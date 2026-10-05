// js/decibelMonitor.js
import { createLevelTracker } from './decibel.js';

export class DecibelMonitor {
  constructor(stream, onLevel) {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
    const source = this.audioCtx.createMediaStreamSource(stream);
    source.connect(this.analyser);

    this.data = new Float32Array(this.analyser.fftSize);
    this.onLevel = onLevel;
    this.tracker = createLevelTracker();
    this.running = true;
    this._tick();
  }

  _tick() {
    if (!this.running) return;
    this.analyser.getFloatTimeDomainData(this.data);

    let sumSquares = 0;
    for (let i = 0; i < this.data.length; i++) {
      sumSquares += this.data[i] * this.data[i];
    }
    const { level, since, db } = this.tracker.update(sumSquares / this.data.length, Date.now());
    this.onLevel(level, db, since);

    requestAnimationFrame(() => this._tick());
  }

  resetLevel() {
    this.tracker.reset(Date.now());
  }

  stop() {
    this.running = false;
    this.audioCtx.close();
  }
}
