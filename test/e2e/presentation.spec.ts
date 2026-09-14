/**
 * Scene and animation tests (specification 22.7).
 *
 * These tests run against the development preview `/preview`. It is
 * deliberately server-free: the scenes are rendered from locally generated
 * sample view models. That makes visual tests deterministic and independent
 * of the random question selection of a real game.
 *
 * Screenshot baselines are platform-dependent. On a new system they are
 * generated once with
 *   npx playwright test --project=preview --update-snapshots
 */
import { expect, test, type Page } from '@playwright/test'

async function selectScene(page: Page, scene: string): Promise<void> {
  await page.locator('[data-preview-panel] select').first().selectOption(scene)
  await expect(page.locator('.stage')).toHaveAttribute('data-scene', scene)
}

async function selectTheme(page: Page, theme: string): Promise<void> {
  await page.locator('[data-preview-panel] select').nth(1).selectOption(theme)
}

/** Only present in the question and solution scenes; there the selector sits in third place. */
async function selectQuestionType(page: Page, type: string): Promise<void> {
  await page.locator('[data-preview-panel] select').nth(2).selectOption(type)
  await expect(page.locator('.stage')).toHaveAttribute('data-presentation', type)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/preview')
  await expect(page.locator('[data-preview-stage]')).toBeVisible()
})

