// Web Audio API Synthesizer for POS System Sound Effects

class SoundManager {
  private audioCtx: AudioContext | null = null;
  public enabled: boolean = true;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Authentic scanner beep (1760Hz, 80ms)
  playBeep() {
    if (!this.enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime); // A6 note - crisp supermarket scan sound

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Audio not permitted or supported
    }
  }

  // Payment completed success chime (two-tone ascending)
  playSuccess() {
    if (!this.enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      // First tone (E5 ~659Hz) then (A5 ~880Hz)
      osc1.frequency.setValueAtTime(659.25, now);
      osc1.frequency.setValueAtTime(880, now + 0.12);

      osc2.frequency.setValueAtTime(1318.5, now + 0.12); // High harmonic

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.12);
      osc1.stop(now + 0.45);
      osc2.stop(now + 0.45);
    } catch {
      // Audio not permitted
    }
  }

  // Out-of-stock or invalid action error buzz
  playError() {
    if (!this.enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.setValueAtTime(140, now + 0.1);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Audio error
    }
  }

  // Cash drawer opening sound (mechanical clang)
  playCashDrawer() {
    if (!this.enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Metal hit
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.15);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Audio error
    }
  }

  // Subtle button click
  playClick() {
    if (!this.enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch {
      // Audio error
    }
  }
}

export const soundManager = new SoundManager();

