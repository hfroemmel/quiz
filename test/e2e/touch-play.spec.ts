/**
 * Selbstbedienung am Touchgeraet.
 *
 * Diese Tests laufen gegen das echte Quizpaket und dieselbe Engine wie die
 * Buehne - nur ohne Server, ueber eine `LocalQuizRuntime` im Browser, und ohne
 * einen einzigen Operatorbefehl. Genau das ist der Punkt: Wenn hier etwas
 * haengt, haengt es auch am Geraet, wo niemand eingreifen kann.
 */
import { expect, test, type Page } from '@playwright/test'
import { openAnswer } from './helpers'

const freeBuzzer = '[data-buzzer][data-enabled="true"]'

/** Ein Hexwert, wie `getComputedStyle` ihn meldet: `rgb(r, g, b)`. */
function color(hex: string): string {
  const raw = hex.replace('#', '')
  const voll = raw.length === 3 ? [...raw].map((char) => char + char).join('') : raw
  const [r, g, b] = [0, 2, 4].map((position) => parseInt(voll.slice(position, position + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Jeder Seitenaufruf baut eine frische Laufzeit im Browser - das Neuladen ist
 * hier der Ruecksetzknopf, den es am Geraet nicht gibt.
 */
async function openStartScreen(page: Page): Promise<void> {
  await page.goto('/play')
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
}

async function startGame(page: Page, players: 'Allein' | 'Zu zweit', preset = 'Leicht'): Promise<void> {
  await openStartScreen(page)
  await page.getByRole('button', { name: new RegExp(`^${players}`) }).click()
  await page.getByRole('button', { name: new RegExp(`^${preset}`) }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
}

/**
 * Antworten, wie es am Geraet zugeht: im Duell erst buzzern, dann tippen, dann
 * abgeben. Erst das Abgeben loest die Wertung aus.
 *
 * Im Einzelspiel gibt es keinen Buzzer - dort holt der erste Tipp den Zuschlag.
 */
async function answerWith(page: Page, side?: 'left' | 'right'): Promise<void> {
  if (side) await page.locator(`[data-buzzer][data-side="${side}"]`).click()
  await page.locator(openAnswer).first().click()
  await page.locator('[data-confirm]').click()
}

/** Nach der Loesung geht es nur weiter, wenn ein Spieler tippt. */
async function next(page: Page): Promise<void> {
  await page.locator('[data-continue]').click()
}

test('die Startauswahl fragt nur nach Spielerzahl und Schwierigkeit', async ({ page }) => {
  await openStartScreen(page)

  /*
   * Zur Wahl stehen nur Presets, die am Geraet auch spielbar sind. Die
   * Buehnenpresets enthalten einen Bilderkennen-Fragenplatz; dessen Fragen
   * muesste ein Mensch bewerten, und hier steht keiner.
   */
  const presets = await page.locator('[data-preset-options] button').allInnerTexts()
  expect(presets.map((entry) => entry.split('\n')[0])).toEqual(['Leicht', 'Mittel', 'Schwer'])

  // Der Quizmodus gehoert zur Aufstellung, nicht auf den Bildschirm der Spieler.
  await expect(page.getByRole('button', { name: /^Allein/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Zu zweit/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Erwachsene|Kinder/ })).toHaveCount(0)
})

/* ------------------------------------------------------------------ *
 * Die Auswahl selbst
 * ------------------------------------------------------------------ */

test('die Auswahl ist immer genau eine - je Schritt', async ({ page }) => {
  await openStartScreen(page)

  /*
   * Beim Aufschlagen steht in jedem Schritt schon eine Wahl. Ein Geraet, das
   * mit lauter leeren Kaesten dasteht, verlangt zwei Entscheidungen, bevor
   * ueberhaupt etwas passieren kann - dabei ist die erste Stufe die richtige
   * Vermutung fuer den, der zufaellig davorsteht.
   */
  await expect(page.locator('[data-player-count][aria-pressed="true"]')).toHaveCount(1)
  await expect(page.locator('[data-player-count="1"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-preset][aria-pressed="true"]')).toHaveCount(1)
  await expect(page.locator('[data-preset="touch-easy"]')).toHaveAttribute('aria-pressed', 'true')

  // Eine zweite Wahl ersetzt die erste; zwei gewaehlte Karten darf es nie geben.
  await page.locator('[data-player-count="2"]').click()
  await expect(page.locator('[data-player-count="2"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-player-count][aria-pressed="true"]')).toHaveCount(1)

  await page.locator('[data-preset="touch-hard"]').click()
  await expect(page.locator('[data-preset="touch-hard"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-preset][aria-pressed="true"]')).toHaveCount(1)

  // Das Haekchen sitzt auf der gewaehlten Karte - und nur dort.
  await expect(page.locator('[data-preset="touch-hard"] [data-on="true"]')).toHaveCount(1)
  await expect(page.locator('[data-preset="touch-easy"] [data-on="true"]')).toHaveCount(0)
})

test('jede Stufenkarte nennt ihren eigenen Umfang', async ({ page }) => {
  await openStartScreen(page)

  /*
   * "Lohnt sich das jetzt?" beantwortet die Karte selbst - die Zahl der Fragen
   * steht auf ihr und nicht an einer zweiten Stelle, die der Auswahl folgen
   * muesste.
   */
  for (const level of ['touch-easy', 'touch-medium', 'touch-hard']) {
    await expect(page.locator(`[data-preset="${level}"]`)).toContainText(/\d+ Fragen/)
  }
})

/* ------------------------------------------------------------------ *
 * Helle und dunkle Fassung der Startauswahl
 *
 * Die Auswahl liegt UEBER der Buehne und konnte deren `.stage--bright` deshalb
 * nie lesen - sie war immer dunkel, auch wenn das Spiel danach auf Papier lief.
 * Die Fassung steht jetzt als `data-theme` am Wurzelelement, und die
 * `--start-*`-Farben haengen daran.
 * ------------------------------------------------------------------ */

test('die Startauswahl steht in derselben Fassung wie die Buehne danach', async ({ page }) => {
  await openStartScreen(page)
  await expect(page.locator('[data-quiz-game]')).toHaveAttribute('data-theme', 'bright')

  const colors = await page.locator('[data-quiz-game]').evaluate((node) => {
    const measured = getComputedStyle(node)
    const value = (name: string) => measured.getPropertyValue(name).trim()
    return { ground: value('--start-bg-top'), selection: value('--start-selected'), green: value('--start-green') }
  })
  // Papier, nicht Nacht.
  expect(colors.ground).toBe('#fff')
  /*
   * DIE AUSWAHL IST NICHT DIE HANDLUNG. Beide waren dasselbe Gruen; auf Papier
   * traegt die Auswahl das Blau der markierten Antwort, und Gruen gehoert
   * allein dem Knopf, der das Spiel startet.
   */
  expect(colors.selection).not.toBe(colors.green)
})

test('gewaehlt, offen und die drei Zustaende dazwischen sind zu unterscheiden', async ({ page }) => {
  await openStartScreen(page)

  const chosen = page.locator('[data-preset][aria-pressed="true"]').first()
  const open = page.locator('[data-preset][aria-pressed="false"]').first()
  const selection = await page
    .locator('[data-quiz-game]')
    .evaluate((node) => getComputedStyle(node).getPropertyValue('--start-selected').trim())

  /*
   * Gewaehlt und offen unterscheiden sich in der FLAECHE und in der Tinte
   * darauf - nicht in einer Kante. Dass keiner der Zustaende eine stellt,
   * prueft der Test weiter unten ("die gewaehlte Karte ist eine Flaeche").
   */
  const state = await chosen.evaluate((node) => {
    const measured = getComputedStyle(node)
    return { area: measured.backgroundColor, font: measured.color }
  })
  const openState = await open.evaluate((node) => {
    const measured = getComputedStyle(node)
    return { area: measured.backgroundColor, font: measured.color }
  })
  expect(state.area).not.toBe(openState.area)
  expect(state.font).not.toBe(openState.font)
  // Die Auswahlmarke traegt genau die Auswahlfarbe - dieselbe wie die Flaeche darunter.
  await expect(chosen.locator('[data-on="true"]')).toHaveCSS('background-color', color(selection))

  /*
   * Zeigen: die Flaeche der offenen Karte hebt sich, ohne dass eine Linie
   * erscheint. Gewartet wird auf den Uebergang - die Flaeche wechselt in 120 ms,
   * und ein Blick sofort danach liest manchmal noch die alte.
   */
  await open.hover()
  await expect
    .poll(() => open.evaluate((node) => getComputedStyle(node).backgroundColor))
    .not.toBe(openState.area)

  /*
   * Tastaturmarke: KEINE Linie, sondern ein Hauch Groesse und ein weicher
   * Schein. Ein Ring darum haette auf der gewaehlten Karte neben der Auswahl
   * gestanden, und aus zwei Metern waeren daraus zwei Striche geworden.
   */
  await open.focus()
  // Gewartet wird auf den Uebergang: Die Groesse waechst in 120 ms, nicht sofort.
  await expect
    .poll(() => open.evaluate((node) => Number(getComputedStyle(node).scale.split(' ')[0])))
    .toBeGreaterThan(1)
  const brand = await open.evaluate((node) => {
    const measured = getComputedStyle(node)
    return { outline: measured.outlineStyle, shadow: measured.boxShadow }
  })
  expect(brand.outline).toBe('none')
  expect(brand.shadow).not.toBe('none')

  /*
   * Gesperrt: Der Startknopf tritt zurueck, bleibt aber sichtbar. Er ist im
   * Betrieb nie gesperrt - eine Stufe ist immer vorgewaehlt -, und genau
   * deshalb wird der Zustand hier erzwungen statt erspielt.
   */
  const start = page.locator('[data-start]')
  const awake = await start.evaluate((node) => getComputedStyle(node).opacity)
  const blocked = await start.evaluate((node) => {
    ;(node as HTMLButtonElement).disabled = true
    return getComputedStyle(node).opacity
  })
  expect(Number(blocked)).toBeLessThan(Number(awake))
})

test('Gruen traegt allein der Startknopf', async ({ page }) => {
  await openStartScreen(page)
  const green = await page
    .locator('[data-quiz-game]')
    .evaluate((node) => getComputedStyle(node).getPropertyValue('--start-green').trim())

  // Auf dem Knopf: als Flaeche, mit heller Aufschrift darauf.
  const button = await page.locator('[data-start]').evaluate((node) => {
    const measured = getComputedStyle(node)
    return { ground: measured.backgroundImage, font: measured.color }
  })
  expect(button.ground).toContain(color(green))
  expect(button.font).toBe('rgb(255, 255, 255)')

  // Nirgends sonst: nicht auf einer Karte, nicht auf der Marke, nicht am Rueckweg.
  const elsewhere = await page.evaluate(() => {
    const places = ['[data-preset][aria-pressed="true"]', '[data-player-count][aria-pressed="true"]', '[data-game-start] button:not([data-start])']
    return places.flatMap((place) =>
      [...document.querySelectorAll(place)].map((node) => {
        const measured = getComputedStyle(node as Element)
        return [measured.backgroundColor, measured.borderTopColor, measured.color].join(' ')
      }),
    )
  })
  expect(elsewhere.join(' ')).not.toContain(color(green))
})

/* ------------------------------------------------------------------ *
 * Kinderwelt
 *
 * Die Startauswahl liegt UEBER der Buehne - die Klasse `.stage--kids` gibt es
 * dort nicht. Dass die Welt trotzdem ankommt, haengt an `data-skin` am
 * Wurzelelement und daran, dass die Welt schon aus der Zielgruppe kommt und
 * nicht erst aus dem laufenden Spiel. Beides ist unsichtbar, wenn es faellt:
 * Die Auswahl saehe einfach aus wie die der Erwachsenen.
 * ------------------------------------------------------------------ */

/** Die Zeichnung, die eine Flaeche traegt - als Dateiname, ohne Adresse davor. */
async function drawing(page: Page, choice: string, pseudo = '::before'): Promise<string> {
  return page.locator(choice).first().evaluate((node, ps) => {
    const source = getComputedStyle(node as Element, ps as string).borderImageSource
    return (source.match(/[\w-]+\.svg/)?.[0] ?? source.slice(0, 40)) as string
  }, pseudo)
}

test('das Kindergeraet traegt seine Welt schon in der Auswahl', async ({ page }) => {
  await page.goto('/play?audience=kids')
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })

  await expect(page.locator('[data-quiz-game]')).toHaveAttribute('data-skin', 'kids')

  // Die Auswahlkarten sind dieselben gemalten Kartons wie die Antwortzeilen.
  expect(await drawing(page, '[data-preset][aria-pressed="false"]')).toBe('answer-box-a.svg')

  /*
   * GEWAEHLT SIEHT AUS WIE EINE GEWAEHLTE ANTWORT: rote Karte, weisse Schrift.
   * Kein gruener Ring und keine gruene Kante - das Gruen ist die Auswahlfarbe
   * der Erwachsenen und hat in dieser Welt keine Bedeutung.
   */
  const chosen = page.locator('[data-preset][aria-pressed="true"]').first()
  expect(await drawing(page, '[data-preset][aria-pressed="true"]')).toBe('answer-box-b.svg')
  const edge = await chosen.evaluate((node) => {
    const s = getComputedStyle(node)
    return { color: s.color, width: s.borderTopWidth }
  })
  expect(edge.color).toBe('rgb(255, 255, 255)')
  expect(edge.width).toBe('0px')
})

test('der primaere Knopf der Kinderwelt ist ueberall derselbe', async ({ page }) => {
  /*
   * "Los geht\'s" in der Auswahl und "Antwort abgeben und aufloesen" in der
   * Fussleiste sind zwei Bauteile an zwei Orten - und muessen aus derselben
   * Zeichnung kommen. Sonst hat die Welt zwei primaere Knoepfe.
   */
  await page.goto('/play?audience=kids')
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
  const inSelection = await drawing(page, '[data-start]')

  await page.getByRole('button', { name: /^Allein/ }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.locator('[data-start]').click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })

  await page.locator(openAnswer).first().click()
  await expect(page.locator('[data-confirm]')).toBeVisible()
  const inGame = await drawing(page, '[data-confirm]')

  expect(inGame).toBe(inSelection)
})

test('die Erwachsenenauswahl bleibt ungezeichnet', async ({ page }) => {
  // Die Kinderwelt darf die andere nicht anfassen.
  await openStartScreen(page)
  await expect(page.locator('[data-quiz-game]')).toHaveAttribute('data-skin', 'default')
  expect(await drawing(page, '[data-preset]')).toBe('none')
})

test('die Startauswahl laesst sich vollstaendig mit der Tastatur bedienen', async ({ page }) => {
  await openStartScreen(page)

  /*
   * Am Geraet im Foyer tippt jeder mit dem Finger - aber die Aufstellung wird
   * mit einer Tastatur geprueft, und Barrierefreiheit ist keine Frage des
   * Aufstellorts. Erreichbar heisst: mit Tab hin und mit der Leertaste
   * ausloesen, ohne dass ein Klick noetig waere.
   */
  await page.locator('[data-player-count="1"]').focus()
  await page.keyboard.press('Tab')
  await expect(page.locator('[data-player-count="2"]')).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.locator('[data-player-count="2"]')).toHaveAttribute('aria-pressed', 'true')

  await page.locator('[data-preset="touch-medium"]').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-preset="touch-medium"]')).toHaveAttribute('aria-pressed', 'true')

  await page.locator('[data-start]').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator(freeBuzzer)).toHaveCount(2)
})

