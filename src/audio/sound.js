/**
 * Procedural impact sounds using **modal synthesis** — the physical way
 * real objects make noise.
 *
 * When you strike an object you hear two things:
 *   1. An **attack transient** — a broadband click/thud at the moment of
 *      contact. We model this as a short filtered noise burst. Hard materials
 *      (steel, glass) get a highpass click; soft ones (rubber, bowling) get
 *      a lowpass thump; mercury gets a bandpass wet-slap.
 *   2. A stack of **resonant modes** — the object's natural frequencies, each
 *      with its own amplitude and decay time. Steel rings at many sharp
 *      high modes for a long time; rubber has essentially no modes.
 *
 * Cross-material damping: when two bodies collide, each one's ring is
 * damped by how *soft* the other one is. A rubber ball absorbs most of the
 * impulse before a steel ball can ring — so rubber-on-steel ≈ rubber
 * thud, steel-on-steel ≈ full metallic clang.
 *
 * Every mode picks up a ±1% random detune on each hit so repeated
 * collisions don't sound identical.
 *
 * Lazy-inits on first user gesture. Master gain mirrors PHYS.volume.
 */

import { PHYS } from '../core/config.js';
import { clamp } from '../core/math.js';

/**
 * @typedef {Object} Mode
 * @property {number} freq   Hz
 * @property {number} amp    0..1
 * @property {number} decay  seconds to silence
 */

/**
 * @typedef {Object} Attack
 * @property {'lowpass'|'highpass'|'bandpass'} type
 * @property {number} freq    filter cutoff / center
 * @property {number} dur     seconds
 * @property {number} amp     0..1
 * @property {number} [q]     bandpass Q
 */

/**
 * @typedef {Object} Profile
 * @property {number}  resonance  overall ringability (rubber ~0.2, steel/glass ~1.0)
 * @property {Attack}  attack
 * @property {Mode[]}  modes
 */

/** @type {Record<string, Profile>} */
const MODAL = {
  // Clear metallic ring — many high partials, long decay. Sharp highpass click.
  STEEL: {
    resonance: 1.00,
    attack: { type: 'highpass', freq: 6000, dur: 0.010, amp: 0.50 },
    modes: [
      { freq: 2800, amp: 1.00, decay: 0.55 },
      { freq: 4100, amp: 0.70, decay: 0.42 },
      { freq: 5700, amp: 0.50, decay: 0.30 },
      { freq: 7200, amp: 0.32, decay: 0.22 }
    ]
  },
  // Mostly damping: a low thud with barely any tonal content.
  RUBBER: {
    resonance: 0.18,
    attack: { type: 'lowpass', freq: 780, dur: 0.055, amp: 0.75 },
    modes: [
      { freq: 140, amp: 0.60, decay: 0.06 }
    ]
  },
  // Brittle chime — very bright click + high-freq modes, short decays.
  GLASS: {
    resonance: 1.00,
    attack: { type: 'highpass', freq: 8000, dur: 0.009, amp: 0.42 },
    modes: [
      { freq: 3500, amp: 1.00, decay: 0.28 },
      { freq: 5200, amp: 0.70, decay: 0.20 },
      { freq: 7800, amp: 0.45, decay: 0.14 }
    ]
  },
  // Heavy plastic thud — low modes, LP click, zero brightness.
  BOWLING: {
    resonance: 0.45,
    attack: { type: 'lowpass', freq: 320, dur: 0.065, amp: 0.55 },
    modes: [
      { freq: 90,  amp: 1.00, decay: 0.24 },
      { freq: 180, amp: 0.45, decay: 0.16 }
    ]
  },
  // Light plastic — short modes, a touch brighter than bowling.
  NEON: {
    resonance: 0.50,
    attack: { type: 'lowpass', freq: 2000, dur: 0.015, amp: 0.42 },
    modes: [
      { freq: 900,  amp: 0.90, decay: 0.13 },
      { freq: 1400, amp: 0.40, decay: 0.09 }
    ]
  },
  // Warm, lower + longer than steel; soft metal bell.
  GOLD: {
    resonance: 0.90,
    attack: { type: 'highpass', freq: 4000, dur: 0.012, amp: 0.38 },
    modes: [
      { freq: 560,  amp: 1.00, decay: 0.75 },
      { freq: 820,  amp: 0.55, decay: 0.55 },
      { freq: 1180, amp: 0.32, decay: 0.40 }
    ]
  },
  // Sci-fi buzz: two close-frequency modes beating against each other.
  PLASMA: {
    resonance: 0.40,
    attack: { type: 'highpass', freq: 5000, dur: 0.022, amp: 0.55 },
    modes: [
      { freq: 380,  amp: 0.85, decay: 0.10 },
      { freq: 396,  amp: 0.85, decay: 0.10 },   // 16 Hz beat
      { freq: 1900, amp: 0.45, decay: 0.07 }
    ]
  },
  // Crystalline crack: very bright attack, sharp ephemeral modes.
  ICE: {
    resonance: 0.95,
    attack: { type: 'highpass', freq: 9000, dur: 0.018, amp: 0.62 },
    modes: [
      { freq: 1700, amp: 1.00, decay: 0.13 },
      { freq: 2400, amp: 0.55, decay: 0.09 },
      { freq: 3600, amp: 0.30, decay: 0.06 }
    ]
  },
  // Darker, damper cousin of steel — ferromagnetic bell.
  MAGNET: {
    resonance: 0.65,
    attack: { type: 'highpass', freq: 3500, dur: 0.013, amp: 0.42 },
    modes: [
      { freq: 1200, amp: 0.90, decay: 0.17 },
      { freq: 1800, amp: 0.45, decay: 0.11 }
    ]
  },
  // Liquid — no tonal modes, just a filtered wet burst.
  MERCURY: {
    resonance: 0.30,
    attack: { type: 'bandpass', freq: 1200, dur: 0.070, amp: 0.60, q: 2.4 },
    modes: []
  }
};

