/**
 * Procedural impact audio — advanced modal synthesis.
 *
 * What makes this sound like real materials instead of video-game beeps:
 *
 *   1. **Inharmonic partials.** Each material has a list of mode *ratios*
 *      (relative to its fundamental) that aren't clean 2:3:4 harmonics.
 *      That mathematical inharmonicity is what makes a struck steel ball
 *      sound like metal instead of a flute. Real steel spheres vibrate at
 *      approximately 1, 1.59, 2.14, 2.65, 3.16, 3.65… of the fundamental.
 *
 *   2. **Size-dependent pitch.** Ring frequency is inversely proportional
 *      to object size (≈ 1/L for a vibrating body). A small ball rings
 *      higher than a big one of the same material — `sizeExp` controls
 *      how strongly. All modes shift together, preserving timbre.
 *
 *   3. **Velocity-dependent brightness.** Soft taps excite only the
 *      fundamental. Hard hits pour energy into every mode. We scale each
 *      mode's amplitude by `strength ^ (1 + index · 0.25)` so higher modes
 *      fade out faster as the impact gets weaker — exactly how a real body
 *      behaves when struck gently vs. hard.
 *
 *   4. **Cross-material damping.** A collision puts BOTH bodies' voices
 *      in play, each damped by the *other*'s softness. Rubber hitting
 *      steel → rubber thud with a faint, heavily-damped steel ring
 *      (because rubber absorbs the impulse before steel can ring freely).
 *
 *   5. **Attack transient.** A short filtered-noise burst models the
 *      physical contact click — highpass for metals, lowpass for rubbery
 *      thuds, bandpass for mercury. This is the "onset" that happens
 *      before any ringing sets in.
 *
 *   6. **Stereo localization.** Every impact is panned based on its x
 *      position on the canvas — balls on the left sound from your left
 *      speaker.
 *
 *   7. **Per-material reverb send.** Bright materials (glass, ice, steel)
 *      send more of their bright modes to the reverb bus than dull ones.
 *
 *   8. **Detune jitter.** Each mode picks up ±1.5 % random detune per hit
 *      so repeated collisions don't phase-lock into identical sounds.
 *
 *   9. **Master compressor.** A gentle 4:1 compressor after the master bus
 *      keeps cascaded shatters from clipping.
 */

import { PHYS } from '../core/config.js';
import { W } from '../core/world.js';
import { clamp } from '../core/math.js';

/** Reference radius — modal frequencies in the profiles below are the values
 *  for a ball of this radius. Smaller balls shift up; larger shift down. */
const REF_R = 20;

/**
 * @typedef {Object} Mode
 * @property {number} ratio   multiplier against the material's baseFreq
 * @property {number} amp     0..1 relative amplitude of this mode
 * @property {number} decay   seconds to silence
 */
/**
 * @typedef {Object} Profile
 * @property {number}  resonance   how "ringable" the material is (rubber ~0.2, glass 1.0)
 * @property {number}  baseFreq    fundamental at REF_R, in Hz
 * @property {Mode[]}  modes
 * @property {number}  sizeExp     pitch scaling exponent (≈1 for solid bodies)
 * @property {Object}  attack      transient noise burst descriptor
 * @property {number}  reverbSend  0..1, per-material wet-bus send level
 */

