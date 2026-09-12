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
export function grundsprache(config: Pick<QuizConfig, 'locales'>): string {
  return config.locales?.[0]?.id ?? 'de-DE'
}

/**
 * Ist diese Sprache konfiguriert?
 *
 * Ein Sprachwunsch, den der Inhalt nicht kennt, wird nicht abgewiesen, sondern
 * auf die Grundsprache zurueckgeholt: Er kommt aus einem Config File oder einer
 * Adresszeile, und ein Tippfehler dort darf kein Geraet lahmlegen.
 */
export function gueltigeSprache(config: Pick<QuizConfig, 'locales'>, gewuenscht: string | undefined): string {
  if (!gewuenscht) return grundsprache(config)
  const bekannt = config.locales?.some((sprache) => sprache.id === gewuenscht)
  return bekannt ? gewuenscht : grundsprache(config)
}

/** Beschriftung in der gewuenschten Sprache - oder die des Originals. */
export function beschriftung(
  eintrag: { label: string; labels?: Record<string, string> },
  locale: string | undefined,
): string {
  return (locale ? eintrag.labels?.[locale] : undefined) ?? eintrag.label
}

/**
 * Untertitel in der gewuenschten Sprache - oder der des Originals.
 *
 * Getrennt von `beschriftung`, weil es ihn geben darf oder nicht: Eine Karte
 * ohne zweite Zeile ist kein Fehler, eine ohne Namen schon.
 */
export function untertitel(
  eintrag: { subtitle?: string; subtitles?: Record<string, string> },
  locale: string | undefined,
): string | undefined {
  return (locale ? eintrag.subtitles?.[locale] : undefined) ?? eintrag.subtitle
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
export function fragenTextFuer(question: Question, locale: string | undefined): Question {
  const uebersetzung: QuestionTranslation | undefined = locale ? question.translations?.[locale] : undefined
  if (!uebersetzung) return question

  const optionen = question.options?.map((option) => {
    const ersatz = uebersetzung.options?.find((eintrag) => eintrag.id === option.id)
    return ersatz ? { ...option, text: ersatz.text } : option
  })

  return {
    ...question,
    prompt: uebersetzung.prompt ?? question.prompt,
    ...(optionen ? { options: optionen } : {}),
    ...(uebersetzung.acceptedAnswerText ? { acceptedAnswerText: uebersetzung.acceptedAnswerText } : {}),
    ...(uebersetzung.explanation ? { explanation: { ...question.explanation, ...uebersetzung.explanation } } : {}),
    ...(uebersetzung.media ? { media: { ...question.media, ...uebersetzung.media } } : {}),
  }
}

/**
 * Beschriftungen der Oberflaeche fuer eine Sprache.
 *
 * Zusammengelegt aus Grundsprache und gewaehlter Sprache: Ein Eintrag, der nur
 * in der Grundsprache steht, bleibt lesbar, statt als Schluessel dazustehen.
 */
export function oberflaechenTexte(
  config: Pick<QuizConfig, 'locales' | 'interfaceStrings'>,
  locale: string | undefined,
): Record<string, string> {
  const grund = config.interfaceStrings?.[grundsprache(config)] ?? {}
  const gewaehlt = locale ? (config.interfaceStrings?.[locale] ?? {}) : {}
  return { ...grund, ...gewaehlt }
}
