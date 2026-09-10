/**
 * Selbstbedienung am Touchgeraet.
 *
 * Diese Tests laufen gegen das echte Quizpaket und dieselbe Engine wie die
 * Buehne - nur ohne Server, ueber eine `LocalQuizRuntime` im Browser, und ohne
 * einen einzigen Operatorbefehl. Genau das ist der Punkt: Wenn hier etwas
 * haengt, haengt es auch am Geraet, wo niemand eingreifen kann.
 */
import { expect, test, type Page } from '@playwright/test'
import { offeneAntwort } from './helpers'

const freierBuzzer = '[data-buzzer][data-enabled="true"]'

/** Ein Hexwert, wie `getComputedStyle` ihn meldet: `rgb(r, g, b)`. */
function farbe(hex: string): string {
  const roh = hex.replace('#', '')
  const voll = roh.length === 3 ? [...roh].map((zeichen) => zeichen + zeichen).join('') : roh
  const [r, g, b] = [0, 2, 4].map((stelle) => parseInt(voll.slice(stelle, stelle + 2), 16))
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
async function antworte(page: Page, seite?: 'left' | 'right'): Promise<void> {
  if (seite) await page.locator(`[data-buzzer][data-side="${seite}"]`).click()
  await page.locator(offeneAntwort).first().click()
  await page.locator('[data-confirm]').click()
}

/** Nach der Loesung geht es nur weiter, wenn ein Spieler tippt. */
async function weiter(page: Page): Promise<void> {
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
  for (const stufe of ['touch-easy', 'touch-medium', 'touch-hard']) {
    await expect(page.locator(`[data-preset="${stufe}"]`)).toContainText(/\d+ Fragen/)
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

  const farben = await page.locator('[data-quiz-game]').evaluate((node) => {
    const gemessen = getComputedStyle(node)
    const wert = (name: string) => gemessen.getPropertyValue(name).trim()
    return { grund: wert('--start-bg-top'), auswahl: wert('--start-selected'), gruen: wert('--start-green') }
  })
  // Papier, nicht Nacht.
  expect(farben.grund).toBe('#fff')
  /*
   * DIE AUSWAHL IST NICHT DIE HANDLUNG. Beide waren dasselbe Gruen; auf Papier
   * traegt die Auswahl das Blau der markierten Antwort, und Gruen gehoert
   * allein dem Knopf, der das Spiel startet.
   */
  expect(farben.auswahl).not.toBe(farben.gruen)
})

test('gewaehlt, offen und die drei Zustaende dazwischen sind zu unterscheiden', async ({ page }) => {
  await openStartScreen(page)

  const gewaehlt = page.locator('[data-preset][aria-pressed="true"]').first()
  const offen = page.locator('[data-preset][aria-pressed="false"]').first()
  const auswahl = await page
    .locator('[data-quiz-game]')
    .evaluate((node) => getComputedStyle(node).getPropertyValue('--start-selected').trim())

  /*
   * Die gewaehlte Karte ist ins Blau gekippt und traegt seine Kante; ihre
   * Schrift bleibt dieselbe Tinte wie auf den anderen Karten.
   */
  const stand = await gewaehlt.evaluate((node) => {
    const gemessen = getComputedStyle(node)
    return { kante: gemessen.borderTopColor, flaeche: gemessen.backgroundColor, schrift: gemessen.color }
  })
  const offenerStand = await offen.evaluate((node) => {
    const gemessen = getComputedStyle(node)
    return { kante: gemessen.borderTopColor, flaeche: gemessen.backgroundColor, schrift: gemessen.color }
  })
  expect(stand.kante).not.toBe(offenerStand.kante)
  expect(stand.flaeche).not.toBe(offenerStand.flaeche)
  expect(stand.schrift).toBe(offenerStand.schrift)
  // Und die Auswahlmarke traegt genau die Auswahlfarbe.
  await expect(gewaehlt.locator('[data-on="true"]')).toHaveCSS('background-color', farbe(auswahl))

  // Zeigen: die Kante der offenen Karte nimmt die Auswahlfarbe an.
  await offen.hover()
  expect(await offen.evaluate((node) => getComputedStyle(node).borderTopColor)).not.toBe(offenerStand.kante)

  // Tastaturmarke: ein eigener Ring AUSSERHALB der Kante.
  await offen.focus()
  const ring = await offen.evaluate((node) => {
    const gemessen = getComputedStyle(node)
    return { breite: gemessen.outlineWidth, farbe: gemessen.outlineColor }
  })
  expect(ring.breite).not.toBe('0px')
  expect(ring.farbe).not.toBe('rgba(0, 0, 0, 0)')

  /*
   * Gesperrt: Der Startknopf tritt zurueck, bleibt aber sichtbar. Er ist im
   * Betrieb nie gesperrt - eine Stufe ist immer vorgewaehlt -, und genau
   * deshalb wird der Zustand hier erzwungen statt erspielt.
   */
  const start = page.locator('[data-start]')
  const wach = await start.evaluate((node) => getComputedStyle(node).opacity)
  const gesperrt = await start.evaluate((node) => {
    ;(node as HTMLButtonElement).disabled = true
    return getComputedStyle(node).opacity
  })
  expect(Number(gesperrt)).toBeLessThan(Number(wach))
})

test('Gruen traegt allein der Startknopf', async ({ page }) => {
  await openStartScreen(page)
  const gruen = await page
    .locator('[data-quiz-game]')
    .evaluate((node) => getComputedStyle(node).getPropertyValue('--start-green').trim())

  // Auf dem Knopf: als Flaeche, mit heller Aufschrift darauf.
  const knopf = await page.locator('[data-start]').evaluate((node) => {
    const gemessen = getComputedStyle(node)
    return { grund: gemessen.backgroundImage, schrift: gemessen.color }
  })
  expect(knopf.grund).toContain(farbe(gruen))
  expect(knopf.schrift).toBe('rgb(255, 255, 255)')

  // Nirgends sonst: nicht auf einer Karte, nicht auf der Marke, nicht am Rueckweg.
  const anderswo = await page.evaluate(() => {
    const orte = ['[data-preset][aria-pressed="true"]', '[data-player-count][aria-pressed="true"]', '[data-game-start] button:not([data-start])']
    return orte.flatMap((ort) =>
      [...document.querySelectorAll(ort)].map((node) => {
        const gemessen = getComputedStyle(node as Element)
        return [gemessen.backgroundColor, gemessen.borderTopColor, gemessen.color].join(' ')
      }),
    )
  })
  expect(anderswo.join(' ')).not.toContain(farbe(gruen))
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
async function zeichnung(page: Page, wahl: string, pseudo = '::before'): Promise<string> {
  return page.locator(wahl).first().evaluate((node, ps) => {
    const quelle = getComputedStyle(node as Element, ps as string).borderImageSource
    return (quelle.match(/[\w-]+\.svg/)?.[0] ?? quelle.slice(0, 40)) as string
  }, pseudo)
}

test('das Kindergeraet traegt seine Welt schon in der Auswahl', async ({ page }) => {
  await page.goto('/play?audience=kids')
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })

  await expect(page.locator('[data-quiz-game]')).toHaveAttribute('data-skin', 'kids')

  // Die Auswahlkarten sind dieselben gemalten Kartons wie die Antwortzeilen.
  expect(await zeichnung(page, '[data-preset][aria-pressed="false"]')).toBe('answer-box-a.svg')

  /*
   * GEWAEHLT SIEHT AUS WIE EINE GEWAEHLTE ANTWORT: rote Karte, weisse Schrift.
   * Kein gruener Ring und keine gruene Kante - das Gruen ist die Auswahlfarbe
   * der Erwachsenen und hat in dieser Welt keine Bedeutung.
   */
  const gewaehlt = page.locator('[data-preset][aria-pressed="true"]').first()
  expect(await zeichnung(page, '[data-preset][aria-pressed="true"]')).toBe('answer-box-b.svg')
  const kante = await gewaehlt.evaluate((node) => {
    const s = getComputedStyle(node)
    return { farbe: s.color, breite: s.borderTopWidth }
  })
  expect(kante.farbe).toBe('rgb(255, 255, 255)')
  expect(kante.breite).toBe('0px')
})

test('der primaere Knopf der Kinderwelt ist ueberall derselbe', async ({ page }) => {
  /*
   * "Los geht\'s" in der Auswahl und "Antwort abgeben und aufloesen" in der
   * Fussleiste sind zwei Bauteile an zwei Orten - und muessen aus derselben
   * Zeichnung kommen. Sonst hat die Welt zwei primaere Knoepfe.
   */
  await page.goto('/play?audience=kids')
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
  const inDerAuswahl = await zeichnung(page, '[data-start]')

  await page.getByRole('button', { name: /^Allein/ }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.locator('[data-start]').click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })

  await page.locator(offeneAntwort).first().click()
  await expect(page.locator('[data-confirm]')).toBeVisible()
  const imSpiel = await zeichnung(page, '[data-confirm]')

  expect(imSpiel).toBe(inDerAuswahl)
})

