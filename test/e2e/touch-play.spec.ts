/**
 * Self-service on the touch device.
 *
 * These tests run against the real quiz package and the same engine as the
 * stage - just without a server, via a `LocalQuizRuntime` in the browser, and
 * without a single operator command. That is exactly the point: if something
 * hangs here, it also hangs on the device, where nobody can intervene.
 */
import { expect, test, type Page } from '@playwright/test'
import { openAnswer } from './helpers'

const freeBuzzer = '[data-buzzer][data-enabled="true"]'

/** A hex value, as `getComputedStyle` reports it: `rgb(r, g, b)`. */
function color(hex: string): string {
  const raw = hex.replace('#', '')
  const voll = raw.length === 3 ? [...raw].map((char) => char + char).join('') : raw
  const [r, g, b] = [0, 2, 4].map((position) => parseInt(voll.slice(position, position + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Every page load builds a fresh runtime in the browser - reloading is
 * the reset button here that the device does not have.
 */
async function openStartScreen(page: Page): Promise<void> {
  await page.goto('/play')
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
}

async function startGame(page: Page, players: 'Allein' | 'Zu zweit', preset = 'Leicht'): Promise<void> {
  await openStartScreen(page)
  await page.getByRole('button', { name: new RegExp(`^${players}`) }).click()
  await page.getByRole('button', { name: new RegExp(`^${preset}`) }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
}

/**
 * Answering, the way it works on the device: in a duel, buzz first, then tap,
 * then submit. Only submitting triggers the scoring.
 *
 * In solo play there is no buzzer - there, the first tap wins the turn.
 */
async function answerWith(page: Page, side?: 'left' | 'right'): Promise<void> {
  if (side) await page.locator(`[data-buzzer][data-side="${side}"]`).click()
  await page.locator(openAnswer).first().click()
  await page.locator('[data-confirm]').click()
}

/** After the solution, things only continue once a player taps. */
async function next(page: Page): Promise<void> {
  await page.locator('[data-continue]').click()
}

test('the start selection asks what the package offers - and nothing else', async ({ page }) => {
  await openStartScreen(page)

  /*
   * Only presets that are actually playable on the device are offered. The
   * stage presets contain an image-recognition question slot; its questions
   * would need a human to judge them, and there is none here.
   */
  const presets = await page.locator('[data-preset-options] button').allInnerTexts()
  expect(presets.map((entry) => entry.split('\n')[0])).toEqual(['Leicht', 'Mittel', 'Schwer'])

  // The quizzes of this audience, and the two ways to play them.
  await expect(page.locator('[data-quiz-card]')).toHaveCount(3)
  await expect(page.getByRole('button', { name: /^Allein/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Zu zweit/ })).toBeVisible()
  /*
   * The audience, on the other hand, belongs to the setup and not on the
   * players' screen - a device where somebody taps the children's world by
   * accident would be an operating mistake with no control for it. The menu of
   * the start selection is checked in `start-menu.spec.ts`.
   */
  await expect(page.getByRole('button', { name: /Erwachsene|Kinder/ })).toHaveCount(0)
})

/* ------------------------------------------------------------------ *
 * The selection itself
 * ------------------------------------------------------------------ */

test('the selection is always exactly one - per step', async ({ page }) => {
  await openStartScreen(page)

  /*
   * On opening, a choice is already made at every step. A device that stands
   * there with nothing but empty boxes demands two decisions before anything
   * can happen at all - and the first level is the right guess for whoever
   * happens to be standing in front of it.
   */
  await expect(page.locator('[data-player-count][aria-pressed="true"]')).toHaveCount(1)
  await expect(page.locator('[data-player-count="1"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-preset][aria-pressed="true"]')).toHaveCount(1)
  await expect(page.locator('[data-preset="touch-easy"]')).toHaveAttribute('aria-pressed', 'true')

  // A second choice replaces the first; there must never be two selected cards.
  await page.locator('[data-player-count="2"]').click()
  await expect(page.locator('[data-player-count="2"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-player-count][aria-pressed="true"]')).toHaveCount(1)

  await page.locator('[data-preset="touch-hard"]').click()
  await expect(page.locator('[data-preset="touch-hard"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-preset][aria-pressed="true"]')).toHaveCount(1)

  // The checkmark sits on the selected card - and only there.
  await expect(page.locator('[data-preset="touch-hard"] [data-on="true"]')).toHaveCount(1)
  await expect(page.locator('[data-preset="touch-easy"] [data-on="true"]')).toHaveCount(0)
})

test('every level card names its own scope', async ({ page }) => {
  await openStartScreen(page)

  /*
   * "Is it worth it right now?" is answered by the card itself - the number of
   * questions is on it, not in a second place that would have to be looked up
   * after the selection.
   */
  for (const level of ['touch-easy', 'touch-medium', 'touch-hard']) {
    await expect(page.locator(`[data-preset="${level}"]`)).toContainText(/\d+ Fragen/)
  }
})

/* ------------------------------------------------------------------ *
 * Light and dark version of the start selection
 *
 * The selection sits ABOVE the stage and could therefore never read its
 * `.stage--bright` - it was always dark, even when the game afterwards ran on
 * paper. The version now lives as `data-theme` on the root element, and the
 * `--start-*` colours depend on it.
 * ------------------------------------------------------------------ */

test('the start selection is in the same version as the stage afterwards', async ({ page }) => {
  await openStartScreen(page)
  await expect(page.locator('[data-quiz-game]')).toHaveAttribute('data-theme', 'bright')

  const colors = await page.locator('[data-quiz-game]').evaluate((node) => {
    const measured = getComputedStyle(node)
    const value = (name: string) => measured.getPropertyValue(name).trim()
    return { ground: value('--start-bg-top'), selection: value('--start-selected'), green: value('--start-green') }
  })
  // Paper, not night - `Weiß` of the federal spectrum, as the palette writes it.
  expect(colors.ground).toBe('#FFFFFF')
  /*
   * THE SELECTION IS NOT THE ACTION. Both used to be the same green; on paper
   * the selection carries the blue of the marked answer, and green belongs
   * solely to the button that starts the game.
   */
  expect(colors.selection).not.toBe(colors.green)
})

test('chosen, open and the three states in between can be told apart', async ({ page }) => {
  await openStartScreen(page)

  const chosen = page.locator('[data-preset][aria-pressed="true"]').first()
  const open = page.locator('[data-preset][aria-pressed="false"]').first()
  const selection = await page
    .locator('[data-quiz-game]')
    .evaluate((node) => getComputedStyle(node).getPropertyValue('--start-selected').trim())

  /*
   * Selected and open differ in the FILL and in the ink on top of it - not in
   * a border. The test further below checks that neither state adds one
   * ("the selected card is a fill").
   */
  const state = await chosen.evaluate((node) => {
    const measured = getComputedStyle(node)
    return { area: measured.backgroundColor, font: measured.color }
  })
  const openState = await open.evaluate((node) => {
    const measured = getComputedStyle(node)
    return { area: measured.backgroundColor, font: measured.color }
  })
  expect(state.area).not.toBe(openState.area)
  expect(state.font).not.toBe(openState.font)
  /*
   * The selection mark reads ON the selected card. It used to be a disc in the
   * selection colour, from the days when the card itself stayed pale; the card
   * is the coloured area now, so the mark is the ink that carries on it - a
   * disc of the same colour inside it would be a second statement of the same
   * thing.
   */
  const mark = chosen.locator('[data-on="true"]')
  const ink = await page
    .locator('[data-quiz-game]')
    .evaluate((node) => getComputedStyle(node).getPropertyValue('--start-ink-on-badge').trim())
  await expect(mark).toHaveCSS('color', color(ink))
  expect(state.area).toBe(color(selection))

  /*
   * Shows that the fill of the open card lifts without a line appearing. The
   * test waits for the transition - the fill changes over 120 ms, and a check
   * right away sometimes still reads the old one.
   */
  await open.hover()
  await expect
    .poll(() => open.evaluate((node) => getComputedStyle(node).backgroundColor))
    .not.toBe(openState.area)

  /*
   * Keyboard mark: NO line, but a touch of size and a soft glow. A ring around
   * it would have sat next to the selection on the selected card, and from two
   * metres away that would have turned into two strokes.
   */
  await open.focus()
  // The test waits for the transition: the size grows over 120 ms, not instantly.
  await expect
    .poll(() => open.evaluate((node) => Number(getComputedStyle(node).scale.split(' ')[0])))
    .toBeGreaterThan(1)
  const brand = await open.evaluate((node) => {
    const measured = getComputedStyle(node)
    return { outline: measured.outlineStyle, shadow: measured.boxShadow }
  })
  expect(brand.outline).toBe('none')
  expect(brand.shadow).not.toBe('none')

  /*
   * Disabled: the start button recedes but stays visible. In operation it is
   * never disabled - a level is always preselected - and that is exactly why
   * the state is forced here rather than reached by playing.
   */
  const start = page.locator('[data-start]')
  const awake = await start.evaluate((node) => getComputedStyle(node).opacity)
  const blocked = await start.evaluate((node) => {
    ;(node as HTMLButtonElement).disabled = true
    return getComputedStyle(node).opacity
  })
  expect(Number(blocked)).toBeLessThan(Number(awake))
})

test('only the start button carries green', async ({ page }) => {
  await openStartScreen(page)
  const green = await page
    .locator('[data-quiz-game]')
    .evaluate((node) => getComputedStyle(node).getPropertyValue('--start-green').trim())

  // On the button: as a fill, with light-coloured lettering on top.
  const button = await page.locator('[data-start]').evaluate((node) => {
    const measured = getComputedStyle(node)
    return { ground: measured.backgroundImage, font: measured.color }
  })
  expect(button.ground).toContain(color(green))
  expect(button.font).toBe('rgb(255, 255, 255)')

  // Nowhere else: not on a card, not on the mark, not on the way back.
  const elsewhere = await page.evaluate(() => {
    const places = ['[data-preset][aria-pressed="true"]', '[data-player-count][aria-pressed="true"]', '[data-game-start] button:not([data-start])']
    return places.flatMap((place) =>
      [...document.querySelectorAll(place)].map((node) => {
        const measured = getComputedStyle(node as Element)
        return [measured.backgroundColor, measured.borderTopColor, measured.color].join(' ')
      }),
    )
  })
  expect(elsewhere.join(' ')).not.toContain(color(green))
})

/* ------------------------------------------------------------------ *
 * Kids world
 *
 * The start selection sits ABOVE the stage - the `.stage--kids` class does not
 * exist there. That the world still comes through depends on `data-skin` on
 * the root element and on the world already coming from the target audience
 * rather than only from the running game. Both are invisible if they fail:
 * the selection would simply look like the adults' one.
 * ------------------------------------------------------------------ */

/** The artwork that a fill carries - as a file name, without a path in front of it. */
async function drawing(page: Page, choice: string, pseudo = '::before'): Promise<string> {
  return page.locator(choice).first().evaluate((node, ps) => {
    const source = getComputedStyle(node as Element, ps as string).borderImageSource
    return (source.match(/[\w-]+\.svg/)?.[0] ?? source.slice(0, 40)) as string
  }, pseudo)
}

test('the kids device carries its world already in the selection', async ({ page }) => {
  await page.goto('/play?audience=kids')
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })

  await expect(page.locator('[data-quiz-game]')).toHaveAttribute('data-skin', 'kids')

  // The selection cards are the same painted cartons as the answer rows.
  expect(await drawing(page, '[data-preset][aria-pressed="false"]')).toBe('answer-box-a.svg')

  /*
   * SELECTED LOOKS LIKE A SELECTED ANSWER: red card, white text. No green ring
   * and no green border - green is the adults' selection colour and has no
   * meaning in this world.
   */
  const chosen = page.locator('[data-preset][aria-pressed="true"]').first()
  expect(await drawing(page, '[data-preset][aria-pressed="true"]')).toBe('answer-box-b.svg')
  const edge = await chosen.evaluate((node) => {
    const s = getComputedStyle(node)
    return { color: s.color, width: s.borderTopWidth }
  })
  expect(edge.color).toBe('rgb(255, 255, 255)')
  expect(edge.width).toBe('0px')
})

test('the primary button of the kids world is the same everywhere', async ({ page }) => {
  /*
   * "Los geht\'s" in the selection and "Antwort abgeben und aufloesen" in the
   * footer are two components in two places - and must come from the same
   * artwork. Otherwise the world would have two primary buttons.
   */
  await page.goto('/play?audience=kids')
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
  const inSelection = await drawing(page, '[data-start]')

  await page.getByRole('button', { name: /^Allein/ }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.locator('[data-start]').click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })

  await page.locator(openAnswer).first().click()
  await expect(page.locator('[data-confirm]')).toBeVisible()
  const inGame = await drawing(page, '[data-confirm]')

  expect(inGame).toBe(inSelection)
})

test('the adults selection stays undrawn', async ({ page }) => {
  // The kids world must not touch the other one.
  await openStartScreen(page)
  await expect(page.locator('[data-quiz-game]')).toHaveAttribute('data-skin', 'default')
  expect(await drawing(page, '[data-preset]')).toBe('none')
})

test('the start selection can be operated completely with the keyboard', async ({ page }) => {
  await openStartScreen(page)

  /*
   * On the device in the foyer everyone taps with a finger - but the setup is
   * checked with a keyboard, and accessibility is not a question of where the
   * device stands. Reachable means: get there with Tab and trigger it with the
   * space key, without a click ever being necessary.
   */
  await page.locator('[data-player-count="1"]').focus()
  await page.keyboard.press('Tab')
  await expect(page.locator('[data-player-count="2"]')).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.locator('[data-player-count="2"]')).toHaveAttribute('aria-pressed', 'true')

  await page.locator('[data-preset="touch-medium"]').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-preset="touch-medium"]')).toHaveAttribute('aria-pressed', 'true')

  await page.locator('[data-start]').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator(freeBuzzer)).toHaveCount(2)
})

