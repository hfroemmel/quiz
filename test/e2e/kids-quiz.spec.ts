/**
 * Kids quiz: illustrated player view.
 *
 * The tests run against the server-free development preview `/preview`. They
 * check exactly what the asset package demands as acceptance criteria: all
 * four answers, the state mapping, long texts without truncation, the fixed
 * chip column, the fallback without a question image, and the drawn outlines.
 *
 * Screenshot baselines are platform-dependent and are generated once on a new
 * system with `--update-snapshots`.
 */
import { expect, test, type Page } from '@playwright/test'

/** Target formats of the acceptance criteria from `ASSET_INTEGRATION.md`, section 13. */
const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1024x768', width: 1024, height: 768 },
] as const

async function openKids(page: Page, scene: 'question' | 'solution' = 'question'): Promise<void> {
  await page.goto('/preview')
  await expect(page.locator('[data-preview-stage]')).toBeVisible()
  await page.locator('[data-preview-panel] select').nth(1).selectOption('kids')
  await page.locator('[data-preview-panel] select').first().selectOption(scene)
  await expect(page.locator('.stage')).toHaveAttribute('data-skin', 'kids')
  await expect(page.locator(`.stage[data-scene='${scene}']`)).toBeVisible()
}

/**
 * Hide the preview's control column.
 *
 * Only then is the stage area exactly as wide as the window - otherwise a
 * "1920 test" would in truth be 1540 pixels wide and the acceptance formats
 * would be off. The controls stay operable, they are just invisible.
 */
async function fullBleed(page: Page): Promise<void> {
  await page.addStyleTag({
    content: '[data-preview]{grid-template-columns:1fr !important}[data-preview-panel]{position:absolute;opacity:0;pointer-events:none}',
  })
}

/** The preview's "Lange Texte" (long texts) toggle. */
function longTextSwitch(page: Page) {
  return page.getByRole('checkbox', { name: /Lange Texte/ })
}

test.describe('Layout of the kids view', () => {
  test('shows wordmark, both player cards, counter, image, question and four answers', async ({ page }) => {
    await openKids(page)

    await expect(page.locator('[data-brand]')).toBeVisible()
    await expect(page.locator('[data-score]')).toHaveCount(2)
    await expect(page.locator('[data-counter]')).toBeVisible()
    await expect(page.locator('[data-media-image]')).toBeVisible()
    await expect(page.locator('[data-prompt]')).toBeVisible()
    await expect(page.locator('[data-answer]')).toHaveCount(4)

    // The letters follow the server's order, not a sorted one.
    expect(await page.locator('[data-answer-chip]').allTextContents()).toEqual(['A', 'B', 'C', 'D'])
  })

  test('mirrors the content of the player cards, not the drawing', async ({ page }) => {
    await openKids(page)
    const cards = page.locator('[data-score]')

    // Player 1: player number first, then the points.
    expect(await cards.nth(0).locator('[data-score-label]').allTextContents()).toEqual(['Spieler', 'Punkte'])
    // Player 2: mirrored.
    expect(await cards.nth(1).locator('[data-score-label]').allTextContents()).toEqual(['Punkte', 'Spieler'])

    // The active player is marked - exactly one.
    await expect(page.locator('[data-score][data-active="true"]')).toHaveCount(1)
  })

  test('shows three-digit scores and the counter with tabular figures', async ({ page }) => {
    await openKids(page)
    const scores = await page.locator('[data-score-value="points"]').allTextContents()
    expect(scores).toEqual(['200', '150'])

    const numeric = await page
      .locator('[data-counter-value]')
      .evaluate((element) => getComputedStyle(element).fontVariantNumeric)
    expect(numeric).toContain('tabular-nums')

    // Last question: the counter reads 7/7.
    await openKids(page, 'solution')
    await expect(page.locator('[data-counter-value]')).toHaveText('7/7')
  })
})

