/**
 * The embedding contract in the browser.
 *
 * Checked against the example collection at `/shell`, i.e. against a foreign
 * application that embeds the quiz - not against the quiz itself.
 *
 * Here the host provides the runtime and tears it down again on leaving;
 * there is no longer a server that could count connected clients. What is
 * checked here is therefore what a host SEES: that the quiz stays within its
 * box, that a result comes out exactly once, and that a second round starts
 * cleanly from scratch.
 */
import { expect, test, type Page } from '@playwright/test'
import { openAnswer } from './helpers'

async function intoQuiz(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Quiz' }).click()
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 30_000 })
}

async function backToCollection(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Zur Sammlung' }).click()
  await expect(page.locator('[data-shell-menu]')).toBeVisible()
}

test('the quiz stays in its box and does not recolour the collection', async ({ page }) => {
  await page.goto('/shell')
  const bar = page.locator('[data-shell-bar]')
  const before = await bar.evaluate((node) => getComputedStyle(node).backgroundColor)

  await intoQuiz(page)

  // The collection's bar looks unchanged.
  expect(await bar.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(before)

  // And the quiz stays within the area the host gives it.
  const frame = (await page.locator('[data-shell-frame]').boundingBox())!
  const game = (await page.locator('[data-quiz-game]').boundingBox())!
  expect(game.y).toBeGreaterThanOrEqual(frame.y - 1)
  expect(game.height).toBeLessThanOrEqual(frame.height + 1)

  await backToCollection(page)
})

test('two rounds in a row each start from the beginning on their own', async ({ page }) => {
  await page.goto('/shell')

  for (const round of [1, 2]) {
    await intoQuiz(page)
    await page.getByRole('button', { name: /^Zu zweit/ }).click()
    await page.getByRole('button', { name: /^Leicht/ }).click()
    await page.getByRole('button', { name: "Los geht's" }).click()
    await expect(page.locator('[data-answers]'), `Runde ${round}`).toBeVisible({ timeout: 30_000 })

    // Back in the middle of the game - the hardest case for teardown.
    await backToCollection(page)
    // There was no result; the collection does not report one either.
    await expect(page.locator('[data-shell-result]')).toHaveCount(0)
  }
})

test('the result of a game reaches the host application exactly once', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('/shell')
  await intoQuiz(page)

  await page.getByRole('button', { name: /^Allein/ }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()

  const stage = page.locator('.stage')
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    if ((await stage.getAttribute('data-scene')) === 'result') break
    /*
     * Tapping and submitting belong together; after a tap the rows
     * deliberately stay active (to change your mind), the question only
     * advances via submitting. In solo play the first tap also wins the turn
     * at the same time.
     */
    const row = page.locator(openAnswer).first()
    if (await row.isVisible().catch(() => false)) {
      await row.click({ timeout: 2_000 }).catch(() => undefined)
      await page.locator('[data-confirm]').click({ timeout: 5_000 }).catch(() => undefined)
      continue
    }
    // After the solution, the device waits for "Weiter".
    const button = page.locator('[data-continue]')
    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 2_000 }).catch(() => undefined)
      continue
    }
    await page.waitForTimeout(300)
  }
  await expect(stage).toHaveAttribute('data-scene', 'result', { timeout: 30_000 })

  /*
   * `onFinished` has reached the collection - it shows the result in its own
   * presentation, not in the quiz's. And exactly once, even though further
   * snapshots keep arriving during the result scene.
   */
  await backToCollection(page)
  await expect(page.locator('[data-shell-result]')).toContainText('richtig')
  await expect(page.locator('[data-shell-result]')).toHaveAttribute('data-rounds', '1')

  // Embed again: the fresh round does not report a second result.
  await intoQuiz(page)
  await backToCollection(page)
  await expect(page.locator('[data-shell-result]')).toHaveAttribute('data-rounds', '1')
})

test("the host's own layer sits inside the stage and carries its dimensions", async ({ page }) => {
  /*
   * The contract of `overlay` in three points. It is the reason the prop
   * exists at all: a layer NEXT TO the stage would get neither its dimensions
   * nor its zoom level and would keep its full size even when the display
   * shrinks - a box at original size on top of a shrunk game.
   */
  await page.goto('/shell')
  await intoQuiz(page)

  // It is shrunk BEFORE the start, just as someone at the device would do it.
  await page.locator('[data-settings-open]').click()
  await page.locator('[data-zoom]').fill('0.7')
  await page.locator('[data-settings-close]').click()

  await page.getByRole('button', { name: /^Zu zweit/ }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })

  await page.locator('[data-shell-layer-open]').click()
  const layer = page.locator('[data-shell-layer]')
  await expect(layer).toBeVisible()

  // 1. It sits INSIDE the stage - not next to it.
  await expect(page.locator('.stage [data-shell-layer]')).toHaveCount(1)

  // 2. It scales with the zoom level like everything else on the stage.
  const scaleFactor = await layer.locator('> div').evaluate((node) => getComputedStyle(node).scale)
  expect(Number(scaleFactor)).toBeCloseTo(0.7, 2)

  /*
   * 3. Its button is the same button. Font size and minimum height come from
   * the same tokens as the buzzer next to it (`--stage-button-*`); the fact
   * that the buzzer takes its own height changes nothing about the font.
   */
  const button = page.locator('[data-shell-layer-close]')
  const buzzer = page.locator('[data-buzzer]').first()
  const font = (place: typeof button) => place.evaluate((node) => getComputedStyle(node).fontSize)
  expect(await font(button)).toBe(await font(buzzer))

  // And the way back tears it down along with everything else.
  await page.locator('[data-shell-layer-close]').click()
  await expect(layer).toHaveCount(0)
})

test("the host's sound switch applies before a round and during one", async ({ page }) => {
  /*
   * WHY THIS IS CHECKED IN THE HOST AND NOT AT THE DEVICE: the switch of the
   * settings belongs to whoever stands in front of the device, and it is gone
   * while a round runs. An application that embeds the quiz has a switch of
   * its own - the media table keeps one in its bar - and that one keeps
   * applying: a quiz that read the value once would go on sounding into a room
   * that has just asked for quiet.
   */
  await page.goto('/shell')

  // The collection starts loud, so the device does too.
  await page.locator('[data-shell-sound]').click()
  await expect(page.locator('[data-shell-sound]')).toHaveAttribute('aria-pressed', 'false')

  await intoQuiz(page)
  const device = page.locator('[data-quiz-game]')
  await expect(device).toHaveAttribute('data-sound', 'false')

  // The settings say the same thing - it is one state, not two.
  await page.locator('[data-settings-open]').click()
  await expect(page.locator('[data-sound-off]')).toHaveAttribute('aria-pressed', 'true')
  await page.locator('[data-settings-close]').click()

  await page.getByRole('button', { name: /^Zu zweit/ }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
  await expect(device).toHaveAttribute('data-sound', 'false')

  // And thrown in the middle of the round, it reaches the running game.
  await page.locator('[data-shell-sound]').click()
  await expect(device).toHaveAttribute('data-sound', 'true')

  await page.locator('[data-shell-sound]').click()
  await expect(device).toHaveAttribute('data-sound', 'false')
})
