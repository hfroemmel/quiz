/**
 * Sound cues (specification 27.1).
 *
 * The sounds come as audio files from `packages/react/src/assets/audio/` and
 * sit in a STATIC registry (`new URL(..., import.meta.url)`): every bundler
 * thereby emits the files as its own artefacts - `import.meta.glob` would be
 * a Vite-specific quirk and would stand in the way of becoming a library. That
 * the registry and the folder match is pinned down by
 * `packages/react/test/audio.test.ts`; a sound file missing at runtime stays
 * silent and blocks nothing.
 *
 * ONLY THE AUDIO MASTER PLAYS BACK. Which client that is is decided by the
 * server (the `client-info` message); remote presentation clients start muted,
 * so that sounds are not heard multiple times with an offset.
 *
 * ALL CUES ARE STATE-DERIVED. They hang off the server state, not off a
 * click: the operator clicks, the server decides, and only the new snapshot
 * triggers the sound. A rejected command therefore stays silent.
 */

export const soundCueIds = [
  /** A player has been awarded the buzz. */
  'buzz',
  /** A new question appears. */
  'question-appear',
  /** The answer options are faded in. */
  'options-appear',
  /** An answer has been logged. */
  'answer-logged',
  'answer-correct',
  'answer-incorrect',
  'score',
  'solution',
  'scene-change',
  'result',
] as const
export type SoundCueId = (typeof soundCueIds)[number]

/**
 * Mapping cue -> file. Several files play at the same time; for "correct"
 * the jingle and applause overlap.
 *
 * It is exported so that a test checks it against the folder: what stands
 * here has to exist, and what exists must not be a countdown or alarm sound
 * (`packages/react/test/audio.test.ts`).
 */
export const cueFilesForTest: Record<SoundCueId, string[]> = {
  buzz: ['buzzer.mp3'],
  'question-appear': ['opener.mp3'],
  'options-appear': ['swoosh.mp3'],
  'answer-logged': ['decide.mp3'],
  'answer-correct': ['correct.mp3', 'applause.wav'],
  'answer-incorrect': ['wrong.mp3'],
  score: ['score.mp3'],
  solution: [],
  'scene-change': [],
  result: [],
}

/**
 * Existing audio files - one per line, addressed bundler-neutrally.
 *
 * `audio.test.ts` checks this list against the folder: what stands here has
 * to exist, and what is in the folder has to stand here.
 */
const urlByName = new Map<string, string>([
  ['applause.wav', new URL('../assets/audio/applause.wav', import.meta.url).href],
  ['buzzer.mp3', new URL('../assets/audio/buzzer.mp3', import.meta.url).href],
  ['correct.mp3', new URL('../assets/audio/correct.mp3', import.meta.url).href],
  ['decide.mp3', new URL('../assets/audio/decide.mp3', import.meta.url).href],
  ['opener.mp3', new URL('../assets/audio/opener.mp3', import.meta.url).href],
  ['score.mp3', new URL('../assets/audio/score.mp3', import.meta.url).href],
  ['swoosh.mp3', new URL('../assets/audio/swoosh.mp3', import.meta.url).href],
  ['wrong.mp3', new URL('../assets/audio/wrong.mp3', import.meta.url).href],
])

/** Only for the inventory test: the names of the registered files. */
export const registeredAudioFilesForTest = [...urlByName.keys()]

/** Missing files are reported once, not on every playback. */
const reportedMissing = new Set<string>()

const elements = new Map<string, HTMLAudioElement>()

function elementFor(name: string): HTMLAudioElement | null {
  const url = urlByName.get(name)
  if (!url) {
    if (!reportedMissing.has(name)) {
      reportedMissing.add(name)
      console.info(`Soundfile fehlt: ${name}. Der Cue bleibt still.`)
    }
    return null
  }
  let element = elements.get(name)
  if (!element) {
    element = new Audio(url)
    element.preload = 'auto'
    elements.set(name, element)
  }
  return element
}

/**
 * Plays a cue. Errors are deliberately swallowed: a sound problem must
 * never stop the live show.
 */
export function playCue(cueId: SoundCueId, options: { enabled: boolean; isAudioMaster: boolean }): void {
  if (!options.enabled || !options.isAudioMaster) return

  for (const name of cueFilesForTest[cueId]) {
    const element = elementFor(name)
    if (!element) continue
    try {
      /*
       * A cue still running is not choked off but played in parallel. Two
       * fast buzzes in a row should both sound.
       */
      const instance = element.paused ? element : (element.cloneNode() as HTMLAudioElement)
      instance.currentTime = 0
      void instance.play().catch(() => undefined)
    } catch {
      // Sound is optional and must never block.
    }
  }
}

/**
 * Releases all sound files again.
 *
 * WHAT FOR: the quiz is deployed as a guest inside a foreign application and
 * removed again - possibly often. Every `Audio` element holds its own
 * buffer and survives the component's removal, because it lives here in a
 * map and not in the tree. Without this cleanup, something would remain
 * behind from every visit.
 *
 * Everything still sounds afterwards: on the next cue the elements are
 * recreated. Only the unlock granted by the user interaction is lost - the
 * view fetches it again the next time it is mounted.
 */
export function releaseAudio(): void {
  for (const element of elements.values()) {
    try {
      element.pause()
      element.removeAttribute('src')
      element.load()
    } catch {
      // Cleanup must never block.
    }
  }
  elements.clear()
}

/**
 * Releases audio output.
 *
 * Browsers only allow audio once a user interaction has happened in THIS
 * document. `load()` alone is not enough for that - only a `play()` inside
 * the interaction lifts the lock. That is why every element here is played
 * muted and immediately reset: nothing is audible, but the later cue is
 * allowed to sound.
 *
 * This has to happen in every window that can output sound - operator AND
 * stage. In the desktop application's stage window, playback is explicitly
 * allowed from the start anyway (see the Electron wrappers); the call does
 * no harm there.
 */
export function unlockAudio(): void {
  for (const name of new Set(Object.values(cueFilesForTest).flat())) {
    const element = elementFor(name)
    if (!element) continue
    try {
      element.muted = true
      void element
        .play()
        .then(() => {
          element.pause()
          element.currentTime = 0
          element.muted = false
        })
        .catch(() => {
          element.muted = false
        })
    } catch {
      // Unlocking is a convenience, not a requirement.
    }
  }
}
