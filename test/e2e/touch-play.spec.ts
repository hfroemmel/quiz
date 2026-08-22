/**
 * Selbstbedienung am Touchgeraet (Stufe 4 der Mehrkontext-Ausbaustufe).
 *
 * Diese Tests laufen gegen den echten Server und das echte Quizpaket - ohne einen
 * einzigen Operatorbefehl. Genau das ist der Punkt: Wenn hier etwas haengt,
 * haengt es auch am Geraet, wo niemand eingreifen kann.
 */
import { expect, test, type Page } from '@playwright/test'
import { openOperator, resetToStartPanel } from './helpers.ts'

const enabledPad = '.answer-pad[data-enabled="true"]'

/**
 * Ein vorheriger Test kann ein Spiel offen gelassen haben. Am Geraet gibt es
 * bewusst keinen Ausstieg - im Kiosk uebernimmt das die Huelle, im eingebetteten
 * Betrieb der Gastgeber. Fuer den Test uebernimmt es der Operator, also der Weg,
 * der im Betrieb tatsaechlich existiert.
 */
async function resetServer(page: Page): Promise<void> {
  const operator = await openOperator(page)
  await resetToStartPanel(operator)
}

async function openStartScreen(page: Page): Promise<void> {
  await resetServer(page)
  await page.goto('/play')
  await expect(page.locator('.game-start')).toBeVisible({ timeout: 15_000 })
}

async function startGame(page: Page, players: 'Allein' | 'Zu zweit', preset = 'Leicht'): Promise<void> {
  await openStartScreen(page)
  await page.getByRole('button', { name: players }).click()
  await page.getByRole('button', { name: new RegExp(`^${preset}`) }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()
  await expect(page.locator(enabledPad).first()).toBeVisible({ timeout: 20_000 })
}

test('die Startauswahl fragt nur nach Spielerzahl und Schwierigkeit', async ({ page }) => {
  await openStartScreen(page)

  const labels = await page.locator('.game-start__label').allInnerTexts()
  expect(labels).toEqual(['Wie viele spielen?', 'Wie schwer?'])

  /*
   * Zur Wahl stehen nur Presets, die am Geraet auch spielbar sind. Die
   * Buehnenpresets enthalten einen Bilderkennen-Fragenplatz; dessen Fragen
   * muesste ein Mensch bewerten, und hier steht keiner.
   */
  const presets = await page.locator('.game-start__choice').nth(1).locator('.game-start__option').allInnerTexts()
  expect(presets.map((entry) => entry.split('\n')[0])).toEqual(['Leicht', 'Mittel', 'Schwer'])

  // Der Quizmodus gehoert zur Aufstellung, nicht auf den Bildschirm der Spieler.
  await expect(page.getByRole('button', { name: 'Allein' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zu zweit' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Erwachsene|Kinder/ })).toHaveCount(0)
})

test('Einzelspiel: eine Antwortleiste, und die Frage laeuft nach dem Tipp von selbst weiter', async ({ page }) => {
  await startGame(page, 'Allein')

  await expect(page.locator('.answer-pad')).toHaveCount(1)
  await expect(page.locator('.answer-pad--mirrored')).toHaveCount(0)
  await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'buzzer-open')

  await page.locator('.answer-pad__button').first().click()

  // Ohne Operator: Auswertung, Loesung und naechste Frage laufen selbst.
  await expect(page.locator('.stage')).toHaveAttribute('data-scene', 'solution', { timeout: 15_000 })
  await expect(page.locator('.stage')).toHaveAttribute('data-scene', 'pause', { timeout: 20_000 })
})

test('Duell: die zweite Leiste liegt gegenueber, und wer zuerst tippt, hat geantwortet', async ({ page }) => {
  await startGame(page, 'Zu zweit')

  // Zwei Leisten, die des zweiten Spielers um 180 Grad gedreht.
  await expect(page.locator('.answer-pad')).toHaveCount(2)
  const mirrored = page.locator('.answer-pad--mirrored')
  await expect(mirrored).toHaveCount(1)
  expect(await mirrored.evaluate((node) => getComputedStyle(node).transform)).toBe('matrix(-1, 0, 0, -1, 0, 0)')
  await expect(page.locator(enabledPad)).toHaveCount(2)

  await mirrored.locator('.answer-pad__button').first().click()

  // Der Spieler, der getippt hat, ist fuer diese Frage durch - in jedem Ausgang.
  await expect(page.locator('.answer-pad[data-player="player-2"]')).toHaveAttribute('data-enabled', 'false')
  await expect(page.locator('.stage')).not.toHaveAttribute('data-phase', 'buzzer-open')
})

test('die Leerlauf-Aufsicht gibt das Geraet wieder frei', async ({ page }) => {
  await resetServer(page)
  // Zwei Sekunden statt zwei Minuten - die Aufsicht kommt als Betriebsangabe herein.
  await page.goto('/play?idle=2')
  await page.getByRole('button', { name: 'Allein' }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()
  await expect(page.locator(enabledPad).first()).toBeVisible({ timeout: 20_000 })

  // Niemand tippt mehr: Das Spiel wird abgebrochen und die Auswahl kehrt zurueck.
  await expect(page.locator('.game-start')).toBeVisible({ timeout: 20_000 })
})

test('ein Einzelspiel laeuft ohne einen einzigen Operatorbefehl bis zum Ergebnis', async ({ page }) => {
  // Ein vollstaendiges Spiel mit sieben Fragen dauert laenger als ein Klicktest.
  test.setTimeout(180_000)
  await startGame(page, 'Allein')

  const stage = page.locator('.stage')
  // Antworten, sobald die Flaechen aktiv sind - sonst warten. Alles dazwischen
  // (Auswertung, Loesung, naechste Frage) macht der Server von selbst.
  const deadline = Date.now() + 150_000
  while (Date.now() < deadline) {
    if ((await stage.getAttribute('data-scene')) === 'result') break
    const pad = page.locator(`${enabledPad} .answer-pad__button`).first()
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
  await expect(page.locator('.result__label')).toHaveText('Ergebnis')
  const summary = await page.locator('.result__winner').innerText()
  const [correct, asked] = summary.match(/^(\d+) von (\d+) richtig$/)!.slice(1).map(Number)
  expect(correct).toBeLessThanOrEqual(asked!)
  expect(asked).toBeGreaterThan(0)
  await expect(page.getByRole('button', { name: 'Nochmal spielen' })).toBeVisible()
})
