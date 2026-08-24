/**
 * Inhaltsmodell des Quiz (Spezifikation Abschnitt 16, 15 und 7.2).
 *
 * Wichtigste Regeln, die hier strukturell erzwungen werden:
 *  - Praesentationsform (`presentationType`), Bewertungsverfahren (`evaluationMode`)
 *    und Medium sind getrennt modelliert. Das Legacy-Feld `type: "image"` gibt es nicht mehr.
 *  - Die richtige Antwort wird immer explizit ueber `correctOptionId` referenziert.
 *    Die Legacy-Annahme "option_1 ist richtig" ist abgeschafft.
 *  - Medien werden ueber stabile Asset-IDs referenziert, nie ueber Dateinamen.
 *  - Laufzeitdaten (z. B. das Legacy-Feld `playCount`) gehoeren nicht in den Inhalt.
 */
import { z } from 'zod'
import { contentThresholds } from './config.ts'

/**
 * Praesentationsform einer Frage auf dem Buehnenscreen.
 *
 * `person` ist eine Auswahlfrage mit Bild wie `image-choice` - sie unterscheidet
 * sich ausschliesslich in der Komposition: Das Portraet traegt die Ansicht und
 * steht gross links, Frage und Antworten stehen daneben. Fachlich laeuft sie
 * durch dieselben Regeln.
 */
export const questionPresentationTypes = [
  'text-choice',
  'image-choice',
  'person',
  'image-reveal',
  'video-then-question',
] as const
export type QuestionPresentationType = (typeof questionPresentationTypes)[number]

/**
 * Braucht dieser Fragetyp Antwortoptionen?
 *
 * EINZIGE QUELLE DIESER ENTSCHEIDUNG - Validierung und Inhaltspflege fragen
 * hier. Wer einen Typ ergaenzt, muss ihn hier einsortieren; eine vergessene
 * Aufzaehlung an anderer Stelle faellt sonst erst im Betrieb auf.
 */
export function presentationNeedsOptions(type: QuestionPresentationType): boolean {
  return type === 'text-choice' || type === 'image-choice' || type === 'person'
}

/** Braucht dieser Fragetyp ein Bild? */
export function presentationNeedsImage(type: QuestionPresentationType): boolean {
  return type === 'image-choice' || type === 'person' || type === 'image-reveal'
}

/** Wie ein Versuch bewertet wird. */
export const evaluationModes = ['option-comparison', 'manual-correct-incorrect'] as const
export type EvaluationMode = (typeof evaluationModes)[number]

/** Bezeichner: klein geschrieben, damit IDs nicht durch Gross-/Kleinschreibung zerfallen. */
const idSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, 'ID darf nur a-z, 0-9, Punkt, Bindestrich und Unterstrich enthalten')

export const answerOptionSchema = z.object({
  id: idSchema,
  text: z.string().min(1),
})
export type AnswerOption = z.infer<typeof answerOptionSchema>

export const questionExplanationSchema = z.object({
  /** Kurzfassung fuer Moderator und Operator. */
  summary: z.string().optional(),
  /** Ausfuehrlicher Hintergrund. */
  details: z.string().optional(),
  /** Quellenangabe (redaktionell, nicht automatisch oeffentlich). */
  source: z.string().optional(),
  /** Regiehinweise: nur fuer Moderator und Operator. */
  moderatorNotes: z.string().optional(),
})
export type QuestionExplanation = z.infer<typeof questionExplanationSchema>

export const questionMediaSchema = z.object({
  imageAssetId: idSchema.optional(),
  videoAssetId: idSchema.optional(),
})
export type QuestionMedia = z.infer<typeof questionMediaSchema>

export const questionSchema = z.object({
  id: idSchema,
  /**
   * Inhaltlich gleiche Varianten teilen sich eine `repetitionGroupId`.
   * Die Wiederholungsvermeidung behandelt die ganze Gruppe wie eine einzige Frage.
   */
  repetitionGroupId: idSchema.optional(),
  modeIds: z.array(idSchema).min(1),
  difficultyId: idSchema,
  categoryIds: z.array(idSchema),
  tags: z.array(idSchema),

  prompt: z.string().min(1),
  presentationType: z.enum(questionPresentationTypes),
  evaluationMode: z.enum(evaluationModes),

  options: z.array(answerOptionSchema).optional(),
  correctOptionId: idSchema.optional(),
  /** Fuer muendliche Antworten: erwartete Formulierungen als Hilfe fuer den Moderator. */
  acceptedAnswerText: z.array(z.string().min(1)).optional(),

  media: questionMediaSchema.optional(),
  explanation: questionExplanationSchema.optional(),
  enabled: z.boolean(),
})
export type Question = z.infer<typeof questionSchema>

/**
 * Ist die Frage eine echte Auswahlfrage?
 *
 * EINZIGE QUELLE DIESER ENTSCHEIDUNG. Validierung, Engine, Befehlsfreigabe und
 * Projektion fragen hier - und nur hier -, ob Antwortleisten, Buchstabentasten und
 * der automatische Vergleich gegen `correctOptionId` ueberhaupt Sinn ergeben.
 *
 * Fragen mit weniger als zwei Optionen sind keine Auswahl: Eine einzelne Option
 * waere die Loesung selbst. Sie laufen deshalb ueberall als freie Antwort - der
 * Saal sieht keine Ein-Zeilen-Auswahl, und der Operator bewertet von Hand.
 */
