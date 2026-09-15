/**
 * The details step: the background of a question, read instead of told.
 *
 * In a hall the moderator tells it, so the projection transmits nothing of it.
 * At a device nobody tells it - and a quiz set up for that place says so in its
 * content (`rules.showDetailsAfterSolution`). The step then holds the round
 * until somebody has read the text, because a round that moves on by itself
 * decides that nobody wanted to.
 *
 * WHAT THE FIXTURE CONTENT SAYS. The rule is off in the package, as it is in a
 * hall; `/play?details=1` turns it on for this suite alone (see
 * `harness/src/main.tsx`). And only the harder questions carry a background -
 * the easy level deliberately brings none, so the case "no background, so no
 * step" can be reached at all.
 *
 * The tests come from the media table of the Bundestag app, which carried this
 * step in its own code, with its own panel and its own two timers. They are
 * here now because the step is.
 */
import { expect, test, type Page } from '@playwright/test'
import { openAnswer } from './helpers'

/** A round on the device, at the chosen level - and the rule turned on. */
async function playTo(page: Page, preset: 'Leicht' | 'Schwer'): Promise<void> {
  await page.goto('/play?details=1')
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /^Allein/ }).click()
  await page.getByRole('button', { name: new RegExp(`^${preset}`) }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
}

/** Answers and submits - in solo play the first tap takes the turn. */
async function answer(page: Page): Promise<void> {
  await page.locator(openAnswer).first().click()
  await page.locator('[data-confirm]').click()
  await expect(page.locator('.stage')).toHaveAttribute('data-scene', 'solution')
}

test('a question with background holds the round until it is read', async ({ page }) => {
  await playTo(page, 'Schwer')
  await answer(page)

  /*
   * THE ROUND IS HELD FROM THIS MOMENT, not from the moment the card is there.
   * The solution is to be read first, and in those seconds the device's own way
   * onward would be one thumb away from skipping the step.
   */
  await expect(page.locator('[data-continue]')).toHaveCount(0)

  const panel = page.locator('[data-quiz-details]')
  await expect(panel).toBeVisible({ timeout: 15_000 })
  await expect(panel).toContainText('Hintergrund zur Testfrage')
  // While it stands, its button is the only way onward.
  await expect(page.locator('[data-continue]')).toHaveCount(0)

  await page.locator('[data-quiz-details-continue]').click()
  // Closed first, gone afterwards - and then the next question stands.
  await expect(panel).toHaveCount(0)
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
})

test('a question without background gets no empty step', async ({ page }) => {
  await playTo(page, 'Leicht')
  await answer(page)

  // Well past the moment the card would have arrived after.
  await page.waitForTimeout(4_000)
  await expect(page.locator('[data-quiz-details]')).toHaveCount(0)

  // And the device's own way onward is there instead.
  await page.locator('[data-continue]').click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
})

test('without the rule the background stays with the moderator', async ({ page }) => {
  /*
   * The same level, the same questions - only the rule is off, as it is in a
   * hall. Then the text does not even reach the device: the projection leaves
   * it out (see `publicSolution`), so there is nothing here that a stylesheet
   * could accidentally reveal.
   */
  await page.goto('/play')
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /^Allein/ }).click()
  await page.getByRole('button', { name: /^Schwer/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
  await answer(page)

  await page.waitForTimeout(4_000)
  await expect(page.locator('[data-quiz-details]')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Hintergrund zur Testfrage')
  // The round moves on the way it always did.
  await expect(page.locator('[data-continue]')).toBeVisible()
})

test('the card lies on the stage, and the stage keeps its size', async ({ page }) => {
  /*
   * The step belongs INSIDE the stage - only there does it get its colours,
   * its container units and its display size. Outside it, the card would keep
   * its full size while everything beneath it shrank with the zoom.
   */
  await playTo(page, 'Schwer')
  await answer(page)
  const panel = page.locator('[data-quiz-details]')
  await expect(panel).toBeVisible({ timeout: 15_000 })

  const inside = await panel.evaluate((element) => element.closest('[data-stage-overlay]') !== null)
  expect(inside, 'the step sits in the stage overlay').toBe(true)

  const stage = (await page.locator('.stage').first().boundingBox())!
  const card = (await panel.locator('[role="dialog"]').boundingBox())!
  expect(card.width).toBeLessThan(stage.width)
  expect(card.height).toBeLessThanOrEqual(stage.height)
})
