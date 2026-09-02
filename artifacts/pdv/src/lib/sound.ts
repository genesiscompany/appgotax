let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

export function playNewOrderSound() {
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();

    const playTone = (freq: number, startTime: number, duration: number, vol = 0.5) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(vol, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    };

    const now = ctx.currentTime;
    // Primeira batida: ding-dong grave
    playTone(1047, now,        0.22, 0.55);
    playTone(1319, now + 0.25, 0.22, 0.55);
    // Segunda batida: reforço
    playTone(1047, now + 0.55, 0.22, 0.45);
    playTone(1319, now + 0.78, 0.30, 0.45);
    // Terceira batida: finaliza forte
    playTone(1047, now + 1.15, 0.18, 0.4);
    playTone(1319, now + 1.35, 0.18, 0.4);
    playTone(1568, now + 1.55, 0.35, 0.5);
  } catch (e) {
    console.warn("Audio not available:", e);
  }
}

export function playStatusSound() {
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, now);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch { /* ignore */ }
}