test('erst steht die Frage allein, dann kommen Antworten und Buzzer', async ({ page }) => {
  /*
   * Am Geraet liest niemand die Frage vor. Die Frist davor ist der Ersatz: Wer
   * noch liest, soll nicht vom schnelleren Daumen ueberholt werden. Solange sie
   * laeuft, sind die Antworten nicht einmal auf der Leitung.
   */
  await openStartScreen(page)
  await page.getByRole('button', { name: /^Zu zweit/ }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()

  await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'question-presented', { timeout: 30_000 })
  await expect(page.locator('[data-prompt]')).toBeVisible()
  await expect(page.locator('[data-answer]')).toHaveCount(0)
  await expect(page.locator('[data-buzzer][data-enabled="true"]')).toHaveCount(0)

  // Erst mit den Antworten geht der Buzzer auf.
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'buzzer-open')
  await expect(page.locator(freeBuzzer)).toHaveCount(2)
})

test('nach der Loesung wartet das Geraet auf "Weiter"', async ({ page }) => {
  await startGame(page, 'Allein')
  const stage = page.locator('.stage')
  const question = await page.locator('[data-prompt]').first().innerText()

  await answerWith(page)
  await expect(stage).toHaveAttribute('data-scene', 'solution', { timeout: 20_000 })

  /*
   * Und bleibt dort. Frueher plante der Server hier einen Uebergang ein; wer
   * gerade noch las, warum seine Antwort falsch war, verlor das Bild.
   */
  await page.waitForTimeout(8_000)
  await expect(stage).toHaveAttribute('data-scene', 'solution')
  await expect(page.locator('[data-prompt]').first()).toHaveText(question)
  // Aufgeloest heisst: niemand buzzert mehr und niemand tippt mehr.
  await expect(page.locator(freeBuzzer)).toHaveCount(0)
  await expect(page.locator(openAnswer)).toHaveCount(0)

  await next(page)
  await expect(stage).toHaveAttribute('data-scene', 'pause', { timeout: 20_000 })
})

