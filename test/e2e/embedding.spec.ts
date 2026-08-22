/**
 * Einbettungsvertrag im Browser (Stufe 6 der Mehrkontext-Ausbaustufe).
 *
 * Geprueft wird an der Beispielsammlung unter `/shell`, also an einer fremden
 * Anwendung, die das Quiz einbindet - nicht am Quiz selbst. Die entscheidende
 * Frage lautet: Bleibt nach dem Verlassen etwas zurueck?
 *
 * Der Nachweis kommt vom Server, nicht aus dem Browser: Er zaehlt seine
 * verbundenen Clients. Ein vergessener WebSocket faellt dort auf, ein
 * geschlossener nicht.
 */
import { expect, test, type Page } from '@playwright/test'
import { resetServer } from './helpers.ts'

/** Zahl der verbundenen Clients aus der Operatordiagnose. */
async function connectedClients(operator: Page): Promise<number> {
  const value = operator.locator('.diagnostics__facts dd').last()
  return Number(await value.innerText())
}

/**
 * Die Tests teilen sich einen Server. Ein Spiel aus einem frueheren Test wuerde
 * die Sammlung mit einer laufenden Partie begruessen statt mit der Auswahl.
 */
test.beforeEach(async ({ page }) => {
  await resetServer(page)
})

async function openDiagnostics(page: Page): Promise<Page> {
  await page.goto('/operator')
  await expect(page.locator('.operator')).toBeVisible()
  const summary = page.getByText('Technik, Protokoll und Verbindung')
  if (!(await page.locator('.diagnostics__facts').isVisible().catch(() => false))) {
    await summary.click()
  }
  await expect(page.locator('.diagnostics__facts')).toBeVisible()
  return page
}

test('das Quiz hinterlaesst in der Gastgeberanwendung keine Verbindung', async ({ browser }) => {
  const watcher = await openDiagnostics(await browser.newPage())
  const shell = await browser.newPage()

  await shell.goto('/shell')
  await expect(shell.locator('.shell__menu')).toBeVisible()
  const base = await connectedClients(watcher)

  // Zwei Runden nacheinander: einbinden, verlassen, wieder einbinden.
  for (const round of [1, 2]) {
    await shell.getByRole('button', { name: 'Quiz' }).click()
    await expect(shell.locator('.game-start')).toBeVisible({ timeout: 15_000 })
    await expect
      .poll(() => connectedClients(watcher), { message: `Runde ${round}: Client verbunden` })
      .toBe(base + 1)

    await shell.getByRole('button', { name: 'Zur Sammlung' }).click()
    await expect(shell.locator('.shell__menu')).toBeVisible()
    // Nach dem Entfernen der Komponente ist die Verbindung wieder zu.
    await expect
      .poll(() => connectedClients(watcher), { message: `Runde ${round}: Verbindung abgebaut` })
      .toBe(base)
  }

  await shell.close()
  await watcher.close()
})

test('das Quiz bleibt in seinem Kasten und faerbt die Sammlung nicht um', async ({ page }) => {
  await page.goto('/shell')
  const bar = page.locator('.shell__bar')
  const before = await bar.evaluate((node) => getComputedStyle(node).backgroundColor)

  await page.getByRole('button', { name: 'Quiz' }).click()
  await expect(page.locator('.game-start')).toBeVisible({ timeout: 15_000 })

  // Die Leiste der Sammlung sieht unveraendert aus.
  expect(await bar.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(before)

  // Und das Quiz haelt sich an die Flaeche, die der Gastgeber ihm gibt.
  const frame = await page.locator('.shell__frame').boundingBox()
  const game = await page.locator('.quiz-game').boundingBox()
  expect(game!.y).toBeGreaterThanOrEqual(frame!.y - 1)
  expect(game!.height).toBeLessThanOrEqual(frame!.height + 1)

  await page.getByRole('button', { name: 'Zur Sammlung' }).click()
  await expect(page.locator('.shell__menu')).toBeVisible()
})

test('das Ergebnis eines Spiels erreicht die Gastgeberanwendung', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('/shell')
  await page.getByRole('button', { name: 'Quiz' }).click()
  await expect(page.locator('.game-start')).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: 'Allein' }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()

  const stage = page.locator('.stage')
  const deadline = Date.now() + 150_000
  while (Date.now() < deadline) {
    if ((await stage.getAttribute('data-scene')) === 'result') break
    const pad = page.locator('.answer-pad[data-enabled="true"] .answer-pad__button').first()
    if (await pad.isVisible().catch(() => false)) {
      await pad.click({ timeout: 2_000 }).catch(() => undefined)
      continue
    }
    await page.waitForTimeout(300)
  }
  await expect(stage).toHaveAttribute('data-scene', 'result', { timeout: 30_000 })

  // `onFinished` hat die Sammlung erreicht - sie zeigt das Ergebnis in ihrer
  // eigenen Darstellung, nicht in der des Quiz.
  await page.getByRole('button', { name: 'Zur Sammlung' }).click()
  await expect(page.locator('.shell__result')).toContainText('richtig')
  await expect(page.locator('.shell__result')).toHaveAttribute('data-rounds', '1')
})
