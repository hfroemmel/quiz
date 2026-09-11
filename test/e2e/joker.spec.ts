/**
 * What the joker leaves behind on a stage screen - and where it appears nowhere.
 *
 * The joker itself belongs to the live quiz: its card, its operator controls and
 * its rules are tested in that repository, against a real server. TWO things
 * still belong here, in the package repository:
 *
 *   - the ANSWERS a 50:50 takes away. They are drawn by the shared answer list,
 *     so this is where the look is checked - dimmed in place, out of the reading
 *     order, nothing jumping.
 *   - the DELIMITATION. The touch device runs the same components through a
 *     local runtime, and it must show no joker anywhere: no card, no dot, no
 *     hidden answer, no control.
 */
import { expect, test, type Page } from '@playwright/test'

async function openPreview(page: Page, theme = 'bright'): Promise<void> {
  await page.addInitScript((value) => localStorage.setItem('quiz.stageTheme', value as string), theme)
  await page.goto('/preview')
  await expect(page.locator('[data-preview-stage]')).toBeVisible()
  await settled(page)
}

/**
 * Wait for the entry animations of the scene.
 *
 * The answer rows arrive one after another with a translate on them, so a
 * position read while that runs is a position that will not exist a frame
 * later. Endless animations are left out - waiting for those would never end.
 */
async function settled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
    await Promise.all(finite.map((animation) => animation.finished.catch(() => undefined)))
  })
}

test.describe('answers a 50:50 has taken away', () => {
  test('stay in their place, dimmed, and out of the reading order', async ({ page }) => {
    await openPreview(page)
    const before = await page
      .locator('[data-answer]')
      .evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().y)))

    await page.locator('[data-preview-fifty-fifty]').check()
    await settled(page)

    const after = await page.locator('[data-answer]').evaluateAll((nodes) =>
      nodes.map((node) => ({
        y: Math.round(node.getBoundingClientRect().y),
        eliminated: node.getAttribute('data-eliminated'),
        aria: node.getAttribute('aria-hidden'),
        opacity: getComputedStyle(node).opacity,
        letter: node.querySelector('[data-answer-chip]')?.textContent,
      })),
    )

    // Four rows before, four rows after, every one of them at the same height.
    expect(after.map((row) => row.y)).toEqual(before)
    expect(after.filter((row) => row.eliminated === 'true')).toHaveLength(2)
    for (const row of after.filter((row) => row.eliminated === 'true')) {
      expect(Number(row.opacity)).toBeLessThan(0.5)
      expect(row.aria).toBe('true')
      // The letter stays with its row, so A to D still mean the same lines.
      expect(row.letter).toBeTruthy()
    }
    for (const row of after.filter((row) => row.eliminated !== 'true')) {
      expect(row.opacity).toBe('1')
    }
    // And each of them carries the line that says it is out.
    await expect(page.locator('[data-answer][data-eliminated="true"] [data-answer-strike]')).toHaveCount(2)
  })

  test('leave the scoreboards untouched', async ({ page }) => {
    await openPreview(page)
    const before = await page
      .locator('[data-score]')
      .evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().x)))

    await page.locator('[data-preview-fifty-fifty]').check()
    await settled(page)

    /*
     * The scoreboards stay where they are and stay neutral: the 50:50 happens
     * in the answer list, and the stage says whose joker it was in words rather
     * than by moving a card about.
     */
    const after = await page
      .locator('[data-score]')
      .evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().x)))
    expect(after).toEqual(before)
  })
})

test.describe('the touch device', () => {
  test('has no joker anywhere', async ({ page }) => {
    await page.goto('/play')
    await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /^Zu zweit/ }).click()
    await page.getByRole('button', { name: /^Leicht/ }).click()
    await page.getByRole('button', { name: "Los geht's" }).click()
    await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })

    /*
     * A local game is self-service: nobody there could authorise a joker, so
     * the state carries no supply and the screen carries nothing about it.
     */
    await expect(page.locator('[data-joker]')).toHaveCount(0)
    await expect(page.locator('[data-answer][data-eliminated="true"]')).toHaveCount(0)
    await expect(page.locator('[data-answer]')).not.toHaveCount(0)
    // And the two scoreboards are otherwise complete.
    await expect(page.locator('[data-score]')).toHaveCount(2)
  })
})
