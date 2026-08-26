/**
 * Selbstbedienung am Touchgeraet.
 *
 * Diese Tests laufen gegen den echten Server und das echte Quizpaket - ohne einen
 * einzigen Operatorbefehl. Genau das ist der Punkt: Wenn hier etwas haengt,
 * haengt es auch am Geraet, wo niemand eingreifen kann.
 */
import { expect, test, type Page } from '@playwright/test'
import { resetServer } from './helpers'

/** Die Antwortzeilen der Szene sind da und tippbar. */
const offeneAntwort = '[data-answers] [data-answer-button]:not([disabled])'
const freierBuzzer = '[data-buzzer][data-enabled="true"]'

async function openStartScreen(page: Page): Promise<void> {
  await resetServer(page)
  await page.goto('/play')
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
}

async function startGame(page: Page, players: 'Allein' | 'Zu zweit', preset = 'Leicht'): Promise<void> {
  await openStartScreen(page)
  await page.getByRole('button', { name: players }).click()
  await page.getByRole('button', { name: new RegExp(`^${preset}`) }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
}

/**
 * Antworten, wie es am Geraet zugeht: im Duell erst buzzern, dann tippen.
 *
 * Im Einzelspiel gibt es keinen Buzzer - dort steht der Spieler ohnehin fest.
 */
async function antworte(page: Page, seite?: 'left' | 'right'): Promise<void> {
  if (seite) await page.locator(`[data-buzzer][data-side="${seite}"]`).click()
  await page.locator(offeneAntwort).first().click()
}

/** Nach der Loesung geht es nur weiter, wenn ein Spieler tippt. */
async function weiter(page: Page): Promise<void> {
  await page.locator('[data-continue]').click()
}

test('die Startauswahl fragt nur nach Spielerzahl und Schwierigkeit', async ({ page }) => {
  await openStartScreen(page)

  expect(await page.locator('[data-choice-label]').allInnerTexts()).toEqual(['Wie viele spielen?', 'Wie schwer?'])

  /*
   * Zur Wahl stehen nur Presets, die am Geraet auch spielbar sind. Die
   * Buehnenpresets enthalten einen Bilderkennen-Fragenplatz; dessen Fragen
   * muesste ein Mensch bewerten, und hier steht keiner.
   */
  const presets = await page.locator('[data-preset-options] button').allInnerTexts()
  expect(presets.map((entry) => entry.split('\n')[0])).toEqual(['Leicht', 'Mittel', 'Schwer'])

  // Der Quizmodus gehoert zur Aufstellung, nicht auf den Bildschirm der Spieler.
  await expect(page.getByRole('button', { name: 'Allein' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zu zweit' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Erwachsene|Kinder/ })).toHaveCount(0)
})

test('erst steht die Frage allein, dann kommen Antworten und Buzzer', async ({ page }) => {
  /*
   * Am Geraet liest niemand die Frage vor. Die Frist davor ist der Ersatz: Wer
   * noch liest, soll nicht vom schnelleren Daumen ueberholt werden. Solange sie
   * laeuft, sind die Antworten nicht einmal auf der Leitung.
   */
  await openStartScreen(page)
  await page.getByRole('button', { name: 'Zu zweit' }).click()
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

  // Der Spieler, der getippt hat, ist fuer diese Frage durch - in jedem Ausgang.
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
  await resetServer(page)
  /*
   * Acht Sekunden statt zwei Minuten - die Aufsicht kommt als Betriebsangabe
   * herein. Kuerzer darf sie hier nicht sein: Die Frist laeuft ab dem Start des
   * Spiels, und der Vorspann aus Video und Zwischenscreen gehoert noch dazu.
   */
  await page.goto('/play?idle=8')
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Allein' }).click()
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
