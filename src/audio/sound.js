/**
 * Web Audio synthesis — procedural impact + noise sounds with a small
 * convolution reverb send.
 *
 * Lazy-inits on first user gesture (browsers block autoplay otherwise) via
 * `Snd.init()` from mousedown in `src/input/mouse.js`.
 */

import { PHYS } from '../core/config.js';
import { clamp } from '../core/math.js';

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
      this.master.gain.value = 0.25;
      this.master.connect(this.ctx.destination);

      // build a short noise impulse response for a cheap reverb send
      const conv = this.ctx.createConvolver();
      const sr = this.ctx.sampleRate, irLen = sr * 0.8;
      const buf = this.ctx.createBuffer(2, irLen, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < irLen; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.5);
        }
      }
      conv.buffer = buf;
      const wet = this.ctx.createGain(); wet.gain.value = 0.12;
      conv.connect(wet); wet.connect(this.ctx.destination);
      this.wetBus = conv;
    } catch (e) {
      this.ctx = null;
    }
  },

  /** Short pitched thud — the atomic impact sound. */
  bonk(freq, vol, dur, timbre) {
    if (!this.ctx || !PHYS.sound) return;
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

  /** Filtered white noise burst — splash, fizz, explosion tail. */
  noise(dur, vol, cutoff) {
    if (!this.ctx || !PHYS.sound) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    }
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  },

  /** Composite impact sound using both material pitches; denser material dominates timbre. */
  collision(matA, matB, magnitude) {
    const pitch = (matA.pitch + matB.pitch) * 0.5 * (1 + Math.min(magnitude * 0.002, 0.5));
    const vol   = clamp(magnitude * 0.003, 0.02, 0.35);
    const dur   = 0.04 + Math.min(magnitude * 0.0004, 0.18);
    const timbre = matA.density > matB.density ? matA.timbre : matB.timbre;
    this.bonk(pitch, vol, dur, timbre);
    if (magnitude > 80) this.noise(0.05, Math.min(0.12, magnitude * 0.0008), 4000);
  },

  /** Wall collision — slightly lower pitch than free collisions. */
  wall(mat, magnitude) {
    const vol   = clamp(magnitude * 0.0025, 0.02, 0.3);
    const pitch = mat.pitch * 0.7 * (1 + Math.min(magnitude * 0.001, 0.3));
    this.bonk(pitch, vol, 0.06 + Math.min(magnitude * 0.0003, 0.15), mat.timbre);
  },

  click()  { this.bonk(800, 0.04, 0.02, 'square'); },
  spring() { this.bonk(450, 0.04, 0.04, 'triangle'); }
};
