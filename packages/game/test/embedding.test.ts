/**
 * Der Einbettungsvertrag, soweit er sich statisch pruefen laesst.
 *
 * Das Quiz ist Gast in fremden Anwendungen. Es darf dort nichts anfassen, was ihm
 * nicht gehoert: kein `body`, kein `html`, keine Elementselektoren und keine
 * Farbtoken am Dokumentwurzelelement. Ein Verstoss faellt in einer eigenstaendigen
 * Anwendung nicht auf - beim Gastgeber dagegen sofort, und dann ist es zu spaet.
 *
 * Geprueft werden die ausgelieferten Stylesheets selbst, nicht ihre Wirkung: Was
 * im Browser passiert, zeigen die End-to-End-Tests der Beispielsammlung.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const stylesheets = {
  '@quiz/game/styles.css': join(here, '..', 'src', 'styles', 'game.css'),
  '@quiz/presentation/styles.css': join(here, '..', '..', 'presentation', 'src', 'styles', 'presentation.css'),
}

/** Alle Selektoren einer Datei - Kommentare, Regelkoerper und At-Regeln entfernt. */
function selectors(css: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const heads: string[] = []
  let depth = 0
  let head = ''

  for (const character of withoutComments) {
    if (character === '{') {
      depth += 1
      if (depth === 1) heads.push(head)
      head = ''
      continue
    }
    if (character === '}') {
      depth -= 1
      head = ''
      continue
    }
    if (depth === 0) head += character
  }

  return heads
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.replace(/\s+/g, ' ').trim())
    .filter((entry) => entry.length > 0)
    // At-Regeln (`@media`, `@keyframes`) sind keine Selektoren.
    .filter((entry) => !entry.startsWith('@'))
    // Keyframe-Schritte stehen in derselben Form, sind aber keine Selektoren.
    .filter((entry) => !/^(from|to|\d+%)$/.test(entry))
}

/**
 * Der erste Teil eines Selektors entscheidet, worauf er ueberhaupt zugreifen kann.
 * Beginnt er mit einer eigenen Klasse, bleibt die Regel im Quiz. Beginnt er mit
 * einem Elementnamen (`p`), dem Universalselektor (`*`) oder `body`/`html`,
 * greift sie in die Gastgeberanwendung hinein.
 *
 * Bewusst als Verbot formuliert und nicht als Liste erlaubter Klassen: Eine Liste
 * muesste bei jeder neuen Klasse gepflegt werden und wuerde beim Vergessen das
 * Falsche melden.
 */
function reachesBeyondTheGuest(selector: string): boolean {
  const first = selector.split(/[\s>+~]/)[0] ?? ''
  if (first.startsWith('.')) return false
  if (first.startsWith(':where(')) return false
  return true
}

describe('Einbettungsvertrag der Stylesheets', () => {
  for (const [name, path] of Object.entries(stylesheets)) {
    describe(name, () => {
      const css = readFileSync(path, 'utf8')

      it('fasst weder body noch html noch Elementselektoren an', () => {
        expect(selectors(css).filter(reachesBeyondTheGuest)).toEqual([])
      })

      it('setzt Farbtoken am Dokumentwurzelelement nur auf ausdrueckliche Anforderung', () => {
        const amWurzelelement = selectors(css).filter((entry) => entry.includes(':root'))
        // Erlaubt ist genau eine Form: `:root` MIT der Anforderungsklasse.
        for (const entry of amWurzelelement) {
          expect(entry).toContain(':root.quiz-tokens')
        }
      })
    })
  }
})
