/**
 * Which text applies in which language?
 *
 * THE ONLY PLACE THAT DECIDES THIS. Projection, validation and import ask here -
 * if the rule stood in three places, one of them would eventually differ, and the
 * room would see a German question with English answers.
 *
 * THE RULE IS SIMPLE: if the translation exists, it applies. If it does not, the
 * original applies. A half-translated table shows mixed languages - unlovely but
 * playable; an empty screen is not.
 */
import type { Question, QuestionTranslation, QuizConfig } from './content'

/** The base locale: the first configured one, otherwise German. */
export function baseLocale(config: Pick<QuizConfig, 'locales'>): string {
  return config.locales?.[0]?.id ?? 'de-DE'
}

/**
 * Is this locale configured?
 *
 * A locale the content does not know is not rejected but brought back to the
 * base locale: it comes from a config file or an address bar, and a typo there
 * must not disable a device.
 */
export function validLocale(config: Pick<QuizConfig, 'locales'>, desired: string | undefined): string {
  if (!desired) return baseLocale(config)
  const known = config.locales?.some((locale) => locale.id === desired)
  return known ? desired : baseLocale(config)
}

/** Label in the requested locale - or the original one. */
export function labelFor(
  entry: { label: string; labels?: Record<string, string> },
  locale: string | undefined,
): string {
  return (locale ? entry.labels?.[locale] : undefined) ?? entry.label
}

/**
 * Subtitle in the requested locale - or the original one.
 *
 * Separate from `labelFor` because it may or may not exist: a card without a
 * second line is not an error, a card without a name is.
 */
export function subtitleFor(
  entry: { subtitle?: string; subtitles?: Record<string, string> },
  locale: string | undefined,
): string | undefined {
  return (locale ? entry.subtitles?.[locale] : undefined) ?? entry.subtitle
}

/**
 * The question in the requested locale.
 *
 * What comes back is a question, not a collection of texts: whoever passes it on
 * need not know whether it is translated. `id`, `correctOptionId` and everything
 * that concerns the evaluation stay untouched - a translation must not shift the
 * scoring.
 *
 * THE OPTIONS ARE REPLACED ONE BY ONE, not swapped as a list: a translation that
 * forgets an option would otherwise lose the answer that is compared against.
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
    ...(translation.image ? { image: translation.image } : {}),
  }
}

/**
 * Interface labels for one locale.
 *
 * Merged from the base locale and the chosen locale: an entry that exists only in
 * the base locale stays readable instead of showing up as a key.
 */
export function interfaceTexts(
  config: Pick<QuizConfig, 'locales' | 'interfaceStrings'>,
  locale: string | undefined,
): Record<string, string> {
  const reason = config.interfaceStrings?.[baseLocale(config)] ?? {}
  const chosen = locale ? (config.interfaceStrings?.[locale] ?? {}) : {}
  return { ...reason, ...chosen }
}