test('die Erwachsenenauswahl bleibt ungezeichnet', async ({ page }) => {
  // Die Kinderwelt darf die andere nicht anfassen.
  await openStartScreen(page)
  await expect(page.locator('[data-quiz-game]')).toHaveAttribute('data-skin', 'default')
  expect(await zeichnung(page, '[data-preset]')).toBe('none')
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
  await expect(page.locator(freierBuzzer)).toHaveCount(2)
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
  await expect(page.locator(freierBuzzer)).toHaveCount(2)
})

test('nach der Loesung wartet das Geraet auf "Weiter"', async ({ page }) => {
  await startGame(page, 'Allein')
  const stage = page.locator('.stage')
  const frage = await page.locator('[data-prompt]').first().innerText()

  await antworte(page)
  await expect(stage).toHaveAttribute('data-scene', 'solution', { timeout: 20_000 })

  /*
   * Und bleibt dort. Frueher plante der Server hier einen Uebergang ein; wer
   * gerade noch las, warum seine Antwort falsch war, verlor das Bild.
   */
  await page.waitForTimeout(8_000)
  await expect(stage).toHaveAttribute('data-scene', 'solution')
  await expect(page.locator('[data-prompt]').first()).toHaveText(frage)
  // Aufgeloest heisst: niemand buzzert mehr und niemand tippt mehr.
  await expect(page.locator(freierBuzzer)).toHaveCount(0)
  await expect(page.locator(offeneAntwort)).toHaveCount(0)

  await weiter(page)
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
  await antworte(page)
  await expect(page.locator('[data-continue]')).toBeVisible({ timeout: 20_000 })

  const breite = page.viewportSize()!.width
  const knopf = (await page.locator('[data-continue]').boundingBox())!
  expect(Math.round(knopf.x + knopf.width / 2)).toBe(Math.round(breite / 2))

  // Der Zaehler steht rechts vom Knopf, die Punktekarte links davon.
  const zaehler = (await page.locator('[data-counter]').boundingBox())!
  const karte = (await page.locator('[data-score]').boundingBox())!
  expect(zaehler.x).toBeGreaterThan(knopf.x + knopf.width)
  expect(karte.x + karte.width).toBeLessThan(knopf.x)
})