test('Einzelspiel: der Hinweis steht mittig, der Zaehler aussen', async ({ page }) => {
  /*
   * Ohne Gegner faellt die rechte Ecke weg. Der Zaehler nimmt ihren Platz ein,
   * damit der Hinweis in der Mitte des Bildschirms bleibt - sonst schoebe er
   * sich mit dem Zaehler nach rechts, und der Knopf laege nicht mehr da, wo ihn
   * im Duell auch die zweite Hand erwartet.
   */
  await startGame(page, 'Allein')
  await answerWith(page)
  await expect(page.locator('[data-continue]')).toBeVisible({ timeout: 20_000 })

  const width = page.viewportSize()!.width
  const button = (await page.locator('[data-continue]').boundingBox())!
  expect(Math.round(button.x + button.width / 2)).toBe(Math.round(width / 2))

  // Der Zaehler steht rechts vom Knopf, die Punktekarte links davon.
  const counter = (await page.locator('[data-counter]').boundingBox())!
  const card = (await page.locator('[data-score]').boundingBox())!
  expect(counter.x).toBeGreaterThan(button.x + button.width)
  expect(card.x + card.width).toBeLessThan(button.x)
})

test('Hinweis und "Weiter" teilen sich ein Feld fester Hoehe', async ({ page }) => {
  await startGame(page, 'Allein')

  const field = page.locator('[data-notice]')
  const empty = (await field.boundingBox())!
  const counter = (await page.locator('[data-counter]').boundingBox())!

  await answerWith(page)
  await expect(page.locator('[data-continue]')).toBeVisible({ timeout: 20_000 })

  /*
   * Feld und Zaehler stehen exakt wie vorher. Ohne feste Hoehe rutschte alles
   * darueber ein Stueck, sobald aus dem Hinweis ein Knopf wird - und zwar in
   * dem Moment, in dem jemand mit dem Finger zielt.
   */
  const withButton = (await field.boundingBox())!
  expect(Math.round(withButton.height)).toBe(Math.round(empty.height))
  expect(Math.round(withButton.y)).toBe(Math.round(empty.y))
  const counterAfter = (await page.locator('[data-counter]').boundingBox())!
  expect(Math.round(counterAfter.y)).toBe(Math.round(counter.y))
})

