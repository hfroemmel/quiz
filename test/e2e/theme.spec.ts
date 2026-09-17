/**
 * A theme belongs to ONE quiz.
 *
 * The package declares its colours on the document (`palette.css`), as the
 * fallback layer for a page that shows one quiz. A host with its own design had
 * to overwrite them there - and then two quizzes on one page could only ever
 * have one look, whichever declaration came last.
 *
 * `QuizProvider` puts the values on the quiz's own element. These tests stand on
 * the harness surface with two devices side by side, in two designs, and ask
 * three things: does each side carry its own, does the page around them stay
 * untouched, and does the design really arrive where it is drawn.
 */
import { expect, test } from '@playwright/test'

/** A custom property as the browser resolves it - on that element, not in the file. */
async function token(selector: string, name: string, page: import('@playwright/test').Page) {
  return page.locator(selector).first().evaluate(
    (element, entry) => getComputedStyle(element).getPropertyValue(entry).trim(),
    name,
  )
}

test('each quiz carries its own theme, and the page around them keeps the package one', async ({ page }) => {
  await page.goto('/pair')
  await expect(page.locator('[data-pair="foyer"] [data-game-start]')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-pair="hall"] [data-game-start]')).toBeVisible({ timeout: 15_000 })

  // Two designs, two accents - and neither is the other's.
  const foyerAccent = await token('[data-pair="foyer"] [data-quiz-game]', '--color-accent', page)
  const hallAccent = await token('[data-pair="hall"] [data-quiz-game]', '--color-accent', page)
  expect(foyerAccent).toBe('#00854a')
  expect(hallAccent).toBe('#c8531a')

  /*
   * And the document keeps the package's own value. A host theme that landed
   * there would recolour every quiz on the page - the mistake the provider
   * exists to prevent.
   */
  const pageAccent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim(),
  )
  expect(pageAccent).not.toBe(foyerAccent)
  expect(pageAccent).not.toBe(hallAccent)
})

test('the theme reaches what is drawn, not just the variable', async ({ page }) => {
  await page.goto('/pair')
  await expect(page.locator('[data-pair="foyer"] [data-game-start]')).toBeVisible({ timeout: 15_000 })

  /*
   * The start button of each side is the one element with a full colour, and it
   * is painted from the menu's green. The foyer theme names no green at all -
   * it names the stage's, and the menu follows it in the light variant. So this
   * fill proves two things at once: the theme arrived where something is
   * painted, and the relationship between stage and menu survived the override.
   */
  const fill = async (mark: string) =>
    page
      .locator(`[data-pair="${mark}"] [data-start]`)
      .evaluate((element) => getComputedStyle(element).backgroundImage)

  // 0x7a1f6e is the foyer's stage green, 0xc8531a the hall's own accent.
  expect(await fill('foyer')).toContain('rgb(122, 31, 110)')
  expect(await fill('hall')).toContain('rgb(200, 83, 26)')
})

test('the theme reaches the running game, where the package sets its own variant', async ({ page }) => {
  await page.goto('/pair')
  const foyer = page.locator('[data-pair="foyer"]')
  await expect(foyer.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })

  await foyer.locator('[data-player-count="1"]').click()
  await foyer.locator('[data-quiz-start-action]').click()
  await expect(foyer.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })

  /*
   * THE HARD CASE. The light variant of the stage declares its colours on the
   * stage element itself, and a declaration there beats a value inherited from
   * the frame - a host theme handed down from above would be overwritten
   * exactly where the game is. So the accent is read ON the stage.
   */
  const accent = await token('[data-pair="foyer"] .stage', '--color-accent', page)
  expect(accent).toBe('#00854a')
  // And the variant of the design applies, not the preference of the window.
  await expect(foyer.locator('.stage')).toHaveClass(/stage--bright/)
})

test('a host with its own bar gets no second frame from the quiz', async ({ page }) => {
  await page.goto('/pair')
  const foyer = page.locator('[data-pair="foyer"]')
  const hall = page.locator('[data-pair="hall"]')
  await expect(hall.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })

  /*
   * The right-hand side carries word mark, way back and settings in its own
   * bar and says so (`chrome`). Until now such a host hid them with three
   * `display: none` rules that had to be kept in step with the package's
   * markup - now they are not rendered at all.
   */
  await expect(hall.locator('[data-settings-open]')).toHaveCount(0)
  await expect(foyer.locator('[data-settings-open]')).toHaveCount(1)

  await hall.locator('[data-player-count="1"]').click()
  await hall.locator('[data-quiz-start-action]').click()
  await expect(hall.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })

  await expect(hall.locator('[data-brand]')).toHaveCount(0)
  await expect(hall.locator('[data-abort-game]')).toHaveCount(0)
  // And the quiz that supplies its own frame still has all of it.
  await expect(foyer.locator('[data-game-start]')).toBeVisible()
})

