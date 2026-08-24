/**
 * Selbstbedienung am Touchgeraet.
 *
 * Diese Tests laufen gegen den echten Server und das echte Quizpaket - ohne einen
 * einzigen Operatorbefehl. Genau das ist der Punkt: Wenn hier etwas haengt,
 * haengt es auch am Geraet, wo niemand eingreifen kann.
 */
import { expect, test, type Page } from '@playwright/test'
import { resetServer } from './helpers.ts'

const enabledPad = '[data-answer-pad][data-enabled="true"]'

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
  await expect(page.locator(enabledPad).first()).toBeVisible({ timeout: 30_000 })
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

test('Einzelspiel: eine Antwortleiste, und die Frage laeuft nach dem Tipp von selbst weiter', async ({ page }) => {
  await startGame(page, 'Allein')

  await expect(page.locator('[data-answer-pad]')).toHaveCount(1)
  await expect(page.locator('[data-answer-pad][data-mirrored="true"]')).toHaveCount(0)
  await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'buzzer-open')

  await page.locator(`${enabledPad} [data-answer-button]`).first().click()

  // Ohne Operator: Auswertung, Loesung und naechste Frage laufen selbst.
  await expect(page.locator('.stage')).toHaveAttribute('data-scene', 'solution', { timeout: 20_000 })
  await expect(page.locator('.stage')).toHaveAttribute('data-scene', 'pause', { timeout: 25_000 })
})

test('die Antworten stehen genau einmal auf dem Tisch - als Schaltflaechen', async ({ page }) => {
  /*
   * Die Buehne zeigt die Antworten in der Szene, das Geraet in den Leisten. Beides
   * zugleich hiesse: dieselben vier Antworten doppelt, und getippt werden koennte
   * nur auf einer der beiden Fassungen.
   */
  await startGame(page, 'Allein')

  const pad = page.locator('[data-answer-pad]')
  const rows = await pad.locator('[data-answer]').count()
  expect(rows).toBeGreaterThan(1)
  // Ausserhalb der Leiste steht keine zweite Fassung derselben Antworten.
  expect(await page.locator('[data-answer]').count()).toBe(rows)
  // Und jede Zeile ist eine echte Schaltflaeche, keine Flaeche mit Klickfaenger.
  await expect(pad.locator('[data-answer-button]')).toHaveCount(rows)
})

test('Duell: die zweite Leiste liegt gegenueber, und wer zuerst tippt, hat geantwortet', async ({ page }) => {
  await startGame(page, 'Zu zweit')

  // Zwei Leisten, die des zweiten Spielers um 180 Grad gedreht.
  await expect(page.locator('[data-answer-pad]')).toHaveCount(2)
  const mirrored = page.locator('[data-answer-pad][data-mirrored="true"]')
  await expect(mirrored).toHaveCount(1)
  expect(await mirrored.evaluate((node) => getComputedStyle(node).transform)).toBe('matrix(-1, 0, 0, -1, 0, 0)')
  await expect(page.locator(enabledPad)).toHaveCount(2)

  await mirrored.locator('[data-answer-button]').first().click()

  // Der Spieler, der getippt hat, ist fuer diese Frage durch - in jedem Ausgang.
  await expect(page.locator('[data-answer-pad][data-player="player-2"]')).toHaveAttribute('data-enabled', 'false')
  await expect(page.locator('.stage')).not.toHaveAttribute('data-phase', 'buzzer-open')
})

test('alle Antwortzeilen bleiben im Bild - auch mit zwei Leisten', async ({ page }) => {
  /*
   * Zwei Leisten und die Szene teilen sich eine Flaeche. Waere eine davon fest
   * bemessen, liefe die letzte Zeile unten aus dem Bild - und ausgerechnet
   * Antwort D fehlte, ohne dass etwas nach einem Fehler aussieht.
   */
  await startGame(page, 'Zu zweit')

  const bottom = await page.locator('.stage').evaluate((stage) => stage.getBoundingClientRect().bottom)
  const rows = await page.locator('[data-answer]').all()
  // Zwei Leisten mit denselben Antworten - wie viele es sind, sagt die Frage.
  expect(rows.length).toBeGreaterThanOrEqual(4)
  expect(rows.length % 2).toBe(0)
  for (const row of rows) {
    const box = (await row.boundingBox())!
    expect(Math.round(box.y + box.height)).toBeLessThanOrEqual(Math.round(bottom))
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
  await expect(page.locator(enabledPad).first()).toBeVisible({ timeout: 30_000 })

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
    const pad = page.locator(`${enabledPad} [data-answer-button]`).first()
    if (await pad.isVisible().catch(() => false)) {
      // Kurzer Anlauf: Zwischen Pruefung und Tipp kann die Flaeche verschwinden,
      // etwa weil das Spiel in diesem Moment endet.
      await pad.click({ timeout: 2_000 }).catch(() => undefined)
      continue
    }
    await page.waitForTimeout(300)
  }

  await expect(stage).toHaveAttribute('data-scene', 'result', { timeout: 30_000 })
  // Solo-Ergebnis: kein Gewinner, sondern die eigene Trefferzahl.
  await expect(page.locator('[data-result-label]')).toHaveText('Ergebnis')
  await expect(page.getByRole('button', { name: 'Nochmal spielen' })).toBeVisible()
})
