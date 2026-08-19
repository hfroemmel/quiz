/**
 * Sound-Cues (Spezifikation 27.1).
 *
 * Die Klaenge kommen als Audiodateien aus `apps/web/src/assets/audio/`. Sie werden
 * ueber `import.meta.glob` eingesammelt: Was da ist, klingt; was fehlt, bleibt
 * still. Ein fehlendes Soundfile kann damit weder den Build noch den Spielablauf
 * blockieren - und sobald eine Datei nachgeliefert wird, ist sie ohne Codeaenderung
 * in Betrieb.
 *
 * NUR DER AUDIO-MASTER SPIELT AB. Welcher Client das ist, entscheidet der Server
 * (`client-info`-Nachricht); entfernte Praesentationsclients starten stumm, damit
 * Sounds nicht mehrfach zeitversetzt zu hoeren sind.
 *
 * ALLE CUES SIND ZUSTANDSABGELEITET. Sie haengen am Serverzustand, nicht an einem
 * Klick: Der Operator klickt, der Server entscheidet, und erst der neue Snapshot
 * loest den Klang aus. Ein abgewiesener Befehl bleibt deshalb still.
 */

export const soundCueIds = [
  /** Ein Spieler hat den Zuschlag bekommen. */
  'buzz',
  /** Eine neue Frage erscheint. */
  'question-appear',
  /** Die Antwortmoeglichkeiten werden eingeblendet. */
  'options-appear',
  /** Eine Antwort wurde eingeloggt. */
  'answer-logged',
  'answer-correct',
  'answer-incorrect',
  /** Jede volle Sekunde der Enthuellung. */
  'countdown-tick',
  /** Der Countdown ist abgelaufen. */
  'countdown-end',
  'score',
  'solution',
  'scene-change',
  'result',
] as const
export type SoundCueId = (typeof soundCueIds)[number]

/**
 * Zuordnung Cue -> Datei. Mehrere Dateien spielen gleichzeitig; bei "richtig"
 * liegen Jingle und Applaus uebereinander.
 */
const cueFiles: Record<SoundCueId, string[]> = {
  buzz: ['buzzer.mp3'],
  'question-appear': ['opener.mp3'],
  'options-appear': ['swoosh.mp3'],
  'answer-logged': ['decide.mp3'],
  'answer-correct': ['correct.mp3', 'applause.wav'],
  'answer-incorrect': ['wrong.mp3'],
  'countdown-tick': ['tick.mp3'],
  'countdown-end': ['ring.mp3'],
  score: ['score.mp3'],
  solution: [],
  'scene-change': [],
  result: [],
}

/**
 * Vorhandene Audiodateien. `eager` laedt nur die Adressen, nicht die Inhalte -
 * die Dateien landen als eigene Build-Artefakte im Paket.
 */
const files = import.meta.glob('../assets/audio/*.{mp3,wav,ogg,m4a}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const urlByName = new Map(Object.entries(files).map(([path, url]) => [path.split('/').pop() ?? path, url]))

/** Fehlende Dateien werden einmal gemeldet, nicht bei jedem Abspielen. */
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
 * Spielt einen Cue ab. Fehler werden bewusst verschluckt: Ein Soundproblem darf
 * niemals den Live-Ablauf stoppen.
 */
export function playCue(cueId: SoundCueId, options: { enabled: boolean; isAudioMaster: boolean }): void {
  if (!options.enabled || !options.isAudioMaster) return

  for (const name of cueFiles[cueId]) {
    const element = elementFor(name)
    if (!element) continue
    try {
      /*
       * Ein noch laufender Cue wird nicht abgewuergt, sondern parallel gespielt.
       * Beim Ticken des Countdowns ueberlappt sonst jede Sekunde die vorige.
       */
      const instance = element.paused ? element : (element.cloneNode() as HTMLAudioElement)
      instance.currentTime = 0
      void instance.play().catch(() => undefined)
    } catch {
      // Sound ist optional und darf nie blockieren.
    }
  }
}

/**
 * Browser erlauben Audio erst nach einer Nutzerinteraktion. Der Operator loest das
 * beim ersten Klick aus; danach ist die Ausgabe bereit.
 *
 * Im Buehnenfenster gibt es keine Interaktion - dort erlaubt die Desktop-Anwendung
 * die Wiedergabe ausdruecklich (siehe `apps/desktop/src/main.ts`).
 */
export function unlockAudio(): void {
  for (const name of new Set(Object.values(cueFiles).flat())) {
    const element = elementFor(name)
    if (!element) continue
    try {
      element.load()
    } catch {
      // Vorladen ist Komfort, kein Muss.
    }
  }
}