test.describe('Visual smoke tests of all scenes', () => {
  test('start image shows only branding', async ({ page }) => {
    await selectScene(page, 'start')
    await expect(page.locator('.stage[data-scene="start"]')).toBeVisible()
    // The start screen must not show a question.
    await expect(page.locator('[data-prompt]')).toHaveCount(0)
  })

  test('pause screen shows no question content', async ({ page }) => {
    await selectScene(page, 'pause')
    await expect(page.locator('.stage[data-scene="pause"]')).toBeVisible()
    await expect(page.locator('[data-prompt]')).toHaveCount(0)
    await expect(page.locator('[data-answer]')).toHaveCount(0)
  })

  test('question scene shows the logged answer but no solution hint', async ({ page }) => {
    await selectScene(page, 'question')
    await expect(page.locator('[data-prompt]')).toBeVisible()
    await expect(page.locator('[data-answer]')).toHaveCount(4)
    // The player's commitment is public - exactly one row is marked.
    await expect(page.locator('[data-answer][data-state="selected"]')).toHaveCount(1)
    // Whether it is right is only revealed by the stage in the solution scene.
    await expect(page.locator('[data-answer][data-state="correct"]')).toHaveCount(0)
  })

  test('the blurred image ground fades in and never carries the previous image', async ({ page }) => {
    /*
     * A `background-image` ONLY CHANGES ONCE THE NEW IMAGE HAS ARRIVED. Set
     * directly, a new question would therefore briefly show the previous
     * question's background. The image is therefore preloaded and the
     * background only shown once it is ready; until then nothing sits there
     * but the stage's gradient.
     */
    await selectScene(page, 'question')
    await selectQuestionType(page, 'image-choice')

    const ground = page.locator('[data-backdrop]')
    await expect(ground).toHaveAttribute('data-ready', 'true', { timeout: 10_000 })
    const image = () => ground.evaluate((node) => getComputedStyle(node).backgroundImage)
    const firstQuestion = await image()
    expect(firstQuestion).not.toBe('none')

    // Faded in, not swapped in - and without intercepting a touch.
    const style = await ground.evaluate((node) => {
      const measured = getComputedStyle(node)
      return { property: measured.transitionProperty, pointer: measured.pointerEvents }
    })
    expect(style.property).toContain('opacity')
    expect(style.pointer).toBe('none')

    /*
     * Different image, different address: afterwards the background carries
     * either still nothing or already the new one - never the old one.
     */
    await selectQuestionType(page, 'person')
    await expect(ground).toHaveAttribute('data-ready', 'true', { timeout: 10_000 })
    expect(await image()).not.toBe(firstQuestion)

    // A question without an image also has no background.
    await selectQuestionType(page, 'text-choice')
    await expect(ground).toHaveCount(0)
  })

  test('portrait question puts the image next to rubric, question and answers', async ({ page }) => {
    await selectScene(page, 'question')
    await selectQuestionType(page, 'person')
    await expect(page.locator('[data-media][data-variant="portrait"] [data-media-image]')).toBeVisible()
    await expect(page.locator('[data-answer]')).toHaveCount(4)

    /*
     * The core of this layout is the side-by-side placement: the portrait sits
     * on the left, everything else in a column to the right, BESIDE it - not
     * below it as with the other image questions.
     */
    const portrait = await page.locator('[data-variant="portrait"]').boundingBox()
    const prompt = await page.locator('[data-prompt]').boundingBox()
    const answers = await page.locator('[data-answers]').boundingBox()
    expect(portrait && prompt && answers).toBeTruthy()
    expect(prompt!.x).toBeGreaterThanOrEqual(portrait!.x + portrait!.width)
    expect(answers!.x).toBeGreaterThanOrEqual(portrait!.x + portrait!.width)
    expect(answers!.y).toBeLessThan(portrait!.y + portrait!.height)
  })

  test('image recognition shows a covered image and no countdown', async ({ page }) => {
    await selectScene(page, 'reveal')
    await expect(page.locator('[data-media][data-variant="reveal"] [data-media-image]')).toBeVisible()
    // The image is fully there - what is missing is the view of it.
    await expect(page.locator('[data-reveal-tiles]')).toBeVisible()
    // The tiles are the clock; there is no longer a number next to it.
    await expect(page.locator('[data-seconds]')).toHaveCount(0)
  })

  test('video scene shows the video area', async ({ page }) => {
    await selectScene(page, 'video')
    await expect(page.locator('.stage[data-scene="video"]')).toBeVisible()
  })

  test('feedback scene shows correct and wrong differently', async ({ page }) => {
    await selectScene(page, 'feedback')
    await expect(page.locator('.stage[data-scene="feedback"] [data-outcome="correct"]')).toBeVisible()
    await expect(page.locator('[data-clip="correct"]')).toBeVisible()

    await page.locator('[data-preview-panel] select').nth(2).selectOption('incorrect')
    await expect(page.locator('.stage[data-scene="feedback"] [data-outcome="incorrect"]')).toBeVisible()
    await expect(page.locator('[data-clip="wrong"]')).toBeVisible()
    // The wrong-answer animation must not give away the solution early.
    await expect(page.locator('[data-answer][data-state="correct"]')).toHaveCount(0)
  })

  test('solution scene colours only the correct answer', async ({ page }) => {
    await selectScene(page, 'solution')
    await expect(page.locator('[data-answer][data-state="correct"]')).toBeVisible()
    await expect(page.locator('[data-answer][data-state="correct"]')).toHaveCount(1)
    // A previously selected wrong answer also recedes here.
    await expect(page.locator('[data-answer][data-state="selected"]')).toHaveCount(0)
  })

  test('result scene shows confetti only with a winner', async ({ page }) => {
    await selectScene(page, 'result')
    await expect(page.locator('[data-result-label]')).toHaveText('Gewinner')
    await expect(page.locator('[data-confetti]')).toHaveCount(1)

    await page.getByRole('checkbox', { name: 'Unentschieden (kein Konfetti)' }).check()
    await expect(page.locator('[data-result-label]')).toHaveText('Unentschieden')
    await expect(page.locator('[data-confetti]')).toHaveCount(0)
  })
})

test.describe('Themes', () => {
  /*
   * What is checked is the mechanism, not the colour value: every mode brings
   * its own, complete token set. Currently all three modes carry the same
   * greyscale system - the dedicated colour systems for kids and Saarbruecken
   * are still to follow.
   */
  const DESIGN_TOKENS = [
    'pageTop', 'pageBottom', 'stageTop', 'stageBottom', 'controls',
    'tile', 'tileDisabled', 'tileQuiet', 'option',
    'accent', 'accentQuiet', 'primary', 'solution', 'solutionChip',
    'correct', 'incorrect', 'text', 'textMuted',
  ]

  test('every mode sets the complete token set on the stage', async ({ page }) => {
    await selectScene(page, 'question')

    // There are exactly two design worlds - Saarbruecken uses the adults' one.
    for (const theme of ['default', 'kids']) {
      await selectTheme(page, theme)
      const missing = await page.locator('.stage').evaluate((element, tokens) => {
        const style = getComputedStyle(element)
        return tokens.filter((token) => !style.getPropertyValue(`--color-${token}`).trim())
      }, DESIGN_TOKENS)
      expect(missing, `Theme "${theme}" fehlen Token`).toEqual([])
    }
  })
})

