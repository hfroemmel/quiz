/**
 * THE ARRANGEMENT OF A DEVICE THAT STANDS ON ITS OWN.
 *
 * The media table, the game collection and the standalone application show
 * the same quiz as an evening with an operator - and they have to say
 * everything that operator would say. So the score cards and the counter move
 * up into one group in the head, the two buzzers become the drawn
 * push-buttons in the bottom corners, and between them a fixed field states
 * what to do next.
 *
 * WHAT IS MEASURED HERE is that arrangement and nothing about the game: the
 * rules, the scoring and the second chance are the engine's, and
 * `touch-play.spec.ts` walks them in the other arrangement. What this file
 * asks is where things stand, which of them is lit, and that nothing covers
 * anything else - the three questions a layout can get wrong.
 *
 * The live arrangement is right beside it in the same harness (`/play`
 * without the parameter), and the last test of this file reads it, because
 * "the kiosk looks like this" is only half a statement: the other half is
 * that the device of a live event did not move.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import { openAnswer } from './helpers'

const kiosk = '/play?layout=kiosk'

async function startGame(page: Page, players: 'Allein' | 'Zu zweit', path = kiosk): Promise<void> {
  await page.goto(path)
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: new RegExp(`^${players}`) }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
}

/** The state of both corners, left first: `side:state`. */
async function buzzers(page: Page): Promise<string[]> {
  return page
    .locator('[data-buzzer]')
    .evaluateAll((nodes) =>
      nodes.map((node) => `${(node as HTMLElement).dataset['side']}:${(node as HTMLElement).dataset['buzzerState']}`),
    )
}

async function box(target: Locator) {
  const found = await target.boundingBox()
  if (!found) throw new Error('Element has no box')
  return found
}

/**
 * The same place, to the pixel.
 *
 * Not to the sub-pixel: a row whose neighbour's text got longer is laid out
 * from a different fractional width, and the browser answers with a sixty-
 * fourth of a pixel. What is being asked here is whether the button MOVED -
 * and a sixty-fourth of a pixel is not a move, it is arithmetic.
 */
async function expectSamePlace(target: Locator, before: { x: number; y: number }): Promise<void> {
  const now = await box(target)
  expect(Math.round(now.x), 'horizontally').toBe(Math.round(before.x))
  expect(Math.round(now.y), 'vertically').toBe(Math.round(before.y))
}

