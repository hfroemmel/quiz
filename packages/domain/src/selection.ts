/**
 * Fragenauswahl und Wiederholungsvermeidung (Spezifikation 17).
 *
 * DRY-Regel: Fragenfilter und Wiederholungslogik existieren ausschliesslich hier.
 * Die Funktion ist rein und bekommt Zufall injiziert, damit Tests mit gesetztem
 * Seed reproduzierbar sind.
 *
 * Warum eine "Frischeklasse" statt "immer die aelteste Frage"?
 * Eine rein deterministische Auswahl wirkt im Live-Betrieb starr und vorhersehbar.
 * Deshalb wird zuerst die aelteste noch verfuegbare Klasse bestimmt und darin
 * zufaellig gewaehlt - leicht zugunsten aelterer Fragen gewichtet.
 *
 * Beispiel: 25 passende Kandidaten, alle schon einmal gespielt.
 *   windowSize = max(3, ceil(25 * 0,2)) = 5
 *   -> es wird unter den 5 am laengsten nicht gespielten Fragen gewuerfelt,
 *      wobei die aelteste etwa doppelt so wahrscheinlich ist wie die fuenfte.
 */
import {
  selectionTuning,
  type Question,
  type QuestionSlotRule,
  type QuizMode,
} from '@quiz/contracts'

/** Zufallsquelle: injizierbar, damit Tests deterministisch laufen. */
export type Rng = () => number

/** Erzeugt einen reproduzierbaren Zufallsgenerator (mulberry32). */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Letzte Nutzung einer Frage bzw. Wiederholungsgruppe im Veranstaltungstag. */
export interface UsageSummary {
  /** Zeitpunkt der letzten Nutzung. */
  lastUsedAtMs: number
  /** Wie oft insgesamt genutzt. Nur fuer Diagnose und Bericht. */
  useCount: number
}

export interface SelectionInput {
  slot: QuestionSlotRule
  slotIndex: number
  /** Bereits nach Modus gefilterter Pool. */
  pool: Question[]
  /** Im aktuellen Spiel bereits verwendete Frage-IDs. */
  excludeQuestionIds: ReadonlySet<string>
  /** Im aktuellen Spiel bereits verwendete Wiederholungsgruppen. */
  excludeRepetitionGroupIds: ReadonlySet<string>
  /** Globale Nutzungshistorie des Veranstaltungstags, adressiert ueber `repetitionKey`. */
  usage: ReadonlyMap<string, UsageSummary>
  rng: Rng
}

export interface SelectionRationale {
  slotId: string
  slotIndex: number
  /** Kandidaten nach Slotfiltern und `enabled`. */
  matchingCandidates: number
  /** Kandidaten nach Ausschluss der im Spiel bereits verwendeten Fragen/Gruppen. */
  availableCandidates: number
  /** Aus welcher Frischeklasse wurde gezogen? */
  freshnessClass: 'never-used' | 'least-recently-used'
  /** Groesse des Fensters, aus dem gezogen wurde. */
  windowSize: number
  text: string
}

export type SelectionResult =
  | { ok: true; question: Question; rationale: SelectionRationale }
  | { ok: false; rationale: SelectionRationale; message: string }

/**
 * Schluessel der Wiederholungsvermeidung. Fragen derselben `repetitionGroupId`
 * gelten als dieselbe Frage - etwa dieselbe Frage mit anderem Bild oder
 * zielgruppenspezifischer Formulierung.
 */
export function repetitionKey(question: Question): string {
  return question.repetitionGroupId ?? question.id
}

/** Pool eines Quizmodus. Der Modus ist ein konfigurierter Filter, kein Sondercode. */
export function poolForMode(questions: Question[], mode: QuizMode): Question[] {
  const filter = mode.questionFilter
  return questions.filter((question) => {
    if (!question.enabled) return false
    if (!question.modeIds.includes(mode.id) && !matchesLegacyModes(question, filter.legacyModes)) return false
    if (filter.categoryIds?.length && !filter.categoryIds.some((id) => question.categoryIds.includes(id))) {
      return false
    }
    if (filter.tags?.length && !filter.tags.some((tag) => question.tags.includes(tag))) return false
    return true
  })
}

function matchesLegacyModes(question: Question, legacyModes: string[] | undefined): boolean {
  if (!legacyModes?.length) return false
  return legacyModes.some((mode) => question.modeIds.includes(mode))
}

/** Erfuellt die Frage alle Filter des Fragenplatzes? Fehlender Filter = beliebig. */
export function matchesSlot(question: Question, slot: QuestionSlotRule): boolean {
  if (!question.enabled) return false
  const { difficultyIds, presentationTypes, evaluationModes, categoryIds, tags } = slot.filters
  if (difficultyIds?.length && !difficultyIds.includes(question.difficultyId)) return false
  if (presentationTypes?.length && !presentationTypes.includes(question.presentationType)) return false
  if (evaluationModes?.length && !evaluationModes.includes(question.evaluationMode)) return false
  if (categoryIds?.length && !categoryIds.some((id) => question.categoryIds.includes(id))) return false
  if (tags?.length && !tags.every((tag) => question.tags.includes(tag))) return false
  return true
}