test.describe("Reveal: the grid follows the server's progress", () => {
  test('the tiles follow the progress', async ({ page }) => {
    await selectScene(page, 'reveal')
    const slider = page.locator('[data-preview-panel] input[type="range"]')
    const tiles = page.locator('[data-reveal-tiles] [data-reveal-tile]')

    const open = () => page.locator('[data-reveal-tile][data-open="true"]').count()

    // The grid size lives in `revealGrid` - here all that counts is that ALL tiles are there.
    const total = await tiles.count()
    expect(total).toBeGreaterThan(1)

    await slider.fill('0')
    // At the start the image is fully covered.
    expect(await open()).toBe(0)

    // Half progress, half the image - the same variable as in the server.
    await slider.fill('5000')
    expect(await open()).toBe(Math.floor(total / 2))

    // At zero seconds nothing is covered anymore.
    await slider.fill('10000')
    expect(await open()).toBe(total)
  })

  test('tiles once open stay open', async ({ page }) => {
    await selectScene(page, 'reveal')
    const slider = page.locator('[data-preview-panel] input[type="range"]')
    const openIndices = () =>
      page.locator('[data-reveal-tile]').evaluateAll((nodes) =>
        nodes.map((node, index) => (node.getAttribute('data-open') === 'true' ? index : -1)).filter((index) => index >= 0),
      )

    await slider.fill('3000')
    const early = await openIndices()
    await slider.fill('7000')
    const late = await openIndices()

    expect(early.length).toBeGreaterThan(0)
    expect(late.length).toBeGreaterThan(early.length)
    // No tile may close again: the pool only ever grows.
    expect(late).toEqual(expect.arrayContaining(early))
  })
})

test.describe('Reduced motion', () => {
  test('shortens the transition duration and hides confetti', async ({ page }) => {
    await selectScene(page, 'question')
    const readDuration = () =>
      page
        .locator('.stage')
        .evaluate((element) => getComputedStyle(element).getPropertyValue('--transition-duration').trim())

    // question-enter normally lasts 520 ms.
    expect(await readDuration()).toBe('520ms')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await expect(page.locator('[data-preview-stage]')).toBeVisible()
    await selectScene(page, 'question')
    // Reduced-motion fallback of the question-enter definition.
    expect(await readDuration()).toBe('140ms')

    await selectScene(page, 'result')
    await expect(page.locator('[data-confetti]')).toBeHidden()
  })
})

/*
 * Long questions (specification 22.1).
 *
 * The case from real operation: a question spanning multiple lines pushed the
 * lower answer rows out of the picture. In the hall, answers C and D were then
 * simply missing, and nothing about it looked like a bug.
 *
 * What is measured is the CLAIM - does anything still stick out past the
 * content edge of the scene? - not a specific font size. Which size results
 * depends on the image, the answer length and the target format; fixing it
 * would only be a second copy of the calculation the adjustment itself is
 * built on.
 */