/** Do these two rectangles share a single pixel? */
async function overlap(one: Locator, other: Locator): Promise<boolean> {
  const [a, b] = [await box(one), await box(other)]
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

test.describe('Kiosk layout, duel', () => {
  test('carries the round in one group at the top: player, counter, player', async ({ page }) => {
    await startGame(page, 'Zu zweit')

    /*
     * THE ORDER IS THE POINT, and it is read off the rendered row rather than
     * off the markup: each card sits on the side of the player it belongs to,
     * and the counter stands exactly between them.
     */
    const group = page.locator('[data-head-group="duel"]')
    await expect(group).toBeVisible()
    const cards = await group.locator('[data-score], [data-counter]').evaluateAll((nodes) =>
      nodes.map((node) => {
        const element = node as HTMLElement
        return element.dataset['counter'] === undefined ? `player-${element.dataset['player']}` : 'counter'
      }),
    )
    expect(cards).toEqual(['player-1', 'counter', 'player-2'])

    // One row, one group: the three sit at the same height and in the middle.
    const [one, middle, two] = await Promise.all([
      box(group.locator('[data-score]').first()),
      box(group.locator('[data-counter]')),
      box(group.locator('[data-score]').last()),
    ])
    expect(Math.round(one.y)).toBe(Math.round(two.y))
    expect(Math.round(middle.y)).toBe(Math.round(one.y))
    const stage = await box(page.locator('.stage'))
    const groupBox = await box(group)
    expect(Math.abs(groupBox.x + groupBox.width / 2 - (stage.x + stage.width / 2))).toBeLessThan(2)
    // And evenly spaced - one gap, not two different ones.
    expect(Math.round(middle.x - (one.x + one.width))).toBe(Math.round(two.x - (middle.x + middle.width)))
  })

  test('opens both buzzers with the answers, and names who may act', async ({ page }) => {
    await startGame(page, 'Zu zweit')

    expect(await buzzers(page)).toEqual(['left:ready', 'right:ready'])
    await expect(page.locator('[data-hint]')).toHaveText('Wenn du die Antwort kennst, jetzt buzzern!')

    /*
     * The corners are the players' own: left is player 1, right is player 2 -
     * and they are buttons with a name, not two pictures.
     */
    await expect(page.locator('[data-buzzer][data-side="left"]')).toHaveAttribute('data-player', 'player-1')
    await expect(page.locator('[data-buzzer][data-side="right"]')).toHaveAttribute('data-player', 'player-2')
    await expect(page.locator('[data-buzzer][data-side="left"]')).toHaveAccessibleName('Spieler 1 Buzzern')
  })

  test('lights the corner that got the buzz and shuts the other one', async ({ page }) => {
    await startGame(page, 'Zu zweit')
    await page.locator('[data-buzzer][data-side="left"]').click()

    expect(await buzzers(page)).toEqual(['left:armed', 'right:locked'])
    await expect(page.locator('[data-buzzer][data-side="right"]')).toBeDisabled()
    await expect(page.locator('[data-hint]')).toHaveText('Spieler 1, bitte wähle eine Antwort.')

    // The head says the same thing: this player's card is the active one.
    await expect(page.locator('[data-score][data-player="1"]')).toHaveAttribute('data-active', 'true')
    await expect(page.locator('[data-score][data-player="2"]')).toHaveAttribute('data-active', 'false')

    /*
     * The shut corner is visibly out of play - grey and taken back. Measured
     * on the computed style, because "greyed out" is a statement about what
     * the room sees, not about a class name.
     */
    const locked = page.locator('[data-buzzer][data-side="right"]')
    expect(await locked.evaluate((node) => getComputedStyle(node).filter)).toContain('grayscale')
    expect(Number(await locked.evaluate((node) => getComputedStyle(node).opacity))).toBeLessThan(1)
    const armed = page.locator('[data-buzzer][data-side="left"]')
    expect(await armed.evaluate((node) => getComputedStyle(node).filter)).toBe('none')
    expect(await armed.evaluate((node) => getComputedStyle(node).opacity)).toBe('1')
  })

  test('puts the confirmation on the buzzer of the player it belongs to', async ({ page }) => {
    await startGame(page, 'Zu zweit')
    await page.locator('[data-buzzer][data-side="right"]').click()
    await page.locator(openAnswer).first().click()

    await expect(page.locator('[data-hint]')).toHaveText('Sicher? Dann gib deine Antwort nun ab.')
    const confirm = page.locator('[data-confirm]')
    await expect(confirm).toHaveText('Antwort abgeben')

    /*
     * ON the buzzer, and on the RIGHT one: the hand that buzzed is already in
     * that corner. It is the one overlap this layout has, and it is measured
     * as one - the button's middle sits on the button underneath it.
     */
    expect(await overlap(confirm, page.locator('[data-buzzer][data-side="right"]'))).toBe(true)
    expect(await overlap(confirm, page.locator('[data-buzzer][data-side="left"]'))).toBe(false)
    const [button, buzzer] = [await box(confirm), await box(page.locator('[data-buzzer][data-side="right"]'))]
    expect(Math.abs(button.x + button.width / 2 - (buzzer.x + buzzer.width / 2))).toBeLessThan(2)
    expect(Math.abs(button.y + button.height / 2 - (buzzer.y + buzzer.height / 2))).toBeLessThan(2)

    // The other corner stays where it is, shut and visible.
    await expect(page.locator('[data-buzzer][data-side="left"]')).toBeVisible()
    expect(await buzzers(page)).toEqual(['left:locked', 'right:armed'])
  })

  test('scores only once the answer is submitted', async ({ page }) => {
    await startGame(page, 'Zu zweit')
    await page.locator('[data-buzzer][data-side="left"]').click()
    const right = page.locator('[data-answer]', { hasText: 'Richtige Antwort' }).locator('[data-answer-button]')
    await right.click()

    // Marked, not judged: the phase is still the open attempt and nobody has points.
    await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'answer-locked')
    await expect(page.locator('[data-score][data-player="1"]')).toHaveAttribute('data-score', '0')

    await page.locator('[data-confirm]').click()
    await expect(page.locator('[data-score][data-player="1"]')).not.toHaveAttribute('data-score', '0', { timeout: 10_000 })
  })

  test('hands the question to the other player after a wrong answer', async ({ page }) => {
    await startGame(page, 'Zu zweit')
    await page.locator('[data-buzzer][data-side="left"]').click()
    await page.locator('[data-answer]', { hasText: 'Falsche Antwort' }).first().locator('[data-answer-button]').click()
    await page.locator('[data-confirm]').click()

    /*
     * The second chance passes the turn WITHOUT a buzz - the only state in
     * which a corner is armed although nobody pressed it, and the one the hint
     * field exists for.
     */
    await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'second-chance', { timeout: 15_000 })
    await expect(page.locator('[data-hint]')).toHaveText('Spieler 2, du darfst es jetzt auch versuchen')
    expect(await buzzers(page)).toEqual(['left:locked', 'right:armed'])
  })

  test('is operable from the keyboard - the drawing is a button', async ({ page }) => {
    await startGame(page, 'Zu zweit')

    await page.locator('[data-buzzer][data-side="right"]').focus()
    await page.keyboard.press('Enter')

    expect(await buzzers(page)).toEqual(['left:locked', 'right:armed'])
    await expect(page.locator('[data-hint]')).toHaveText('Spieler 2, bitte wähle eine Antwort.')
  })

  test('keeps head, question and foot clear of one another', async ({ page }) => {
    await startGame(page, 'Zu zweit')

    const head = page.locator('[data-head-group="duel"]')
    const answers = page.locator('[data-answers]')
    const foot = page.locator('[data-kiosk-foot]')
    expect(await overlap(head, answers)).toBe(false)
    expect(await overlap(answers, foot)).toBe(false)
    expect(await overlap(head, foot)).toBe(false)

    /*
     * And the round's way out sits under the hint, in the middle of the
     * screen, at the same distance from the bottom edge in every state.
     */
    const stage = await box(page.locator('.stage'))
    const end = await box(page.locator('[data-abort-game]'))
    const hint = await box(page.locator('[data-hint]'))
    expect(Math.abs(end.x + end.width / 2 - (stage.x + stage.width / 2))).toBeLessThan(2)
    expect(end.y).toBeGreaterThan(hint.y + hint.height)

    await page.locator('[data-buzzer][data-side="left"]').click()
    await page.locator(openAnswer).first().click()
    await expectSamePlace(page.locator('[data-abort-game]'), end)
  })
})

