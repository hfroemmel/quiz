/**
 * Lifelines on screen: the status dots, and the answers a 50:50 takes away.
 *
 * Two surfaces, because they are two integrations of the same components. The
 * PREVIEW renders a sample snapshot and is where the look is checked - both
 * themes, both dot states, the mirroring, reduced motion. The TOUCH DEVICE runs
 * the real engine through a `LocalQuizRuntime`, with lifelines switched on by
 * configuration alone (`?lifelines=1`), and is where the behaviour is checked.
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

/** Every dot on screen, in document order. */
async function dots(page: Page) {
  return page.locator('[data-lifeline]').evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node)
      const box = node.getBoundingClientRect()
      return {
        type: node.getAttribute('data-lifeline'),
        used: node.getAttribute('data-used'),
        name: node.getAttribute('aria-label'),
        background: style.backgroundColor,
        opacity: style.opacity,
        x: Math.round(box.x),
        /* The diagonal line is a pseudo-element - only its presence matters. */
        struck: getComputedStyle(node, '::after').content !== 'none',
      }
    }),
  )
}

test.describe('the status dots', () => {
  test('are absent entirely where the installation offers no lifelines', async ({ page }) => {
    await openPreview(page)
    // The default preview snapshot has no lifelines - like a host that configures none.
    await expect(page.locator('[data-lifelines]')).toHaveCount(0)
    await expect(page.locator('[data-lifeline]')).toHaveCount(0)
    // And the scoreboards are otherwise complete: nothing is waiting for them.
    await expect(page.locator('[data-score]')).toHaveCount(2)
    await expect(page.locator('[data-score-value]').first()).toBeVisible()
  })

  test('show both players, and player two mirrored', async ({ page }) => {
    await openPreview(page)
    await page.locator('[data-preview-lifelines]').check()

    await expect(page.locator('[data-lifelines]')).toHaveCount(2)
    const groups = page.locator('[data-lifelines]')
    await expect(groups.nth(0)).toHaveAttribute('data-player', 'player-1')
    await expect(groups.nth(0)).toHaveAttribute('data-mirrored', 'false')
    await expect(groups.nth(1)).toHaveAttribute('data-player', 'player-2')
    await expect(groups.nth(1)).toHaveAttribute('data-mirrored', 'true')

    /*
     * Mirrored means: the dots sit between the player number and the outer edge
     * on BOTH sides. So player one's dots are to the right of their number and
     * player two's to the left of theirs - measured, not assumed.
     */
    const box = async (selector: string, index: number) => {
      const value = await page.locator(selector).nth(index).boundingBox()
      if (!value) throw new Error(`no box: ${selector}#${index}`)
      return value
    }
    const numberOne = await box('[data-score] [data-score-value]', 0)
    const numberTwo = await box('[data-score] [data-score-value]', 3)
    const groupOne = await box('[data-lifelines]', 0)
    const groupTwo = await box('[data-lifelines]', 1)
    expect(groupOne.x).toBeGreaterThan(numberOne.x)
    expect(groupTwo.x).toBeLessThan(numberTwo.x)
  })

  test('tell available from used without relying on colour', async ({ page }) => {
    await openPreview(page)
    await page.locator('[data-preview-lifelines]').check()

    const all = await dots(page)
    expect(all).toHaveLength(4)
    const used = all.filter((dot) => dot.used === 'true')
    const available = all.filter((dot) => dot.used === 'false')
    expect(used).toHaveLength(1)
    expect(available).toHaveLength(3)

    // The spent one is crossed out and dimmed; the others are neither.
    expect(used[0]?.struck).toBe(true)
    expect(Number(used[0]?.opacity)).toBeLessThan(1)
    for (const dot of available) {
      expect(dot.struck).toBe(false)
      expect(dot.opacity).toBe('1')
    }
    // And it says so in words, for anyone who cannot see either.
    expect(used[0]?.name).toBe('50:50-Joker: verbraucht')
    expect(available.map((dot) => dot.name)).toContain('Publikumsjoker: verfügbar')
  })

  test('carry the stage colours in both themes', async ({ page }) => {
    const readDots = async (theme: string) => {
      await openPreview(page, theme)
      await page.locator('[data-preview-lifelines]').check()
      return dots(page)
    }

    const bright = await readDots('bright')
    const dark = await readDots('dark')

    /*
     * The values differ - they come from the palette of the fassung - but the
     * statement does not: an available dot is filled, a used one is not.
     */
    const filled = (list: Awaited<ReturnType<typeof dots>>) =>
      list.filter((dot) => dot.used === 'false').map((dot) => dot.background)
    expect(new Set(filled(bright)).size).toBeGreaterThan(0)
    expect(filled(bright)).not.toEqual(filled(dark))
    for (const list of [bright, dark]) {
      expect(list.filter((dot) => dot.used === 'true')[0]?.struck).toBe(true)
    }
  })

  test('hold still where motion is switched off', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openPreview(page)
    await page.locator('[data-preview-lifelines]').check()

    const durations = await page
      .locator('[data-lifeline]')
      .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).transitionDuration))
    // The state is the same, it just no longer fades into place.
    for (const duration of durations) expect(duration).toBe('0.001s')
  })
})