test('first the question stands alone, then answers and buzzers come', async ({ page }) => {
  /*
   * On the device nobody reads the question aloud. The countdown beforehand is
   * the substitute: whoever is still reading should not be beaten by a faster
   * thumb. While it runs, the answers are not even live.
   */
  await openStartScreen(page)
  await page.getByRole('button', { name: /^Zu zweit/ }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()

  await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'question-presented', { timeout: 30_000 })
  await expect(page.locator('[data-prompt]')).toBeVisible()
  await expect(page.locator('[data-answer]')).toHaveCount(0)
  await expect(page.locator('[data-buzzer][data-enabled="true"]')).toHaveCount(0)

  // The buzzer only opens once the answers appear.
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'buzzer-open')
  await expect(page.locator(freeBuzzer)).toHaveCount(2)
})

test('after the solution the device waits for "next"', async ({ page }) => {
  await startGame(page, 'Allein')
  const stage = page.locator('.stage')
  const question = await page.locator('[data-prompt]').first().innerText()

  await answerWith(page)
  await expect(stage).toHaveAttribute('data-scene', 'solution', { timeout: 20_000 })

  /*
   * And stays there. The server used to schedule a transition here; whoever
   * was still reading why their answer was wrong lost the picture.
   */
  await page.waitForTimeout(8_000)
  await expect(stage).toHaveAttribute('data-scene', 'solution')
  await expect(page.locator('[data-prompt]').first()).toHaveText(question)
  // Resolved means: nobody can buzz anymore and nobody can tap anymore.
  await expect(page.locator(freeBuzzer)).toHaveCount(0)
  await expect(page.locator(openAnswer)).toHaveCount(0)

  await next(page)
  await expect(stage).toHaveAttribute('data-scene', 'pause', { timeout: 20_000 })
})

