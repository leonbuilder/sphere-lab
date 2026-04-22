/**
 * Web Audio synthesis — procedural impact + noise sounds.
 *
 * Per-material sound profiles: each `MATERIALS[name]` entry has a pitch +
 * timbre, and `SOUND_DUR` gives its characteristic decay time (metals ring
 * long, plasma is a quick zap, bowling is a heavy long thud). Collisions
 * use the denser participant's profile — what a material sounds like is
 * mostly about its own stiffness.
 *
 * Master gain mirrors `PHYS.volume` (0..1). Lazy-inits on first user gesture.
 */

import { PHYS } from '../core/config.js';
import { clamp } from '../core/math.js';

/** Characteristic impact decay time per material (seconds). */
const SOUND_DUR = {
  STEEL:   0.10,   // metallic ring
  RUBBER:  0.12,   // deep muted thud
  GLASS:   0.06,   // crisp tink
  BOWLING: 0.18,   // heavy long thud
  NEON:    0.06,
  GOLD:    0.14,   // warm sustained ding
  PLASMA:  0.04,   // electric zap
  ICE:     0.05,   // cold snap
  MAGNET:  0.08,   // muted metallic
  MERCURY: 0.09    // watery
};

export const Snd = {
  /** @type {AudioContext | null} */  ctx: null,
  /** @type {GainNode | null} */      master: null,
  /** @type {ConvolverNode | null} */ wetBus: null,
  enabled: true,

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window['webkitAudioContext'])();
      this.master = this.ctx.createGain();
      this.master.gain.value = PHYS.volume;
      this.master.connect(this.ctx.destination);

      const conv = this.ctx.createConvolver();
      const sr = this.ctx.sampleRate, irLen = sr * 0.8;
      const buf = this.ctx.createBuffer(2, irLen, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.5);
      }
      conv.buffer = buf;
      const wet = this.ctx.createGain(); wet.gain.value = 0.12;
      conv.connect(wet); wet.connect(this.ctx.destination);
      this.wetBus = conv;
    } catch (e) {
      this.ctx = null;
    }
  },

  applyVolume() { if (this.master) this.master.gain.value = PHYS.volume; },

  /**
   * Short pitched thud. The pitch ramp models a body's natural decay —
   * starts at `freq`, falls to ~40% over the duration.
   */
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

  /**
   * Ball-on-ball collision — use the stiffer (denser) participant's voice,
   * with material-specific overtones added.
   */
  collision(matA, matB, magnitude) {
    const dominant = matA.density > matB.density ? matA : matB;
    this._impact(dominant, magnitude);
    // soft material joins with a quieter shadow tone
    const other = dominant === matA ? matB : matA;
    if (other.pitch !== dominant.pitch) {
      this.bonk(other.pitch, clamp(magnitude * 0.0012, 0.01, 0.15), SOUND_DUR[other.name] * 0.7, other.timbre);
    }
  },

  /** Ball-on-wall — uses the ball's own material, lowered pitch. */
  wall(mat, magnitude) {
    this._impact(mat, magnitude * 0.8, 0.7);
  },

  /**
   * Shared impact synthesis with material-specific overtones:
   *   STEEL — high-freq noise burst on big hits (metallic shimmer)
   *   ICE   — high-freq noise burst always (cold crackle)
   *   GLASS — add an octave-up secondary tone (sparkle)
   *   BOWLING — low-freq noise (cavernous boom)
   *   PLASMA — detuned second tone (beat frequency)
   */
  _impact(mat, magnitude, pitchMul = 1) {
    const pitch = mat.pitch * pitchMul * (1 + Math.min(magnitude * 0.001, 0.35));
    const vol   = clamp(magnitude * 0.003, 0.02, 0.35);
    const dur   = (SOUND_DUR[mat.name] || 0.08) * (0.8 + Math.min(magnitude * 0.0008, 0.5));
    this.bonk(pitch, vol, dur, mat.timbre);

    switch (mat.name) {
      case 'STEEL':
        if (magnitude > 60) this.noise(0.03, vol * 0.45, 8000);
        break;
      case 'ICE':
        this.noise(0.04, vol * 0.55, 6500);
        break;
      case 'GLASS':
        this.bonk(pitch * 2.0, vol * 0.35, 0.05, 'sine');
        break;
      case 'BOWLING':
        this.noise(0.10, vol * 0.4, 500);
        break;
      case 'PLASMA':
        this.bonk(pitch * 1.06, vol * 0.5, dur, 'sawtooth'); // slight detune = buzz
        break;
      case 'MERCURY':
        this.noise(0.05, vol * 0.3, 1200);  // muted watery slosh
        break;
    }
    if (magnitude > 150) this.noise(0.05, Math.min(0.12, magnitude * 0.0008), 4000);
  },

  /** Catastrophic break — glass/ice specific. */
  shatter(mat) {
    if (!this.ctx || !PHYS.sound || PHYS.volume <= 0) return;
    const pitch = mat.pitch * 1.4;
    this.bonk(pitch,       0.32, 0.06, 'square');
    this.bonk(pitch * 1.35, 0.22, 0.10, 'triangle');
    this.noise(0.28, 0.18, 5500);
    if (mat.name === 'ICE') {
      this.bonk(1700, 0.20, 0.05, 'sine');
    } else if (mat.name === 'GLASS') {
      this.bonk(2400, 0.15, 0.07, 'sine');
      this.bonk(3100, 0.10, 0.05, 'sine');
    }
  },

  click()  { this.bonk(800, 0.04, 0.02, 'square'); },
  spring() { this.bonk(450, 0.04, 0.04, 'triangle'); }
};