test('Einzelspiel: kein Buzzer, und die Auswertung laeuft ohne Operator', async ({ page }) => {
  await startGame(page, 'Allein')

  // Gegen wen sollte man sich melden? Sobald die Antworten stehen, sind sie offen.
  await expect(page.locator('[data-buzzer]')).toHaveCount(0)
  await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'buzzer-open')

  await answerWith(page)

  // Bewertung und Loesung laufen von selbst - nur der Schritt danach nicht.
  await expect(page.locator('.stage')).toHaveAttribute('data-scene', 'feedback', { timeout: 20_000 })
  await expect(page.locator('.stage')).toHaveAttribute('data-scene', 'solution', { timeout: 20_000 })
  await expect(page.locator('[data-continue]')).toBeVisible()
})

test('die Antworten stehen genau einmal auf dem Tisch - als Schaltflaechen', async ({ page }) => {
  /*
   * EINE Liste, auch im Duell. Frueher hatte jeder Spieler seine eigene; dieselben
   * vier Antworten standen dann doppelt da, und getippt werden konnte nur auf
   * einer der beiden Fassungen.
   */
  await startGame(page, 'Zu zweit')

  await expect(page.locator('[data-answers]')).toHaveCount(1)
  const rows = await page.locator('[data-answer]').count()
  expect(rows).toBeGreaterThan(1)
  // Und jede Zeile ist eine echte Schaltflaeche, keine Flaeche mit Klickfaenger.
  await expect(page.locator('[data-answer-button]')).toHaveCount(rows)
})

test('Duell: zwei Buzzer, und wer zuerst drueckt, bekommt die Antworten', async ({ page }) => {
  await startGame(page, 'Zu zweit')

  // Beide Spieler stehen nebeneinander: ein Buzzer je Seite, beide offen.
  await expect(page.locator('[data-buzzer]')).toHaveCount(2)
  await expect(page.locator(freeBuzzer)).toHaveCount(2)
  // Solange niemand gedrueckt hat, gehoeren die Antworten niemandem.
  await expect(page.locator(openAnswer)).toHaveCount(0)

  await page.locator('[data-buzzer][data-side="right"]').click()

  // Der Zuschlag steht am Buzzer selbst, und der andere tritt zurueck.
  await expect(page.locator('[data-buzzer][data-side="right"]')).toHaveAttribute('data-armed', 'true')
  await expect(page.locator(freeBuzzer)).toHaveCount(0)
  const rows = await page.locator('[data-answer]').count()
  await expect(page.locator(openAnswer)).toHaveCount(rows)

  await page.locator(openAnswer).first().click()

  /*
   * Getippt ist nur eingeloggt: Die Antwort ist markiert, der Knopf zum Abgeben
   * steht bereit, und bis dahin darf der Spieler umentscheiden. Gewertet wird
   * erst, wenn er abgibt.
   */
  await expect(page.locator('[data-confirm]')).toBeVisible()
  await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'answer-locked')

  await page.locator('[data-confirm]').click()

  // Der Spieler, der abgegeben hat, ist fuer diese Frage durch - in jedem Ausgang.
  await expect(page.locator('.stage')).not.toHaveAttribute('data-phase', 'answer-locked')
  await expect(page.locator('.stage')).not.toHaveAttribute('data-phase', 'buzzer-open')
})

test('die Szene bleibt ueber der Fussleiste - in jeder Aufloesung', async ({ page }) => {
  /*
   * Die Fussleiste gibt nichts her: Sie traegt Punktestand und Buzzer, und die
   * Hand des Spielers darf nicht kleiner werden, weil eine Frage lang ist.
   * Nachgiebig ist die Szene darueber. Laeuft sie trotzdem hinein, verschwindet
   * ausgerechnet Antwort D hinter einer Punktekarte - ohne dass etwas nach
   * einem Fehler aussieht.
   *
   * Geprueft wird in allen Zielformaten: Die Flaeche ueber der Leiste ist viel
   * breiter als hoch, und genau dort rechnen sich Groessen in Containerbreiten
   * am leichtesten aus dem Bild.
   */
  await startGame(page, 'Zu zweit')

  for (const [width, height] of [
    [1920, 1080],
    [1280, 720],
    [1024, 768],
  ] as const) {
    await page.setViewportSize({ width, height })
    // Ein Frame fuer den Umbruch - die Frage misst sich nach der Groesse neu.
    await page.waitForTimeout(300)

    const foot = (await page.locator('[data-player-foot]').boundingBox())!
    const rows = await page.locator('[data-answer]').all()
    expect(rows.length, `${width}x${height}`).toBeGreaterThanOrEqual(4)
    for (const row of rows) {
      const box = (await row.boundingBox())!
      expect(Math.round(box.y + box.height), `${width}x${height}`).toBeLessThanOrEqual(Math.round(foot.y))
    }
  }
})

