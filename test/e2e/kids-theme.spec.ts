/**
 * The kids world across all three delivery paths.
 *
 * THE SAME WORLD, THREE HOSTS: the hall (`/preview`), the standalone device
 * (`/play`) and the embedded application (`/shell`). They differ in the frame
 * around it - buzzer, footer, menu - not in the scene. What is checked here is
 * exactly that: that the scene is the same everywhere and no rule anywhere
 * asks which host it is.
 */
import { expect, test, type Page } from '@playwright/test'

/** The character of the kids world. One element, present in the markup in every world. */
const mascot = '[data-mascot]'

/** Visible means: it actually carries an artwork, not just an empty box. */
async function mascotVisible(page: Page): Promise<boolean> {
  return page.locator(mascot).evaluate((el) => getComputedStyle(el).backgroundImage !== 'none')
}

/** What the character occupies, in percent of the scene - that is what makes it comparable. */
async function mascotShare(page: Page): Promise<{ width: number; right: number; bottom: number }> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-mascot]') as HTMLElement
    const scene = (el.closest('[class*="sceneArea"]') ?? document.querySelector('.stage')) as HTMLElement
    const a = el.getBoundingClientRect()
    const b = scene.getBoundingClientRect()
    return {
      width: +((a.width / b.width) * 100).toFixed(1),
      right: +(((b.right - a.right) / b.width) * 100).toFixed(1),
      bottom: +(((b.bottom - a.bottom) / b.width) * 100).toFixed(1),
    }
  })
}

/**
 * Same place, same size - accurate to a tenth of a percentage point.
 *
 * There cannot be exactly matching numbers: the scenes have different widths,
 * and half a pixel rounds one way or the other during conversion. What is
 * meant is that the same rule applies, not that the same pixels come out.
 */
function expectSameSpot(actual: Record<string, number>, expectedValue: Record<string, number>, where: string): void {
  for (const key of Object.keys(expectedValue)) {
    expect(Math.abs(actual[key]! - expectedValue[key]!), `${where}/${key}`).toBeLessThan(0.2)
  }
}

/** The stage in the hall: preview test rig, scene and world freely selectable. */
async function openStage(page: Page, theme: 'kids' | 'default', scene = 'question'): Promise<void> {
  await page.goto('/preview')
  await page.locator('select').first().selectOption(scene)
  await page.locator('select').nth(1).selectOption(theme)
  await expect(page.locator('.stage')).toBeVisible({ timeout: 15_000 })
}

/** The device - standalone (`/play`) or embedded (`/shell`). */
async function openDevice(
  page: Page,
  host: 'play' | 'shell',
  audience: 'kids' | 'adults',
  players: 'Allein' | 'Zu zweit' = 'Zu zweit',
): Promise<void> {
  await page.goto(`/${host}?audience=${audience}`)
  if (host === 'shell') await page.locator('[data-shell-menu] button').first().click()
  await expect(page.locator('[data-game-start]')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: new RegExp(`^${players}`) }).click()
  await page.getByRole('button', { name: /^Leicht/ }).click()
  await page.getByRole('button', { name: "Los geht's" }).click()
  await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
}

test.describe('The mascot of the kids world', () => {
  test('stands in the hall, on the device and in the embedded application', async ({ page }) => {
    await openStage(page, 'kids')
    expect(await mascotVisible(page), 'Saal').toBe(true)
    const hall = await mascotShare(page)

    await openDevice(page, 'play', 'kids')
    expect(await mascotVisible(page), 'eigenstaendig').toBe(true)
    /*
     * SAME SIZE AND SAME PLACE - measured against the scene it belongs to. On
     * the device the scene is a shrunk stage in the middle; the character is
     * just as big there as in the hall, only computed from that area instead.
     */
    expectSameSpot(await mascotShare(page), hall, 'eigenstaendig')

    await openDevice(page, 'shell', 'kids')
    expect(await mascotVisible(page), 'eingebettet').toBe(true)
    expectSameSpot(await mascotShare(page), hall, 'eingebettet')
  })

  test('stands in the solo game as in the duel', async ({ page }) => {
    await openDevice(page, 'play', 'kids', 'Allein')
    expect(await mascotVisible(page), 'allein').toBe(true)
    const solo = await mascotShare(page)

    await openDevice(page, 'play', 'kids', 'Zu zweit')
    expect(await mascotVisible(page), 'zu zweit').toBe(true)
    expectSameSpot(await mascotShare(page), solo, 'zu zweit')
  })

  test('covers neither text nor image nor controls', async ({ page }) => {
    /*
     * WHAT IS CHECKED IS WHAT GETS READ. The outstretched wing juts, as in the
     * design, a bit over the empty end of the drawn cards - the same in the
     * hall. None of that may cover a single word, photo or button.
     */
    const clearances = async (host: 'play' | 'shell' | null) => {
      if (host) await openDevice(page, host, 'kids')
      else await openStage(page, 'kids')
      return page.evaluate(() => {
        const box = (sel: string) => document.querySelector(sel)?.getBoundingClientRect()
        const figure = box('[data-mascot]')!
        const overlaps = (other?: DOMRect | null) =>
          !!other &&
          figure.left < other.right &&
          figure.right > other.left &&
          figure.top < other.bottom &&
          figure.bottom > other.top
        const texts = (sel: string) =>
          Array.from(document.querySelectorAll(sel)).some((el) => overlaps(el.getBoundingClientRect()))
        return {
          questionText: texts('[data-prompt]'),
          rubric: texts('[data-category]'),
          answerText: texts('[data-answer] [class*="text"]'),
          image: overlaps(box('[class*="media"]')),
          buzzerLeft: overlaps(box('[data-buzzer][data-side="left"]')),
          buzzerRight: overlaps(box('[data-buzzer][data-side="right"]')),
        }
      })
    }
    const nothingCovered = {
      questionText: false,
      rubric: false,
      answerText: false,
      image: false,
      buzzerLeft: false,
      buzzerRight: false,
    }

    expect(await clearances(null), 'Saal').toEqual(nothingCovered)
    expect(await clearances('play'), 'eigenstaendig').toEqual(nothingCovered)
    expect(await clearances('shell'), 'eingebettet').toEqual(nothingCovered)
  })

  test('stays empty in the adults world in every host', async ({ page }) => {
    await openStage(page, 'default')
    expect(await mascotVisible(page), 'Saal').toBe(false)

    await openDevice(page, 'play', 'adults')
    expect(await mascotVisible(page), 'eigenstaendig').toBe(false)

    await openDevice(page, 'shell', 'adults')
    expect(await mascotVisible(page), 'eingebettet').toBe(false)
  })

  test('is decoration and is not read out by the screen reader', async ({ page }) => {
    await openStage(page, 'kids')
    await expect(page.locator(mascot)).toHaveAttribute('aria-hidden', 'true')
    // No text, no image with a description, no button.
    await expect(page.locator(mascot)).toHaveText('')
    await expect(page.locator(`${mascot} img`)).toHaveCount(0)
  })
})