/** @type {Record<string, Profile>} */
const MODAL = {
  // Steel ball bearing — sharp click, bright clang with rich inharmonic overtones.
  // Ratios modelled on a solid-sphere resonance pattern (not flute-like harmonics).
  STEEL: {
    resonance: 1.00,
    baseFreq: 2800,
    sizeExp: 1.0,
    modes: [
      { ratio: 1.000, amp: 1.00, decay: 0.55 },
      { ratio: 1.594, amp: 0.75, decay: 0.47 },
      { ratio: 2.136, amp: 0.58, decay: 0.40 },
      { ratio: 2.653, amp: 0.45, decay: 0.33 },
      { ratio: 3.155, amp: 0.34, decay: 0.27 },
      { ratio: 3.650, amp: 0.25, decay: 0.22 },
      { ratio: 4.128, amp: 0.18, decay: 0.17 },
      { ratio: 4.593, amp: 0.12, decay: 0.14 }
    ],
    attack: { type: 'highpass', freq: 6000, dur: 0.010, amp: 0.50 },
    reverbSend: 0.35
  },
  // Rubber — almost entirely damping. Short low thud, single weak body mode.
  RUBBER: {
    resonance: 0.18,
    baseFreq: 140,
    sizeExp: 0.8,
    modes: [
      { ratio: 1.000, amp: 0.80, decay: 0.07 },
      { ratio: 2.3,   amp: 0.25, decay: 0.04 }
    ],
    attack: { type: 'lowpass', freq: 780, dur: 0.075, amp: 0.85 },
    reverbSend: 0.05
  },
  // Glass — brittle bell. Bright click, high sparse modes, fast decay.
  GLASS: {
    resonance: 1.00,
    baseFreq: 3500,
    sizeExp: 1.1,
    modes: [
      { ratio: 1.000, amp: 1.00, decay: 0.28 },
      { ratio: 1.94,  amp: 0.78, decay: 0.22 },
      { ratio: 2.88,  amp: 0.55, decay: 0.18 },
      { ratio: 3.82,  amp: 0.38, decay: 0.14 },
      { ratio: 4.76,  amp: 0.24, decay: 0.11 },
      { ratio: 5.70,  amp: 0.14, decay: 0.09 }
    ],
    attack: { type: 'highpass', freq: 8000, dur: 0.008, amp: 0.45 },
    reverbSend: 0.40
  },
  // Bowling ball — dense damped polymer. Deep low thud, three modes only.
  BOWLING: {
    resonance: 0.45,
    baseFreq: 90,
    sizeExp: 0.9,
    modes: [
      { ratio: 1.000, amp: 1.00, decay: 0.24 },
      { ratio: 2.20,  amp: 0.45, decay: 0.16 },
      { ratio: 3.70,  amp: 0.18, decay: 0.10 }
    ],
    attack: { type: 'lowpass', freq: 320, dur: 0.065, amp: 0.55 },
    reverbSend: 0.10
  },
  // Neon — light plastic. Mid fundamentals, short modes, soft onset.
  NEON: {
    resonance: 0.50,
    baseFreq: 900,
    sizeExp: 1.0,
    modes: [
      { ratio: 1.000, amp: 0.90, decay: 0.14 },
      { ratio: 1.60,  amp: 0.50, decay: 0.10 },
      { ratio: 2.40,  amp: 0.25, decay: 0.07 }
    ],
    attack: { type: 'lowpass', freq: 2000, dur: 0.015, amp: 0.42 },
    reverbSend: 0.15
  },
  // Gold — soft dense metal. Warmer and lower than steel, long sustain.
  GOLD: {
    resonance: 0.90,
    baseFreq: 560,
    sizeExp: 1.0,
    modes: [
      { ratio: 1.000, amp: 1.00, decay: 0.80 },
      { ratio: 1.62,  amp: 0.60, decay: 0.62 },
      { ratio: 2.28,  amp: 0.40, decay: 0.48 },
      { ratio: 2.97,  amp: 0.25, decay: 0.35 },
      { ratio: 3.71,  amp: 0.16, decay: 0.26 }
    ],
    attack: { type: 'highpass', freq: 4000, dur: 0.012, amp: 0.38 },
    reverbSend: 0.30
  },
  // Plasma — sci-fi: two beating modes near each other + bright overtones.
  PLASMA: {
    resonance: 0.40,
    baseFreq: 380,
    sizeExp: 0.9,
    modes: [
      { ratio: 1.000, amp: 0.85, decay: 0.12 },
      { ratio: 1.042, amp: 0.85, decay: 0.12 },   // ~16 Hz beat with the fundamental
      { ratio: 5.10,  amp: 0.40, decay: 0.07 },
      { ratio: 8.30,  amp: 0.22, decay: 0.05 }
    ],
    attack: { type: 'highpass', freq: 5000, dur: 0.022, amp: 0.55 },
    reverbSend: 0.20
  },
  // Ice — crystalline. Very bright click, sharp ephemeral modes.
  ICE: {
    resonance: 0.95,
    baseFreq: 1700,
    sizeExp: 1.0,
    modes: [
      { ratio: 1.000, amp: 1.00, decay: 0.15 },
      { ratio: 1.41,  amp: 0.60, decay: 0.11 },
      { ratio: 2.12,  amp: 0.38, decay: 0.08 },
      { ratio: 2.82,  amp: 0.22, decay: 0.06 }
    ],
    attack: { type: 'highpass', freq: 9000, dur: 0.018, amp: 0.62 },
    reverbSend: 0.35
  },
  // Magnet — ferromagnetic steel cousin. Darker + damper than steel.
  MAGNET: {
    resonance: 0.65,
    baseFreq: 1200,
    sizeExp: 1.0,
    modes: [
      { ratio: 1.000, amp: 0.90, decay: 0.19 },
      { ratio: 1.50,  amp: 0.55, decay: 0.14 },
      { ratio: 2.11,  amp: 0.30, decay: 0.10 },
      { ratio: 2.75,  amp: 0.18, decay: 0.08 }
    ],
    attack: { type: 'highpass', freq: 3500, dur: 0.013, amp: 0.42 },
    reverbSend: 0.20
  },
  // Mercury — liquid, no tonal ring. Just a wet bandpass burst.
  MERCURY: {
    resonance: 0.30,
    baseFreq: 0,
    sizeExp: 0,
    modes: [],
    attack: { type: 'bandpass', freq: 1200, dur: 0.070, amp: 0.60, q: 2.4 },
    reverbSend: 0.15
  }
};

