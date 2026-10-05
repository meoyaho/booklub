// js/recorder.js
export class Recorder {
  constructor(stream) {
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
  }

  pause() {
    if (this.mediaRecorder.state === 'recording') this.mediaRecorder.pause();
  }

  resume() {
    if (this.mediaRecorder.state === 'paused') this.mediaRecorder.resume();
  }

  stop() {
    return new Promise((resolve) => {
      this.mediaRecorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: 'audio/webm' }));
      };
      this.mediaRecorder.stop();
    });
  }
}