test.describe('The interstitial before the question', () => {
  test('puts counter and rubric on a board in the kids world', async ({ page }) => {
    await openStage(page, 'kids', 'pause')

    const board = page.locator('[data-pause-card]')
    await expect(board).toBeVisible()
    // Both pieces of information sit INSIDE it - one panel, not a second box.
    await expect(board.locator('[data-pause-progress]')).toBeVisible()
    await expect(board.locator('[data-pause-category]')).toBeVisible()
    await expect(board.locator('[class*="pauseCard"]')).toHaveCount(0)

    const drawn = await board.evaluate((el) => getComputedStyle(el, '::before').borderImageSource)
    expect(drawn).toContain('url(')
  })

  test('sizes both entries from the stage, with the rubric leading', async ({ page }) => {
    await openStage(page, 'kids', 'pause')
    const size = async (sel: string) =>
      page.locator(sel).evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))

    const counter = await size('[data-pause-progress]')
    const rubric = await size('[data-pause-category]')
    /*
     * Measured against the STAGE: all sizes in the scene are expressed in
     * `cqw`, and in the test rig the control column sits next to the stage as
     * well.
     */
    const width = await page.locator('.stage').evaluate((el) => el.getBoundingClientRect().width)

    /*
     * THE ORDER WAS TURNED AROUND ON PURPOSE (2026-09-17, "fix some fonts"):
     * the counter went from 7cqw to 2.5cqw and the rubric from 5cqw to 3.5cqw,
     * so the subject of the question leads and the position in the round is
     * the quieter line. This test used to demand the opposite - it protected a
     * design that no longer exists.
     *
     * What it still protects is the property that the sizes are the stage's
     * and not the window's: both scale with the stage width, which is what
     * `cqw` is for and what a `vw` value would silently break.
     */
    expect(counter).toBeCloseTo(width * 0.025, 0)
    expect(rubric).toBeCloseTo(width * 0.035, 0)
    expect(rubric).toBeGreaterThan(counter)
  })

  test('keeps even a long rubric completely on the board', async ({ page }) => {
    await openStage(page, 'kids', 'pause')

    await page.locator('[data-pause-category]').evaluate((el) => {
      el.textContent = 'Politik, Gesellschaft und das Zusammenleben in der Demokratie'
    })
    await page.waitForTimeout(150)

    const measure = await page.evaluate(() => {
      const rubric = document.querySelector('[data-pause-category]') as HTMLElement
      const board = document.querySelector('[data-pause-card]') as HTMLElement
      const scene = document.querySelector('[data-scene-root]') as HTMLElement
      const r = rubric.getBoundingClientRect()
      const t = board.getBoundingClientRect()
      const s = scene.getBoundingClientRect()
      return {
        /* It wraps instead of running out of the panel in a single line. */
        rows: Math.round(r.height / Number.parseFloat(getComputedStyle(rubric).lineHeight)),
        clipped: rubric.scrollWidth > rubric.clientWidth + 1,
        /* The text stays within the panel, the panel stays within the scene. */
        outsideBoard: r.left < t.left - 1 || r.right > t.right + 1,
        outsideScene: t.left < s.left - 1 || t.right > s.right + 1,
      }
    })
    expect(measure.clipped).toBe(false)
    expect(measure.outsideBoard).toBe(false)
    expect(measure.outsideScene).toBe(false)
    expect(measure.rows).toBeGreaterThan(1)
  })

  test('leaves the adults world as it was', async ({ page }) => {
    await openStage(page, 'default', 'pause')

    /*
     * The frame is present in the markup here too - it just is not one:
     * `display: contents` removes it from the layout, and the two paragraphs
     * remain direct children of the scene as before.
     */
    await expect(page.locator('[data-pause-card]')).toHaveCSS('display', 'contents')
    const drawn = await page
      .locator('[data-pause-card]')
      .evaluate((el) => getComputedStyle(el, '::before').borderImageSource)
    expect(drawn === 'none' || drawn === '').toBe(true)
  })
})

