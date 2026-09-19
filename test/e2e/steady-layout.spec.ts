/**
 * The entrance of the answer rows.
 *
 * It is measured in the development preview `/preview`, because it is a
 * property of the composition and not of a round: the rows are released in the
 * middle of a question, and what has to be true of them there is that they
 * move at all, that the movement is their own and that they arrive in order.
 *
 * The other way a scene can be unquiet - something moving that should stand
 * still - is measured where it happens: `kiosk-layout.spec.ts` holds the head
 * group against a growing score.
 */
import { expect, test, type Page } from '@playwright/test'

async function selectScene(page: Page, scene: string): Promise<void> {
  await page.locator('[data-preview-panel] select').first().selectOption(scene)
  await expect(page.locator('.stage')).toHaveAttribute('data-scene', scene)
}

async function selectTheme(page: Page, theme: string): Promise<void> {
  await page.locator('[data-preview-panel] select').nth(1).selectOption(theme)
}

/**
 * The rows' entrance, as the browser resolves it - including whether a
 * keyframe of that name is loaded at all. A name without a definition behind it
 * is the failure this whole case is about, and the computed style alone does
 * not tell them apart.
 */
async function entranceOf(
  page: Page,
): Promise<{ name: string; duration: string; delay: string; defined: boolean }[]> {
  return page.locator('[data-answer]').evaluateAll((rows) => {
    const defined = new Set<string>()
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList
      try {
        rules = sheet.cssRules
      } catch {
        continue
      }
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSKeyframesRule) defined.add(rule.name)
      }
    }
    return rows.map((row) => {
      const style = getComputedStyle(row)
      return {
        name: style.animationName,
        duration: style.animationDuration,
        delay: style.animationDelay,
        defined: defined.has(style.animationName),
      }
    })
  })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/preview')
  await expect(page.locator('[data-preview-stage]')).toBeVisible()
})

test('the answer rows bring their own entrance, one after another', async ({ page }) => {
  await selectScene(page, 'question')

  /*
   * THE DURATION IS THE ROW'S OWN, and that is the whole point of this case.
   * The entrance used to take the duration of the SCENE transition, which is
   * only set while one runs - so the rows, released in the middle of a
   * question, had an invalid declaration and appeared from one frame to the
   * next. A duration of `0s` here means exactly that bug is back.
   */
  const rows = await entranceOf(page)
  expect(rows.length).toBeGreaterThanOrEqual(4)
  for (const row of rows) {
    /*
     * The name is the module's, so it carries a hash - what matters is that it
     * is the row's entrance AND that a keyframe of that name exists: a
     * reference into a stylesheet the module cannot see compiles to a name
     * nothing defines, and then nothing moves at all.
     */
    expect(row.name).toMatch(/option-enter/)
    expect(row.defined).toBe(true)
    expect(row.duration).toBe('0.38s')
  }

  // And they arrive in order, 70 ms apart.
  expect(rows.map((row) => row.delay)).toEqual(['0s', '0.07s', '0.14s', '0.21s'])
})

test('the drawn cards of the kids world move in the same way', async ({ page }) => {
  await selectScene(page, 'question')
  await selectTheme(page, 'kids')
  await expect(page.locator('.stage')).toHaveClass(/stage--kids/)

  const rows = await entranceOf(page)
  expect(rows.length).toBeGreaterThanOrEqual(4)
  for (const row of rows) {
    expect(row.name).toMatch(/option-enter/)
    expect(row.defined).toBe(true)
    expect(row.duration).toBe('0.38s')
  }
})
