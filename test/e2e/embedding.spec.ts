/**
 * Einbettungsvertrag im Browser.
 *
 * Geprueft wird an der Beispielsammlung unter `/shell`, also an einer fremden
 * Anwendung, die das Quiz einbindet - nicht am Quiz selbst.
 *
 * Der Gastgeber stellt hier die Laufzeit und raeumt sie beim Verlassen wieder
 * ab; einen Server, der verbundene Clients zaehlen koennte, gibt es nicht mehr.
 * Was hier geprueft wird, ist deshalb das, was ein Gastgeber SIEHT: dass das
 * Quiz in seinem Kasten bleibt, dass ein Ergebnis genau einmal herauskommt und
 * dass eine zweite Runde sauber von vorn beginnt.
 */
import { expect, test, type Page } from '@playwright/test'
import { offeneAntwort } from './helpers'

async function insQuiz(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Quiz' }).click()
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 30_000 })
}

async function zurueckZurSammlung(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Zur Sammlung' }).click()
  await expect(page.locator('[data-shell-menu]')).toBeVisible()
}

test('das Quiz bleibt in seinem Kasten und faerbt die Sammlung nicht um', async ({ page }) => {
  await page.goto('/shell')
  const bar = page.locator('[data-shell-bar]')
  const before = await bar.evaluate((node) => getComputedStyle(node).backgroundColor)

  await insQuiz(page)

  // Die Leiste der Sammlung sieht unveraendert aus.
  expect(await bar.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(before)

  // Und das Quiz haelt sich an die Flaeche, die der Gastgeber ihm gibt.
  const frame = (await page.locator('[data-shell-frame]').boundingBox())!
  const game = (await page.locator('[data-quiz-game]').boundingBox())!
  expect(game.y).toBeGreaterThanOrEqual(frame.y - 1)
  expect(game.height).toBeLessThanOrEqual(frame.height + 1)

  await zurueckZurSammlung(page)
})

test('zwei Runden nacheinander beginnen jede fuer sich von vorn', async ({ page }) => {
  await page.goto('/shell')

  for (const runde of [1, 2]) {
    await insQuiz(page)
    await page.getByRole('button', { name: /^Zu zweit/ }).click()
    await page.getByRole('button', { name: /^Leicht/ }).click()
    await page.getByRole('button', { name: "Los geht's" }).click()
    await expect(page.locator('[data-answers]'), `Runde ${runde}`).toBeVisible({ timeout: 30_000 })

    // Mitten im Spiel zurueck - der haerteste Fall fuer den Abbau.
    await zurueckZurSammlung(page)
    // Ein Ergebnis gab es nicht; die Sammlung meldet auch keines.
    await expect(page.locator('[data-shell-result]')).toHaveCount(0)
  }
})

test('das Ergebnis eines Spiels erreicht die Gastgeberanwendung genau einmal', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('/shell')
  await insQuiz(page)

  await page.getByRole('button', { name: /^Allein/ }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()

  const stage = page.locator('.stage')
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    if ((await stage.getAttribute('data-scene')) === 'result') break
    /*
     * Tippen und abgeben gehoeren zusammen; nach einem Tipp bleiben die Zeilen
     * absichtlich aktiv (umentscheiden), die Frage geht nur ueber das Abgeben
     * weiter. Im Einzelspiel holt der erste Tipp zugleich den Zuschlag.
     */
    const zeile = page.locator(offeneAntwort).first()
    if (await zeile.isVisible().catch(() => false)) {
      await zeile.click({ timeout: 2_000 }).catch(() => undefined)
      await page.locator('[data-confirm]').click({ timeout: 5_000 }).catch(() => undefined)
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
   * eigenen Darstellung, nicht in der des Quiz. Und genau einmal, obwohl
   * waehrend der Ergebnisszene weitere Schnappschuesse eintreffen.
   */
  await zurueckZurSammlung(page)
  await expect(page.locator('[data-shell-result]')).toContainText('richtig')
  await expect(page.locator('[data-shell-result]')).toHaveAttribute('data-rounds', '1')

  // Erneut einbinden: Die frische Runde meldet kein zweites Ergebnis.
  await insQuiz(page)
  await zurueckZurSammlung(page)
  await expect(page.locator('[data-shell-result]')).toHaveAttribute('data-rounds', '1')
})

test('die eigene Ebene des Gastgebers steht in der Buehne und traegt deren Masse', async ({ page }) => {
  /*
   * Der Vertrag von `overlay` in drei Punkten. Er ist der Grund, warum es die
   * Prop ueberhaupt gibt: Eine Ebene NEBEN der Buehne bekaeme weder ihre Masse
   * noch ihre Zoomstufe und behielte bei kleiner Anzeige ihre volle Groesse -
   * ein Kasten in Originalgroesse ueber einem verkleinerten Spiel.
   */
  await page.goto('/shell')
  await insQuiz(page)

  // Kleiner gestellt wird VOR dem Start, so wie es jemand am Geraet taete.
  await page.locator('[data-settings-open]').click()
  await page.locator('[data-zoom]').fill('0.7')
  await page.locator('[data-settings-close]').click()

  await page.getByRole('button', { name: /^Zu zweit/ }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })

  await page.locator('[data-shell-layer-open]').click()
  const ebene = page.locator('[data-shell-layer]')
  await expect(ebene).toBeVisible()

  // 1. Sie steht IN der Buehne - nicht daneben.
  await expect(page.locator('.stage [data-shell-layer]')).toHaveCount(1)

  // 2. Sie skaliert mit der Zoomstufe wie alles andere auf der Flaeche.
  const massstab = await ebene.locator('> div').evaluate((node) => getComputedStyle(node).scale)
  expect(Number(massstab)).toBeCloseTo(0.7, 2)

  /*
   * 3. Ihr Knopf ist derselbe Knopf. Schriftgroesse und Mindesthoehe kommen aus
   * denselben Token wie beim Buzzer daneben (`--stage-button-*`); dass der
   * Buzzer sich eine eigene Hoehe nimmt, aendert an der Schrift nichts.
   */
  const knopf = page.locator('[data-shell-layer-close]')
  const buzzer = page.locator('[data-buzzer]').first()
  const schrift = (ort: typeof knopf) => ort.evaluate((node) => getComputedStyle(node).fontSize)
  expect(await schrift(knopf)).toBe(await schrift(buzzer))

  // Und der Weg zurueck raeumt sie mit ab.
  await page.locator('[data-shell-layer-close]').click()
  await expect(ebene).toHaveCount(0)
})