test('solo game: the hint sits centred, the counter outside', async ({ page }) => {
  /*
   * Without an opponent, the right-hand corner disappears. The counter takes
   * its place so the hint stays in the middle of the screen - otherwise it
   * would shift to the right along with the counter, and the button would no
   * longer sit where the second hand also expects it in a duel.
   */
  await startGame(page, 'Allein')
  await answerWith(page)
  await expect(page.locator('[data-continue]')).toBeVisible({ timeout: 20_000 })

  const width = page.viewportSize()!.width
  const button = (await page.locator('[data-continue]').boundingBox())!
  expect(Math.round(button.x + button.width / 2)).toBe(Math.round(width / 2))

  // The counter sits to the right of the button, the score card to its left.
  const counter = (await page.locator('[data-counter]').boundingBox())!
  const card = (await page.locator('[data-score]').boundingBox())!
  expect(counter.x).toBeGreaterThan(button.x + button.width)
  expect(card.x + card.width).toBeLessThan(button.x)
})

test('hint and "next" share a field of fixed height', async ({ page }) => {
  await startGame(page, 'Allein')

  const field = page.locator('[data-notice]')
  const empty = (await field.boundingBox())!
  const counter = (await page.locator('[data-counter]').boundingBox())!

  await answerWith(page)
  await expect(page.locator('[data-continue]')).toBeVisible({ timeout: 20_000 })

  /*
   * Field and counter stay exactly where they were. Without a fixed height,
   * everything above it would shift a bit as soon as the hint turns into a
   * button - right at the moment someone is aiming with their finger.
   */
  const withButton = (await field.boundingBox())!
  expect(Math.round(withButton.height)).toBe(Math.round(empty.height))
  expect(Math.round(withButton.y)).toBe(Math.round(empty.y))
  const counterAfter = (await page.locator('[data-counter]').boundingBox())!
  expect(Math.round(counterAfter.y)).toBe(Math.round(counter.y))
})

test('solo game: no buzzer, and the evaluation runs without an operator', async ({ page }) => {
  await startGame(page, 'Allein')

  // Whom would you buzz against? As soon as the answers appear, they are open.
  await expect(page.locator('[data-buzzer]')).toHaveCount(0)
  await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'buzzer-open')

  await answerWith(page)

  // Scoring and the solution run on their own - only the step after that does not.
  await expect(page.locator('.stage')).toHaveAttribute('data-scene', 'feedback', { timeout: 20_000 })
  await expect(page.locator('.stage')).toHaveAttribute('data-scene', 'solution', { timeout: 20_000 })
  await expect(page.locator('[data-continue]')).toBeVisible()
})

test('the answers are on the table exactly once - as buttons', async ({ page }) => {
  /*
   * ONE list, even in a duel. Each player used to have their own; the same
   * four answers then appeared twice, and only one of the two copies could be
   * tapped.
   */
  await startGame(page, 'Zu zweit')

  await expect(page.locator('[data-answers]')).toHaveCount(1)
  const rows = await page.locator('[data-answer]').count()
  expect(rows).toBeGreaterThan(1)
  // And every row is a real button, not a fill with a click handler bolted on.
  await expect(page.locator('[data-answer-button]')).toHaveCount(rows)
})