/** Fenstergroesse fuer die Auswahl unter bereits genutzten Fragen. */
export function candidateWindowSize(candidateCount: number): number {
  return Math.max(selectionTuning.minWindowSize, Math.ceil(candidateCount * selectionTuning.windowFraction))
}

export function selectQuestionForSlot(input: SelectionInput): SelectionResult {
  const { slot, slotIndex, pool, excludeQuestionIds, excludeRepetitionGroupIds, usage, rng } = input

  // 1. Nach Slotfiltern und `enabled` filtern.
  const matching = pool.filter((question) => matchesSlot(question, slot))

  // 2. Im aktuellen Spiel bereits verwendete Fragen und Wiederholungsgruppen ausschliessen.
  const available = matching.filter(
    (question) =>
      !excludeQuestionIds.has(question.id) && !excludeRepetitionGroupIds.has(repetitionKey(question)),
  )

  const baseRationale = {
    slotId: slot.id,
    slotIndex,
    matchingCandidates: matching.length,
    availableCandidates: available.length,
  }

  if (available.length === 0) {
    const rationale: SelectionRationale = {
      ...baseRationale,
      freshnessClass: 'never-used',
      windowSize: 0,
      text: `Kein Kandidat für Fragenplatz "${slot.id}" (passend: ${matching.length}, nach Ausschluss: 0).`,
    }
    return {
      ok: false,
      rationale,
      message:
        matching.length === 0
          ? `Für den Fragenplatz "${slot.id}" gibt es im gewählten Modus keine passende Frage. Bitte anderes Preset oder anderen Modus wählen.`
          : `Alle passenden Fragen für "${slot.id}" wurden in diesem Spiel bereits verwendet. Bitte Preset anpassen oder Fragenpool erweitern.`,
    }
  }

  // 3. Noch nie genutzte Kandidaten bilden die hoechste Frischeklasse.
  const neverUsed = available.filter((question) => !usage.has(repetitionKey(question)))
  if (neverUsed.length > 0) {
    const picked = pickUniform(neverUsed, rng)
    return {
      ok: true,
      question: picked,
      rationale: {
        ...baseRationale,
        freshnessClass: 'never-used',
        windowSize: neverUsed.length,
        text: `Zufällig aus ${neverUsed.length} heute noch nicht gespielten Fragen gewählt.`,
      },
    }
  }

  // 4./5./6. Nach letzter Nutzung sortieren und aus einem kleinen aeltesten Fenster ziehen.
  const sorted = [...available].sort((a, b) => {
    const aUsed = usage.get(repetitionKey(a))?.lastUsedAtMs ?? 0
    const bUsed = usage.get(repetitionKey(b))?.lastUsedAtMs ?? 0
    if (aUsed !== bUsed) return aUsed - bUsed
    // Stabiler Tiebreak, damit die Auswahl bei gleichem Zeitstempel reproduzierbar ist.
    return a.id.localeCompare(b.id)
  })
  const windowSize = Math.min(sorted.length, candidateWindowSize(sorted.length))
  const window = sorted.slice(0, windowSize)
  const picked = pickWeightedTowardsOlder(window, rng)

  return {
    ok: true,
    question: picked,
    rationale: {
      ...baseRationale,
      freshnessClass: 'least-recently-used',
      windowSize,
      text: `Pool erschöpft: gewichtete Auswahl aus den ${windowSize} am längsten nicht gespielten Fragen.`,
    },
  }
}

function pickUniform<T>(items: T[], rng: Rng): T {
  const index = Math.min(items.length - 1, Math.floor(rng() * items.length))
  return items[index]!
}

/**
 * Zieht aus dem Fenster, leicht zugunsten aelterer Eintraege gewichtet.
 * `olderBias = 0` waere Gleichverteilung, `1` eine lineare Gewichtung.
 */
function pickWeightedTowardsOlder<T>(window: T[], rng: Rng): T {
  const bias = selectionTuning.olderBias
  const weights = window.map((_, index) => 1 + bias * (window.length - 1 - index))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let ticket = rng() * total
  for (let index = 0; index < window.length; index += 1) {
    ticket -= weights[index]!
    if (ticket <= 0) return window[index]!
  }
  return window[window.length - 1]!
}

/**
 * Sichtbare Optionsreihenfolge fuer ein Spiel. Das Mischen aendert die Auswertung
 * nicht, weil immer gegen `correctOptionId` verglichen wird (Spezifikation 16.3).
 */
export function shuffleOptionOrder(question: Question, rng: Rng): string[] {
  const ids = (question.options ?? []).map((option) => option.id)
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(rng() * (index + 1))
    const current = ids[index]!
    ids[index] = ids[swapWith]!
    ids[swapWith] = current
  }
  return ids
}
