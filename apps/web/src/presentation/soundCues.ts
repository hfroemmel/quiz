/**
 * Sound-Cues (Spezifikation 27.1).
 *
 * Entwurfsentscheidung: Die Cues werden mit der Web Audio API synthetisiert statt aus
 * Audiodateien geladen. Gruende:
 *  - der Offline-Betrieb braucht keine zusaetzlichen Assets;
 *  - ein fehlendes oder nicht ladbares Soundfile kann den Spielablauf nicht blockieren.
 *
 * Wer echte Klaenge verwenden moechte, ersetzt `playCue` durch das Abspielen
 * vorgeladener Dateien. Der uebrige Code bleibt unveraendert, weil Szenen und
 * Uebergaenge ausschliesslich Cue-IDs kennen.
 *
 * NUR DER AUDIO-MASTER SPIELT AB. Welcher Client das ist, entscheidet der Server
 * (`client-info`-Nachricht); entfernte Praesentationsclients starten stumm, damit
 * Sounds nicht mehrfach zeitversetzt zu hoeren sind.
 */

export const soundCueIds = [
  'buzz',
  'question-appear',
  'answer-correct',
  'answer-incorrect',
  'score',
  'solution',
  'scene-change',
  'result',
] as const
export type SoundCueId = (typeof soundCueIds)[number]

interface Tone {
  frequency: number
  durationMs: number
  type: OscillatorType
  gain: number
  /** Verzoegerung relativ zum Cue-Start. */
  delayMs?: number
}

/** Klangprofil je Cue. Zentrale Stelle fuer alle Soundanpassungen. */
const cues: Record<SoundCueId, Tone[]> = {
  buzz: [{ frequency: 220, durationMs: 140, type: 'square', gain: 0.16 }],
  'question-appear': [{ frequency: 520, durationMs: 110, type: 'sine', gain: 0.09 }],
  'answer-correct': [
    { frequency: 660, durationMs: 130, type: 'sine', gain: 0.13 },
    { frequency: 880, durationMs: 220, type: 'sine', gain: 0.13, delayMs: 120 },
  ],
  'answer-incorrect': [
    { frequency: 200, durationMs: 200, type: 'sawtooth', gain: 0.11 },
    { frequency: 150, durationMs: 260, type: 'sawtooth', gain: 0.11, delayMs: 150 },
  ],
  score: [{ frequency: 990, durationMs: 90, type: 'triangle', gain: 0.1 }],
  solution: [{ frequency: 440, durationMs: 260, type: 'sine', gain: 0.1 }],
  'scene-change': [{ frequency: 330, durationMs: 90, type: 'sine', gain: 0.06 }],
  result: [
    { frequency: 523, durationMs: 180, type: 'triangle', gain: 0.12 },
    { frequency: 659, durationMs: 180, type: 'triangle', gain: 0.12, delayMs: 160 },
    { frequency: 784, durationMs: 340, type: 'triangle', gain: 0.12, delayMs: 320 },
  ],
}

let context: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    context ??= new Ctor()
    return context
  } catch {
    // Keine Soundausgabe verfuegbar - der Spielablauf laeuft unveraendert weiter.
    return null
  }
}

/**
 * Spielt einen Cue ab. Fehler werden bewusst verschluckt: Ein Soundproblem darf
 * niemals den Live-Ablauf stoppen.
 */
export function playCue(cueId: SoundCueId, options: { enabled: boolean; isAudioMaster: boolean }): void {
  if (!options.enabled || !options.isAudioMaster) return
  const ctx = audioContext()
  if (!ctx) return

  try {
    if (ctx.state === 'suspended') void ctx.resume()
    const startedAt = ctx.currentTime
    for (const tone of cues[cueId]) {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      const begin = startedAt + (tone.delayMs ?? 0) / 1000
      const end = begin + tone.durationMs / 1000

      oscillator.type = tone.type
      oscillator.frequency.setValueAtTime(tone.frequency, begin)
      gain.gain.setValueAtTime(0.0001, begin)
      gain.gain.exponentialRampToValueAtTime(tone.gain, begin + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, end)

      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start(begin)
      oscillator.stop(end + 0.02)
    }
  } catch {
    // Siehe oben: Sound ist optional und darf nie blockieren.
  }
}

/**
 * Browser erlauben Audio erst nach einer Nutzerinteraktion. Der Operator loest das
 * beim ersten Klick aus; danach ist die Ausgabe bereit.
 */
export function unlockAudio(): void {
  const ctx = audioContext()
  if (ctx && ctx.state === 'suspended') void ctx.resume()
}