export function isChoiceQuestion(question: Pick<Question, 'options'>): boolean {
  return (question.options?.length ?? 0) >= contentThresholds.minChoiceOptionCount
}

/**
 * Kann diese Frage ohne Operator beantwortet werden?
 *
 * Nur Fragen mit Antwortoptionen, die gegen `correctOptionId` verglichen werden.
 * Eine muendliche Antwort braucht jemanden, der sie bewertet - im Kiosk gibt es
 * niemanden. Diese Regel steht hier, weil sowohl die Inhaltsvalidierung als auch
 * die Zustandsmaschine sie brauchen und es sie deshalb genau einmal geben darf.
 */
export function isSelfServiceAnswerable(question: Question): boolean {
  return question.evaluationMode === 'option-comparison' && (question.options?.length ?? 0) > 0
}

export const mediaAssetSchema = z.object({
  id: idSchema,
  kind: z.enum(['image', 'video', 'audio']),
  /** Pfad relativ zum Asset-Wurzelverzeichnis des Pakets. Nie absolut, nie mit "..". */
  filename: z
    .string()
    .min(1)
    .refine((value) => !value.startsWith('/') && !value.includes('..') && !/^[a-zA-Z]:/.test(value), {
      message: 'Asset-Pfade muessen relativ sein und duerfen kein ".." enthalten',
    }),
  mimeType: z.string().min(1),
  credit: z.string().optional(),
  sourceUrl: z.string().optional(),
  checksum: z.string().optional(),
})
export type MediaAsset = z.infer<typeof mediaAssetSchema>

/* ------------------------------------------------------------------ *
 * Konfiguration: Modi, Themes, Schwierigkeits-Presets, Fragenplaetze
 * ------------------------------------------------------------------ */

export const questionSlotRuleSchema = z.object({
  id: idSchema,
  /** Frei waehlbare Beschriftung fuer Operator-Diagnose und Validierungsbericht. */
  label: z.string().optional(),
  /**
   * Fehlende Filter bedeuten "beliebig". Ein Sonderwert wie der String `random`
   * ist deshalb bewusst nicht noetig.
   */
  filters: z
    .object({
      difficultyIds: z.array(idSchema).optional(),
      presentationTypes: z.array(z.enum(questionPresentationTypes)).optional(),
      /**
       * Bewertungsverfahren. Ein Fragenplatz fuer das Touchgeraet filtert auf
       * `option-comparison`: Eine muendlich zu bewertende Frage koennte dort
       * niemand aufloesen.
       */
      evaluationModes: z.array(z.enum(evaluationModes)).optional(),
      categoryIds: z.array(idSchema).optional(),
      tags: z.array(idSchema).optional(),
    })
    .default({}),
})
export type QuestionSlotRule = z.infer<typeof questionSlotRuleSchema>

/**
 * Taugt dieses Preset fuer die Selbstbedienung am Touchgeraet?
 *
 * Nur wenn JEDER Fragenplatz ausschliesslich auswertbare Fragen zulaesst. Das
 * wird aus den Filtern abgeleitet und nicht zusaetzlich erklaert: Eine zweite
 * Angabe koennte von den Filtern abweichen, und dann waere unklar, welche gilt.
 */
export function isSelfServicePreset(preset: DifficultyPreset): boolean {
  return preset.slots.every(
    (slot) =>
      slot.filters.evaluationModes?.length === 1 && slot.filters.evaluationModes[0] === 'option-comparison',
  )
}

export const difficultyPresetSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  /**
   * Ein Preset ist eine dramaturgische Ablaufkonfiguration, kein globaler Filter.
   * `easy` darf daher einzelne mittelschwere Fragenplaetze enthalten.
   */
  slots: z.array(questionSlotRuleSchema).min(1),
})
export type DifficultyPreset = z.infer<typeof difficultyPresetSchema>

/**
 * Gestaltungswelt eines Themes.
 *
 * `stage` ist die dunkle Buehne des Erwachsenenquiz. `kids` ist die
 * illustrierte Karlchen-Welt mit gezeichneten Flaechen.
 *
 * WARUM ALS DATENFELD: Der Client darf keine Modusnamen kennen. Ohne dieses
 * Feld muesste irgendwo `if (theme.id === 'kids')` stehen - genau die
 * Modus-Sonderbehandlung, die die Spezifikation ausschliesst. So waehlt die
 * Konfiguration die Welt, und ein neuer Modus bekommt sie ohne Codeaenderung.
 */
export const themeSkins = ['default', 'kids'] as const
export type ThemeSkin = (typeof themeSkins)[number]

