/**
 * Kinderquiz: illustrierte Spieleransicht.
 *
 * Die Tests laufen gegen die serverfreie Entwicklungsvorschau `/preview`. Sie
 * pruefen genau das, was das Assetpaket als Abnahme verlangt: alle vier
 * Antworten, die Zustandsabbildung, lange Texte ohne Abschneiden, die feste
 * Chipspalte, den Rueckfall ohne Fragebild und die gezeichneten Konturen.
 *
 * Screenshot-Baselines sind plattformabhaengig und werden auf einem neuen System
 * einmalig mit `--update-snapshots` erzeugt.
 */
import { expect, test, type Page } from '@playwright/test'

/** Zielformate der Abnahme aus `ASSET_INTEGRATION.md`, Abschnitt 13. */
const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1024x768', width: 1024, height: 768 },
] as const

async function openKids(page: Page, scene: 'question' | 'solution' = 'question'): Promise<void> {
  await page.goto('/preview')
  await expect(page.locator('.preview__stage')).toBeVisible()
  await page.locator('.preview__panel select').nth(1).selectOption('kids')
  await page.locator('.preview__panel select').first().selectOption(scene)
  await expect(page.locator('.stage')).toHaveAttribute('data-skin', 'kids')
  await expect(page.locator('.kids-screen')).toBeVisible()
}

/**
 * Bedienspalte der Vorschau ausblenden.
 *
 * Nur so ist die Buehnenflaeche genau so breit wie das Fenster - sonst waere ein
 * "1920er Test" in Wahrheit 1540 Pixel breit und die Abnahmeformate saessen
 * daneben. Die Schalter bleiben bedienbar, sie sind nur unsichtbar.
 */
async function fullBleed(page: Page): Promise<void> {
  await page.addStyleTag({
    content: '.preview{grid-template-columns:1fr !important}.preview__panel{position:absolute;opacity:0;pointer-events:none}',
  })
}

/** Schalter "Lange Texte" der Vorschau. */
function longTextSwitch(page: Page) {
  return page.getByRole('checkbox', { name: /Lange Texte/ })
}

test.describe('Aufbau der Kinderansicht', () => {
  test('zeigt Wortmarke, beide Spielerkarten, Zaehler, Bild, Frage und vier Antworten', async ({ page }) => {
    await openKids(page)

    await expect(page.locator('.kids-brand__mark')).toBeVisible()
    await expect(page.locator('.kids-score')).toHaveCount(2)
    await expect(page.locator('.kids-counter')).toBeVisible()
    await expect(page.locator('.kids-media__image')).toBeVisible()
    await expect(page.locator('.kids-panel__prompt')).toBeVisible()
    await expect(page.locator('.kids-answer')).toHaveCount(4)

    // Die Buchstaben stehen in der Reihenfolge des Servers, nicht sortiert.
    expect(await page.locator('.kids-answer__chip').allTextContents()).toEqual(['A', 'B', 'C', 'D'])
  })

  test('spiegelt den Inhalt der Spielerkarten, nicht die Zeichnung', async ({ page }) => {
    await openKids(page)
    const cards = page.locator('.kids-score')

    // Spieler 1: erst die Spielernummer, dann die Punkte.
    expect(await cards.nth(0).locator('.kids-score__label').allTextContents()).toEqual(['Spieler', 'Punkte'])
    // Spieler 2: gespiegelt.
    expect(await cards.nth(1).locator('.kids-score__label').allTextContents()).toEqual(['Punkte', 'Spieler'])

    // Der aktive Spieler ist markiert - genau einer.
    await expect(page.locator('.kids-score[data-active="true"]')).toHaveCount(1)
  })

  test('zeigt dreistellige Punktestaende und den Zaehler mit Tabellenziffern', async ({ page }) => {
    await openKids(page)
    const scores = await page.locator('.kids-score__value--points').allTextContents()
    expect(scores).toEqual(['200', '150'])

    const numeric = await page
      .locator('.kids-counter__value')
      .evaluate((element) => getComputedStyle(element).fontVariantNumeric)
    expect(numeric).toContain('tabular-nums')

    // Letzte Frage: der Zaehler steht auf 7/7.
    await openKids(page, 'solution')
    await expect(page.locator('.kids-counter__value')).toHaveText('7/7')
  })
})

