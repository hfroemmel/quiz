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
import { contentThresholds } from './config'

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

/* ------------------------------------------------------------------ *
 * Mehrsprachigkeit
 *
 * EINE FRAGE BLEIBT EINE FRAGE, auch in fuenf Sprachen. Uebersetzungen haengen
 * deshalb AN der Frage und stehen nicht als zweiter Bestand daneben: Die
 * Auswahl (Wiederholungsvermeidung, Fragenplaetze, Pools) rechnet weiter mit
 * genau einer Menge, und eine Sprache umzuschalten kann keine andere Frage
 * ergeben. Was fehlt, faellt auf die Grundsprache zurueck - eine halb
 * uebersetzte Tabelle ist besser als ein leerer Bildschirm.
 * ------------------------------------------------------------------ */

/** Beschriftung je Sprache. Fehlt eine, gilt das `label` daneben. */
export const translatedLabels = z.record(z.string().min(1), z.string().min(1))

/**
 * Eine Sprache, in der das Quiz gespielt werden kann.
 *
 * `label` steht bewusst IN DIESER Sprache ("Deutsch", "English") und nicht in
 * der Sprache der Oberflaeche: Wer die Sprache sucht, sucht ihren eigenen
 * Namen.
 */
export const localeSchema = z.object({
  id: z.string().min(2),
  label: z.string().min(1),
})
export type QuizLocale = z.infer<typeof localeSchema>

/**
 * Der uebersetzbare Teil einer Frage.
 *
 * Die Optionen tragen dieselben Bezeichner wie im Original - gewertet wird
 * gegen `correctOptionId`, und eine Uebersetzung darf die Wertung nicht
 * verschieben. Das Medium darf abweichen: Ein Bild mit deutscher Beschriftung
 * ist in einer anderen Sprache ein anderes Bild.
 */
export const questionTranslationSchema = z.object({
  prompt: z.string().min(1).optional(),
  options: z.array(answerOptionSchema).optional(),
  acceptedAnswerText: z.array(z.string().min(1)).optional(),
  explanation: questionExplanationSchema.optional(),
  media: z
    .object({
      imageAssetId: idSchema.optional(),
      videoAssetId: idSchema.optional(),
    })
    .optional(),
})
export type QuestionTranslation = z.infer<typeof questionTranslationSchema>

export const questionSchema = z.object({
  id: idSchema,
  /**
   * Inhaltlich gleiche Varianten teilen sich eine `repetitionGroupId`.
   * Die Wiederholungsvermeidung behandelt die ganze Gruppe wie eine einzige Frage.
   */
  repetitionGroupId: idSchema.optional(),
  /**
   * Fragenpools, zu denen die Frage gehoert (Schema v2). Ein Pool ist eine
   * INHALTSAUSWAHL - "Saarbruecken" ist genau das: ein Pool, kein Modus und
   * keine Kategorie. Welche Pools ein Spiel zieht, entscheidet `START_GAME`.
   */
  poolIds: z.array(idSchema).min(1),
  /** Zielgruppen, fuer die die Frage taugt (frueher `modeIds`). */
  audiences: z.array(idSchema).min(1),
  difficulty: idSchema,
  categories: z.array(idSchema),
  tags: z.array(idSchema),
  /** BCP-47-Sprachkennung des Frageninhalts, z. B. `de-DE`. */
  locale: z.string().min(2),

  prompt: z.string().min(1),
  questionType: z.enum(questionPresentationTypes),
  evaluationMode: z.enum(evaluationModes),

  options: z.array(answerOptionSchema).optional(),
  correctOptionId: idSchema.optional(),
  /** Fuer muendliche Antworten: erwartete Formulierungen als Hilfe fuer den Moderator. */
  acceptedAnswerText: z.array(z.string().min(1)).optional(),

  media: questionMediaSchema.optional(),
  explanation: questionExplanationSchema.optional(),
  /** Fassungen in anderen Sprachen, nach Sprachkennung. Fehlendes faellt zurueck. */
  translations: z.record(z.string().min(2), questionTranslationSchema).optional(),
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
 * Nur echte Auswahlfragen, die gegen `correctOptionId` verglichen werden. Eine
 * muendliche Antwort braucht jemanden, der sie bewertet - im Kiosk gibt es
 * niemanden. Diese Regel steht hier, weil sowohl die Inhaltsvalidierung als auch
 * die Zustandsmaschine sie brauchen und es sie deshalb genau einmal geben darf.
 *
 * DIE ZAHL DER OPTIONEN ENTSCHEIDET `isChoiceQuestion` und niemand sonst. Eine
 * eigene Untergrenze hier waere eine zweite Regel: Sie liess frueher eine Frage
 * mit einer einzigen Option durch, und am Geraet stand dann eine Zeile da, die
 * zugleich die Loesung war - nicht spielbar, aber gezogen.
 */
export function isSelfServiceAnswerable(question: Question): boolean {
  return question.evaluationMode === 'option-comparison' && isChoiceQuestion(question)
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
      questionTypes: z.array(z.enum(questionPresentationTypes)).optional(),
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
  labels: translatedLabels.optional(),
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

/**
 * Seit Schema v2 traegt das Quizpaket KEINE Farben und Schriften mehr -
 * Darstellung ist Sache des Gastgebers (`quiz-themes`). Ein Theme nennt nur die
 * Gestaltungswelt und seine Branding-Assets.
 */
export const quizThemeSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  /** Gestaltungswelt: `default` oder `kids`. Fehlt sie, gilt `default`. */
  skin: z.enum(themeSkins).optional(),
  logoAssetId: idSchema.optional(),
  presentationAnimationSetId: idSchema.optional(),
})
export type QuizTheme = z.infer<typeof quizThemeSchema>

/**
 * Zielgruppe (Schema v2, frueher "Quizmodus").
 *
 * Der alte Modus verquickte drei Dinge: Zielgruppe, Fragenpool und Gestaltung.
 * Jetzt sind sie getrennt - die Zielgruppe traegt Gestaltung und erlaubte
 * Presets, die Pools sind eine eigene Achse der Inhaltsauswahl, und die Fragen
 * nennen beide direkt (`audiences`, `poolIds`). "Saarbruecken" braucht damit
 * keinen Sondermodus mehr: Es ist ein Pool, waehlbar zu jeder Zielgruppe.
 */
export const audienceConfigSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  themeId: idSchema,
  startVisualAssetId: idSchema.optional(),
  /**
   * Titel, der auf dem Startbild ueber der Grafik steht. Fehlt er, zeigt die
   * Startansicht nur die Grafik - etwa wenn diese den Titel schon enthaelt.
   */
  startTitle: z.string().min(1).optional(),
  /**
   * Zwei, drei Zeilen unter dem Titel: worum es in diesem Quiz geht. Sie sind
   * Werbetext und keine Regel - fehlen sie, steht die Tafel eben ohne sie da.
   */
  startDescription: z.string().min(1).optional(),
  labels: translatedLabels.optional(),
  /** Startbild-Titel je Sprache. */
  startTitles: translatedLabels.optional(),
  /** Startbild-Beschreibung je Sprache. */
  startDescriptions: translatedLabels.optional(),
  allowedPresetIds: z.array(idSchema).min(1),
})
export type AudienceConfig = z.infer<typeof audienceConfigSchema>