test('Punkte und Zaehler stehen unten bei den Buzzern, nicht in der Kopfzeile', async ({ page }) => {
  await startGame(page, 'Zu zweit')

  const foot = page.locator('[data-player-foot]')
  await expect(foot.locator('[data-score]')).toHaveCount(2)
  await expect(foot.locator('[data-counter]')).toHaveCount(1)
  // Die Kopfzeile traegt am Geraet nur noch die Wortmarke.
  await expect(page.locator('header [data-score]')).toHaveCount(0)
  await expect(page.locator('[data-brand]')).toBeVisible()

  /*
   * Jede Ecke gehoert einem Spieler: Die Punktekarte steht ueber SEINEM Buzzer
   * und auf derselben Seite. Daran - und nicht am Lesen - erkennt er im Spiel,
   * wo er hinschlagen muss.
   */
  for (const [side, number] of [
    ['left', '1'],
    ['right', '2'],
  ]) {
    const card = (await page.locator(`[data-score][data-player="${number}"]`).boundingBox())!
    const buzzer = (await page.locator(`[data-buzzer][data-side="${side}"]`).boundingBox())!
    expect(Math.round(card.x), side).toBe(Math.round(buzzer.x))
    expect(card.y + card.height, side).toBeLessThanOrEqual(buzzer.y + 1)
  }
})

test('die Leerlauf-Aufsicht gibt das Geraet wieder frei', async ({ page }) => {
  /*
   * Acht Sekunden statt zwei Minuten - die Aufsicht kommt als Betriebsangabe
   * herein. Kuerzer darf sie hier nicht sein: Die Frist laeuft ab dem Start des
   * Spiels, und der Vorspann aus Video und Zwischenscreen gehoert noch dazu.
   */
  await page.goto('/play?idle=8')
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /^Allein/ }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })

  // Niemand tippt mehr: Das Spiel wird abgebrochen und die Auswahl kehrt zurueck.
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 25_000 })
})

test('ein Einzelspiel laeuft ohne einen einzigen Operatorbefehl bis zum Ergebnis', async ({ page }) => {
  // Ein vollstaendiges Spiel mit sieben Fragen dauert laenger als ein Klicktest.
  test.setTimeout(240_000)
  await startGame(page, 'Allein')

  const stage = page.locator('.stage')
  /*
   * Antworten, sobald die Flaechen aktiv sind - sonst warten. Alles dazwischen
   * (Auswertung, Loesung, naechste Frage) macht der Server von selbst.
   */
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    if ((await stage.getAttribute('data-scene')) === 'result') break
    /*
     * Erst abgeben, dann tippen: Nach einem Tipp bleiben die Zeilen absichtlich
     * aktiv (umentscheiden), die Frage geht nur ueber das Abgeben weiter.
     */
    const submit = page.locator('[data-confirm]')
    if (await submit.isVisible().catch(() => false)) {
      await submit.click({ timeout: 2_000 }).catch(() => undefined)
      continue
    }
    const row = page.locator(openAnswer).first()
    if (await row.isVisible().catch(() => false)) {
      // Kurzer Anlauf: Zwischen Pruefung und Tipp kann die Flaeche verschwinden,
      // etwa weil das Spiel in diesem Moment endet.
      await row.click({ timeout: 2_000 }).catch(() => undefined)
      continue
    }
    // Nach der Loesung wartet das Geraet auf einen Tipp - auch im Einzelspiel.
    const button = page.locator('[data-continue]')
    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 2_000 }).catch(() => undefined)
      continue
    }
    await page.waitForTimeout(300)
  }

  await expect(stage).toHaveAttribute('data-scene', 'result', { timeout: 30_000 })
  // Solo-Ergebnis: kein Gewinner, sondern die eigene Trefferzahl.
  await expect(page.locator('[data-result-label]')).toHaveText('Ergebnis')
  await expect(page.getByRole('button', { name: 'Nochmal spielen' })).toBeVisible()
})

/* ------------------------------------------------------------------ *
 * Einstellungen, Zoom und Ausstieg
 * ------------------------------------------------------------------ */

test('die Einstellungen haengen am Startbildschirm, nicht am laufenden Spiel', async ({ page }) => {
  await openStartScreen(page)
  await page.locator('[data-settings-open]').click()

  const settings = page.locator('[data-settings]')
  await expect(settings).toBeVisible()
  await expect(settings.locator('[data-sound-on]')).toHaveAttribute('aria-pressed', 'true')
  await expect(settings.locator('[data-sound-test]')).toBeVisible()
  await expect(settings.locator('[data-zoom]')).toHaveValue('1')

  await page.locator('[data-settings-close]').click()
  await expect(settings).toHaveCount(0)

  /*
   * Waehrend gespielt wird, sind sie fort: Wer davorsteht, soll den Ton nicht
   * abschalten koennen, waehrend die anderen zuhoeren.
   */
  await page.getByRole('button', { name: /^Allein/ }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-settings-open]')).toHaveCount(0)
})

test('der Tonschalter der Einstellungen gilt fuer das ganze Geraet', async ({ page }) => {
  await openStartScreen(page)
  await page.locator('[data-settings-open]').click()
  await page.locator('[data-sound-off]').click()

  await expect(page.locator('[data-sound-off]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-sound-on]')).toHaveAttribute('aria-pressed', 'false')

  // Er haengt am Spielstand und nicht an der Ansicht: Er ueberlebt das Schliessen.
  await page.locator('[data-settings-close]').click()
  await page.locator('[data-settings-open]').click()
  await expect(page.locator('[data-sound-off]')).toHaveAttribute('aria-pressed', 'true')
})

test('ein kleinerer Zoom verkleinert die Szene zur Mitte, die Ecken bleiben am Rand', async ({ page }) => {
  await startGame(page, 'Zu zweit')

  const scene = page.locator('[data-scene-root]')
  const large = await scene.boundingBox()
  const leftCornerLarge = await page.locator('[data-corner="left"]').boundingBox()
  const area = await page.locator('[data-quiz-game]').boundingBox()

  await page.evaluate(() => {
    const root = document.querySelector('[data-quiz-game]') as HTMLElement
    root.style.setProperty('--stage-zoom', '0.7')
  })

  const small = await scene.boundingBox()
  const leftCornerSmall = await page.locator('[data-corner="left"]').boundingBox()

  // Die Szene wird kleiner ...
  expect(small!.width).toBeLessThan(large!.width * 0.8)
  // ... und bleibt dabei mittig: Der Abstand nach links und rechts ist gleich.
  const left = small!.x - area!.x
  const right = area!.x + area!.width - (small!.x + small!.width)
  expect(Math.abs(left - right)).toBeLessThan(4)

  // Die Punktekarte schrumpft mit, rueckt aber nicht von der Kante ab.
  expect(leftCornerSmall!.width).toBeLessThan(leftCornerLarge!.width * 0.8)
  expect(leftCornerSmall!.x - area!.x).toBeLessThan(leftCornerLarge!.x - area!.x + 1)
})

