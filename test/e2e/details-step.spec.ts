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

/*
 * WHAT THE CARD SAYS ABOUT ITS QUESTION.
 *
 * The card covers the stage, so the rubric and the question it explains were
 * gone from the moment it opened - and a background of three sentences read as
 * a text without a subject. Both stand at the top of the card now, and they are
 * the SAME two lines the board behind it carries: that is what is measured
 * here, against the board itself rather than against a fixture text.
 */
test('the card names the rubric and the question it belongs to', async ({ page }) => {
  await playTo(page, 'Schwer')

  // What the board says while the solution stands - before the card covers it.
  const board = page.locator('.stage [data-panel]')
  const askedCategory = (await board.locator('[data-category]').textContent())?.trim()
  const askedPrompt = (await board.locator('[data-prompt]').textContent())?.trim()
  expect(askedCategory).toBeTruthy()
  expect(askedPrompt).toBeTruthy()

  await answer(page)
  const card = page.locator('[data-quiz-details] [role="dialog"]')
  await expect(card).toBeVisible({ timeout: 15_000 })

  await expect(card.locator('[data-quiz-details-category]')).toHaveText(askedCategory!)
  await expect(card.locator('[data-quiz-details-prompt]')).toHaveText(askedPrompt!)
  /*
   * And the heading is the card's name for a screen reader, instead of the
   * question being announced once as a label and once as a text.
   */
  const heading = card.locator('[data-quiz-details-prompt]')
  expect(await card.getAttribute('aria-labelledby')).toBe(await heading.getAttribute('id'))
  expect(await card.getAttribute('aria-label')).toBeNull()
})

/*
 * AND IT KEEPS THAT QUESTION WHILE IT LEAVES.
 *
 * The round moves on the moment the button is pressed, so the next question is
 * already in the view model while this card is still fading. A prompt read live
 * would swap to the NEXT question in front of the reader - the card would spend
 * its last moment showing something it never explained.
 *
 * The fade is slowed down here so that moment can be looked at at all: the card
 * reads the stage's own `--stage-fade-duration`, and this is what a host with a
 * slower room would set.
 */
test('the card keeps its question while it fades out', async ({ page }) => {
  await playTo(page, 'Schwer')
  await answer(page)
  const step = page.locator('[data-quiz-details]')
  await expect(step).toBeVisible({ timeout: 15_000 })

  const shown = (await step.locator('[data-quiz-details-prompt]').textContent())?.trim()
  await page.locator('.stage').first().evaluate((stage) => {
    ;(stage as HTMLElement).style.setProperty('--stage-fade-duration', '3000ms')
  })

  await page.locator('[data-quiz-details-continue]').click()
  // It is on its way out - and it still says what it explained.
  await expect(step).toHaveAttribute('data-open', 'false')
  expect((await step.locator('[data-quiz-details-prompt]').textContent())?.trim()).toBe(shown)

  await expect(step).toHaveCount(0, { timeout: 10_000 })
})

/*
 * THE CARD READS FROM THE LEFT, AND THE WAY ONWARD STANDS AT THE END OF IT.
 *
 * Centred is a form for one short line; a rubric, a question and a paragraph
 * give a reader three different places to start that way. The button sits where
 * the reading ends - the right end of the card - and its label has to be
 * readable on it, which is not a matter of course: the shared button of the
 * stage names its ink with specificity zero, and a host's own
 * `button { color: inherit }` beats that and hands the label the ink of the
 * card it stands on.
 */
test('everything reads from the left, and the button stands at the right end', async ({ page }) => {
  await playTo(page, 'Schwer')
  await answer(page)
  const step = page.locator('[data-quiz-details]')
  await expect(step).toBeVisible({ timeout: 15_000 })

  const measured = await step.locator('[role="dialog"]').evaluate((panel) => {
    const button = panel.querySelector('[data-quiz-details-continue]')!
    const text = panel.querySelector('p:last-of-type')!
    const panelBox = panel.getBoundingClientRect()
    const buttonBox = button.getBoundingClientRect()
    const style = getComputedStyle(button)
    return {
      align: getComputedStyle(panel).textAlign,
      textLeft: Math.round(text.getBoundingClientRect().left - panelBox.left),
      padding: Math.round(Number.parseFloat(getComputedStyle(panel).paddingLeft)),
      rightGap: Math.round(panelBox.right - buttonBox.right),
      pastTheMiddle: buttonBox.left > panelBox.left + panelBox.width / 2,
      ink: style.color,
      area: style.backgroundColor,
      width: Math.round(buttonBox.width),
      height: Math.round(buttonBox.height),
    }
  })

  expect(measured.align).toBe('left')
  // The paragraph starts at the card's inner edge, so the block is not centred.
  expect(Math.abs(measured.textLeft - measured.padding)).toBeLessThanOrEqual(1)
  // The button ends where the text does, at the card's other inner edge.
  expect(Math.abs(measured.rightGap - measured.padding)).toBeLessThanOrEqual(1)
  expect(measured.pastTheMiddle).toBe(true)
  // And it can be read: the label is not the colour of the box it stands on.
  expect(measured.ink).not.toBe(measured.area)
  // A word in a box, not a word-sized box: the label has room on both sides.
  expect(measured.width).toBeGreaterThan(measured.height * 2)
})
