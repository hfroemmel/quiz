/**
 * Welcher Text gilt in welcher Sprache?
 *
 * DIE EINZIGE STELLE, DIE DAS ENTSCHEIDET. Projektion, Validierung und Import
 * fragen hier - stuende die Regel an drei Stellen, faellt eine davon irgendwann
 * anders aus, und der Saal saehe eine Frage auf Deutsch mit englischen
 * Antworten.
 *
 * DIE REGEL IST EINFACH: Gibt es die Uebersetzung, gilt sie. Gibt es sie nicht,
 * gilt das Original. Eine halb uebersetzte Tabelle zeigt gemischte Sprachen -
 * das ist unschoen, aber spielbar; ein leerer Bildschirm ist es nicht.
 */
import type { Question, QuestionTranslation, QuizConfig } from './content'

/** Die Grundsprache: die erste konfigurierte, sonst Deutsch. */
export function baseLocale(config: Pick<QuizConfig, 'locales'>): string {
  return config.locales?.[0]?.id ?? 'de-DE'
}

/**
 * Ist diese Sprache konfiguriert?
 *
 * Ein Sprachwunsch, den der Inhalt nicht kennt, wird nicht abgewiesen, sondern
 * auf die Grundsprache zurueckgeholt: Er kommt aus einem Config File oder einer
 * Adresszeile, und ein Tippfehler dort darf kein Geraet lahmlegen.
 */
export function validLocale(config: Pick<QuizConfig, 'locales'>, desired: string | undefined): string {
  if (!desired) return baseLocale(config)
  const known = config.locales?.some((locale) => locale.id === desired)
  return known ? desired : baseLocale(config)
}

/** Beschriftung in der gewuenschten Sprache - oder die des Originals. */
export function labelFor(
  entry: { label: string; labels?: Record<string, string> },
  locale: string | undefined,
): string {
  return (locale ? entry.labels?.[locale] : undefined) ?? entry.label
}

/**
 * Untertitel in der gewuenschten Sprache - oder der des Originals.
 *
 * Getrennt von `beschriftung`, weil es ihn geben darf oder nicht: Eine Karte
 * ohne zweite Zeile ist kein Fehler, eine ohne Namen schon.
 */
export function subtitleFor(
  entry: { subtitle?: string; subtitles?: Record<string, string> },
  locale: string | undefined,
): string | undefined {
  return (locale ? entry.subtitles?.[locale] : undefined) ?? entry.subtitle
}

/**
 * Die Frage in der gewuenschten Sprache.
 *
 * Zurueck kommt eine Frage, keine Textsammlung: Wer sie weiterreicht, muss
 * nicht wissen, ob sie uebersetzt ist. `id`, `correctOptionId` und alles, was
 * die Auswertung betrifft, bleiben unberuehrt - eine Uebersetzung darf die
 * Wertung nicht verschieben.
 *
 * DIE OPTIONEN WERDEN EINZELN ERSETZT, nicht als Liste ausgetauscht: Eine
 * Uebersetzung, die eine Option vergisst, wuerde sonst die Antwort verlieren,
 * gegen die verglichen wird.
 */
export function questionTextFor(question: Question, locale: string | undefined): Question {
  const translation: QuestionTranslation | undefined = locale ? question.translations?.[locale] : undefined
  if (!translation) return question

  const options = question.options?.map((option) => {
    const fallback = translation.options?.find((entry) => entry.id === option.id)
    return fallback ? { ...option, text: fallback.text } : option
  })

  return {
    ...question,
    prompt: translation.prompt ?? question.prompt,
    ...(options ? { options: options } : {}),
    ...(translation.acceptedAnswerText ? { acceptedAnswerText: translation.acceptedAnswerText } : {}),
    ...(translation.explanation ? { explanation: { ...question.explanation, ...translation.explanation } } : {}),
    ...(translation.media ? { media: { ...question.media, ...translation.media } } : {}),
  }
}

/**
 * Beschriftungen der Oberflaeche fuer eine Sprache.
 *
 * Zusammengelegt aus Grundsprache und gewaehlter Sprache: Ein Eintrag, der nur
 * in der Grundsprache steht, bleibt lesbar, statt als Schluessel dazustehen.
 */
export function interfaceTexts(
  config: Pick<QuizConfig, 'locales' | 'interfaceStrings'>,
  locale: string | undefined,
): Record<string, string> {
  const reason = config.interfaceStrings?.[baseLocale(config)] ?? {}
  const chosen = locale ? (config.interfaceStrings?.[locale] ?? {}) : {}
  return { ...reason, ...chosen }
}

/* Former names, kept for one release so that hosts can migrate. */
/** @deprecated Renamed to `baseLocale`. */
export const grundsprache = baseLocale
/** @deprecated Renamed to `validLocale`. */
export const gueltigeSprache = validLocale
/** @deprecated Renamed to `labelFor`. */
export const beschriftung = labelFor
/** @deprecated Renamed to `subtitleFor`. */
export const untertitel = subtitleFor
/** @deprecated Renamed to `questionTextFor`. */
export const fragenTextFuer = questionTextFor
/** @deprecated Renamed to `interfaceTexts`. */
export const oberflaechenTexte = interfaceTexts