test('the surface says whether the room is paper or dark', async ({ page }) => {
  /*
   * A host that recolours its own bar around the quiz needs one word for that.
   * `data-theme` names a world - and the children's paper is light too, so it
   * cannot answer the question.
   */
  await page.goto('/pair')
  await expect(page.locator('[data-pair="foyer"] [data-game-start]')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-pair="foyer"] [data-quiz-game]')).toHaveAttribute('data-surface', 'light')
  await expect(page.locator('[data-pair="hall"] [data-quiz-game]')).toHaveAttribute('data-surface', 'dark')

  await page.goto('/play?audience=kids')
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
  // Paper is light, however much its world differs from the adults' stage.
  await expect(page.locator('[data-quiz-game]')).toHaveAttribute('data-surface', 'light')
})

test('the children world keeps its paper - a host theme for the stage does not recolour it', async ({ page }) => {
  /*
   * A host states the design of ITS world. The second world of a package is a
   * drawing, not a palette: a theme meant for the adults' stage must not paint
   * the children's paper in its colours, or the drawn boxes would sit on a
   * green ground.
   */
  await page.goto('/play?audience=kids')
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })

  const paper = await token('[data-quiz-game]', '--color-pageTop', page)
  await page.goto('/pair')
  await expect(page.locator('[data-pair="foyer"] [data-game-start]')).toBeVisible({ timeout: 15_000 })
  const foyerPage = await token('[data-pair="foyer"] [data-quiz-game]', '--color-pageTop', page)

  expect(paper).not.toBe(foyerPage)
})

/**
 * THE RED VARIANT, on the surface where it is visible.
 *
 * The rule that carries it sits on the stage element itself, and that is the
 * hard part: the frame around it hands variables down, and only a declaration
 * on the element itself beats them. What is checked here is therefore not the
 * stylesheet - the package's tests do that - but what the browser resolves in
 * the place where the room looks.
 */
test('the red variant is the dark stage on a red ground', async ({ page }) => {
  const open = async (variant: string) => {
    await page.addInitScript((value) => localStorage.setItem('quiz.stageTheme', value as string), variant)
    await page.goto('/preview')
    await expect(page.locator('[data-preview-stage] .stage')).toBeVisible({ timeout: 15_000 })
  }

  await open('dark')
  const dark = {
    ground: await token('[data-preview-stage] .stage', '--color-pageTop', page),
    accent: await token('[data-preview-stage] .stage', '--color-accent', page),
    correct: await token('[data-preview-stage] .stage', '--color-correct', page),
    incorrect: await token('[data-preview-stage] .stage', '--color-incorrect', page),
    tile: await token('[data-preview-stage] .stage', '--color-tile', page),
  }

  await open('red')
  await expect(page.locator('[data-preview-stage] .stage')).toHaveClass(/stage--red/)
  /*
   * The ground turns - and it is `Rot` at 80 percent, a step of the federal
   * spectrum. The value is written out here on purpose: it is the one place
   * where a change to the variant's ground has to be noticed.
   */
  expect(await token('[data-preview-stage] .stage', '--color-pageTop', page)).toBe('#CD3363')
  expect(await token('[data-preview-stage] .stage', '--color-pageTop', page)).not.toBe(dark.ground)

  /*
   * And everything else stays the dark stage's: the three signals - blue for
   * the selection, green for the right answer, red for the wrong one - and the
   * veils the surfaces are made of. They become lighter red over the ground on
   * their own, which is why this variant names no surface of its own.
   */
  expect(await token('[data-preview-stage] .stage', '--color-accent', page)).toBe(dark.accent)
  expect(await token('[data-preview-stage] .stage', '--color-correct', page)).toBe(dark.correct)
  expect(await token('[data-preview-stage] .stage', '--color-incorrect', page)).toBe(dark.incorrect)
  expect(await token('[data-preview-stage] .stage', '--color-tile', page)).toBe(dark.tile)

  // The ink stays light, so a host that recolours its own frame is told so.
  await expect(page.locator('[data-preview-stage] .stage')).toHaveAttribute('data-surface', 'dark')
})
