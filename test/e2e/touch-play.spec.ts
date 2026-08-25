/**
 * Selbstbedienung am Touchgeraet.
 *
 * Diese Tests laufen gegen den echten Server und das echte Quizpaket - ohne einen
 * einzigen Operatorbefehl. Genau das ist der Punkt: Wenn hier etwas haengt,
 * haengt es auch am Geraet, wo niemand eingreifen kann.
 */
import { expect, test, type Page } from '@playwright/test'
import { resetServer } from './helpers.ts'

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

test('Einzelspiel: kein Buzzer, und die Frage laeuft nach dem Tipp von selbst weiter', async ({ page }) => {
  await startGame(page, 'Allein')

  // Gegen wen sollte man sich melden? Die Antworten sind sofort offen.
  await expect(page.locator('[data-buzzer]')).toHaveCount(0)
  await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'buzzer-open')

  await antworte(page)

  // Ohne Operator: Auswertung, Loesung und naechste Frage laufen selbst.
  await expect(page.locator('.stage')).toHaveAttribute('data-scene', 'solution', { timeout: 20_000 })
  await expect(page.locator('.stage')).toHaveAttribute('data-scene', 'pause', { timeout: 25_000 })
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

test('die Szene bleibt zwischen den Buzzern, und nichts ueberdeckt sich', async ({ page }) => {
  /*
   * Die Buzzer haben eine feste Breite, die Szene bekommt den Rest. Waeren sie
   * mitwachsende Flexkinder, schoebe eine lange Frage sie zusammen - oder die
   * Antwortzeilen liefen unter einen Buzzer, und der Tipp landete auf der
   * falschen Flaeche.
   */
  await startGame(page, 'Zu zweit')

  const links = (await page.locator('[data-buzzer][data-side="left"]').boundingBox())!
  const rechts = (await page.locator('[data-buzzer][data-side="right"]').boundingBox())!
  const buehne = (await page.locator('.stage').boundingBox())!

  const zeilen = await page.locator('[data-answer]').all()
  expect(zeilen.length).toBeGreaterThanOrEqual(4)
  for (const zeile of zeilen) {
    const box = (await zeile.boundingBox())!
    expect(Math.round(box.x)).toBeGreaterThanOrEqual(Math.round(links.x + links.width))
    expect(Math.round(box.x + box.width)).toBeLessThanOrEqual(Math.round(rechts.x))
    expect(Math.round(box.y + box.height)).toBeLessThanOrEqual(Math.round(buehne.y + buehne.height))
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
    await page.waitForTimeout(300)
  }

  await expect(stage).toHaveAttribute('data-scene', 'result', { timeout: 30_000 })
  // Solo-Ergebnis: kein Gewinner, sondern die eigene Trefferzahl.
  await expect(page.locator('[data-result-label]')).toHaveText('Ergebnis')
  await expect(page.getByRole('button', { name: 'Nochmal spielen' })).toBeVisible()
})
