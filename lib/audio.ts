// =============================================================================
// Tiny Web-Audio-API sound effect engine. Synthesizes simple chip-tune blips
// rather than loading audio files. Safe to import in SSR — all work is gated
// behind `typeof window`.
// =============================================================================

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let enabled = true;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Win = window as any;
  const Ctor: typeof AudioContext | undefined = Win.AudioContext || Win.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.18; // overall volume cap so the whole game isn't loud
  masterGain.connect(ctx.destination);
  return ctx;
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

export function isSoundEnabled(): boolean {
  return enabled;
}

/** Resume the audio context after a user gesture (required by Chrome autoplay). */
export function resumeAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
}

/**
 * Play a single oscillator-driven blip.
 *  - freq:   frequency in Hz
 *  - dur:    duration in seconds
 *  - type:   oscillator wave shape
 *  - sweep:  if provided, frequency at end of envelope (linear ramp)
 *  - vol:    peak gain
 */
function blip(opts: {
  freq: number;
  dur: number;
  type?: OscillatorType;
  sweep?: number;
  vol?: number;
  delay?: number;
}) {
  if (!enabled) return;
  const c = getCtx();
  if (!c || !masterGain) return;
  const t0 = c.currentTime + (opts.delay ?? 0);
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = opts.type ?? "square";
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.sweep !== undefined) {
    osc.frequency.linearRampToValueAtTime(opts.sweep, t0 + opts.dur);
  }
  const vol = opts.vol ?? 0.5;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.005);   // tiny attack to avoid click
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + opts.dur + 0.02);
}

// ===== Named SFX =====

export const SFX = {
  cursor:   () => blip({ freq: 880, dur: 0.06, type: "square", vol: 0.25 }),
  confirm:  () => blip({ freq: 660, dur: 0.08, type: "square", vol: 0.4, sweep: 990 }),
  cancel:   () => blip({ freq: 440, dur: 0.08, type: "square", vol: 0.35, sweep: 220 }),
  hit:      () => blip({ freq: 220, dur: 0.10, type: "sawtooth", vol: 0.4, sweep: 110 }),
  crit:     () => {
    blip({ freq: 880, dur: 0.06, type: "square", vol: 0.45 });
    blip({ freq: 1320, dur: 0.10, type: "square", vol: 0.45, delay: 0.05, sweep: 1760 });
  },
  catch:    () => {
    [880, 1100, 1320, 1760].forEach((f, i) => blip({ freq: f, dur: 0.08, type: "square", vol: 0.4, delay: i * 0.1 }));
  },
  faint:    () => blip({ freq: 440, dur: 0.4, type: "triangle", vol: 0.5, sweep: 80 }),
  levelup:  () => {
    [523, 659, 784, 1047].forEach((f, i) => blip({ freq: f, dur: 0.12, type: "square", vol: 0.4, delay: i * 0.08 }));
  },
  heal:     () => blip({ freq: 660, dur: 0.18, type: "sine", vol: 0.4, sweep: 990 }),
  shop:     () => blip({ freq: 990, dur: 0.08, type: "square", vol: 0.4, sweep: 660 }),
  evolution:() => {
    [330, 415, 523, 659, 830, 1047].forEach((f, i) =>
      blip({ freq: f, dur: 0.15, type: "square", vol: 0.4, delay: i * 0.12 })
    );
  },
} as const;

export type SfxName = keyof typeof SFX;

export function play(name: SfxName) {
  try { SFX[name](); } catch { /* swallow, sound is non-critical */ }
}