const FALLBACK = MODAL.NEON;

export const Snd = {
  /** @type {AudioContext | null} */  ctx: null,
  /** @type {GainNode | null} */      master: null,
  /** @type {AudioNode | null} */     wetBus: null,
  enabled: true,

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window['webkitAudioContext'])();

      this.master = this.ctx.createGain();
      this.master.gain.value = PHYS.volume;

      // Gentle master compressor — cascaded shatters + dense collisions would
      // otherwise clip.
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 8;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.14;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);

      // Short room — noise-impulse convolver, low wet level
      const conv = this.ctx.createConvolver();
      const sr = this.ctx.sampleRate, irLen = sr * 0.8;
      const buf = this.ctx.createBuffer(2, irLen, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.5);
      }
      conv.buffer = buf;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.10;
      conv.connect(wet);
      wet.connect(comp);
      this.wetBus = conv;
    } catch (e) {
      this.ctx = null;
    }
  },

  applyVolume() { if (this.master) this.master.gain.value = PHYS.volume; },

  /* ------------------------------------------------------------------ */
  /*  Primitives                                                         */
  /* ------------------------------------------------------------------ */

  bonk(freq, vol, dur, timbre) {
    if (!this.ctx || !PHYS.sound || PHYS.volume <= 0) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = timbre || 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.4), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    if (this.wetBus) g.connect(this.wetBus);
    o.start(t); o.stop(t + dur);
  },

  noise(dur, vol, cutoff) {
    if (!this.ctx || !PHYS.sound || PHYS.volume <= 0) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  },

  /** Internal — short filtered noise burst for an attack transient. */
  _attack(atk, gain, destination) {
    if (!this.ctx || gain <= 0) return;
    const t = this.ctx.currentTime;
    const len = Math.max(32, Math.floor(this.ctx.sampleRate * atk.dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = atk.type;
    f.frequency.value = atk.freq;
    if (atk.type === 'bandpass' && atk.q) f.Q.value = atk.q;
    const g = this.ctx.createGain();
    g.gain.value = gain * atk.amp;
    src.connect(f); f.connect(g); g.connect(destination);
    src.start(t);
  },

  /* ------------------------------------------------------------------ */
  /*  Modal synthesis                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Emit one ball's voice at `strength`, damped by the other participant's
   * softness. Accepts a ball so it can extract size (pitch) + x (pan).
   *
   * @param {{mat: any, x?: number, r?: number}} ball
   * @param {number} strength          0..1 overall loudness
   * @param {number} otherSoftness     0..1 other participant's `deform`
   */
  emitMaterialSound(ball, strength, otherSoftness = 0.15) {
    if (!this.ctx || !PHYS.sound || PHYS.volume <= 0) return;
    const mat = ball.mat;
    const profile = MODAL[mat.name] || FALLBACK;
    if (strength <= 0.005) return;

    const t = this.ctx.currentTime;

    // Stereo panner — position in the world maps to L/R in the mix.
    const cw = W.cw || window.innerWidth || 1000;
    const px = ball.x ?? cw / 2;
    const panVal = clamp((px / cw) * 2 - 1, -0.85, 0.85);
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = panVal;
    pan.connect(this.master);

    // Attack transient — softened by the other body's damping
    const attackAmp = strength * (1 - otherSoftness * 0.35);
    this._attack(profile.attack, attackAmp, pan);

    // Modes — pitch + brightness depend on size + velocity
    const modeScale = strength * (1 - otherSoftness * 0.75) * profile.resonance;
    if (modeScale < 0.003) return;

    const radius = ball.r || REF_R;
    const sizeScale = Math.pow(REF_R / radius, profile.sizeExp || 0);
    const reverbSend = profile.reverbSend ?? 0.15;

    for (let i = 0; i < profile.modes.length; i++) {
      const m = profile.modes[i];

      // Velocity-dependent excitation — higher modes need harder hits to
      // ring. `strength ^ (i · 0.25)` gives a smooth falloff.
      const excitation = Math.pow(strength, i * 0.25);
      const peak = m.amp * modeScale * excitation * 0.85;
      if (peak < 0.001) continue;

      const freq = profile.baseFreq * m.ratio * sizeScale;
      // Guard against silly-high frequencies on very small balls
      if (freq > 18000 || freq < 30) continue;

      const detune = 1 + (Math.random() - 0.5) * 0.015;

      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * detune, t);

      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + m.decay);

      o.connect(g);
      g.connect(pan);

      // bright modes also tickle the reverb bus
      if (this.wetBus && freq > 1500 && reverbSend > 0) {
        const send = this.ctx.createGain();
        send.gain.value = reverbSend * 0.6;
        g.connect(send);
        send.connect(this.wetBus);
      }

      o.start(t);
      o.stop(t + m.decay + 0.05);
    }
  },

  /* ------------------------------------------------------------------ */
  /*  Events used by the physics layer                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Ball-on-ball collision. Each participant rings in its own location,
   * damped by the other's softness.
   */
  collision(a, b, magnitude) {
    const strength = clamp(magnitude * 0.003, 0.04, 0.9);
    const softA = a.mat.deform ?? 0.2;
    const softB = b.mat.deform ?? 0.2;
    this.emitMaterialSound(a, strength, softB);
    this.emitMaterialSound(b, strength, softA);
  },

  /** Ball-on-wall / ball-on-peg — walls count as hard infrastructure. */
  wall(ball, magnitude) {
    const strength = clamp(magnitude * 0.0025, 0.035, 0.7);
    this.emitMaterialSound(ball, strength, 0.15);
  },

  /** Fragile material shatter — play at full strength + add bright shards. */
  shatter(ball) {
    if (!this.ctx || !PHYS.sound || PHYS.volume <= 0) return;
    this.emitMaterialSound(ball, 0.95, 0);
    if (ball.mat.name === 'ICE') {
      this.bonk(1800, 0.22, 0.06, 'sine');
      this.bonk(2600, 0.15, 0.05, 'sine');
    } else if (ball.mat.name === 'GLASS') {
      this.bonk(2500, 0.20, 0.09, 'sine');
      this.bonk(3300, 0.14, 0.07, 'sine');
      this.bonk(4800, 0.10, 0.05, 'sine');
    }
    this.noise(0.30, 0.18, 5500);
  },

  click()  { this.bonk(800, 0.04, 0.02, 'square'); },
  spring() { this.bonk(450, 0.04, 0.04, 'triangle'); }
};