test.describe('Image and question board', () => {
  /** The gap between the image and the panel, in percent of the scene. */
  async function layout(page: Page) {
    return page.evaluate(() => {
      const head = document.querySelector('[data-panel]')!.closest('[class*="head"]') as HTMLElement
      const scene = document.querySelector('[data-scene-root]') as HTMLElement
      const media = head.querySelector('[class*="media"]') as HTMLElement | null
      const panel = head.querySelector('[data-panel]') as HTMLElement
      const b = (el: HTMLElement) => el.getBoundingClientRect()
      const width = b(scene).width
      return {
        headClass: (head.className.match(/_head_\w+/) ?? [''])[0],
        gap: media ? +(((b(panel).left - b(media).right) / width) * 100).toFixed(2) : null,
        /* Nothing may be left over to the right of the panel. */
        restRight: +((b(head).right - b(panel).right).toFixed(1)),
        panelWidth: +((b(panel).width / width) * 100).toFixed(1),
        imageRatio: media ? +(b(media).width / b(media).height).toFixed(2) : null,
        overflow: head.scrollWidth > head.clientWidth + 1,
      }
    })
  }

  /**
   * Plays through on the device until a question WITH an image comes up.
   *
   * Which question comes first is decided by the server's selection - a
   * question without an image has no gap, and then this test would be
   * checking nothing.
   */
  async function advanceToImageQuestion(page: Page): Promise<void> {
    for (let round = 0; round < 6; round += 1) {
      const hasImage = await page
        .locator('[data-panel]')
        .evaluate((el) => !!el.closest('[class*="head"]')!.querySelector('[class*="media"]'))
      if (hasImage) return
      /* In solo play the first tap wins the turn; submitting happens separately. */
      await page.locator('[data-answer]:not([disabled])').first().click()
      await page.locator('[data-confirm]').click()
      // After the solution, the device waits for a tap - it does not advance on its own.
      await expect(page.locator('[data-continue]')).toBeVisible({ timeout: 30_000 })
      await page.locator('[data-continue]').click()
      await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
    }
    throw new Error('Keine Frage mit Bild gefunden.')
  }

  test('sets the same gap from the same building block in all three hosts', async ({ page }) => {
    // Two devices playing through until an image question comes up - that takes a while.
    test.setTimeout(180_000)
    await openStage(page, 'kids')
    const hall = await layout(page)

    await openDevice(page, 'play', 'kids', 'Allein')
    await advanceToImageQuestion(page)
    const device = await layout(page)

    await openDevice(page, 'shell', 'kids', 'Allein')
    await advanceToImageQuestion(page)
    const embedded = await layout(page)

    // The same class means: the same component, not three copies.
    expect(device.headClass).toBe(hall.headClass)
    expect(embedded.headClass).toBe(hall.headClass)
    // And the same gap - there is one token (`--kids-stage-gap`).
    expect(device.gap).toBe(hall.gap)
    expect(embedded.gap).toBe(hall.gap)
  })

  test('keeps the gap with short as with long question text', async ({ page }) => {
    await openStage(page, 'kids')
    const short = await layout(page)

    // The test rig has the long text as a toggle.
    await page.getByText('Lange Texte', { exact: false }).click()
    await page.waitForTimeout(200)
    const lang = await layout(page)

    expect(lang.gap).toBe(short.gap)
    expect(lang.overflow).toBe(false)
    expect(short.overflow).toBe(false)
  })

  test('lets the board fill the whole rest of the row', async ({ page }) => {
    await openStage(page, 'kids')
    const withValue = await layout(page)

    // No empty space between the panel and the right edge of the row.
    expect(Math.abs(withValue.restRight)).toBeLessThan(1)
    // The image keeps its aspect ratio (4:3).
    expect(withValue.imageRatio).toBeCloseTo(4 / 3, 1)
  })

  test('gives the board the whole width without an image', async ({ page }) => {
    await openStage(page, 'kids')
    const withValue = await layout(page)

    /*
     * A reveal question does not carry its image in the header zone but large
     * on the stage - there the panel runs the full width.
     */
    await page.locator('select').first().selectOption('reveal')
    await expect(page.locator('[data-reveal-tiles]')).toBeVisible()
    const without = await layout(page)

    expect(without.gap).toBeNull()
    expect(without.panelWidth).toBeGreaterThan(withValue.panelWidth)
  })
})