/** Ein Fragenpool ist nur Kennung und Beschriftung - die Fragen nennen ihn selbst. */
export const questionPoolSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  labels: translatedLabels.optional(),
})
export type QuestionPool = z.infer<typeof questionPoolSchema>

/**
 * Eine QUIZART - das eine Angebot, das am Pult gewaehlt wird.
 *
 * Zielgruppe, Fragenpool, Theme und die Schwierigkeitswahl sind seit Schema v2
 * getrennte Achsen. Eine Quizart verbindet sie, ohne sie zu verschmelzen: Sie
 * nennt jede einzeln, als Wert, an genau dieser Stelle. "Bremen-Quiz" ist damit
 * eine Zeile in der Konfiguration und keine Bedingung im Code - wer es umhaengt,
 * aendert die Zeile und nichts sonst.
 *
 * WARUM DAS THEME HIER UND NICHT NUR AN DER ZIELGRUPPE STEHT: Zwei Quizarten
 * duerfen dieselbe Zielgruppe und verschiedene Gestaltung haben. Die Zielgruppe
 * behaelt ihr Theme fuer alles, was ohne Quizart startet (Geraet, Kiosk); laeuft
 * ein Spiel MIT Quizart, gilt deren Theme. Es gibt also zu jedem Zeitpunkt genau
 * eine Zuordnung, nicht zwei konkurrierende.
 *
 * DIE SCHWIERIGKEITSWAHL STEHT NICHT ALS SCHALTER DA, sondern folgt aus
 * `presetIds`: Ein einziges Preset heisst, dass es nichts zu waehlen gibt
 * (`quizSupportsDifficulty`). Ein zusaetzliches Feld "unterstuetzt Schwierigkeit"
 * koennte der Liste widersprechen, und dann waere unklar, welches gilt.
 */