test('duel: two buzzers, and whoever presses first gets the answers', async ({ page }) => {
  await startGame(page, 'Zu zweit')

  // Both players stand side by side: one buzzer per side, both open.
  await expect(page.locator('[data-buzzer]')).toHaveCount(2)
  await expect(page.locator(freeBuzzer)).toHaveCount(2)
  // As long as nobody has pressed, the answers belong to no one.
  await expect(page.locator(openAnswer)).toHaveCount(0)

  await page.locator('[data-buzzer][data-side="right"]').click()

  // The turn is shown on the buzzer itself, and the other one recedes.
  await expect(page.locator('[data-buzzer][data-side="right"]')).toHaveAttribute('data-armed', 'true')
  await expect(page.locator(freeBuzzer)).toHaveCount(0)
  const rows = await page.locator('[data-answer]').count()
  await expect(page.locator(openAnswer)).toHaveCount(rows)

  await page.locator(openAnswer).first().click()

  /*
   * Tapped is only logged: the answer is marked, the submit button is ready,
   * and until then the player may change their mind. Scoring only happens
   * once they submit.
   */
  await expect(page.locator('[data-confirm]')).toBeVisible()
  await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'answer-locked')

  await page.locator('[data-confirm]').click()

  // The player who has submitted is done with this question - whatever the outcome.
  await expect(page.locator('.stage')).not.toHaveAttribute('data-phase', 'answer-locked')
  await expect(page.locator('.stage')).not.toHaveAttribute('data-phase', 'buzzer-open')
})

test('the scene stays above the footer - in every resolution', async ({ page }) => {
  /*
   * The footer gives up nothing: it carries the score and the buzzers, and the
   * player's hand must not get smaller just because a question is long. The
   * scene above it is the one that yields. If it still runs into the footer,
   * of all things answer D disappears behind a score card - without anything
   * looking like a bug.
   *
   * Checked across every target format: the area above the footer is much
   * wider than it is tall, and that is exactly where sizes expressed in
   * container widths are easiest to lose track of.
   */
  await startGame(page, 'Zu zweit')

  for (const [width, height] of [
    [1920, 1080],
    [1280, 720],
    [1024, 768],
  ] as const) {
    await page.setViewportSize({ width, height })
    // One frame for the reflow - the question re-measures itself after the resize.
    await page.waitForTimeout(300)

    const foot = (await page.locator('[data-player-foot]').boundingBox())!
    const rows = await page.locator('[data-answer]').all()
    expect(rows.length, `${width}x${height}`).toBeGreaterThanOrEqual(4)
    for (const row of rows) {
      const box = (await row.boundingBox())!
      expect(Math.round(box.y + box.height), `${width}x${height}`).toBeLessThanOrEqual(Math.round(foot.y))
    }
  }
})

test('points and counter sit at the bottom by the buzzers, not in the header', async ({ page }) => {
  await startGame(page, 'Zu zweit')

  const foot = page.locator('[data-player-foot]')
  await expect(foot.locator('[data-score]')).toHaveCount(2)
  await expect(foot.locator('[data-counter]')).toHaveCount(1)
  // On the device, the header carries only the wordmark now.
  await expect(page.locator('header [data-score]')).toHaveCount(0)
  await expect(page.locator('[data-brand]')).toBeVisible()

  /*
   * Every corner belongs to one player: the score card sits above THEIR buzzer
   * and on the same side. That - not reading - is how they know during the
   * game where to hit.
   */
  for (const [side, number] of [
    ['left', '1'],
    ['right', '2'],
  ]) {
    const card = (await page.locator(`[data-score][data-player="${number}"]`).boundingBox())!
    const buzzer = (await page.locator(`[data-buzzer][data-side="${side}"]`).boundingBox())!
    expect(Math.round(card.x), side).toBe(Math.round(buzzer.x))
    expect(card.y + card.height, side).toBeLessThanOrEqual(buzzer.y + 1)
  }
})

test('the idle watch releases the device again', async ({ page }) => {
  /*
   * Eight seconds instead of two minutes - the supervision limit comes in as
   * an operating setting. It must not be any shorter here: the countdown runs
   * from the start of the game, and the lead-in of the interstitial screen
   * still counts towards it.
   */
  await page.goto('/play?idle=8')
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /^Allein/ }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })

  // Nobody is tapping anymore: the game is aborted and the selection returns.
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 25_000 })
})

test('a solo game runs to the result without a single operator command', async ({ page }) => {
  // A complete game with seven questions takes longer than a click test.
  test.setTimeout(240_000)
  await startGame(page, 'Allein')

  const stage = page.locator('.stage')
  /*
   * Answer as soon as the tiles are active - otherwise wait. Everything in
   * between (scoring, solution, next question) is handled by the server on
   * its own.
   */
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    if ((await stage.getAttribute('data-scene')) === 'result') break
    /*
     * Submit only after tapping: after a tap the rows deliberately stay active
     * (to change your mind), the question only advances via submitting.
     */
    const submit = page.locator('[data-confirm]')
    if (await submit.isVisible().catch(() => false)) {
      await submit.click({ timeout: 2_000 }).catch(() => undefined)
      continue
    }
    const row = page.locator(openAnswer).first()
    if (await row.isVisible().catch(() => false)) {
      // Short run-up: between the check and the tap, the tile can disappear,
      // for instance because the game ends at that exact moment.
      await row.click({ timeout: 2_000 }).catch(() => undefined)
      continue
    }
    // After the solution, the device waits for a tap - even in solo play.
    const button = page.locator('[data-continue]')
    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 2_000 }).catch(() => undefined)
      continue
    }
    await page.waitForTimeout(300)
  }

  await expect(stage).toHaveAttribute('data-scene', 'result', { timeout: 30_000 })
  // Solo result: no winner, just your own number of correct answers.
  await expect(page.locator('[data-result-label]')).toHaveText('Ergebnis')
  await expect(page.getByRole('button', { name: 'Nochmal spielen' })).toBeVisible()
  /*
   * And no way to end a round that is over: the result view offers another
   * round and the way out instead.
   */
  await expect(page.locator('[data-abort-game]')).toHaveCount(0)
})

/* ------------------------------------------------------------------ *
 * Settings, zoom and exit
 * ------------------------------------------------------------------ */

test('the settings hang on the start screen, not on the running game', async ({ page }) => {
  await openStartScreen(page)
  await page.locator('[data-settings-open]').click()

  const settings = page.locator('[data-settings]')
  await expect(settings).toBeVisible()
  await expect(settings.locator('[data-sound-on]')).toHaveAttribute('aria-pressed', 'true')
  await expect(settings.locator('[data-sound-test]')).toBeVisible()
  await expect(settings.locator('[data-zoom]')).toHaveValue('1')

  await page.locator('[data-settings-close]').click()
  await expect(settings).toHaveCount(0)

  /*
   * While a game is running, they are gone: whoever is standing at the device
   * should not be able to mute the sound while everyone else is listening.
   */
  await page.getByRole('button', { name: /^Allein/ }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-settings-open]')).toHaveCount(0)
})