test.describe('Long questions', () => {
  const VIEWPORTS = [
    { name: '1920x1080', width: 1920, height: 1080 },
    { name: '1280x720', width: 1280, height: 720 },
  ] as const

  /** Hides the control column - afterwards the stage has the whole area. */
  async function fullBleed(page: Page): Promise<void> {
    await page.addStyleTag({
      content:
        '[data-preview]{grid-template-columns:1fr !important}[data-preview-panel]{position:absolute;opacity:0;pointer-events:none}',
    })
  }

  /** Largest overhang past the content edge of the scene, in pixels. */
  async function overshoot(page: Page): Promise<number> {
    return await page.locator('[data-fit-box]').evaluate((box) => {
      const limit = box.getBoundingClientRect().bottom - Number.parseFloat(getComputedStyle(box).paddingBottom)
      let worst = 0
      for (const node of box.querySelectorAll('*')) {
        const position = getComputedStyle(node).position
        // Absolutely positioned parts deliberately sit past the edge - see the director's note.
        if (position === 'absolute' || position === 'fixed') continue
        worst = Math.max(worst, node.getBoundingClientRect().bottom - limit)
      }
      return Math.round(worst)
    })
  }

  /*
   * The switch is operated via the DOM, not via a click: after `fullBleed` the
   * control column no longer accepts pointer input, so it does not cover the
   * stage area.
   */
  async function toggleLongText(page: Page): Promise<void> {
    await page
      .getByRole('checkbox', { name: /Lange Texte/ })
      .evaluate((element) => (element as HTMLInputElement).click())
  }

  async function promptSize(page: Page): Promise<number> {
    return await page
      .locator('[data-prompt]')
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  }

  for (const viewport of VIEWPORTS) {
    test(`portrait question keeps all four answers in view - ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await selectScene(page, 'question')
      await selectQuestionType(page, 'person')
      await page.getByRole('checkbox', { name: /Lange Texte/ }).check()
      await fullBleed(page)
      await page.waitForTimeout(400)

      expect(await overshoot(page)).toBeLessThanOrEqual(2)
      await expect(page.locator('[data-answer]')).toHaveCount(4)
    })
  }

  test('shrinks the question only as far as necessary', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await selectScene(page, 'question')
    await selectQuestionType(page, 'person')
    await fullBleed(page)
    await page.waitForTimeout(400)

    // A short question fits anyway and therefore stays at full size.
    const base = await promptSize(page)
    expect(base).toBeCloseTo(1920 * 0.028, 0)

    await toggleLongText(page)
    await page.waitForTimeout(400)
    const fitted = await promptSize(page)

    expect(fitted).toBeLessThan(base)
    // And not without a limit: below the lower bound it would be unreadable in the hall.
    expect(fitted).toBeGreaterThanOrEqual(base * 0.55 - 1)
  })

  test('leaves the question large when shrinking gains nothing', async ({ page }) => {
    /*
     * For the image question, the long ANSWERS are the ones causing the
     * overhang. Making the question smaller would not change that - a tiny
     * question AND an overhang would be doubly bad.
     */
    await page.setViewportSize({ width: 1920, height: 1080 })
    await selectScene(page, 'question')
    await selectQuestionType(page, 'image-choice')
    await fullBleed(page)
    await page.waitForTimeout(400)
    const base = await promptSize(page)

    await toggleLongText(page)
    await page.waitForTimeout(400)

    expect(await promptSize(page)).toBeCloseTo(base, 0)
  })

  test('leaves a short question untouched in every scene', async ({ page }) => {
    /*
     * The counter-check for the adjustment: a short question fits in every
     * scene and must therefore keep its base size. If the measurement
     * depended on the answer rows sliding in - during the animation they sit
     * lower than at the end - the question would stay too small afterwards,
     * even though it has long since fit.
     */
    await page.setViewportSize({ width: 1920, height: 1080 })
    await fullBleed(page)

    for (const scene of ['question', 'solution'] as const) {
      await selectScene(page, scene)
      await selectQuestionType(page, 'person')
      // Change the area in the middle of the entry animation - in operation, the jump into
      // full screen. That triggers a second measurement while the rows are still
      // on their way in.
      await page.setViewportSize({ width: 1900, height: 1080 })
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.waitForTimeout(600)
      expect(await promptSize(page), `Szene ${scene}`).toBeCloseTo(1920 * 0.028, 0)
    }
  })
})

/*
 * The stage measures itself solely by its WIDTH.
 *
 * It runs on projectors, in windows and on touch tables with very different
 * formats. Previously, image heights, paddings and stroke widths were partly
 * computed against the HEIGHT of the area (`cqh`): the same question looked
 * differently proportioned on a 4:3 screen than on 16:9, and nobody could tell
 * from the design how big it would end up. Now there is one single measure.
 */
test.describe('Size', () => {
  test('depends on the width and not on the height of the area', async ({ page }) => {
    /*
     * Measured against the corner of the stage, not against the window: the
     * preview sets the area itself, and its position is free to shift - only
     * what sits INSIDE it has to stay the same.
     */
    async function measures(): Promise<Record<string, number[] | null>> {
      await page.goto('/preview')
      await expect(page.locator('[data-preview-stage]')).toBeVisible()
      await selectScene(page, 'question')
      /*
       * The scene change animates `transform`, and a measurement taken in the
       * middle of it reads a position that will not exist a moment later. The
       * test therefore waits for the animations themselves rather than for a
       * number of milliseconds - endless ones are excluded, otherwise this
       * would wait forever.
       */
      await page.evaluate(async () => {
        const finite = document
          .getAnimations()
          .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        await Promise.all(finite.map((animation) => animation.finished.catch(() => undefined)))
      })
      return page.evaluate(() => {
        const names = ['[data-media]', '[data-prompt]', '[data-category]', '[data-answers]', '[data-score]', '[data-counter]']
        const ground = document.querySelector('[data-preview-stage]')!.getBoundingClientRect()
        const rows: Record<string, number[] | null> = {}
        for (const name of names) {
          const element = document.querySelector(name)
          rows[name] = null
          if (!element) continue
          const box = element.getBoundingClientRect()
          rows[name] = [box.x - ground.x, box.y - ground.y, box.width, box.height].map((number) =>
            Math.round(number),
          )
        }
        return rows
      })
    }

    await page.setViewportSize({ width: 1280, height: 800 })
    const flat = await measures()
    await page.setViewportSize({ width: 1280, height: 1100 })
    expect(await measures()).toEqual(flat)
  })
})

test.describe('Screenshot regression of central states', () => {
  // Animations are turned off for the capture so the images are stable.
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await expect(page.locator('[data-preview-stage]')).toBeVisible()
  })

  for (const scene of ['question', 'solution', 'result', 'pause'] as const) {
    test(`Scene ${scene}`, async ({ page }) => {
      await selectScene(page, scene)
      await page.waitForTimeout(300)
      await expect(page.locator('[data-preview-stage]')).toHaveScreenshot(`scene-${scene}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      })
    })
  }

  test('Scene question as portrait question', async ({ page }) => {
    await selectScene(page, 'question')
    await selectQuestionType(page, 'person')
    await page.waitForTimeout(300)
    await expect(page.locator('[data-preview-stage]')).toHaveScreenshot('scene-question-person.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    })
  })
})