/** Fallback profile if a material has no entry. */
const FALLBACK = MODAL.NEON;

export const Snd = {
  /** @type {AudioContext | null} */  ctx: null,
  /** @type {GainNode | null} */      master: null,
  /** @type {GainNode | null} */      wetBus: null,
  enabled: true,

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window['webkitAudioContext'])();

      this.master = this.ctx.createGain();
      this.master.gain.value = PHYS.volume;
      this.master.connect(this.ctx.destination);

      // cheap reverb: noise-impulse convolver, low wet level
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
      wet.connect(this.ctx.destination);
      this.wetBus = /** @type {any} */ (conv);
    } catch (e) {
      this.ctx = null;
    }
  },

  applyVolume() { if (this.master) this.master.gain.value = PHYS.volume; },

  /* ------------------------------------------------------------------ */
  /*  Primitives                                                         */
  /* ------------------------------------------------------------------ */

  /** Generic pitched ping. Kept for flippers, clicks, explosion booms. */
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

  /** Filtered noise burst. */
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

  /** Internal: play an attack-transient noise burst with arbitrary filter. */
  _attack(atk, gain) {
    if (!this.ctx || gain <= 0) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, Math.max(32, this.ctx.sampleRate * atk.dur), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      // exponential decay envelope shaped into the buffer
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.6);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = atk.type;
    f.frequency.value = atk.freq;
    if (atk.type === 'bandpass' && atk.q) f.Q.value = atk.q;
    const g = this.ctx.createGain();
    g.gain.value = gain * atk.amp;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  },

  /* ------------------------------------------------------------------ */
  /*  Modal synthesis                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Emit a material's voice at `strength` (0..1). `otherSoftness` ∈ [0..1] is
   * the other participant's `deform` — the softer the other body, the more
   * it absorbs our ring. Walls + pegs pass ~0.15 (hard infrastructure).
   */
  emitMaterialSound(mat, strength, otherSoftness = 0.15) {
    if (!this.ctx || !PHYS.sound || PHYS.volume <= 0) return;
    const profile = MODAL[mat.name] || FALLBACK;
    if (strength <= 0.005) return;
    const t = this.ctx.currentTime;

    // attack — broadband onset, lightly dampened by the other body
    const attackAmp = strength * (1 - otherSoftness * 0.35);
    this._attack(profile.attack, attackAmp);

    // modes — heavily dampened by softer partners
    const modeScale = strength * (1 - otherSoftness * 0.75) * profile.resonance;
    if (modeScale < 0.01) return;

    for (const m of profile.modes) {
      const detune = 1 + (Math.random() - 0.5) * 0.02;    // ±1 % variation
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(m.freq * detune, t);

      // short attack to avoid click artefact, exponential decay to silence
      const peak = m.amp * modeScale * 0.3;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + m.decay);

      o.connect(g);
      g.connect(this.master);
      // bright modes route a little to the reverb bus — like real rooms
      if (this.wetBus && m.freq > 1500) g.connect(this.wetBus);

      o.start(t);
      o.stop(t + m.decay + 0.05);
    }
  },

  /* ------------------------------------------------------------------ */
  /*  Events used by the physics layer                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Ball-on-ball collision. Both materials contribute their voices, each
   * damped by the other's softness.
   */
  collision(matA, matB, magnitude) {
    const strength = clamp(magnitude * 0.0014, 0.02, 0.75);
    const softA = matA.deform ?? 0.2;
    const softB = matB.deform ?? 0.2;
    this.emitMaterialSound(matA, strength, softB);
    this.emitMaterialSound(matB, strength, softA);
  },

  /** Ball-on-wall — treat walls as a generic hard material (softness ≈ 0.15). */
  wall(mat, magnitude) {
    const strength = clamp(magnitude * 0.0014, 0.02, 0.55);
    this.emitMaterialSound(mat, strength, 0.15);
  },

  /** Fragile material shatter — high-amp attack + bright modes + noise wash. */
  shatter(mat) {
    if (!this.ctx || !PHYS.sound || PHYS.volume <= 0) return;
    this.emitMaterialSound(mat, 0.95, 0);
    // extra high-freq shards + a noise crackle on top
    if (mat.name === 'ICE') {
      this.bonk(1800, 0.22, 0.06, 'sine');
      this.bonk(2600, 0.15, 0.05, 'sine');
    } else if (mat.name === 'GLASS') {
      this.bonk(2500, 0.20, 0.09, 'sine');
      this.bonk(3300, 0.14, 0.07, 'sine');
      this.bonk(4800, 0.10, 0.05, 'sine');
    }
    this.noise(0.30, 0.18, 5500);
  },

  click()  { this.bonk(800, 0.04, 0.02, 'square'); },
  spring() { this.bonk(450, 0.04, 0.04, 'triangle'); }
};
