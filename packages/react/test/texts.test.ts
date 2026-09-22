/**
 * The interface speaks two languages by itself.
 *
 * A package that shipped German only forced every English-speaking host to
 * state EVERY visible string in its content - fifty overrides in a build
 * script, which is a translation nobody reviews. So both sets live here, and
 * these tests hold the three properties that make them trustworthy: they are
 * complete, they are picked by the language of the running game, and the
 * content still wins over both.
 */
import { describe, expect, it } from 'vitest'
import { defaultTexts, englishTexts, textFor, textsFor, type TextKey } from '../src/presentation/texts'

const keys = Object.keys(defaultTexts) as TextKey[]

describe('the two sets', () => {
  it('holds every key in both languages', () => {
    /*
     * The type already refuses a missing key. This says it for whoever reads
     * the file rather than compiles it - and it names the key, which a type
     * error in a record of sixty entries does not.
     */
    const missing = keys.filter((key) => !(key in englishTexts))
    expect(missing, 'keys without an English version').toEqual([])
    expect(Object.keys(englishTexts).sort()).toEqual([...keys].sort())
  })

  it('translates every text instead of repeating the German one', () => {
    /*
     * A German word standing in the English set is the mistake this test exists
     * for: it looks translated and reads as German in the hall. Today not one
     * text is the same in both languages - "50:50" carries a word on either
     * side of it - and if one ever is, this test is where that gets decided
     * rather than noticed.
     */
    const untranslated = keys.filter((key) => englishTexts[key] === (defaultTexts[key] as string))
    expect(untranslated, 'English texts identical to the German ones').toEqual([])
  })

  it('keeps the placeholders of a text, because they are its contract', () => {
    const placeholders = (text: string) => (text.match(/\{(\w+)\}/g) ?? []).sort()
    for (const key of keys) {
      expect(placeholders(englishTexts[key]), `placeholders of ${key}`).toEqual(
        placeholders(defaultTexts[key] as string),
      )
    }
  })
})

describe('which set a view reads', () => {
  it('takes the language of the running game', () => {
    expect(textFor({ texts: undefined, locale: 'de-DE' }, 'kiosk.settings')).toBe('Einstellungen')
    expect(textFor({ texts: undefined, locale: 'en-GB' }, 'kiosk.settings')).toBe('Settings')
  })

  it('reads a region as its language, and anything unknown as German', () => {
    // `en-US` is the same wording here; a region that needs its own says so in
    // the content. And a typo in a config file must not blank a screen.
    expect(textFor({ texts: undefined, locale: 'en-US' }, 'kiosk.done')).toBe('Done')
    expect(textFor({ texts: undefined, locale: 'kl-KL' }, 'kiosk.done')).toBe('Fertig')
    expect(textFor(null, 'kiosk.done')).toBe('Fertig')
  })

  it('lets the content win over both sets', () => {
    const view = { texts: { 'kiosk.start': 'Runde starten' }, locale: 'en-GB' }
    const t = textsFor(view)
    // The host's word, in a game that is otherwise English.
    expect(t('kiosk.start')).toBe('Runde starten')
    expect(t('kiosk.back')).toBe('Back')
  })

  it('fills the placeholders in either language', () => {
    expect(textFor({ texts: undefined, locale: 'en-GB' }, 'result.winnerHeadline', { player: 'Ada' })).toBe(
      'Ada wins!',
    )
    expect(textFor({ texts: undefined, locale: 'de-DE' }, 'result.winnerHeadline', { player: 'Ada' })).toBe(
      'Ada hat gewonnen!',
    )
  })
})
