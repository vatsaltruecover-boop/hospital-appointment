// Web Audio API Hospital Dual-Tone Chime & Speech Synthesizer

class QueueAudioNotifier {
  constructor() {
    this.audioCtx = null;
    this.isMuted = false;
  }

  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // Play airport/hospital 2-tone melodic chime (C5 -> E5 -> G5)
  playChime() {
    if (this.isMuted) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;

      // Note 1: C5 (523.25 Hz)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.55);

      // Note 2: E5 (659.25 Hz)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.18);
      gain2.gain.setValueAtTime(0, now + 0.18);
      gain2.gain.linearRampToValueAtTime(0.35, now + 0.23);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.75);

      // Note 3: G5 (783.99 Hz)
      const osc3 = this.audioCtx.createOscillator();
      const gain3 = this.audioCtx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(783.99, now + 0.38);
      gain3.gain.setValueAtTime(0, now + 0.38);
      gain3.gain.linearRampToValueAtTime(0.4, now + 0.43);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      osc3.connect(gain3);
      gain3.connect(this.audioCtx.destination);
      osc3.start(now + 0.38);
      osc3.stop(now + 1.1);
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }

  // Speak voice announcement after chime
  announceToken(tokenNumber, room = 'Cabin 104') {
    if (this.isMuted) return;
    this.playChime();

    if ('speechSynthesis' in window) {
      setTimeout(() => {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(`Token number ${tokenNumber}, please proceed to ${room}`);
          utterance.rate = 0.95;
          utterance.pitch = 1.05;
          utterance.volume = 0.9;
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.warn('Speech synthesis error:', err);
        }
      }, 700);
    }
  }
}

export const queueAudio = new QueueAudioNotifier();