test('Hinweis und "Weiter" teilen sich ein Feld fester Hoehe', async ({ page }) => {
  await startGame(page, 'Allein')

  const feld = page.locator('[data-notice]')
  const leer = (await feld.boundingBox())!
  const zaehler = (await page.locator('[data-counter]').boundingBox())!

  await antworte(page)
  await expect(page.locator('[data-continue]')).toBeVisible({ timeout: 20_000 })

  /*
   * Feld und Zaehler stehen exakt wie vorher. Ohne feste Hoehe rutschte alles
   * darueber ein Stueck, sobald aus dem Hinweis ein Knopf wird - und zwar in
   * dem Moment, in dem jemand mit dem Finger zielt.
   */
  const mitKnopf = (await feld.boundingBox())!
  expect(Math.round(mitKnopf.height)).toBe(Math.round(leer.height))
  expect(Math.round(mitKnopf.y)).toBe(Math.round(leer.y))
  const zaehlerDanach = (await page.locator('[data-counter]').boundingBox())!
  expect(Math.round(zaehlerDanach.y)).toBe(Math.round(zaehler.y))
})

test('Einzelspiel: kein Buzzer, und die Auswertung laeuft ohne Operator', async ({ page }) => {
  await startGame(page, 'Allein')

  // Gegen wen sollte man sich melden? Sobald die Antworten stehen, sind sie offen.
  await expect(page.locator('[data-buzzer]')).toHaveCount(0)
  await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'buzzer-open')

  await antworte(page)

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
  await expect(page.locator(freierBuzzer)).toHaveCount(2)
  // Solange niemand gedrueckt hat, gehoeren die Antworten niemandem.
  await expect(page.locator(offeneAntwort)).toHaveCount(0)

  await page.locator('[data-buzzer][data-side="right"]').click()

  // Der Zuschlag steht am Buzzer selbst, und der andere tritt zurueck.
  await expect(page.locator('[data-buzzer][data-side="right"]')).toHaveAttribute('data-armed', 'true')
  await expect(page.locator(freierBuzzer)).toHaveCount(0)
  const rows = await page.locator('[data-answer]').count()
  await expect(page.locator(offeneAntwort)).toHaveCount(rows)

  await page.locator(offeneAntwort).first().click()

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

  for (const [breite, hoehe] of [
    [1920, 1080],
    [1280, 720],
    [1024, 768],
  ]) {
    await page.setViewportSize({ width: breite, height: hoehe })
    // Ein Frame fuer den Umbruch - die Frage misst sich nach der Groesse neu.
    await page.waitForTimeout(300)

    const fuss = (await page.locator('[data-player-foot]').boundingBox())!
    const zeilen = await page.locator('[data-answer]').all()
    expect(zeilen.length, `${breite}x${hoehe}`).toBeGreaterThanOrEqual(4)
    for (const zeile of zeilen) {
      const box = (await zeile.boundingBox())!
      expect(Math.round(box.y + box.height), `${breite}x${hoehe}`).toBeLessThanOrEqual(Math.round(fuss.y))
    }
  }
})