test.describe('States of the answers', () => {
  test('maps the server state onto the drawn areas', async ({ page }) => {
    await openKids(page)

    /*
     * Question scene of the second chance: one selected answer, one already
     * marked wrong, and two untouched.
     */
    expect(await page.locator('[data-answer]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-state')))).toEqual([
      'idle',
      'selected',
      'idle',
      'incorrect',
    ])

    // Solution scene: only the correct answer carries colour.
    await openKids(page, 'solution')
    expect(await page.locator('[data-answer]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-state')))).toEqual([
      'correct',
      'disabled',
      'disabled',
      'disabled',
    ])
  })

  test('every state carries its own drawn area and its chip', async ({ page }) => {
    await openKids(page)
    /*
     * The artwork sits on the pseudo-element behind the content - which is
     * exactly where it is read from.
     */
    const drawing = (selector: string, index: number) =>
      page
        .locator(selector)
        .nth(index)
        .evaluate((element) => getComputedStyle(element, '::before').borderImageSource)
    const surface = (index: number) => drawing('[data-answer-surface]', index)

    expect(await surface(0)).toContain('answer-box-a.svg')
    expect(await surface(1)).toContain('answer-box-b.svg')
    expect(await surface(3)).toContain('answer-box-incorrect.svg')

    expect(await drawing('[data-answer-chip]', 1)).toContain('badge-letter-b.svg')

    await openKids(page, 'solution')
    expect(await surface(0)).toContain('answer-box-correct.svg')
  })

  test('carries the wide card drawing only on the answer area, never on the row', async ({ page }) => {
    await openKids(page)
    // All measurements are pure container measurements - checked at the target format.
    await fullBleed(page)
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.waitForTimeout(200)

    /*
     * The core of the fix: the chip and the card are two separate artworks.
     * If the wide card sat on the row, the letter would sit on it too - that
     * was exactly the deviation in the first version.
     */
    const rowDrawing = await page
      .locator('[data-answer]')
      .first()
      .evaluate((element) => getComputedStyle(element, '::before').borderImageSource)
    expect(rowDrawing).toBe('none')

    // And a visible gap remains between the two.
    const gap = await page.locator('[data-answer]').first().evaluate((row) => {
      const chip = row.querySelector('[data-answer-chip]')!.getBoundingClientRect()
      const surface = row.querySelector('[data-answer-surface]')!.getBoundingClientRect()
      return surface.left - chip.right
    })
    expect(gap).toBeGreaterThanOrEqual(9)
  })

  test('draws outlines exclusively as areas, never as CSS borders', async ({ page }) => {
    await openKids(page)
    const framed = [
      '[data-answer]',
      '[data-answer-surface]',
      '[data-answer-chip]',
      '[data-panel]',
      '[data-media]',
      '[data-score]',
      '[data-counter]',
    ]
    for (const selector of framed) {
      const drawn = await page.locator(selector).evaluateAll((nodes) =>
        nodes.map((node) => {
          const style = getComputedStyle(node)
          return { border: style.borderTopWidth, radius: style.borderTopLeftRadius, shadow: style.boxShadow }
        }),
      )
      expect(drawn.every((entry) => entry.border === '0px'), `${selector} traegt einen CSS-Rahmen`).toBe(true)
      expect(drawn.every((entry) => entry.radius === '0px'), `${selector} traegt einen CSS-Radius`).toBe(true)
      expect(drawn.every((entry) => entry.shadow === 'none'), `${selector} traegt einen gerechneten Schatten`).toBe(true)
    }
  })
})

