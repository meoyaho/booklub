// js/decibelMonitor.js
import { rmsToDb, classifyLevel } from './decibel.js';

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
    const rms = Math.sqrt(sumSquares / this.data.length);
    const db = rmsToDb(rms);
    this.onLevel(classifyLevel(db));

    requestAnimationFrame(() => this._tick());
  }

  stop() {
    this.running = false;
    this.audioCtx.close();
  }
}