export const quizModeSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  labels: translatedLabels.optional(),
  /** Zweite Zeile der Angebotskarte - worum es in diesem Quiz geht. */
  subtitle: z.string().min(1).optional(),
  subtitles: translatedLabels.optional(),
  /** Zielgruppe, in der dieses Quiz spielt. */
  audienceId: idSchema,
  /** Gestaltungswelt dieses Quiz. Muss es in `themes` geben. */
  themeId: idSchema,
  /** Fragenpools. Ohne Angabe spielen alle Pools der Zielgruppe mit. */
  poolIds: z.array(idSchema).min(1).optional(),
  /**
   * Waehlbare Schwierigkeitsgrade, in der Reihenfolge, in der sie angeboten
   * werden. Genau ein Eintrag heisst: keine Auswahl, dieses Preset gilt.
   */
  presetIds: z.array(idSchema).min(1),
  /**
   * Voreinstellung der Schwierigkeitswahl. Ohne Angabe der erste Eintrag.
   *
   * Sie steht getrennt von der Reihenfolge, weil beides verschiedene Fragen
   * beantwortet: Angeboten wird von leicht nach schwer, voreingestellt ist die
   * Stufe, mit der das Haus ueblicherweise spielt.
   */
  defaultPresetId: idSchema.optional(),
})
export type QuizMode = z.infer<typeof quizModeSchema>

/**
 * Bietet diese Quizart eine Schwierigkeitswahl an?
 *
 * EINZIGE QUELLE DIESER ENTSCHEIDUNG - Formular, Server und Validierung fragen
 * hier. Eine Stufe zur Wahl zu stellen, die es nur einmal gibt, waere ein leeres
 * Auswahlfeld vor dem Start.
 */
export function quizSupportsDifficulty(quiz: Pick<QuizMode, 'presetIds'>): boolean {
  return quiz.presetIds.length > 1
}

/** Die voreingestellte Stufe einer Quizart - ohne eigene Angabe die erste. */
export function defaultPresetIdOf(quiz: Pick<QuizMode, 'presetIds' | 'defaultPresetId'>): string {
  const named = quiz.defaultPresetId
  if (named && quiz.presetIds.includes(named)) return named
  return quiz.presetIds[0]!
}

export const categorySchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  labels: translatedLabels.optional(),
})
export const difficultySchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  labels: translatedLabels.optional(),
})
export type Category = z.infer<typeof categorySchema>
export type Difficulty = z.infer<typeof difficultySchema>

export const quizConfigSchema = z.object({
  /** Standardanzahl der Fragenplaetze pro Spiel. Genau eine Quelle der Wahrheit. */
  questionsPerGame: z.number().int().min(1).max(30),
  difficulties: z.array(difficultySchema).min(1),
  categories: z.array(categorySchema).min(1),
  pools: z.array(questionPoolSchema).min(1),
  themes: z.array(quizThemeSchema).min(1),
  presets: z.array(difficultyPresetSchema).min(1),
  audiences: z.array(audienceConfigSchema).min(1),
  /**
   * Die Quizarten, die am Pult zur Wahl stehen (siehe `quizModeSchema`).
   *
   * OPTIONAL, weil nicht jede Aufstellung sie braucht: Ein Kioskgeraet startet
   * mit Zielgruppe und Preset und kennt gar keine Quizarten. Fehlt die Liste,
   * gibt es am Pult nichts auszuwaehlen - und das ist eine Aussage der
   * Konfiguration, kein Programmfehler.
   */
  quizzes: z.array(quizModeSchema).optional(),
  /**
   * Sprachen, in denen dieses Quiz gespielt werden kann.
   *
   * Fehlt die Liste oder steht nur eine Sprache darin, gibt es nichts zu
   * waehlen und der Umschalter erscheint nicht. Die erste ist die Grundsprache:
   * Was nicht uebersetzt ist, kommt aus ihr.
   */
  locales: z.array(localeSchema).min(1).optional(),
  /**
   * Beschriftungen der Oberflaeche je Sprache.
   *
   * Die deutschen Fassungen stehen im Code (`@hfroemmel/quiz-react`); hier
   * stehen nur Abweichungen und die uebrigen Sprachen. So laeuft ein Quiz ohne
   * einen einzigen Eintrag, und wer einen Satz anders haben will, braucht dafuer
   * keine neue Programmfassung.
   */
  interfaceStrings: z.record(z.string().min(2), z.record(z.string().min(1), z.string())).optional(),
})
export type QuizConfig = z.infer<typeof quizConfigSchema>

/* ------------------------------------------------------------------ *
 * Paket (Abschnitt 24.3)
 * ------------------------------------------------------------------ */

/** Inhaltsprofile der Pipeline. `no-video` traegt die Offline-Apps. */
export const contentProfiles = ['full', 'no-video'] as const
export type ContentProfile = (typeof contentProfiles)[number]

export const quizPackageManifestSchema = z.object({
  schemaVersion: z.string().min(1),
  contentVersion: z.string().min(1),
  /** Inhaltsprofil des Builds. Fehlt es (aeltere Pakete), gilt `full`. */
  profile: z.enum(contentProfiles).optional(),
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
export const QUIZ_PACKAGE_SCHEMA_VERSION = '2.0.0'

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

/* Former names, kept for one release so that hosts can migrate. */
/** @deprecated Renamed to `translatedLabels`. */
export const uebersetzteBeschriftung = translatedLabels
