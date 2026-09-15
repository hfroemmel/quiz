/**
 * The start menu of a device - what it offers and what it hands on.
 *
 * These tests used to run in the Bundestags-App, against the start screen that
 * app brought itself: three quizzes, two modes, one button. The screen now
 * lives in the package, so the tests do too - against the same data attributes,
 * and now against the CONFIGURATION instead of three cards in host code.
 *
 * The package under test offers three quizzes at the device: the emphasised one
 * with a motif, a second one beside it, and one whose pool has no questions
 * yet - the honest intermediate state of a setup, and the case the menu has to
 * say out loud.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * The questions of the built package - the same file the harness serves.
 *
 * It is read here so a game can be checked against the pool it should come
 * from: whether the chosen quiz really reached the engine cannot be seen on the
 * screen, only in which questions turn up.
 */
const questions = JSON.parse(
  readFileSync(join(here, '..', '..', 'content', 'dist', 'questions.json'), 'utf8'),
) as { prompt: string; poolIds: string[] }[]

function promptsOf(poolId: string): Set<string> {
  return new Set(questions.filter((question) => question.poolIds.includes(poolId)).map((entry) => entry.prompt.trim()))
}

async function openMenu(page: Page): Promise<void> {
  await page.goto('/play')
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
}

/** The boxes of the three cards and the two columns - measured, not assumed. */
async function geometry(page: Page) {
  return page.evaluate(() => {
    const box = (selector: string) => {
      const element = document.querySelector(selector)
      if (!element) throw new Error(`missing: ${selector}`)
      const rect = element.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom }
    }
    return {
      wide: box('[data-quiz-card="tisch-bundestag"]'),
      second: box('[data-quiz-card="tisch-saarbruecken"]'),
      third: box('[data-quiz-card="tisch-europa"]'),
      content: box('[data-quiz-start-content]'),
    }
  })
}

test('offers the configured quizzes, the two modes and the levels of the chosen quiz', async ({ page }) => {
  await openMenu(page)

  await expect(page.locator('[data-quiz-card]')).toHaveCount(3)
  await expect(page.locator('[data-quiz-card]')).toHaveText([
    /Bundestagsquiz/,
    /Saarbrücken-Quiz/,
    /Europa-Quiz/,
  ])
  await expect(page.locator('[data-play-mode]')).toHaveCount(2)

  /*
   * The first card, a single player and the quiz's default level stand chosen.
   * A device that shows nothing but empty boxes demands three decisions before
   * anything can happen at all.
   */
  await expect(page.locator('[data-quiz-card="tisch-bundestag"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-quiz-card][aria-pressed="true"]')).toHaveCount(1)
  await expect(page.locator('[data-player-count="1"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-preset="touch-easy"]')).toHaveAttribute('aria-pressed', 'true')

  // The levels are the ones of THIS quiz - the emphasised one has three.
  expect(
    (await page.locator('[data-preset-options] button').allInnerTexts()).map((entry) => entry.split('\n')[0]),
  ).toEqual(['Leicht', 'Mittel', 'Schwer'])

  // The audience is not on offer: which one plays here belongs to the setup.
  await expect(page.getByRole('button', { name: /Erwachsene|Kinder/ })).toHaveCount(0)
})

test('the emphasised quiz takes the whole row, the others share it', async ({ page }) => {
  await openMenu(page)

  for (const width of [1920, 1600, 1280]) {
    await page.setViewportSize({ width, height: Math.round((width * 9) / 16) })
    const label = `${width}px`
    const { wide, second, third } = await geometry(page)

    // The emphasised quiz spans both columns above the two others.
    expect(Math.round(wide.width), label).toBeGreaterThan(Math.round(second.width * 1.9))
    expect(second.height, label).toBeLessThan(wide.height)
    // And those two are one row: same upper edge, same height.
    expect(Math.abs(second.y - third.y), label).toBeLessThan(1)
    expect(Math.abs(second.height - third.height), label).toBeLessThan(1)

    // Nothing runs out of the screen - labels and motifs scale with it.
    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      cards: [...document.querySelectorAll('[data-quiz-card]')].map((card) => card.scrollWidth - card.clientWidth),
    }))
    expect(overflow.page, label).toBeLessThanOrEqual(0)
    expect(Math.max(...overflow.cards), label).toBeLessThanOrEqual(0)
  }
})

test('scales with the display size of the device', async ({ page }) => {
  await openMenu(page)

  /*
   * The menu takes the display size of the device - the same value the running
   * game gets (`--stage-zoom`). The mechanism is measured instead of the
   * number: a smaller value shrinks the whole composition by exactly that
   * factor, and nothing inside is measured separately.
   */
  const both = await page.evaluate(() => {
    const root = document.querySelector('[data-quiz-game]') as HTMLElement
    const content = document.querySelector('[data-quiz-start-content]')!
    const before = root.style.getPropertyValue('--stage-zoom')
    const read = () => content.getBoundingClientRect().width
    const full = read()
    root.style.setProperty('--stage-zoom', '0.7')
    const small = read()
    if (before) root.style.setProperty('--stage-zoom', before)
    else root.style.removeProperty('--stage-zoom')
    return { full, small, back: read() }
  })

  expect(both.small / both.full).toBeCloseTo(0.7, 2)
  expect(both.back).toBeCloseTo(both.full, 1)
})