export const quizThemeSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  /** Gestaltungswelt: `default` oder `kids`. Fehlt sie, gilt `default`. */
  skin: z.enum(themeSkins).optional(),
  /**
   * ABWEICHUNGEN von der Farbwelt des `skin`, nicht der ganze Satz.
   *
   * Die Farben stehen in `theme.ts`; ein Theme nennt hier nur, was bei ihm
   * anders ist. Fehlt das Feld, gilt die Welt unveraendert. Beim Bauen wird der
   * vollstaendige Satz eingesetzt, damit das Paket allein lesbar bleibt.
   *
   * Schluessel sind CSS-Custom-Properties ohne fuehrende Bindestriche.
   */
  colors: z.record(z.string(), z.string()).optional(),
  logoAssetId: idSchema.optional(),
  typography: z
    .object({
      headingFont: z.string().optional(),
      bodyFont: z.string().optional(),
    })
    .optional(),
  presentationAnimationSetId: idSchema.optional(),
})
export type QuizTheme = z.infer<typeof quizThemeSchema>

export const quizModeSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  /**
   * Ein Modus ist ein konfigurierter Fragenpool. Damit wird der Legacy-Widerspruch
   * geloest, dass `adults`/`kids` Werte des Feldes `mode` sind, `Saarbruecken`
   * aber eine Kategorie ist: eine regionale Auswahl ist einfach ein Modus mit
   * entsprechendem Kategorie-Filter. Kein Sondercode in der Engine.
   */
  questionFilter: z
    .object({
      legacyModes: z.array(idSchema).optional(),
      categoryIds: z.array(idSchema).optional(),
      tags: z.array(idSchema).optional(),
    })
    .default({}),
  themeId: idSchema,
  startVisualAssetId: idSchema.optional(),
  /**
   * Titel, der auf dem Startbild ueber der Grafik steht. Fehlt er, zeigt die
   * Startansicht nur die Grafik - etwa wenn diese den Titel schon enthaelt.
   */
  startTitle: z.string().min(1).optional(),
  allowedPresetIds: z.array(idSchema).min(1),
})
export type QuizMode = z.infer<typeof quizModeSchema>

export const categorySchema = z.object({ id: idSchema, label: z.string().min(1) })
export const difficultySchema = z.object({ id: idSchema, label: z.string().min(1) })
export type Category = z.infer<typeof categorySchema>
export type Difficulty = z.infer<typeof difficultySchema>

export const quizConfigSchema = z.object({
  /** Standardanzahl der Fragenplaetze pro Spiel. Genau eine Quelle der Wahrheit. */
  questionsPerGame: z.number().int().min(1).max(30),
  difficulties: z.array(difficultySchema).min(1),
  categories: z.array(categorySchema).min(1),
  themes: z.array(quizThemeSchema).min(1),
  presets: z.array(difficultyPresetSchema).min(1),
  modes: z.array(quizModeSchema).min(1),
})
export type QuizConfig = z.infer<typeof quizConfigSchema>

/* ------------------------------------------------------------------ *
 * Paket (Abschnitt 24.3)
 * ------------------------------------------------------------------ */

export const quizPackageManifestSchema = z.object({
  schemaVersion: z.string().min(1),
  contentVersion: z.string().min(1),
  createdAt: z.string().min(1),
  sourceRevision: z.string().optional(),
  questionsFile: z.string().min(1),
  configFile: z.string().min(1),
  assets: z.array(mediaAssetSchema),
  checksum: z.string().min(1),
})
export type QuizPackageManifest = z.infer<typeof quizPackageManifestSchema>

/** Das im Speicher geladene, validierte Paket. */
export interface QuizPackage {
  manifest: QuizPackageManifest
  config: QuizConfig
  questions: Question[]
  assetsById: Map<string, MediaAsset>
  /** Absoluter Pfad des Verzeichnisses, in dem `assets/` liegt. */
  rootDir: string
}

/** Aktuelle Schemaversion des Quizpakets. Aenderungen erfordern eine Migration. */
export const QUIZ_PACKAGE_SCHEMA_VERSION = '1.0.0'

/* ------------------------------------------------------------------ *
 * Live-Hotfixes (Abschnitt 25)
 * ------------------------------------------------------------------ */

/** Nur diese Felder duerfen live gepatcht werden. */
export const patchableQuestionFieldsSchema = questionSchema
  .pick({
    prompt: true,
    options: true,
    correctOptionId: true,
    acceptedAnswerText: true,
    explanation: true,
    media: true,
    enabled: true,
  })
  .partial()
export type PatchableQuestionFields = z.infer<typeof patchableQuestionFieldsSchema>

export const questionPatchSchema = z.object({
  id: z.string().min(1),
  questionId: idSchema,
  baseContentVersion: z.string().min(1),
  changes: patchableQuestionFieldsSchema,
  reason: z.string().optional(),
  createdAt: z.string().min(1),
  createdBy: z.literal('operator'),
  /**
   * `next-use`: Der Patch wirkt erst, wenn die Frage das naechste Mal gezogen wird.
   * `immediate-confirmed`: Der Operator hat "Jetzt uebernehmen" ausdruecklich bestaetigt,
   * die Aenderung geht sofort auf den Buehnenscreen.
   */
  applyMode: z.enum(['next-use', 'immediate-confirmed']),
})
export type QuestionPatch = z.infer<typeof questionPatchSchema>