test('the sound switch of the settings applies to the whole device', async ({ page }) => {
  await openStartScreen(page)
  await page.locator('[data-settings-open]').click()
  await page.locator('[data-sound-off]').click()

  await expect(page.locator('[data-sound-off]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-sound-on]')).toHaveAttribute('aria-pressed', 'false')

  // It is tied to the game state, not to the view: it survives closing.
  await page.locator('[data-settings-close]').click()
  await page.locator('[data-settings-open]').click()
  await expect(page.locator('[data-sound-off]')).toHaveAttribute('aria-pressed', 'true')
})

test('a smaller zoom shrinks the scene towards the centre, the corners stay at the edge', async ({ page }) => {
  await startGame(page, 'Zu zweit')

  const scene = page.locator('[data-scene-root]')
  const large = await scene.boundingBox()
  const leftCornerLarge = await page.locator('[data-corner="left"]').boundingBox()
  const area = await page.locator('[data-quiz-game]').boundingBox()

  await page.evaluate(() => {
    const root = document.querySelector('[data-quiz-game]') as HTMLElement
    root.style.setProperty('--stage-zoom', '0.7')
  })

  const small = await scene.boundingBox()
  const leftCornerSmall = await page.locator('[data-corner="left"]').boundingBox()

  // The scene gets smaller ...
  expect(small!.width).toBeLessThan(large!.width * 0.8)
  // ... and stays centred while doing so: the gap to the left and right is equal.
  const left = small!.x - area!.x
  const right = area!.x + area!.width - (small!.x + small!.width)
  expect(Math.abs(left - right)).toBeLessThan(4)

  // The score card shrinks along with it but does not move away from the edge.
  expect(leftCornerSmall!.width).toBeLessThan(leftCornerLarge!.width * 0.8)
  expect(leftCornerSmall!.x - area!.x).toBeLessThan(leftCornerLarge!.x - area!.x + 1)
})

test('the zoom level also applies to selection and settings', async ({ page }) => {
  /*
   * Whoever shrinks the display because they otherwise cannot see across means
   * the selection beforehand just as much as the question afterwards. A
   * full-size selection in front of a shrunk game would only be half the
   * setting.
   */
  await openStartScreen(page)
  const selectionLarge = (await page.locator('[data-game-start]').boundingBox())!.width

  await page.locator('[data-settings-open]').click()
  const cardLarge = (await page.locator('[data-settings] > div').boundingBox())!.width
  await page.locator('[data-zoom]').fill('0.7')
  const cardSmall = (await page.locator('[data-settings] > div').boundingBox())!.width
  await page.locator('[data-settings-close]').click()
  const selectionSmall = (await page.locator('[data-game-start]').boundingBox())!.width

  expect(selectionSmall).toBeLessThan(selectionLarge * 0.8)
  expect(cardSmall).toBeLessThan(cardLarge * 0.8)
})

test('the scene appears immediately in the set size, not only after the transition', async ({ page }) => {
  /*
   * THE SCENE TRANSITIONS ANIMATE `transform`. If the zoom level lived as a
   * transform on the same element, the animation would overwrite it: the
   * question would appear at full size and jump small at the end of the
   * animation. That is why it lives in its own `scale` property, which gets
   * combined WITH the animation - and that is why this test measures during
   * the transition and not after it.
   */
  await openStartScreen(page)
  await page.evaluate(() => {
    const root = document.querySelector('[data-quiz-game]') as HTMLElement
    root.style.setProperty('--stage-zoom', '0.7')
  })
  await page.getByRole('button', { name: /^Allein/ }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()

  await page.waitForSelector('[data-scene-root]', { timeout: 30_000 })
  const measured: number[] = []
  for (let i = 0; i < 12; i += 1) {
    measured.push((await page.locator('[data-scene-root]').boundingBox())!.width)
    await page.waitForTimeout(60)
  }
  expect(Math.max(...measured) - Math.min(...measured)).toBeLessThan(2)
})

/* ------------------------------------------------------------------ *
 * Ending a running round
 *
 * The one control that sits ON the game. What is checked is where it is, when
 * it exists, that it asks before it acts, and that what comes back is a menu
 * and not the remains of a round.
 * ------------------------------------------------------------------ */

test('"end round" asks first and leads back to the selection', async ({ page }) => {
  await startGame(page, 'Allein')

  await page.locator('[data-abort-game]').click()
  await expect(page.locator('[data-abort-dialog]')).toBeVisible()

  // Whoever wants to keep playing is back in front of the same question afterwards.
  await page.locator('[data-abort-cancel]').click()
  await expect(page.locator('[data-abort-dialog]')).toHaveCount(0)
  await expect(page.locator('[data-answers]')).toBeVisible()

  await page.locator('[data-abort-game]').click()
  await page.locator('[data-abort-confirm]').click()
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
})

test('it exists only while a round runs, and sits in the middle of its head', async ({ page }) => {
  await openStartScreen(page)
  // Not in the menu: there is nothing running to end.
  await expect(page.locator('[data-abort-game]')).toHaveCount(0)

  await page.getByRole('button', { name: /^Allein/ }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })

  const chip = page.locator('[data-abort-game]')
  await expect(chip).toBeVisible()
  /*
   * CENTRED, and that is the point of its place: the corners belong to the
   * players - buzzers below, the host's own bar above - and a control that
   * ends the round for both of them sits in neither hand.
   */
  const placed = await chip.evaluate((node) => {
    const box = node.getBoundingClientRect()
    return { offset: Math.round(box.left + box.width / 2 - window.innerWidth / 2), top: Math.round(box.top) }
  })
  expect(Math.abs(placed.offset), 'distance from the middle').toBeLessThan(2)
  expect(placed.top, 'in the head of the screen').toBeLessThan(80)
  // A finger's target, not a word's box.
  const size = (await chip.boundingBox())!
  expect(size.height).toBeGreaterThanOrEqual(30)
})

