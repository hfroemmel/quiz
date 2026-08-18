/**
 * Szenen- und Animationstests (Spezifikation 22.7).
 *
 * Diese Tests laufen gegen die Entwicklungsvorschau `/preview`. Sie ist bewusst
 * serverfrei: Die Szenen werden aus lokal erzeugten Beispiel-View-Modellen gerendert.
 * Dadurch sind visuelle Tests deterministisch und unabhaengig von der zufaelligen
 * Fragenauswahl eines echten Spiels.
 *
 * Screenshot-Baselines sind plattformabhaengig. Auf einem neuen System werden sie mit
 *   npx playwright test --project=preview --update-snapshots
 * einmalig erzeugt.
 */
import { expect, test, type Page } from '@playwright/test'

async function selectScene(page: Page, scene: string): Promise<void> {
  await page.locator('.preview__panel select').first().selectOption(scene)
  await expect(page.locator('.stage')).toHaveAttribute('data-scene', scene)
}

async function selectTheme(page: Page, theme: string): Promise<void> {
  await page.locator('.preview__panel select').nth(1).selectOption(theme)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/preview')
  await expect(page.locator('.preview__stage')).toBeVisible()
})

test.describe('Visuelle Smoke-Tests aller Szenen', () => {
  test('Startbild zeigt nur Branding', async ({ page }) => {
    await selectScene(page, 'start')
    await expect(page.locator('.scene--start')).toBeVisible()
    // Auf dem Startbild darf keine Frage stehen.
    await expect(page.locator('.question-prompt')).toHaveCount(0)
  })

  test('Pausenscreen zeigt keine Frageninhalte', async ({ page }) => {
    await selectScene(page, 'pause')
    await expect(page.locator('.scene--pause')).toBeVisible()
    await expect(page.locator('.question-prompt')).toHaveCount(0)
    await expect(page.locator('.option-card')).toHaveCount(0)
  })

  test('Frageszene zeigt Frage und vier Optionen ohne Loesungshinweis', async ({ page }) => {
    await selectScene(page, 'question')
    await expect(page.locator('.question-prompt')).toBeVisible()
    await expect(page.locator('.option-card')).toHaveCount(4)
    // Kein Zustand an den Optionen: die Loesung ist noch nicht oeffentlich.
    await expect(page.locator('.option-card--correct')).toHaveCount(0)
    await expect(page.locator('.option-card--chosen-incorrect')).toHaveCount(0)
  })

  test('Bilderkennen zeigt Countdown und unscharfes Bild', async ({ page }) => {
    await selectScene(page, 'reveal')
    await expect(page.locator('.reveal__seconds')).toBeVisible()
    await expect(page.locator('.reveal__image')).toBeVisible()
  })

  test('Videoszene zeigt die Videoflaeche', async ({ page }) => {
    await selectScene(page, 'video')
    await expect(page.locator('.scene--video')).toBeVisible()
  })

  test('Feedbackszene zeigt Richtig und Falsch unterschiedlich', async ({ page }) => {
    await selectScene(page, 'feedback')
    await expect(page.locator('.scene--feedback-correct')).toBeVisible()
    await expect(page.locator('.feedback__symbol')).toHaveText('✓')

    await page.locator('.preview__panel select').nth(2).selectOption('incorrect')
    await expect(page.locator('.scene--feedback-incorrect')).toBeVisible()
    await expect(page.locator('.feedback__symbol')).toHaveText('✗')
    // Die Falsch-Animation darf die Loesung nicht vorwegnehmen.
    await expect(page.locator('.solution__answer')).toHaveCount(0)
  })

  test('Loesungsszene hebt die richtige Option hervor', async ({ page }) => {
    await selectScene(page, 'solution')
    await expect(page.locator('.solution__answer')).toBeVisible()
    await expect(page.locator('.option-card--correct')).toHaveCount(1)
    await expect(page.locator('.option-card--chosen-incorrect')).toHaveCount(1)
  })

  test('Ergebnisszene zeigt Konfetti nur bei einem Gewinner', async ({ page }) => {
    await selectScene(page, 'result')
    await expect(page.locator('.result__label')).toHaveText('Gewinner')
    await expect(page.locator('.confetti')).toHaveCount(1)

    await page.locator('.field--checkbox input').check()
    await expect(page.locator('.result__label')).toHaveText('Unentschieden')
    await expect(page.locator('.confetti')).toHaveCount(0)
  })
})

test.describe('Themes', () => {
  test('jeder Modus kann ein eigenes Farbsystem verwenden', async ({ page }) => {
    await selectScene(page, 'question')
    const readAccent = () =>
      page.locator('.stage').evaluate((element) => getComputedStyle(element).getPropertyValue('--color-accent').trim())

    const standard = await readAccent()
    await selectTheme(page, 'kids')
    const kids = await readAccent()
    await selectTheme(page, 'regional')
    const regional = await readAccent()

    expect(new Set([standard, kids, regional]).size).toBe(3)
  })
})

test.describe('Enthuellung: Countdown und Bildschaerfe stammen aus derselben Quelle', () => {
  test('Schaerfe und Countdown laufen synchron', async ({ page }) => {
    await selectScene(page, 'reveal')
    const slider = page.locator('.preview__panel input[type="range"]')

    const readState = async () => ({
      seconds: Number(await page.locator('.reveal__seconds').textContent()),
      blur: await page
        .locator('.reveal__image')
        .evaluate((element) => Number.parseFloat((element as HTMLElement).style.filter.replace(/[^\d.]/g, ''))),
    })

    await slider.fill('0')
    const start = await readState()
    expect(start.seconds).toBe(10)
    expect(start.blur).toBeGreaterThan(40)

    await slider.fill('5000')
    const middle = await readState()
    expect(middle.seconds).toBe(5)
    // Halber Fortschritt bedeutet halbe Unschaerfe - dieselbe Variable.
    expect(middle.blur).toBeGreaterThan(start.blur * 0.45)
    expect(middle.blur).toBeLessThan(start.blur * 0.55)

    await slider.fill('10000')
    const end = await readState()
    expect(end.seconds).toBe(0)
    expect(end.blur).toBe(0)
  })
})

test.describe('Reduzierte Bewegung', () => {
  test('verkuerzt die Uebergangsdauer und blendet Konfetti aus', async ({ page }) => {
    await selectScene(page, 'question')
    const readDuration = () =>
      page
        .locator('.stage')
        .evaluate((element) => getComputedStyle(element).getPropertyValue('--transition-duration').trim())

    // question-enter ist regulaer 520 ms lang.
    expect(await readDuration()).toBe('520ms')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await expect(page.locator('.preview__stage')).toBeVisible()
    await selectScene(page, 'question')
    // Reduced-Motion-Fallback der Definition question-enter.
    expect(await readDuration()).toBe('140ms')

    await selectScene(page, 'result')
    await expect(page.locator('.confetti')).toBeHidden()
  })
})

test.describe('Screenshot-Regression zentraler Zustaende', () => {
  // Animationen werden fuer die Aufnahme abgeschaltet, damit die Bilder stabil sind.
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await expect(page.locator('.preview__stage')).toBeVisible()
  })

  for (const scene of ['question', 'solution', 'result', 'pause'] as const) {
    test(`Szene ${scene}`, async ({ page }) => {
      await selectScene(page, scene)
      await page.waitForTimeout(300)
      await expect(page.locator('.preview__stage')).toHaveScreenshot(`scene-${scene}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      })
    })
  }
})
