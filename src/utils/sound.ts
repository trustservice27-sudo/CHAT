// Web Audio API synthesized harmonic chime notification sound (zero external asset dependency)
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        sharedAudioCtx = new AudioContextClass();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

// Unlock audio context on user interaction (resolves mobile Safari/Chrome autoplay restrictions)
export function unlockAudioContext() {
  getAudioContext();
}

if (typeof window !== 'undefined') {
  const unlockEvents = ['pointerdown', 'keydown', 'touchstart'];
  const handler = () => {
    unlockAudioContext();
    unlockEvents.forEach((ev) => window.removeEventListener(ev, handler));
  };
  unlockEvents.forEach((ev) => window.addEventListener(ev, handler, { passive: true }));
}

export function playNotificationSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Harmonic double chime (High bell tone: C6 at 1046.5Hz followed by G6 at 1568Hz)
    const tones = [
      { freq: 1046.5, start: now, duration: 0.28, gain: 0.15 },
      { freq: 1567.98, start: now + 0.07, duration: 0.32, gain: 0.18 },
      { freq: 2093.0, start: now + 0.14, duration: 0.22, gain: 0.10 },
    ];

    tones.forEach((tone) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(tone.freq, tone.start);

      // Acoustic exponential decay
      gainNode.gain.setValueAtTime(0.0001, tone.start);
      gainNode.gain.exponentialRampToValueAtTime(tone.gain, tone.start + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, tone.start + tone.duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(tone.start);
      osc.stop(tone.start + tone.duration);
    });
  } catch {
    // Ignore audio autoplay limitations gracefully
  }
}