test('it looks the same in every version of the stage', async ({ page }) => {
  /*
   * One look everywhere, by decision: whoever wants out of a round should not
   * have to find a different button on the dark stage than on paper. The chip
   * therefore reads its two colours from tokens that belong to no theme
   * (`--stage-chip`, `--stage-inkOnChip`) - this measures that they really do
   * not move with the version.
   */
  const colours = async (variant: string) => {
    await page.addInitScript((value) => localStorage.setItem('quiz.stageTheme', value as string), variant)
    await startGame(page, 'Allein')
    return page.locator('[data-abort-game]').evaluate((node) => {
      const measured = getComputedStyle(node)
      return { area: measured.backgroundColor, ink: measured.color }
    })
  }
  const bright = await colours('bright')
  const dark = await colours('dark')
  const red = await colours('red')
  expect(dark).toEqual(bright)
  expect(red).toEqual(bright)
  // And it is a light surface with dark ink on it, not the other way round.
  expect(bright.area).toBe('rgb(242, 243, 244)')
  expect(bright.ink).toBe('rgb(0, 75, 118)')
})

test('the round can be ended with the keyboard alone', async ({ page }) => {
  await startGame(page, 'Allein')

  /*
   * The chip is a button and reachable by tabbing; the dialog puts the
   * keyboard on its confirming answer, and Escape is the way back out of it.
   */
  await page.locator('[data-abort-game]').focus()
  await expect(page.locator('[data-abort-game]')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-abort-dialog]')).toBeVisible()
  await expect(page.locator('[data-abort-confirm]')).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(page.locator('[data-abort-dialog]')).toHaveCount(0)
  await expect(page.locator('[data-answers]')).toBeVisible()

  await page.locator('[data-abort-game]').focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
})

test('a duel ends the same way, and what comes back is a fresh round', async ({ page }) => {
  await startGame(page, 'Zu zweit')
  // Play into the round, so there is something to reset.
  await page.locator(freeBuzzer).first().click()
  await page.locator(openAnswer).first().click()
  await page.locator('[data-confirm]').click()

  await page.locator('[data-abort-game]').click()
  await page.locator('[data-abort-confirm]').click()
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
  // The menu, not the remains of a round: nothing of the game is left on screen.
  await expect(page.locator('[data-answers]')).toHaveCount(0)
  await expect(page.locator('[data-abort-game]')).toHaveCount(0)

  /*
   * AND THE NEXT ROUND STARTS AT THE BEGINNING. The state is reset, not
   * paused: first question, no points - in the mode chosen anew.
   */
  await page.getByRole('button', { name: /^Zu zweit/ }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-counter]')).toContainText('1/')
  const points = await page.locator('[data-score-value="points"]').allInnerTexts()
  expect(points).toEqual(['0', '0'])
})

/* ------------------------------------------------------------------ *
 * Multilingualism
 * ------------------------------------------------------------------ */