test('Punkte und Zaehler stehen unten bei den Buzzern, nicht in der Kopfzeile', async ({ page }) => {
  await startGame(page, 'Zu zweit')

  const fuss = page.locator('[data-player-foot]')
  await expect(fuss.locator('[data-score]')).toHaveCount(2)
  await expect(fuss.locator('[data-counter]')).toHaveCount(1)
  // Die Kopfzeile traegt am Geraet nur noch die Wortmarke.
  await expect(page.locator('header [data-score]')).toHaveCount(0)
  await expect(page.locator('[data-brand]')).toBeVisible()

  /*
   * Jede Ecke gehoert einem Spieler: Die Punktekarte steht ueber SEINEM Buzzer
   * und auf derselben Seite. Daran - und nicht am Lesen - erkennt er im Spiel,
   * wo er hinschlagen muss.
   */
  for (const [seite, nummer] of [
    ['left', '1'],
    ['right', '2'],
  ]) {
    const karte = (await page.locator(`[data-score][data-player="${nummer}"]`).boundingBox())!
    const buzzer = (await page.locator(`[data-buzzer][data-side="${seite}"]`).boundingBox())!
    expect(Math.round(karte.x), seite).toBe(Math.round(buzzer.x))
    expect(karte.y + karte.height, seite).toBeLessThanOrEqual(buzzer.y + 1)
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
    const abgeben = page.locator('[data-confirm]')
    if (await abgeben.isVisible().catch(() => false)) {
      await abgeben.click({ timeout: 2_000 }).catch(() => undefined)
      continue
    }
    const zeile = page.locator(offeneAntwort).first()
    if (await zeile.isVisible().catch(() => false)) {
      // Kurzer Anlauf: Zwischen Pruefung und Tipp kann die Flaeche verschwinden,
      // etwa weil das Spiel in diesem Moment endet.
      await zeile.click({ timeout: 2_000 }).catch(() => undefined)
      continue
    }
    // Nach der Loesung wartet das Geraet auf einen Tipp - auch im Einzelspiel.
    const knopf = page.locator('[data-continue]')
    if (await knopf.isVisible().catch(() => false)) {
      await knopf.click({ timeout: 2_000 }).catch(() => undefined)
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

  const einstellungen = page.locator('[data-settings]')
  await expect(einstellungen).toBeVisible()
  await expect(einstellungen.locator('[data-sound-on]')).toHaveAttribute('aria-pressed', 'true')
  await expect(einstellungen.locator('[data-sound-test]')).toBeVisible()
  await expect(einstellungen.locator('[data-zoom]')).toHaveValue('1')

  await page.locator('[data-settings-close]').click()
  await expect(einstellungen).toHaveCount(0)

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

  const szene = page.locator('[data-scene-root]')
  const gross = await szene.boundingBox()
  const linkeEckeGross = await page.locator('[data-corner="left"]').boundingBox()
  const flaeche = await page.locator('[data-quiz-game]').boundingBox()

  await page.evaluate(() => {
    const wurzel = document.querySelector('[data-quiz-game]') as HTMLElement
    wurzel.style.setProperty('--stage-zoom', '0.7')
  })

  const klein = await szene.boundingBox()
  const linkeEckeKlein = await page.locator('[data-corner="left"]').boundingBox()

  // Die Szene wird kleiner ...
  expect(klein!.width).toBeLessThan(gross!.width * 0.8)
  // ... und bleibt dabei mittig: Der Abstand nach links und rechts ist gleich.
  const links = klein!.x - flaeche!.x
  const rechts = flaeche!.x + flaeche!.width - (klein!.x + klein!.width)
  expect(Math.abs(links - rechts)).toBeLessThan(4)

  // Die Punktekarte schrumpft mit, rueckt aber nicht von der Kante ab.
  expect(linkeEckeKlein!.width).toBeLessThan(linkeEckeGross!.width * 0.8)
  expect(linkeEckeKlein!.x - flaeche!.x).toBeLessThan(linkeEckeGross!.x - flaeche!.x + 1)
})

test('die Zoomstufe gilt auch fuer Auswahl und Einstellungen', async ({ page }) => {
  /*
   * Wer die Anzeige kleiner stellt, weil er sonst nicht hinuebersieht, meint
   * die Auswahl davor genauso wie die Frage danach. Eine Auswahl in voller
   * Groesse vor einem verkleinerten Spiel waere die halbe Einstellung.
   */
  await openStartScreen(page)
  const auswahlGross = (await page.locator('[data-game-start]').boundingBox())!.width

  await page.locator('[data-settings-open]').click()
  const karteGross = (await page.locator('[data-settings] > div').boundingBox())!.width
  await page.locator('[data-zoom]').fill('0.7')
  const karteKlein = (await page.locator('[data-settings] > div').boundingBox())!.width
  await page.locator('[data-settings-close]').click()
  const auswahlKlein = (await page.locator('[data-game-start]').boundingBox())!.width

  expect(auswahlKlein).toBeLessThan(auswahlGross * 0.8)
  expect(karteKlein).toBeLessThan(karteGross * 0.8)
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
    const wurzel = document.querySelector('[data-quiz-game]') as HTMLElement
    wurzel.style.setProperty('--stage-zoom', '0.7')
  })
  await page.getByRole('button', { name: /^Allein/ }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()

  await page.waitForSelector('[data-scene-root]', { timeout: 30_000 })
  const gemessen: number[] = []
  for (let i = 0; i < 12; i += 1) {
    gemessen.push((await page.locator('[data-scene-root]').boundingBox())!.width)
    await page.waitForTimeout(60)
  }
  expect(Math.max(...gemessen) - Math.min(...gemessen)).toBeLessThan(2)
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

  const umschalter = page.locator('[data-languages]')
  await expect(umschalter).toBeVisible()
  await expect(page.locator('[data-locale="de-DE"]')).toHaveAttribute('aria-pressed', 'true')

  // Deutsch: die Oberflaeche und die Namen der Schwierigkeitsstufen.
  await expect(page.getByRole('button', { name: /^Allein/ })).toBeVisible()
  const deutschePresets = await page.locator('[data-preset-options] button').allInnerTexts()
  expect(deutschePresets.map((eintrag) => eintrag.split('\n')[0])).toEqual(['Leicht', 'Mittel', 'Schwer'])

  await page.locator('[data-locale="en-GB"]').click()

  await expect(page.locator('[data-locale="en-GB"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /^Alone/ })).toBeVisible()
  const englischePresets = await page.locator('[data-preset-options] button').allInnerTexts()
  expect(englischePresets.map((eintrag) => eintrag.split('\n')[0])).toEqual(['Easy', 'Medium', 'Hard'])
  await expect(page.getByRole('button', { name: "Let's go" })).toBeVisible()

  // Und das Spiel selbst laeuft in derselben Sprache weiter.
  await page.getByRole('button', { name: 'Alone' }).click()
  await page.getByRole('button', { name: /^Easy/ }).click()
  await page.getByRole('button', { name: "Let's go" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })

  await expect(page.locator('[data-prompt]')).toContainText('Test question')
  const antworten = await page.locator('[data-answer]').allInnerTexts()
  expect(antworten.join(' ')).toMatch(/Correct answer|Wrong answer/)
  await expect(page.locator('[data-score-label]').first()).toHaveText('Player')
})

test('ohne zweite Sprache gibt es nichts umzuschalten', async ({ page }) => {
  /*
   * Der Umschalter haengt an der Konfiguration und nicht am Code: Ein Bestand
   * mit einer Sprache zeigt eine Auswahl mit genau einer Moeglichkeit nicht -
   * das waere keine Auswahl, sondern eine Huerde.
   */
  await openStartScreen(page)
  const sprachen = await page.locator('[data-languages] button').count()
  expect(sprachen).toBeGreaterThan(1)
})