test.describe('Kiosk layout, single player', () => {
  test('shows the counter and the points - and no player at all', async ({ page }) => {
    await startGame(page, 'Allein')

    const group = page.locator('[data-head-group="solo"]')
    await expect(group).toBeVisible()
    await expect(group.locator('[data-counter]')).toBeVisible()
    await expect(group.locator('[data-score]')).toHaveAttribute('data-points-only', '')
    // No player cell, and therefore no word for one.
    await expect(group.getByText('Spieler', { exact: true })).toHaveCount(0)

    const [counter, points] = [await box(group.locator('[data-counter]')), await box(group.locator('[data-score]'))]
    expect(counter.x).toBeLessThan(points.x)
    expect(Math.round(counter.y)).toBe(Math.round(points.y))
    const stage = await box(page.locator('.stage'))
    const groupBox = await box(group)
    expect(Math.abs(groupBox.x + groupBox.width / 2 - (stage.x + stage.width / 2))).toBeLessThan(2)
  })

  test('draws no buzzer, and keeps no room for one', async ({ page }) => {
    await startGame(page, 'Allein')

    await expect(page.locator('[data-buzzer]')).toHaveCount(0)
    /*
     * Not merely invisible: the foot of a single player is the middle column
     * and nothing else, so the corners cannot be holding space.
     */
    const foot = await box(page.locator('[data-kiosk-foot]'))
    const middle = await box(page.locator('[data-hint]'))
    const stage = await box(page.locator('.stage'))
    expect(Math.abs(middle.x + middle.width / 2 - (stage.x + stage.width / 2))).toBeLessThan(2)
    expect(foot.height).toBeLessThan(stage.height / 2)
  })

  test('puts the confirmation in the middle, above the way out of the round', async ({ page }) => {
    await startGame(page, 'Allein')
    const end = await box(page.locator('[data-abort-game]'))

    await page.locator(openAnswer).first().click()
    const confirm = page.locator('[data-confirm]')
    await expect(confirm).toHaveText('Antwort abgeben')
    await expect(page.locator('[data-hint]')).toHaveText('Sicher? Dann gib deine Antwort nun ab.')

    const [button, stage] = [await box(confirm), await box(page.locator('.stage'))]
    expect(Math.abs(button.x + button.width / 2 - (stage.x + stage.width / 2))).toBeLessThan(2)
    expect(button.y + button.height).toBeLessThan(end.y)
    // And the way out has not moved for it.
    await expectSamePlace(page.locator('[data-abort-game]'), end)

    await confirm.click()
    await expect(page.locator('.stage')).not.toHaveAttribute('data-phase', 'answer-locked', { timeout: 10_000 })
  })
})

/*
 * THE OTHER HALF OF THE STATEMENT.
 *
 * Everything above describes one arrangement; this describes what must NOT
 * have happened to the other one. The device of a live event keeps its foot
 * with the score card above the buzzer, its word on the buzzer instead of a
 * drawing, and its way out of the round at the top - and its head stays
 * empty but for the word mark.
 */
test('the live device keeps its own arrangement', async ({ page }) => {
  await startGame(page, 'Zu zweit', '/play')

  await expect(page.locator('.stage')).toHaveAttribute('data-layout', 'live')
  await expect(page.locator('[data-kiosk-foot]')).toHaveCount(0)
  await expect(page.locator('[data-head-group]')).toHaveCount(0)
  await expect(page.locator('[data-player-foot] [data-score]')).toHaveCount(2)
  await expect(page.locator('[data-buzzer]').first()).toHaveText('Buzzern')

  // Its way out of the round sits above the question, not under it.
  const end = await box(page.locator('[data-abort-game]'))
  const answers = await box(page.locator('[data-answers]'))
  expect(end.y).toBeLessThan(answers.y)
})