test.describe('answers a 50:50 has taken away', () => {
  test('stay in their place, dimmed, and out of the reading order', async ({ page }) => {
    await openPreview(page)
    const before = await page
      .locator('[data-answer]')
      .evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().y)))

    await page.locator('[data-preview-lifelines]').check()
    await settled(page)

    const after = await page.locator('[data-answer]').evaluateAll((nodes) =>
      nodes.map((node) => ({
        y: Math.round(node.getBoundingClientRect().y),
        hidden: node.getAttribute('data-hidden'),
        aria: node.getAttribute('aria-hidden'),
        opacity: getComputedStyle(node).opacity,
        letter: node.querySelector('[data-answer-chip]')?.textContent,
      })),
    )

    // Four rows before, four rows after, every one of them at the same height.
    expect(after.map((row) => row.y)).toEqual(before)
    expect(after.filter((row) => row.hidden === 'true')).toHaveLength(2)
    for (const row of after.filter((row) => row.hidden === 'true')) {
      expect(Number(row.opacity)).toBeLessThan(0.5)
      expect(row.aria).toBe('true')
      // The letter stays with its row, so A to D still mean the same lines.
      expect(row.letter).toBeTruthy()
    }
    for (const row of after.filter((row) => row.hidden !== 'true')) {
      expect(row.opacity).toBe('1')
    }
  })
})

/* ------------------------------------------------------------------ *
 * The touch device: the real engine, lifelines on by configuration
 * ------------------------------------------------------------------ */

async function startTouchGame(page: Page, players: 'Allein' | 'Zu zweit'): Promise<void> {
  await page.goto('/play?lifelines=1')
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: new RegExp(`^${players}`) }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
}

test.describe('a player using their own lifeline', () => {
  test('takes two answers away and cannot tap them afterwards', async ({ page }) => {
    await startTouchGame(page, 'Zu zweit')

    const fiftyFifty = page.locator('[data-lifeline="fiftyFifty"]').first()
    await expect(fiftyFifty).toHaveAttribute('data-used', 'false')
    /*
     * The visible dot stays small, but what a thumb has to hit is a button of
     * at least 44 by 44 pixels around it.
     */
    const hit = (await fiftyFifty.boundingBox())!
    expect(hit.width).toBeGreaterThanOrEqual(44)
    expect(hit.height).toBeGreaterThanOrEqual(44)

    await fiftyFifty.click()

    // The server decided which two go; the client only shows the result.
    await expect(page.locator('[data-answer][data-hidden="true"]')).toHaveCount(2)
    await expect(fiftyFifty).toHaveAttribute('data-used', 'true')
    // Two remain, and they are the only ones a thumb can reach.
    await expect(page.locator('[data-answer]:not([data-hidden="true"]) [data-answer-button]')).toHaveCount(2)
    for (const disabled of await page
      .locator('[data-answer][data-hidden="true"] [data-answer-button]')
      .all()) {
      await expect(disabled).toBeDisabled()
    }
    // Nothing was chosen on the player's behalf.
    await expect(page.locator('[data-answer][data-state="selected"]')).toHaveCount(0)
  })

  test('spends it once, and only their own', async ({ page }) => {
    await startTouchGame(page, 'Zu zweit')

    const own = page.locator('[data-lifelines][data-player="player-1"] [data-lifeline="fiftyFifty"]')
    const other = page.locator('[data-lifelines][data-player="player-2"] [data-lifeline="fiftyFifty"]')
    await own.click()

    await expect(own).toHaveAttribute('data-used', 'true')
    await expect(own).toBeDisabled()
    // The other player still has theirs - it is just not usable on this question.
    await expect(other).toHaveAttribute('data-used', 'false')
  })

  test('shows only player one in a single-player game', async ({ page }) => {
    await startTouchGame(page, 'Allein')

    await expect(page.locator('[data-lifelines]')).toHaveCount(1)
    await expect(page.locator('[data-lifelines]')).toHaveAttribute('data-player', 'player-1')
    await expect(page.locator('[data-lifeline]')).toHaveCount(2)
  })

  test('keeps the game exactly as it was where lifelines are off', async ({ page }) => {
    // The same route without the switch - the kiosk default.
    await page.goto('/play')
    await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /^Zu zweit/ }).click()
    await page.getByRole('button', { name: /^Leicht/ }).click()
    await page.getByRole('button', { name: "Los geht's" }).click()
    await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })

    await expect(page.locator('[data-lifelines]')).toHaveCount(0)
    await expect(page.locator('[data-answer][data-hidden="true"]')).toHaveCount(0)
    await expect(page.locator('[data-answer]')).not.toHaveCount(0)
  })
})