test.describe('Zustaende der Antworten', () => {
  test('bildet den Serverzustand auf die gezeichneten Flaechen ab', async ({ page }) => {
    await openKids(page)

    /*
     * Frageszene der zweiten Chance: eine gewaehlte Antwort, eine bereits als
     * falsch bewertete und zwei unberuehrte.
     */
    expect(await page.locator('.kids-answer').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-state')))).toEqual([
      'idle',
      'selected',
      'idle',
      'incorrect',
    ])

    // Loesungsszene: nur die richtige Antwort traegt Farbe.
    await openKids(page, 'solution')
    expect(await page.locator('.kids-answer').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-state')))).toEqual([
      'correct',
      'disabled',
      'disabled',
      'disabled',
    ])
  })

  test('jeder Zustand traegt seine eigene gezeichnete Flaeche und seinen Chip', async ({ page }) => {
    await openKids(page)
    const surface = (index: number) =>
      page
        .locator('.kids-answer')
        .nth(index)
        .evaluate((element) => getComputedStyle(element).getPropertyValue('--kids-surface').trim())

    expect(await surface(0)).toContain('answer-default.svg')
    expect(await surface(1)).toContain('answer-selected.svg')
    expect(await surface(3)).toContain('answer-incorrect.svg')

    const chip = await page
      .locator('.kids-answer')
      .nth(1)
      .locator('.kids-answer__chip')
      .evaluate((element) => getComputedStyle(element).getPropertyValue('--kids-chip').trim())
    expect(chip).toContain('answer-active.svg')

    await openKids(page, 'solution')
    expect(await surface(0)).toContain('answer-correct.svg')
  })

  test('zeichnet Konturen ausschliesslich als Flaechen, nie als CSS-Rahmen', async ({ page }) => {
    await openKids(page)
    const framed = ['.kids-answer', '.kids-panel', '.kids-media', '.kids-score', '.kids-counter']
    for (const selector of framed) {
      const widths = await page
        .locator(selector)
        .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).borderTopWidth))
      expect(widths.every((width) => width === '0px'), `${selector} traegt einen CSS-Rahmen`).toBe(true)
    }
  })
})

test.describe('Lange Fragen und Antworten', () => {
  test('bricht um, statt abzuschneiden - in jedem Zielformat', async ({ page }) => {
    await openKids(page)
    // Erst schalten, dann die Bedienspalte ausblenden - danach ist sie nicht mehr bedienbar.
    await longTextSwitch(page).check()
    await fullBleed(page)

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.waitForTimeout(200)

      /*
       * Abschneiden entsteht durch drei Dinge: eine Ellipse, ein abschneidender
       * Rahmen oder eine feste Hoehe. Geprueft wird deshalb genau das - nicht ein
       * Pixelvergleich von `scrollHeight`, der schon an der Rundung einer
       * Zeilenbox scheitert.
       */
      const clipping = await page
        .locator('.kids-panel, .kids-panel__prompt, .kids-answer, .kids-answer__text')
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

      // Die Frage nimmt mehrere Zeilen ein, wird also wirklich umgebrochen.
      const promptLines = await page.locator('.kids-panel__prompt').evaluate((element) => {
        const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight)
        return Math.round(element.getBoundingClientRect().height / lineHeight)
      })
      expect(promptLines, `Frage einzeilig bei ${viewport.name}`).toBeGreaterThanOrEqual(3)

      // Und die Antwortzeilen tragen ihre zwei Zeilen, ohne dass die Karte klemmt.
      const answerLines = await page.locator('.kids-answer__text').first().evaluate((element) => {
        const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight)
        return Math.round(element.getBoundingClientRect().height / lineHeight)
      })
      expect(answerLines, `Antwort einzeilig bei ${viewport.name}`).toBeGreaterThanOrEqual(2)
    }
  })

  test('haelt den Buchstabenchip in fester Groesse und mittig', async ({ page }) => {
    await openKids(page)
    const chipBox = async () => (await page.locator('.kids-answer__chip').first().boundingBox())!

    const short = await chipBox()
    await longTextSwitch(page).check()
    await page.waitForTimeout(150)
    const long = await chipBox()

    // Der Chip waechst nicht mit dem Text mit.
    expect(Math.abs(long.width - short.width)).toBeLessThan(1)
    expect(Math.abs(long.height - short.height)).toBeLessThan(1)

    // Und er bleibt senkrecht mittig in seiner Zeile.
    const row = (await page.locator('.kids-answer').first().boundingBox())!
    expect(Math.abs(long.y + long.height / 2 - (row.y + row.height / 2))).toBeLessThan(2)
  })
})

test.describe('Rueckfaelle', () => {
  test('kommt ohne Fragebild aus, ohne die Reihenfolge zu aendern', async ({ page }) => {
    // Die Loesungsszene der Vorschau hat bewusst kein Bild.
    await openKids(page, 'solution')
    await expect(page.locator('.kids-media')).toHaveCount(0)
    await expect(page.locator('.kids-stage--textonly')).toBeVisible()
    await expect(page.locator('.kids-panel__prompt')).toBeVisible()
    await expect(page.locator('.kids-answer')).toHaveCount(4)
  })

  test('verkuerzt bei reduzierter Bewegung alle Uebergaenge', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openKids(page)
    const duration = await page
      .locator('.kids-answer')
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration)
    expect(duration.startsWith('0.001s')).toBe(true)
  })
})

test.describe('Screenshots der Zielformate', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  for (const viewport of VIEWPORTS) {
    test(`Kinderansicht ${viewport.name}`, async ({ page }) => {
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
