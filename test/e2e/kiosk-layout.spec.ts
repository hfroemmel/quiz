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

  /*
   * THE FIELD IS AS WIDE AS ITS COLUMN, and that is not a detail of taste: its
   * sentence is positioned absolutely inside it, so the box had nothing to
   * take a width from and collapsed - and a sentence in a box of no width
   * wraps at every space, one word per line, in the middle of the screen. Text
   * content alone does not see this; the lines do.
   */
  test('gives its hint the whole column, on one line', async ({ page }) => {
    await startGame(page, 'Zu zweit')

    const field = await box(page.locator('[data-hint]'))
    const column = await box(page.locator('[data-kiosk-foot] [data-hint]').locator('..'))
    expect(Math.round(field.width)).toBe(Math.round(column.width))

    // One sentence, one line: its height is the height of a line of it.
    const lines = await page.locator('[data-hint] span').evaluate((node) => {
      const style = getComputedStyle(node)
      const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2
      return Math.round(node.getBoundingClientRect().height / line)
    })
    expect(lines).toBe(1)
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

  test('puts the confirmation in the middle, whichever corner buzzed', async ({ page }) => {
    await startGame(page, 'Zu zweit')
    await page.locator('[data-buzzer][data-side="right"]').click()
    await page.locator(openAnswer).first().click()

    await expect(page.locator('[data-hint]')).toHaveText('Sicher? Dann gib deine Antwort nun ab.')
    const confirm = page.locator('[data-confirm]')
    await expect(confirm).toHaveText('Antwort abgeben')

    /*
     * IN THE MIDDLE, NOT ON A CORNER. It used to stand on the buzzer of the
     * player who had buzzed, which put the button under one hand and moved it
     * across the screen whenever the other corner got the next question. Now
     * it stands where the hint stands, under it, in both modes - and it covers
     * neither drawing.
     */
    const stage = await box(page.locator('.stage'))
    const button = await box(confirm)
    expect(Math.abs(button.x + button.width / 2 - (stage.x + stage.width / 2))).toBeLessThan(2)
    expect(await overlap(confirm, page.locator('[data-buzzer][data-side="right"]'))).toBe(false)
    expect(await overlap(confirm, page.locator('[data-buzzer][data-side="left"]'))).toBe(false)

    // Under the hint and above the way out of the round.
    const hint = await box(page.locator('[data-hint]'))
    const end = await box(page.locator('[data-abort-game]'))
    expect(button.y).toBeGreaterThanOrEqual(hint.y + hint.height - 1)
    expect(end.y).toBeGreaterThanOrEqual(button.y + button.height - 1)

    // Both corners stay where they are - one armed, one shut.
    await expect(page.locator('[data-buzzer][data-side="left"]')).toBeVisible()
    expect(await buzzers(page)).toEqual(['left:locked', 'right:armed'])
  })

  test('keeps the confirmation in the same place when the other corner buzzes', async ({ page }) => {
    /*
     * The reason it moved into the middle: a button that travels between the
     * corners is a button somebody has to look for. Two rounds, two different
     * corners, one place.
     */
    await startGame(page, 'Zu zweit')
    await page.locator('[data-buzzer][data-side="left"]').click()
    await page.locator(openAnswer).first().click()
    const left = await box(page.locator('[data-confirm]'))

    await page.reload()
    await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
    await startGame(page, 'Zu zweit')
    await page.locator('[data-buzzer][data-side="right"]').click()
    await page.locator(openAnswer).first().click()
    await expectSamePlace(page.locator('[data-confirm]'), left)
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
 * THE SCORE MAY RISE, THE HEAD MAY NOT MOVE.
 *
 * The points cell used to be as wide as the number in it, so the first
 * correct answer of a round - nought becoming a hundred - widened the card and
 * pushed the counter and the other player's card sideways, at exactly the
 * moment everybody is looking at the score. The cell reserves three digits
 * now, which is the most a round produces (seven questions at a hundred
 * points).
 *
 * THE NUMBER IS WRITTEN INTO THE CELL HERE instead of being played for: what
 * is asked is a property of the cell's width, not of the engine's scoring -
 * the points a correct answer is worth are counted in `touch-play.spec.ts`.
 */
test('the head group stands still while a score grows to three digits', async ({ page }) => {
  await startGame(page, 'Zu zweit')

  const points = page.locator('[data-score-group="player-1"] [data-score-value="points"]')
  const neighbour = page.locator('[data-score-group="player-2"]')
  const width = () =>
    points.evaluate((node) => {
      const cell = (node as HTMLElement).closest('div')!
      return Number(cell.getBoundingClientRect().width.toFixed(1))
    })
  const write = (value: string) => points.evaluate((node, text) => ((node as HTMLElement).textContent = text), value)

  await write('0')
  const narrow = await width()
  const place = await box(neighbour)

  await write('700')
  expect(await width()).toBe(narrow)
  await expectSamePlace(neighbour, place)
})

/*
 * WHAT A HOST'S ZOOM DOES TO THIS ARRANGEMENT.
 *
 * A media table asks for a smaller composition so someone standing at it can
 * take the whole screen in (`zoom`), and the scene shrinks with it. Where the
 * loss goes is the question: on the live device the box hangs from its top
 * edge, because it is measured against the lower screen edge and the fixed
 * corners stand under it. Here head, scene and foot each have a row, so the
 * whole of the loss would end up below the composition - a band of empty
 * ground between the last answer and the foot.
 */
test('a smaller host zoom shrinks the scene toward the middle of its row', async ({ page }) => {
  await startGame(page, 'Zu zweit', `${kiosk}&zoom=0.75`)

  /*
   * TWO BOXES OF THE SAME ELEMENT: the one the layout gave it (`offsetTop`,
   * `offsetHeight` - a scale does not touch those) and the one on screen. Where
   * the zoom shrank it toward tells the two apart: from the top edge both start
   * in the same place, from the middle both have the same centre.
   */
  const room = await page.locator('[class*="sceneArea"]').evaluate((node) => {
    const area = node as HTMLElement
    const seen = area.getBoundingClientRect()
    const anchor = (area.offsetParent as HTMLElement).getBoundingClientRect().top
    return { laidOut: { top: anchor + area.offsetTop, height: area.offsetHeight }, seen: { top: seen.top, height: seen.height } }
  })

  // The zoom really did shrink it - otherwise this test asks nothing.
  expect(room.seen.height).toBeLessThan(room.laidOut.height - 10)

  const centre = (box: { top: number; height: number }) => box.top + box.height / 2
  expect(Math.abs(centre(room.seen) - centre(room.laidOut))).toBeLessThan(1)
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