test.describe('Handwriting and drawing', () => {
  test('sets Patrick Hand for everything read and Melior for numbers and letters', async ({ page }) => {
    await openKids(page)

    const family = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((element) => {
          const style = getComputedStyle(element)
          return { font: style.fontFamily, weight: style.fontWeight }
        })

    for (const selector of ['[data-prompt]', '[data-category]', '[data-answer-text]', '[data-score-label]', '[data-counter-label]']) {
      const { font, weight } = await family(selector)
      expect(font, `${selector} traegt nicht die Handschrift`).toContain('Patrick Hand')
      // Patrick Hand has only one weight: anything bolder than that would be synthetic bold.
      expect(weight, `${selector} wuerde synthetisch fett gerechnet`).toBe('400')
    }

    // Player number, points, counter and the letters A-D are set in Melior.
    for (const selector of ['[data-score-value]', '[data-counter-value]', '[data-answer-chip]']) {
      const { font, weight } = await family(selector)
      expect(font, `${selector} traegt nicht die Serifenschrift`).toContain('Melior')
      expect(weight).toBe('700')
    }

    // And both files really are present - otherwise the screen would show the fallback.
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready
      return {
        hand: document.fonts.check('400 40px "Patrick Hand"'),
        numeric: document.fonts.check('700 40px Melior'),
      }
    })
    expect(loaded).toEqual({ hand: true, numeric: true })
  })

  test('keeps a visible gap between question image and question area', async ({ page }) => {
    await openKids(page)
    await fullBleed(page)
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.waitForTimeout(200)

    const media = (await page.locator('[data-media]').boundingBox())!
    const panel = (await page.locator('[data-panel]').boundingBox())!
    // `clamp(16px, 1.4vw, 28px)` - at 1920 that is 27 pixels.
    expect(panel.x - (media.x + media.width)).toBeGreaterThanOrEqual(16)
  })

  /*
   * Karlchen only appears once there is something to choose. While the
   * question stands alone, it is being read aloud - a character would draw
   * the eye away from the text. The switch for this lives on the stage, not
   * in the character.
   */
  test('shows Karlchen only once the answers are in place', async ({ page }) => {
    await openKids(page)
    await expect(page.locator('.stage')).toHaveAttribute('data-answers-shown', 'true')
    await expect(page.locator('[data-mascot]')).toBeVisible()

    await page.locator('.stage').evaluate((element) => element.setAttribute('data-answers-shown', 'false'))
    await expect(page.locator('[data-mascot]')).toBeHidden()
  })

  test('puts Karlchen large at the right edge without touching the answers', async ({ page }) => {
    await openKids(page)
    await fullBleed(page)
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.waitForTimeout(200)

    const stage = (await page.locator('.stage').boundingBox())!
    const figure = (await page.locator('[data-mascot]').boundingBox())!

    // A good half of the image height - not a marginal decoration.
    const share = figure.height / stage.height
    expect(share).toBeGreaterThanOrEqual(0.54)
    expect(share).toBeLessThanOrEqual(0.62)

    // It stands on the right and on the ground, not in the middle of the image.
    expect(figure.x).toBeGreaterThan(stage.x + stage.width * 0.7)
    expect(figure.y + figure.height).toBeGreaterThan(stage.y + stage.height * 0.85)

    /*
     * And no answer text sits underneath it. The rows themselves are allowed
     * to run a bit underneath the character - the outstretched wing reaches
     * over their empty right end, exactly as in the reference. Everything
     * just has to remain readable.
     */
    const texts = await page.locator('[data-answer-text]').evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().right),
    )
    expect(texts.length).toBeGreaterThan(0)
    for (const right of texts) expect(right).toBeLessThanOrEqual(figure.x)

    // Decoration does not accept clicks.
    for (const selector of ['[data-mascot]', '[data-peek]']) {
      const events = await page.locator(selector).evaluate((element) => getComputedStyle(element).pointerEvents)
      expect(events, `${selector} faengt Klicks`).toBe('none')
    }
  })

  test('lets Karlchen peek out above the image frame, right of the wordmark', async ({ page }) => {
    await openKids(page)
    await fullBleed(page)
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.waitForTimeout(200)

    const media = (await page.locator('[data-media]').boundingBox())!
    const peek = (await page.locator('[data-peek]').boundingBox())!

    // Slightly right of the frame's centre as in the design - and above the frame.
    const centre = peek.x + peek.width / 2
    expect(centre).toBeGreaterThan(media.x + media.width * 0.5)
    expect(centre).toBeLessThan(media.x + media.width * 0.8)

    /*
     * The bottom edge sits 8 to 14 pixels behind the frame. What is measured
     * is the artwork, not the file: below it lies 9.4 percent of transparent
     * margin.
     */
    const drawnBottom = peek.y + peek.height * 0.906
    const overlap = drawnBottom - media.y
    expect(overlap).toBeGreaterThanOrEqual(8)
    expect(overlap).toBeLessThanOrEqual(14)
  })
})