/* ------------------------------------------------------------------ *
 * Video scene
 * ------------------------------------------------------------------ */

test.describe('Video', () => {
  /*
   * In the operator's preview no second piece of media is playing - and it
   * tells them nothing about the playback either. There is nothing to see
   * there except the area by which they recognise the composition.
   */
  test('the operator preview plays nothing and shows no state', async ({ page }) => {
    await page.goto('/preview')
    await selectScene(page, 'video')
    await page.locator('[data-preview-variant]').selectOption('preview')

    await expect(page.locator('[data-video-placeholder]')).toBeVisible()
    await expect(page.locator('video')).toHaveCount(0)
    /*
     * No "ready", no "running", no "finished": the operator needs nothing from
     * the stage in order to start the video or to move on afterwards.
     */
    await expect(page.locator('[data-video-status]')).toHaveCount(0)
  })

  test('on the stage the image stands, preloaded and unstarted', async ({ page }) => {
    await page.goto('/preview')
    await selectScene(page, 'video')
    await expect(page.locator('[data-video-placeholder]')).toBeVisible()

    const medium = page.locator('video')
    await expect(medium).toHaveCount(1)
    await expect(medium).toHaveAttribute('preload', 'auto')
    // The area stays visible - it no longer fades out after the video.
    await expect(page.locator('[data-video-placeholder]')).toHaveCSS('opacity', '1')
    await expect(page.locator('[data-video-status]')).toHaveCount(0)
  })
})