test('hands the chosen quiz and mode to the engine', async ({ page }) => {
  await openMenu(page)

  // The second quiz, a duel, its own level - and then the button.
  await page.locator('[data-quiz-card="tisch-saarbruecken"]').click()
  await page.locator('[data-player-count="2"]').click()
  await page.locator('[data-preset="touch-medium"]').click()
  await page.locator('[data-quiz-start-action]').click()

  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-buzzer]')).toHaveCount(2)

  /*
   * THE QUESTION PROVES THE QUIZ. The card only says which quiz was tapped;
   * that its id reached the engine can only be seen in the pool the question
   * comes from - without it, the device would play the whole audience.
   */
  const asked = (await page.locator('[data-prompt]').innerText()).trim()
  expect(promptsOf('saarbruecken')).toContain(asked)
  expect(promptsOf('bundestag')).not.toContain(asked)
})

test('the level of one quiz does not travel to another', async ({ page }) => {
  await openMenu(page)

  /*
   * The emphasised quiz has three levels, the second one two. A level kept
   * beside the quiz instead of with it would survive the change - and the start
   * would be refused with a level that is not even on screen any more.
   */
  await page.locator('[data-preset="touch-hard"]').click()
  await page.locator('[data-quiz-card="tisch-saarbruecken"]').click()

  await expect(page.locator('[data-preset="touch-hard"]')).toHaveCount(0)
  await expect(page.locator('[data-preset="touch-easy"]')).toHaveAttribute('aria-pressed', 'true')

  await page.locator('[data-quiz-start-action]').click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
})

test('is operable by touch - the card is the target', async ({ browser }) => {
  /*
   * The device has no mouse. A tap must land on the whole card: the checkmark
   * is a spot somewhere in the corner, and nobody hits that with a thumb.
   */
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1920, height: 1080 } })
  const page = await context.newPage()
  await openMenu(page)

  await page.locator('[data-quiz-card="tisch-saarbruecken"]').tap()
  await expect(page.locator('[data-quiz-card="tisch-saarbruecken"]')).toHaveAttribute('aria-pressed', 'true')
  await page.locator('[data-play-mode="duel"]').tap()
  await expect(page.locator('[data-play-mode="duel"]')).toHaveAttribute('aria-pressed', 'true')

  // And then the button - a tap starts the game.
  await page.locator('[data-quiz-start-action]').tap()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-buzzer]')).toHaveCount(2)

  await context.close()
})

test('is fully operable with the keyboard', async ({ page }) => {
  await openMenu(page)

  /*
   * Everyone taps with a finger at the device in the foyer - but the setup is
   * checked with a keyboard, and accessibility is not a question of where the
   * device stands. Reachable means: get there with Tab and trigger it with the
   * space key, without a click ever being necessary.
   */
  await page.locator('[data-quiz-card="tisch-bundestag"]').focus()
  await page.keyboard.press('Tab')
  await expect(page.locator('[data-quiz-card="tisch-saarbruecken"]')).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.locator('[data-quiz-card="tisch-saarbruecken"]')).toHaveAttribute('aria-pressed', 'true')

  await page.locator('[data-quiz-start-action]').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
})

test('fits on the device, and the corner buttons stay hittable', async ({ page }) => {
  /*
   * THREE STEPS ARE MORE THAN TWO, and the device has the screen it has. When
   * the selection grows taller than the window, it slides over the row with the
   * language switcher and the gear - both are then visible but no longer
   * hittable, which is invisible in a screenshot and fatal on a device where
   * the gear is the only way into the settings.
   */
  for (const size of [
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    const label = `${size.width}x${size.height}`
    await page.setViewportSize(size)
    await openMenu(page)

    for (const corner of ['[data-locale="en-GB"]', '[data-settings-open]']) {
      const onTop = await page.locator(corner).evaluate((element) => {
        const rect = element.getBoundingClientRect()
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
        return hit !== null && element.contains(hit)
      })
      expect(onTop, `${label} ${corner}`).toBe(true)
    }

    // And the selection itself stands on the screen instead of running past it.
    const overflow = await page
      .locator('[data-quiz-start]')
      .evaluate((element) => element.scrollHeight - element.clientHeight)
    expect(overflow, label).toBeLessThanOrEqual(1)
  }
})

test('says why a quiz without questions cannot be started - before the attempt', async ({ page }) => {
  await openMenu(page)

  /*
   * The pool of this quiz is configured, its questions are not written yet. The
   * engine refuses such a start; the menu says so beforehand instead of letting
   * somebody press a button that cannot work - and instead of quietly playing
   * another quiz under this name.
   */
  await page.locator('[data-quiz-card="tisch-europa"]').click()
  await expect(page.locator('[data-quiz-start-notice]')).toBeVisible()
  await expect(page.locator('[data-quiz-start-action]')).toBeDisabled()
  await expect(page.locator('[data-answers]')).toHaveCount(0)

  // The quiz next to it plays, right afterwards and without a reload.
  await page.locator('[data-quiz-card="tisch-bundestag"]').click()
  await expect(page.locator('[data-quiz-start-notice]')).toHaveCount(0)
  await page.locator('[data-quiz-start-action]').click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
})