test.describe('Long questions and answers', () => {
  test('wraps instead of clipping - in every target format', async ({ page }) => {
    await openKids(page)
    // Toggle first, then hide the control column - after that it is no longer operable.
    await longTextSwitch(page).check()
    await fullBleed(page)

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.waitForTimeout(200)

      /*
       * Truncation is caused by three things: an ellipsis, a clipping frame,
       * or a fixed height. That is exactly what is checked - not a pixel
       * comparison of `scrollHeight`, which already fails on the rounding of
       * a line box.
       */
      const clipping = await page
        .locator('[data-panel], [data-prompt], [data-answer-surface], [data-answer-text]')
        .evaluateAll((nodes) =>
          nodes
            .filter((node) => {
              const style = getComputedStyle(node)
              const hidden = style.overflowY === 'hidden' || style.overflowY === 'clip'
              return style.textOverflow === 'ellipsis' || (hidden && node.scrollHeight > node.clientHeight + 4)
            })
            .map((node) => node.className),
        )
      expect(clipping, `Text abgeschnitten bei ${viewport.name}`).toEqual([])

      // The question spans multiple lines, so it really does wrap.
      const promptLines = await page.locator('[data-prompt]').evaluate((element) => {
        const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight)
        return Math.round(element.getBoundingClientRect().height / lineHeight)
      })
      expect(promptLines, `Frage einzeilig bei ${viewport.name}`).toBeGreaterThanOrEqual(3)

      // And the answer rows carry their two lines without the card getting cramped.
      const answerLines = await page.locator('[data-answer-text]').first().evaluate((element) => {
        const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight)
        return Math.round(element.getBoundingClientRect().height / lineHeight)
      })
      expect(answerLines, `Antwort einzeilig bei ${viewport.name}`).toBeGreaterThanOrEqual(2)
    }
  })

  test('keeps the letter chip at a fixed size and centred', async ({ page }) => {
    await openKids(page)
    const chipBox = async () => (await page.locator('[data-answer-chip]').first().boundingBox())!

    const short = await chipBox()
    await longTextSwitch(page).check()
    await page.waitForTimeout(150)
    const long = await chipBox()

    // The chip does not grow along with the text.
    expect(Math.abs(long.width - short.width)).toBeLessThan(1)
    expect(Math.abs(long.height - short.height)).toBeLessThan(1)

    // And it stays vertically centred within its row.
    const row = (await page.locator('[data-answer]').first().boundingBox())!
    expect(Math.abs(long.y + long.height / 2 - (row.y + row.height / 2))).toBeLessThan(2)
  })
})

test.describe('Fallbacks', () => {
  test('copes without a question image without changing the order', async ({ page }) => {
    // The preview's solution scene deliberately has no image.
    await openKids(page, 'solution')
    await expect(page.locator('[data-media]')).toHaveCount(0)
    // Without an image the frame disappears entirely; the question panel takes its place.
    await expect(page.locator('[data-panel]')).toBeVisible()
    await expect(page.locator('[data-prompt]')).toBeVisible()
    await expect(page.locator('[data-answer]')).toHaveCount(4)
  })

  test('shortens all transitions under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openKids(page)
    const duration = await page
      .locator('[data-answer]')
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration)
    expect(duration.startsWith('0.001s')).toBe(true)
  })
})

test.describe('Screenshots of the target formats', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  for (const viewport of VIEWPORTS) {
    test(`Kids view ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await openKids(page)
      await fullBleed(page)
      await page.waitForTimeout(400)
      await expect(page.locator('.stage')).toHaveScreenshot(`kids-${viewport.name}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      })
    })
  }
})