test('die Zoomstufe gilt auch fuer Auswahl und Einstellungen', async ({ page }) => {
  /*
   * Wer die Anzeige kleiner stellt, weil er sonst nicht hinuebersieht, meint
   * die Auswahl davor genauso wie die Frage danach. Eine Auswahl in voller
   * Groesse vor einem verkleinerten Spiel waere die halbe Einstellung.
   */
  await openStartScreen(page)
  const selectionLarge = (await page.locator('[data-game-start]').boundingBox())!.width

  await page.locator('[data-settings-open]').click()
  const cardLarge = (await page.locator('[data-settings] > div').boundingBox())!.width
  await page.locator('[data-zoom]').fill('0.7')
  const cardSmall = (await page.locator('[data-settings] > div').boundingBox())!.width
  await page.locator('[data-settings-close]').click()
  const selectionSmall = (await page.locator('[data-game-start]').boundingBox())!.width

  expect(selectionSmall).toBeLessThan(selectionLarge * 0.8)
  expect(cardSmall).toBeLessThan(cardLarge * 0.8)
})

test('die Szene erscheint sofort in der eingestellten Groesse, nicht erst nach dem Uebergang', async ({ page }) => {
  /*
   * DIE SZENENUEBERGAENGE ANIMIEREN `transform`. Stuende die Zoomstufe als
   * Transformation an demselben Element, ueberschriebe die Animation sie: Die
   * Frage erschiene in voller Groesse und spraenge am Ende der Animation
   * klein. Deshalb steht sie in der eigenen Eigenschaft `scale`, die MIT der
   * Animation verrechnet wird - und deshalb misst dieser Test waehrend des
   * Uebergangs und nicht danach.
   */
  await openStartScreen(page)
  await page.evaluate(() => {
    const root = document.querySelector('[data-quiz-game]') as HTMLElement
    root.style.setProperty('--stage-zoom', '0.7')
  })
  await page.getByRole('button', { name: /^Allein/ }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()

  await page.waitForSelector('[data-scene-root]', { timeout: 30_000 })
  const measured: number[] = []
  for (let i = 0; i < 12; i += 1) {
    measured.push((await page.locator('[data-scene-root]').boundingBox())!.width)
    await page.waitForTimeout(60)
  }
  expect(Math.max(...measured) - Math.min(...measured)).toBeLessThan(2)
})

test('"Spiel beenden" fragt nach und fuehrt zurueck in die Auswahl', async ({ page }) => {
  await startGame(page, 'Allein')

  await page.locator('[data-abort-game]').click()
  await expect(page.locator('[data-abort-dialog]')).toBeVisible()

  // Wer weiterspielen will, steht danach wieder vor derselben Frage.
  await page.locator('[data-abort-cancel]').click()
  await expect(page.locator('[data-abort-dialog]')).toHaveCount(0)
  await expect(page.locator('[data-answers]')).toBeVisible()

  await page.locator('[data-abort-game]').click()
  await page.locator('[data-abort-confirm]').click()
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
})

/* ------------------------------------------------------------------ *
 * Mehrsprachigkeit
 * ------------------------------------------------------------------ */

test('der Sprachumschalter stellt Auswahl und Spiel um', async ({ page }) => {
  /*
   * Der ganze Weg im Browser: Umschalter -> Befehl -> Server -> Projektion ->
   * Ansicht. Geprueft wird an drei Stellen, weil die Sprache an drei Stellen
   * aufgeloest wird - Oberflaeche, Katalog und Frageninhalt.
   */
  await openStartScreen(page)

  const switcher = page.locator('[data-languages]')
  await expect(switcher).toBeVisible()
  await expect(page.locator('[data-locale="de-DE"]')).toHaveAttribute('aria-pressed', 'true')

  // Deutsch: die Oberflaeche und die Namen der Schwierigkeitsstufen.
  await expect(page.getByRole('button', { name: /^Allein/ })).toBeVisible()
  const germanPresets = await page.locator('[data-preset-options] button').allInnerTexts()
  expect(germanPresets.map((entry) => entry.split('\n')[0])).toEqual(['Leicht', 'Mittel', 'Schwer'])

  await page.locator('[data-locale="en-GB"]').click()

  await expect(page.locator('[data-locale="en-GB"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /^Alone/ })).toBeVisible()
  const englishPresets = await page.locator('[data-preset-options] button').allInnerTexts()
  expect(englishPresets.map((entry) => entry.split('\n')[0])).toEqual(['Easy', 'Medium', 'Hard'])
  await expect(page.getByRole('button', { name: "Let's go" })).toBeVisible()

  // Und das Spiel selbst laeuft in derselben Sprache weiter.
  await page.getByRole('button', { name: 'Alone' }).click()
  await page.getByRole('button', { name: /^Easy/ }).click()
  await page.getByRole('button', { name: "Let's go" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })

  await expect(page.locator('[data-prompt]')).toContainText('Test question')
  const answers = await page.locator('[data-answer]').allInnerTexts()
  expect(answers.join(' ')).toMatch(/Correct answer|Wrong answer/)
  await expect(page.locator('[data-score-label]').first()).toHaveText('Player')
})

test('ohne zweite Sprache gibt es nichts umzuschalten', async ({ page }) => {
  /*
   * Der Umschalter haengt an der Konfiguration und nicht am Code: Ein Bestand
   * mit einer Sprache zeigt eine Auswahl mit genau einer Moeglichkeit nicht -
   * das waere keine Auswahl, sondern eine Huerde.
   */
  await openStartScreen(page)
  const locales = await page.locator('[data-languages] button').count()
  expect(locales).toBeGreaterThan(1)
})

/*
 * Die Groesse haengt an der BREITE des Fensters - und an nichts sonst.
 *
 * Das ist die Zusage an die Aufstellung: Der Touchtisch im Foyer, das Tablet am
 * Stand und das Fenster in der Spielesammlung haben verschiedene Formate. Wer
 * eine Groesse aendert, aendert sie fuer alle auf einmal, weil es nur EIN Mass
 * gibt. Vorher rechnete die Szene ihre Hoehe aus dem uebrigen Platz und ihre
 * Breite daraus: Dasselbe Geraet, einmal flach gestellt, zeigte die Frage
 * kleiner - ohne dass eine Zahl im Entwurf sich geaendert haette.
 */
test('gleiche Breite heisst gleiche Groesse, auch auf verschieden hohen Fenstern', async ({ page }) => {
  /*
   * Gemessen wird nichts Inhaltliches: der Kasten der Szene, der Kasten eines
   * Buzzers und die Schriftgroesse eines Punktestands. Die Antwortliste taugt
   * dafuer NICHT - eine Bildfrage stellt sie neben das Foto, eine Textfrage
   * darunter, und welche Frage kommt, entscheidet die Auswahl.
   */
  async function measures(): Promise<Record<string, number>> {
    const box = async (choice: string) => {
      const box = await page.locator(choice).first().boundingBox()
      if (!box) throw new Error(`ohne Kasten: ${choice}`)
      return box
    }
    const scene = await page.evaluate(() => {
      const element = document.querySelector('[class*="sceneRoot"]')
      if (!element) throw new Error('ohne Szene')
      const box = element.getBoundingClientRect()
      return { width: box.width, height: box.height, left: box.x }
    })
    const buzzer = await box('[data-buzzer]')
    const points = await page
      .locator('[data-score-value]')
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
    return {
      sceneWidth: Math.round(scene.width),
      sceneHeight: Math.round(scene.height),
      sceneLeft: Math.round(scene.left),
      buzzerWidth: Math.round(buzzer.width),
      buzzerHeight: Math.round(buzzer.height),
      pointsFont: Math.round(points * 100) / 100,
    }
  }

  /*
   * Both heights leave room for the full-width scene above the fixed footer;
   * the one exception to "width decides" is tested right after: a window too
   * flat for that never lets the scene run under the footer.
   */
  await page.setViewportSize({ width: 1280, height: 900 })
  await startGame(page, 'Zu zweit')
  const flat = await measures()

  await page.setViewportSize({ width: 1280, height: 1000 })
  await startGame(page, 'Zu zweit')
  const tall = await measures()

  expect(tall).toEqual(flat)

  await page.setViewportSize({ width: 1280, height: 720 })
  await startGame(page, 'Zu zweit')
  const clearance = await page.evaluate(() => {
    const scene = document.querySelector('[class*="sceneArea"]')!.getBoundingClientRect()
    const corner = document.querySelector('[data-corner="left"]')!.getBoundingClientRect()
    return corner.top - scene.bottom
  })
  expect(clearance, 'scene above the footer at 1280x720').toBeGreaterThanOrEqual(0)

  /*
   * Und umgekehrt: Aendert sich NUR die Breite, waechst alles im gleichen
   * Verhaeltnis mit. Die halbe Breite ergibt die halbe Schrift und den halben
   * Kasten - kein Bauteil bricht aus der Proportion aus.
   */
  await page.setViewportSize({ width: 640, height: 1000 })
  await startGame(page, 'Zu zweit')
  const half = await measures()

  for (const [name, value] of Object.entries(half)) {
    // Ein Pixel Spielraum: Die Masse sind gerundet, die halbe Breite ist es nicht.
    expect(Math.abs(value - tall[name]! / 2), name).toBeLessThanOrEqual(1)
  }
})

/*
 * Die Fussleiste liegt an der unteren Kante - dort, wo die Haende sind.
 *
 * Sie traegt Punktestand, Zaehler und die beiden Buzzer, also alles, was an
 * diesem Geraet angefasst wird. Seit die Komposition ihre Hoehe aus der Breite
 * nimmt, bleibt auf einem hoeheren Fenster Platz uebrig; der gehoert in die
 * Mitte und nicht unter die Leiste.
 */
test('die Fussleiste steht am unteren Bildrand, wie hoch das Fenster auch ist', async ({ page }) => {
  async function spaceBelowBar(): Promise<number> {
    return page.evaluate(() => {
      const stage = document.querySelector('.stage')!.getBoundingClientRect()
      /* Der Punktestand steht in einer Spielerecke, die Ecke in der Leiste. */
      const bar = document.querySelector('[data-score]')!.parentElement!.parentElement!
      return Math.round(stage.bottom - bar.getBoundingClientRect().bottom)
    })
  }

  for (const height of [720, 1000]) {
    await page.setViewportSize({ width: 1280, height: height })
    await startGame(page, 'Zu zweit')
    expect(await spaceBelowBar(), `Duell bei 1280x${height}`).toBe(0)
  }

  /*
   * Und im Einzelspiel genauso: Dort fehlen die Buzzer, die Leiste ist also
   * niedriger - sie rutscht deshalb nicht nach oben.
   */
  await page.setViewportSize({ width: 1280, height: 1000 })
  await startGame(page, 'Allein')
  expect(await spaceBelowBar(), 'Einzelspiel bei 1280x1000').toBe(0)
})

/*
 * Die Spielerfarbe traegt genau eine Flaeche: der Buzzer.
 *
 * Vorher trug die Punktekarte sie auch, und der Buzzer selbst nur als Kante mit
 * einem Hauch davon innen. In der hellen Fassung wurde daraus ein blasses Rosa
 * unter weisser Schrift, und die Ecke war ein Block, in dem nichts hervorstach.
 * Jetzt ist in jeder Ecke genau ein Ding farbig, und es ist das, was angefasst
 * wird.
 */
test('die Spielerfarbe traegt allein der Buzzer - in jedem Zustand', async ({ page }) => {
  const playerColors = async () =>
    page.evaluate(() => {
      const style = getComputedStyle(document.querySelector('.stage')!)
      return ['--stage-playerOne', '--stage-playerTwo'].map((name) => style.getPropertyValue(name).trim())
    })

  /** Jede Flaeche der Leiste: Grund, Kante und Deckkraft, wie sie wirklich steht. */
  const bar = async () =>
    page.evaluate(() => {
      const readInput = (element: Element) => {
        const style = getComputedStyle(element)
        return {
          ground: style.backgroundColor,
          edge: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].join(' '),
          font: style.color,
          opacity: style.opacity,
        }
      }
      return {
        buzzer: [...document.querySelectorAll('[data-buzzer]')].map((button) => ({
          side: button.getAttribute('data-side'),
          ...readInput(button),
        })),
        /* Beide Kacheln jeder Karte - der Grund steht an ihnen, nicht an der Karte. */
        cards: [...document.querySelectorAll('[data-score]')].flatMap((card) => [...card.children].map(readInput)),
      }
    })

  const [one, two] = await (async () => {
    await startGame(page, 'Zu zweit')
    return playerColors()
  })()

  /*
   * Drei Zustaende in einer Runde: offen (beide bedienbar), gebuzzert (einer
   * hat den Zuschlag, der andere ist gesperrt) und aufgeloest (beide gesperrt).
   */
  const states = [] as Awaited<ReturnType<typeof bar>>[]
  states.push(await bar())
  await page.locator('[data-buzzer][data-side="left"]').click()
  await expect(page.locator('[data-buzzer][data-armed="true"]')).toHaveCount(1)
  states.push(await bar())
  /*
   * Bewusst die RICHTIGE Antwort des Testbestands: Eine falsche gibt dem anderen
   * Spieler die zweite Chance, und dann ist die Runde nicht aufgeloest, sondern
   * wieder offen - ein anderer Zustand als der, der hier gemeint ist.
   */
  await page.locator('[data-answer-button]', { hasText: /Richtige Antwort/ }).first().click()
  await page.locator('[data-confirm]').click()
  await expect(page.locator('[data-continue]')).toBeVisible()
  states.push(await bar())

  for (const [number, state] of states.entries()) {
    for (const button of state.buzzer) {
      const expected = button.side === 'left' ? one : two
      expect(button.ground, `Zustand ${number}, ${button.side}`).toBe(color(expected!))
      // Vollflaechig heisst auch: kein Zustand nimmt der Flaeche ihre Deckkraft.
      expect(button.opacity, `Zustand ${number}, ${button.side}`).toBe('1')
      expect(button.edge, `Zustand ${number}, ${button.side}`).toBe('0px 0px 0px 0px')
      expect(button.font, `Zustand ${number}, ${button.side}`).toBe('rgb(255, 255, 255)')
    }
    // Und die Karten bleiben in jedem dieser Zustaende neutral.
    for (const tile of state.cards) {
      expect([tile.ground, tile.edge], `Zustand ${number}`).not.toContain(color(one!))
      expect([tile.ground, tile.edge], `Zustand ${number}`).not.toContain(color(two!))
      expect(tile.edge, `Zustand ${number}`).toBe('0px 0px 0px 0px')
    }
  }

  /* Im Einzelspiel gibt es keinen Buzzer - und die Karte ist dieselbe neutrale. */
  await startGame(page, 'Allein')
  const solo = await bar()
  expect(solo.buzzer).toHaveLength(0)
  for (const tile of solo.cards) {
    expect([tile.ground, tile.edge]).not.toContain(color(one!))
    expect([tile.ground, tile.edge]).not.toContain(color(two!))
  }
})

/*
 * Die Startauswahl steht in denselben Flaechen wie das Spiel danach.
 *
 * Die gewaehlte Karte war ein Kasten mit vier Merkmalen: eine dickere Kante,
 * eine leicht eingefaerbte Flaeche, das Haekchen - und im Fokuszustand kam ein
 * Ring darum. Auf Papier waren die Kante und die Einfaerbung aus zwei Metern
 * nicht zu sehen, die beiden Linien dafuer umso mehr.
 */
test('die gewaehlte Karte ist eine Flaeche, und zwar dieselbe wie eine angetippte Antwort', async ({ page }) => {
  const cardState = async (choice: string) =>
    page.locator(choice).evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        ground: style.backgroundColor,
        edge: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].join(' '),
        outline: `${style.outlineStyle} ${style.outlineWidth}`,
        font: style.color,
        /* Jede Schrift und jede Flaeche IN der Karte - Titel, Zeile, Zeichen, Haekchen. */
        inner: [...element.querySelectorAll('span')].map((part) => getComputedStyle(part).color),
      }
    })

  await openStartScreen(page)
  const chosen = '[data-player-count="1"]'
  const open = '[data-player-count="2"]'

  /*
   * Vier Zustaende an derselben Karte. `hover` und `focus-visible` liegen
   * bewusst NACHEINANDER auf der offenen Karte: Genau ihre Ueberlagerung hat
   * vorher zwei Linien uebereinander gelegt.
   */
  const states: Record<string, Awaited<ReturnType<typeof cardState>>> = {}
  states['gewaehlt'] = await cardState(chosen)
  states['offen'] = await cardState(open)
  await page.locator(open).hover()
  states['hover'] = await cardState(open)
  await page.keyboard.press('Tab')
  await page.locator(chosen).focus()
  states['fokus'] = await cardState(chosen)
  await page.locator(open).hover()
  await page.locator(open).focus()
  states['hover+fokus'] = await cardState(open)

  for (const [name, state] of Object.entries(states)) {
    expect(state.edge, name).toBe('0px 0px 0px 0px')
    expect(state.outline, name).toBe('none 0px')
  }

  /* Auf der gefuellten Karte ist alles weiss - Titel, Zeile darunter, Zeichen, Haekchen. */
  expect(states['gewaehlt']!.font).toBe('rgb(255, 255, 255)')
  for (const ink of states['gewaehlt']!.inner) {
    expect(ink).toMatch(/^rgba?\(255, 255, 255/)
  }
  /* Und auf der offenen dunkel - sie ist eine ruhige graue Flaeche. */
  expect(states['offen']!.font).not.toMatch(/^rgba?\(255, 255, 255/)

  /*
   * DIE PROBE AUFS GANZE: dieselbe Farbe wie eine angetippte Antwort im Spiel.
   * Gelesen wird sie nicht aus der Palette, sondern aus dem, was am Ende auf dem
   * Bildschirm steht - einmal hier, einmal dort.
   */
  const cardBlue = states['gewaehlt']!.ground
  await startGame(page, 'Zu zweit')
  await page.locator('[data-buzzer][data-side="left"]').click()
  const answer = page.locator('[data-answer][data-state="idle"] [data-answer-button]').first()
  await answer.click()
  await expect(page.locator('[data-answer][data-state="chosen"], [data-answer][data-state="selected"]')).toHaveCount(1)
  const answerBlue = await page
    .locator('[data-answer][data-state="chosen"] [data-answer-surface], [data-answer][data-state="selected"] [data-answer-surface]')
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(cardBlue).toBe(answerBlue)
})