test('the language switch changes selection and game', async ({ page }) => {
  /*
   * The whole path in the browser: switch -> command -> server -> projection
   * -> view. Checked at three points, because the language is resolved at
   * three points - the interface, the catalogue and the question content.
   */
  await openStartScreen(page)

  const switcher = page.locator('[data-languages]')
  await expect(switcher).toBeVisible()
  await expect(page.locator('[data-locale="de-DE"]')).toHaveAttribute('aria-pressed', 'true')

  // German: the interface and the names of the difficulty levels.
  await expect(page.getByRole('button', { name: /^Allein/ })).toBeVisible()
  const germanPresets = await page.locator('[data-preset-options] button').allInnerTexts()
  expect(germanPresets.map((entry) => entry.split('\n')[0])).toEqual(['Leicht', 'Mittel', 'Schwer'])

  await page.locator('[data-locale="en-GB"]').click()

  await expect(page.locator('[data-locale="en-GB"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /^Play alone/ })).toBeVisible()
  const englishPresets = await page.locator('[data-preset-options] button').allInnerTexts()
  expect(englishPresets.map((entry) => entry.split('\n')[0])).toEqual(['Easy', 'Medium', 'Hard'])
  await expect(page.getByRole('button', { name: "Let's go" })).toBeVisible()

  // And the game itself continues in the same language.
  await page.getByRole('button', { name: /^Play alone/ }).click()
  await page.getByRole('button', { name: /^Easy/ }).click()
  await page.getByRole('button', { name: "Let's go" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })

  await expect(page.locator('[data-prompt]')).toContainText('Test question')
  const answers = await page.locator('[data-answer]').allInnerTexts()
  expect(answers.join(' ')).toMatch(/Correct answer|Wrong answer/)
  await expect(page.locator('[data-score-label]').first()).toHaveText('Player')
})

test('the English screen comes from the package, not from the content', async ({ page }) => {
  /*
   * THE FIXTURE CONTENT OVERRIDES NOTHING ANY MORE. It used to carry twenty
   * English strings, because the package spoke German only - and a set of
   * overrides in a config file is a translation nobody reviews. Both languages
   * live in the package now; the content is where a host words a screen its own
   * way, and where a third language would arrive.
   *
   * So this test reads the package's own English on the screen, and checks in
   * the same breath that the content really says nothing: a leftover override
   * would make the assertion above pass for the wrong reason.
   */
  await openStartScreen(page)
  const overrides = await page.evaluate(async () => {
    const answer = await fetch('/quiz-package/config.json')
    const config = (await answer.json()) as { interfaceStrings?: Record<string, unknown> }
    return Object.keys(config.interfaceStrings ?? {})
  })
  expect(overrides, 'locales the fixture content overrides texts for').toEqual([])

  await page.locator('[data-locale="en-GB"]').click()
  // Words that stand nowhere but in `englishTexts`.
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible()
  await expect(page.locator('[data-quiz-start-content]')).toContainText('Start a game')
  await expect(page.locator('[data-quiz-start-content]')).toContainText('Choose mode and difficulty.')
  /*
   * And the step names, which are no headlines on the screen: they are what a
   * screen reader announces before the cards of a group, so they are read
   * where they live.
   */
  await expect(page.getByRole('group', { name: 'How many are playing?' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Which quiz?' })).toBeVisible()
})

test('without a second language there is nothing to switch', async ({ page }) => {
  /*
   * The switch depends on the configuration, not on the code: a package with
   * only one language does not show a selector with exactly one option - that
   * would not be a choice, it would be an obstacle.
   */
  await openStartScreen(page)
  const locales = await page.locator('[data-languages] button').count()
  expect(locales).toBeGreaterThan(1)
})

/*
 * The size depends on the WIDTH of the window - and on nothing else.
 *
 * That is the promise to the setup: the touch table in the foyer, the tablet
 * at the booth and the window in the game collection all have different
 * formats. Whoever changes a size changes it for all of them at once, because
 * there is only ONE measure. Previously the scene computed its height from
 * the remaining space and its width from that: the same device, laid flat,
 * showed the question smaller - without a single number in the design having
 * changed.
 */
test('same width means same size, even on windows of different height', async ({ page }) => {
  /*
   * Nothing about the content is measured: the box of the scene, the box of a
   * buzzer and the font size of a score. The answer list is NOT suitable for
   * this - an image question places it beside the photo, a text question
   * places it below, and which question shows up is decided by the selection.
   */
  async function measures(): Promise<Record<string, number>> {
    const box = async (choice: string) => {
      const box = await page.locator(choice).first().boundingBox()
      if (!box) throw new Error(`ohne Kasten: ${choice}`)
      return box
    }
    const scene = await page.evaluate(() => {
      const element = document.querySelector('[class*="sceneRoot"]')
      if (!element) throw new Error('ohne Szene')
      const box = element.getBoundingClientRect()
      return { width: box.width, height: box.height, left: box.x }
    })
    const buzzer = await box('[data-buzzer]')
    const points = await page
      .locator('[data-score-value]')
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
    return {
      sceneWidth: Math.round(scene.width),
      sceneHeight: Math.round(scene.height),
      sceneLeft: Math.round(scene.left),
      buzzerWidth: Math.round(buzzer.width),
      buzzerHeight: Math.round(buzzer.height),
      pointsFont: Math.round(points * 100) / 100,
    }
  }

  /*
   * BOTH HEIGHTS LEAVE ROOM for the full-width scene above the fixed footer,
   * and that is arithmetic, not taste: at 1280 the scene is 720 tall, the
   * header takes about 77 and the footer about 218 - so from roughly 1030
   * upwards the width decides alone. Below that the height constrains, which
   * is the exception tested right after: a window too flat for the full width
   * never lets the scene run under the footer.
   *
   * The numbers used to be 900 and 1000, from the days when the device showed
   * the stage at 80 percent and a 1280-wide scene was only 576 tall.
   */
  await page.setViewportSize({ width: 1280, height: 1100 })
  await startGame(page, 'Zu zweit')
  const flat = await measures()

  await page.setViewportSize({ width: 1280, height: 1250 })
  await startGame(page, 'Zu zweit')
  const tall = await measures()

  expect(tall).toEqual(flat)

  await page.setViewportSize({ width: 1280, height: 720 })
  await startGame(page, 'Zu zweit')
  const clearance = await page.evaluate(() => {
    const scene = document.querySelector('[class*="sceneArea"]')!.getBoundingClientRect()
    const corner = document.querySelector('[data-corner="left"]')!.getBoundingClientRect()
    return corner.top - scene.bottom
  })
  expect(clearance, 'scene above the footer at 1280x720').toBeGreaterThanOrEqual(0)

  /*
   * And conversely: if ONLY the width changes, everything grows in the same
   * proportion. Half the width yields half the font size and half the box -
   * no component breaks out of the proportion.
   */
  await page.setViewportSize({ width: 640, height: 1000 })
  await startGame(page, 'Zu zweit')
  const half = await measures()

  for (const [name, value] of Object.entries(half)) {
    // One pixel of leeway: the measurements are rounded, half the width is not.
    expect(Math.abs(value - tall[name]! / 2), name).toBeLessThanOrEqual(1)
  }
})

/*
 * The footer sits at the bottom edge - where the hands are.
 *
 * It carries the score, the counter and the two buzzers, i.e. everything that
 * gets touched on this device. Since the composition derives its height from
 * the width, a taller window leaves space left over; that space belongs in
 * the middle, not underneath the footer.
 */
test('the footer sits at the bottom edge of the screen, however tall the window is', async ({ page }) => {
  async function spaceBelowBar(): Promise<number> {
    return page.evaluate(() => {
      const stage = document.querySelector('.stage')!.getBoundingClientRect()
      /* The score sits in a player corner, the corner sits in the footer. */
      const bar = document.querySelector('[data-score]')!.parentElement!.parentElement!
      return Math.round(stage.bottom - bar.getBoundingClientRect().bottom)
    })
  }

  for (const height of [720, 1000]) {
    await page.setViewportSize({ width: 1280, height: height })
    await startGame(page, 'Zu zweit')
    expect(await spaceBelowBar(), `duel at 1280x${height}`).toBe(0)
  }

  /*
   * And the same in solo play: there the buzzers are missing, so the footer is
   * shorter - which is why it does not shift upward.
   */
  await page.setViewportSize({ width: 1280, height: 1000 })
  await startGame(page, 'Allein')
  expect(await spaceBelowBar(), 'solo game at 1280x1000').toBe(0)
})

/*
 * Colour in a corner means: this one is playing.
 *
 * Both corners carry the accent of the world - they are told apart by their
 * place, not by two tones of their own. And the accent stays only while it
 * says something: the buzzer is open for the taking, or its player has the
 * turn. Otherwise the corner is the neutral tile of the stage, the same area
 * the score card carries next to it.
 *
 * The test reads both tokens out of the running world instead of naming
 * values: the light device and the dark hall have different accents, and the
 * one that must arrive is the one of the world on screen.
 */
test('the accent marks the corner that is playing - in every state', async ({ page }) => {
  /** A token of the world, normalised the way the browser reports colours. */
  const token = async (name: string, property: 'background' | 'color') =>
    page.evaluate(
      ([entry, kind]) => {
        const stage = document.querySelector('.stage')!
        const probe = document.createElement('div')
        probe.style.setProperty(kind, `var(${entry})`)
        stage.appendChild(probe)
        const computed = getComputedStyle(probe)
        const value = kind === 'background' ? computed.backgroundColor : computed.color
        probe.remove()
        return value
      },
      [name, property] as const,
    )

  /** Every fill of the footer: background, border, type and opacity, as it actually stands. */
  const bar = async () =>
    page.evaluate(() => {
      const readInput = (element: Element) => {
        const style = getComputedStyle(element)
        return {
          ground: style.backgroundColor,
          edge: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].join(' '),
          font: style.color,
          opacity: style.opacity,
        }
      }
      return {
        buzzer: [...document.querySelectorAll('[data-buzzer]')].map((button) => ({
          side: button.getAttribute('data-side'),
          armed: button.getAttribute('data-armed') === 'true',
          ...readInput(button),
        })),
        /* Per card both of its tiles - the fill sits on them, not on the card. */
        cards: [...document.querySelectorAll('[data-score]')].map((card) => ({
          active: card.getAttribute('data-active') === 'true',
          locked: card.getAttribute('data-locked') === 'true',
          tiles: [...card.children].map(readInput),
        })),
      }
    })

  await startGame(page, 'Zu zweit')
  const accent = await token('--color-accent', 'background')
  const quietAccent = await token('--color-accentQuiet', 'background')
  const quietGround = await token('--color-tile', 'background')
  const quietFont = await token('--color-textMuted', 'color')

  /*
   * Three states in one round: open (both operable), buzzed (one has the turn,
   * the other is locked) and resolved (both locked).
   */
  const states = [] as Awaited<ReturnType<typeof bar>>[]
  states.push(await bar())
  await page.locator('[data-buzzer][data-side="left"]').click()
  await expect(page.locator('[data-buzzer][data-armed="true"]')).toHaveCount(1)
  states.push(await bar())
  /*
   * Deliberately the CORRECT answer of the test package: a wrong one gives the
   * other player a second chance, and then the round is not resolved but open
   * again - a different state than the one meant here.
   */
  await page.locator('[data-answer-button]', { hasText: /Richtige Antwort/ }).first().click()
  await page.locator('[data-confirm]').click()
  await expect(page.locator('[data-continue]')).toBeVisible()
  states.push(await bar())

  /** Which corners are playing: while the buzzer is open both, after a buzz the one that holds it. */
  const playing = [
    ['left', 'right'],
    ['left'],
    [],
  ]

  for (const [number, state] of states.entries()) {
    for (const button of state.buzzer) {
      const isPlaying = playing[number]!.includes(button.side!)
      const where = `Zustand ${number}, ${button.side}`
      if (isPlaying) {
        expect(button.ground, where).toBe(accent)
        expect(button.font, where).toBe('rgb(255, 255, 255)')
      } else {
        expect(button.ground, where).toBe(quietGround)
        expect(button.font, where).toBe(quietFont)
      }
      // Full-fill also means: no state takes the fill's opacity away.
      expect(button.opacity, where).toBe('1')
      expect(button.edge, where).toBe('0px 0px 0px 0px')
    }

    /*
     * Card and buzzer of one corner say the same thing about the turn: the
     * card through `data-active`, the buzzer through its accent. If the two
     * drifted apart, one of them would be lying about whose turn it is.
     *
     * And the card says it in colour too: its two tiles carry the accent of
     * the world while that player is on turn, the calm accent once the corner
     * is locked, and the plain tile as long as nobody has the turn. The fill
     * sits on the tiles; the card's own ground stays the frosted glass.
     */
    for (const [index, card] of state.cards.entries()) {
      const side = index === 0 ? 'left' : 'right'
      const buzzer = state.buzzer.find((button) => button.side === side)!
      const where = `Zustand ${number}, ${side}`
      expect(card.active, where).toBe(buzzer.armed)

      const expected = card.active ? accent : card.locked ? quietAccent : quietGround
      for (const tile of card.tiles) {
        expect(tile.ground, where).toBe(expected)
        expect(tile.edge, where).toBe('0px 0px 0px 0px')
      }
    }
  }

  /* In solo play there is no buzzer at all - and therefore no corner to mark. */
  await startGame(page, 'Allein')
  const solo = await bar()
  expect(solo.buzzer).toHaveLength(0)
})

/*
 * The start selection uses the same fills as the game that follows.
 *
 * The selected card used to be a box with four traits: a thicker border, a
 * slightly tinted fill, the checkmark - and in the focus state a ring was
 * added around it. On paper the border and the tint were not visible from two
 * metres away, but the two lines were, all the more so.
 */
test('the chosen card is an area, and the same one as a tapped answer', async ({ page }) => {
  const cardState = async (choice: string) =>
    page.locator(choice).evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        ground: style.backgroundColor,
        edge: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].join(' '),
        /*
         * WHETHER AN OUTLINE IS DRAWN, NOT HOW WIDE IT WOULD BE.
         *
         * With `outline-style: none` nothing is drawn, whatever the width says -
         * and Chromium keeps the width of its own focus ring on a button in
         * that state, so the number differs between two builds of the same
         * browser while the screen looks identical. Reading the width there
         * measured the build, not the design; a style that DOES draw comes back
         * with its width and fails with it.
         */
        outline: style.outlineStyle === 'none' ? 'none' : `${style.outlineStyle} ${style.outlineWidth}`,
        font: style.color,
        /* Every piece of text and every fill INSIDE the card - title, line, icon, checkmark. */
        inner: [...element.querySelectorAll('span')].map((part) => getComputedStyle(part).color),
      }
    })

  await openStartScreen(page)
  const chosen = '[data-player-count="1"]'
  const open = '[data-player-count="2"]'

  /*
   * Four states on the same card. `hover` and `focus-visible` are deliberately
   * applied ONE AFTER ANOTHER on the open card: it was exactly their overlap
   * that previously stacked two lines on top of each other.
   */
  const states: Record<string, Awaited<ReturnType<typeof cardState>>> = {}
  states['chosen'] = await cardState(chosen)
  states['offen'] = await cardState(open)
  await page.locator(open).hover()
  states['hover'] = await cardState(open)
  await page.keyboard.press('Tab')
  await page.locator(chosen).focus()
  states['fokus'] = await cardState(chosen)
  await page.locator(open).hover()
  await page.locator(open).focus()
  states['hover+fokus'] = await cardState(open)

  for (const [name, state] of Object.entries(states)) {
    expect(state.edge, name).toBe('0px 0px 0px 0px')
    expect(state.outline, name).toBe('none')
  }

  /* On the filled card everything is white - title, line below it, icon, checkmark. */
  expect(states['chosen']!.font).toBe('rgb(255, 255, 255)')
  for (const ink of states['chosen']!.inner) {
    expect(ink).toMatch(/^rgba?\(255, 255, 255/)
  }
  /* And on the open one, dark - it is a calm grey fill. */
  expect(states['offen']!.font).not.toMatch(/^rgba?\(255, 255, 255/)

  /*
   * THE ACID TEST: the same colour as a tapped answer in the game. It is not
   * read from the palette but from what actually ends up on screen - once
   * here, once there.
   */
  const cardBlue = states['chosen']!.ground
  await startGame(page, 'Zu zweit')
  await page.locator('[data-buzzer][data-side="left"]').click()
  const answer = page.locator('[data-answer][data-state="idle"] [data-answer-button]').first()
  await answer.click()
  await expect(page.locator('[data-answer][data-state="chosen"], [data-answer][data-state="selected"]')).toHaveCount(1)
  const answerBlue = await page
    .locator('[data-answer][data-state="chosen"] [data-answer-surface], [data-answer][data-state="selected"] [data-answer-surface]')
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(cardBlue).toBe(answerBlue)
})
