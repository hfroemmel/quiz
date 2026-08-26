/**
 * Einbettungsvertrag im Browser.
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
import { openOperator, resetServer } from './helpers'

/** Zahl der verbundenen Clients aus der Operatordiagnose. */
async function connectedClients(operator: Page): Promise<number> {
  return Number(await operator.locator('[data-connected-clients]').innerText())
}

async function openDiagnostics(page: Page): Promise<Page> {
  const operator = await openOperator(page)
  if (!(await operator.locator('[data-diagnostics-facts]').isVisible().catch(() => false))) {
    await operator.locator('[data-diagnostics-summary]').click()
  }
  await expect(operator.locator('[data-diagnostics-facts]')).toBeVisible()
  return operator
}

/*
 * Die Tests teilen sich einen Server. Ein Spiel aus einem frueheren Test wuerde
 * die Sammlung mit einer laufenden Partie begruessen statt mit der Auswahl.
 */
test.beforeEach(async ({ page }) => {
  await resetServer(page)
})

test('das Quiz hinterlaesst in der Gastgeberanwendung keine Verbindung', async ({ browser }) => {
  const watcher = await openDiagnostics(await browser.newPage())
  const shell = await browser.newPage()

  await shell.goto('/shell')
  await expect(shell.locator('[data-shell-menu]')).toBeVisible()
  const base = await connectedClients(watcher)

  // Zwei Runden nacheinander: einbinden, verlassen, wieder einbinden.
  for (const round of [1, 2]) {
    await shell.getByRole('button', { name: 'Quiz' }).click()
    await expect(shell.locator('[data-game-start]')).toBeVisible({ timeout: 20_000 })
    await expect
      .poll(() => connectedClients(watcher), { message: `Runde ${round}: Client verbunden` })
      .toBe(base + 1)

    await shell.getByRole('button', { name: 'Zur Sammlung' }).click()
    await expect(shell.locator('[data-shell-menu]')).toBeVisible()
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
  const bar = page.locator('[data-shell-bar]')
  const before = await bar.evaluate((node) => getComputedStyle(node).backgroundColor)

  await page.getByRole('button', { name: 'Quiz' }).click()
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 20_000 })

  // Die Leiste der Sammlung sieht unveraendert aus.
  expect(await bar.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(before)

  // Und das Quiz haelt sich an die Flaeche, die der Gastgeber ihm gibt.
  const frame = (await page.locator('[data-shell-frame]').boundingBox())!
  const game = (await page.locator('[data-quiz-game]').boundingBox())!
  expect(game.y).toBeGreaterThanOrEqual(frame.y - 1)
  expect(game.height).toBeLessThanOrEqual(frame.height + 1)

  await page.getByRole('button', { name: 'Zur Sammlung' }).click()
  await expect(page.locator('[data-shell-menu]')).toBeVisible()
})

test('das Ergebnis eines Spiels erreicht die Gastgeberanwendung', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('/shell')
  await page.getByRole('button', { name: 'Quiz' }).click()
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: 'Allein' }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()

  const stage = page.locator('.stage')
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    if ((await stage.getAttribute('data-scene')) === 'result') break
    // Erst abgeben, dann tippen - nach einem Tipp bleiben die Zeilen aktiv.
    const abgeben = page.locator('[data-confirm]')
    if (await abgeben.isVisible().catch(() => false)) {
      await abgeben.click({ timeout: 2_000 }).catch(() => undefined)
      continue
    }
    const zeile = page.locator('[data-answers] [data-answer-button]:not([disabled])').first()
    if (await zeile.isVisible().catch(() => false)) {
      await zeile.click({ timeout: 2_000 }).catch(() => undefined)
      continue
    }
    // Nach der Loesung wartet das Geraet auf "Weiter".
    const knopf = page.locator('[data-continue]')
    if (await knopf.isVisible().catch(() => false)) {
      await knopf.click({ timeout: 2_000 }).catch(() => undefined)
      continue
    }
    await page.waitForTimeout(300)
  }
  await expect(stage).toHaveAttribute('data-scene', 'result', { timeout: 30_000 })

  /*
   * `onFinished` hat die Sammlung erreicht - sie zeigt das Ergebnis in ihrer
   * eigenen Darstellung, nicht in der des Quiz. Und genau einmal: Ein Ergebnis,
   * das beim Einsetzen schon auf dem Server steht, gehoert einer frueheren
   * Partie und darf dem Gastgeber nicht als eigenes gemeldet werden.
   */
  await page.getByRole('button', { name: 'Zur Sammlung' }).click()
  await expect(page.locator('[data-shell-result]')).toContainText('richtig')
  await expect(page.locator('[data-shell-result]')).toHaveAttribute('data-rounds', '1')

  // Erneut einbinden: Das alte Ergebnis wird NICHT ein zweites Mal gemeldet.
  await page.getByRole('button', { name: 'Quiz' }).click()
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Zur Sammlung' }).click()
  await expect(page.locator('[data-shell-result]')).toHaveAttribute('data-rounds', '1')
})
