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
  'score',
  'solution',
  'scene-change',
  'result',
] as const
export type SoundCueId = (typeof soundCueIds)[number]

/**
 * Zuordnung Cue -> Datei. Mehrere Dateien spielen gleichzeitig; bei "richtig"
 * liegen Jingle und Applaus uebereinander.
 *
 * Sie ist exportiert, damit ein Test sie gegen den Ordner haelt: Was hier steht,
 * muss es geben, und was es gibt, darf kein Countdown- oder Weckerton sein
 * (`apps/web/test/audio.test.ts`).
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

  for (const name of cueFilesForTest[cueId]) {
    const element = elementFor(name)
    if (!element) continue
    try {
      /*
       * Ein noch laufender Cue wird nicht abgewuergt, sondern parallel gespielt.
       * Zwei schnelle Buzzer hintereinander sollen beide klingen.
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
 * Gibt alle Klangdateien wieder frei.
 *
 * WOFUER: Als Gast in einer fremden Anwendung wird das Quiz eingesetzt und
 * wieder entfernt - womoeglich oft. Jedes `Audio`-Element haelt einen eigenen
 * Puffer und ueberlebt das Entfernen der Komponente, weil es hier in einer Karte
 * liegt und nicht im Baum. Ohne dieses Aufraeumen bliebe von jedem Besuch etwas
 * zurueck.
 *
 * Danach klingt weiterhin alles: Beim naechsten Cue werden die Elemente neu
 * angelegt. Verloren geht nur die Freigabe durch die Nutzerinteraktion - die
 * Ansicht holt sie sich beim naechsten Einsetzen erneut.
 */
export function releaseAudio(): void {
  for (const element of elements.values()) {
    try {
      element.pause()
      element.removeAttribute('src')
      element.load()
    } catch {
      // Aufraeumen darf nie blockieren.
    }
  }
  elements.clear()
}

/**
 * Gibt die Tonausgabe frei.
 *
 * Browser erlauben Audio erst, nachdem in DIESEM Dokument eine Nutzerinteraktion
 * stattgefunden hat. `load()` allein genuegt dafuer nicht - erst ein `play()`
 * innerhalb der Interaktion hebt die Sperre. Deshalb wird jedes Element hier
 * stumm angespielt und sofort wieder zurueckgesetzt: hoerbar ist nichts, aber der
 * spaetere Cue darf klingen.
 *
 * Das muss in jedem Fenster passieren, das Ton ausgeben kann - Operator UND
 * Buehne. Im Buehnenfenster der Desktop-Anwendung ist die Wiedergabe ohnehin
 * ausdruecklich erlaubt (siehe `apps/desktop/src/main.ts`); der Aufruf schadet
 * dort nicht.
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
      // Freigeben ist Komfort, kein Muss.
    }
  }
}
