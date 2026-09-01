let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Beep corto: reporte nuevo. */
export function playBeep(): void {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.22, c.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.35);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.4);
}

/** Alarma triple: alerta de barco silencioso. */
export function playAlertBeep(): void {
  const c = getCtx();
  if (!c) return;
  [660, 880, 660].forEach((f, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.value = f;
    const t = c.currentTime + i * 0.18;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  });
}
