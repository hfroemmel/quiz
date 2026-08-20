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
    const drawing = (selector: string, index: number) =>
      page
        .locator(selector)
        .nth(index)
        .evaluate((element) => getComputedStyle(element).getPropertyValue('--kids-surface').trim())
    const surface = (index: number) => drawing('.kids-answer__surface', index)

    expect(await surface(0)).toContain('answer-box-a.svg')
    expect(await surface(1)).toContain('answer-box-b.svg')
    expect(await surface(3)).toContain('answer-box-incorrect.svg')

    expect(await drawing('.kids-answer__chip', 1)).toContain('badge-letter-b.svg')

    await openKids(page, 'solution')
    expect(await surface(0)).toContain('answer-box-correct.svg')
  })

  test('traegt die breite Kartenzeichnung nur auf der Antwortflaeche, nie auf der Zeile', async ({ page }) => {
    await openKids(page)
    // Alle Masse sind reine Containermasse - gemessen wird im Zielformat.
    await fullBleed(page)
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.waitForTimeout(200)

    /*
     * Der Kern der Korrektur: Chip und Karte sind zwei Zeichnungen. Laege die
     * breite Karte auf der Zeile, saesse der Buchstabe mit auf ihr - genau das
     * war die Abweichung der ersten Fassung.
     */
    const rowDrawing = await page
      .locator('.kids-answer')
      .first()
      .evaluate((element) => getComputedStyle(element).getPropertyValue('--kids-surface').trim())
    expect(rowDrawing).toBe('')

    // Und zwischen beiden bleibt eine sichtbare Luecke.
    const gap = await page.locator('.kids-answer').first().evaluate((row) => {
      const chip = row.querySelector('.kids-answer__chip')!.getBoundingClientRect()
      const surface = row.querySelector('.kids-answer__surface')!.getBoundingClientRect()
      return surface.left - chip.right
    })
    expect(gap).toBeGreaterThanOrEqual(9)
  })

  test('zeichnet Konturen ausschliesslich als Flaechen, nie als CSS-Rahmen', async ({ page }) => {
    await openKids(page)
    const framed = [
      '.kids-answer',
      '.kids-answer__surface',
      '.kids-answer__chip',
      '.kids-panel',
      '.kids-media',
      '.kids-score',
      '.kids-counter',
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

test.describe('Handschrift und Zeichnung', () => {
  test('setzt Patrick Hand fuer alles Gelesene und Melior fuer Zahlen und Buchstaben', async ({ page }) => {
    await openKids(page)

    const family = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((element) => {
          const style = getComputedStyle(element)
          return { font: style.fontFamily, weight: style.fontWeight }
        })

    for (const selector of ['.kids-panel__prompt', '.kids-panel__category', '.kids-answer__text', '.kids-score__label', '.kids-counter__label']) {
      const { font, weight } = await family(selector)
      expect(font, `${selector} traegt nicht die Handschrift`).toContain('Patrick Hand')
      // Patrick Hand hat nur einen Schnitt: Alles darueber waere gerechnete Fettschrift.
      expect(weight, `${selector} wuerde synthetisch fett gerechnet`).toBe('400')
    }

    // Spielernummer, Punkte, Zaehler und die Buchstaben A-D stehen in Melior.
    for (const selector of ['.kids-score__value', '.kids-counter__value', '.kids-answer__chip']) {
      const { font, weight } = await family(selector)
      expect(font, `${selector} traegt nicht die Serifenschrift`).toContain('Melior')
      expect(weight).toBe('700')
    }

    // Und beide Dateien liegen wirklich vor - sonst zeigte der Screen den Rueckfall.
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready
      return {
        hand: document.fonts.check('400 40px "Patrick Hand"'),
        numeric: document.fonts.check('700 40px Melior'),
      }
    })
    expect(loaded).toEqual({ hand: true, numeric: true })
  })

  test('haelt eine sichtbare Fuge zwischen Fragebild und Frageflaeche', async ({ page }) => {
    await openKids(page)
    await fullBleed(page)
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.waitForTimeout(200)

    const media = (await page.locator('.kids-media').boundingBox())!
    const panel = (await page.locator('.kids-panel').boundingBox())!
    // `clamp(16px, 1.4vw, 28px)` - bei 1920 sind das 27 Pixel.
    expect(panel.x - (media.x + media.width)).toBeGreaterThanOrEqual(16)
  })

  test('stellt Karlchen gross an den rechten Rand, ohne die Antworten zu beruehren', async ({ page }) => {
    await openKids(page)
    await fullBleed(page)
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.waitForTimeout(200)

    const stage = (await page.locator('.stage').boundingBox())!
    const figure = (await page.locator('.kids-mascot__figure').boundingBox())!

    // Rund die halbe Bildhoehe - keine Randgrafik.
    const share = figure.height / stage.height
    expect(share).toBeGreaterThanOrEqual(0.42)
    expect(share).toBeLessThanOrEqual(0.52)

    // Sie steht rechts und auf dem Boden, nicht in der Bildmitte.
    expect(figure.x).toBeGreaterThan(stage.x + stage.width * 0.7)
    expect(figure.y + figure.height).toBeGreaterThan(stage.y + stage.height * 0.85)

    // Und die Antwortzeilen enden davor.
    const answers = (await page.locator('.kids-answers').boundingBox())!
    expect(answers.x + answers.width).toBeLessThanOrEqual(figure.x)

    // Dekoration nimmt keine Klicks entgegen.
    for (const selector of ['.kids-mascot', '.kids-media__peek']) {
      const events = await page.locator(selector).evaluate((element) => getComputedStyle(element).pointerEvents)
      expect(events, `${selector} faengt Klicks`).toBe('none')
    }
  })

  test('laesst Karlchen ueber dem Bildrahmen hervorschauen, rechts der Wortmarke', async ({ page }) => {
    await openKids(page)
    await fullBleed(page)
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.waitForTimeout(200)

    const media = (await page.locator('.kids-media').boundingBox())!
    const peek = (await page.locator('.kids-media__peek').boundingBox())!

    // Etwas rechts der Rahmenmitte wie im Entwurf - und ueber dem Rahmen.
    const centre = peek.x + peek.width / 2
    expect(centre).toBeGreaterThan(media.x + media.width * 0.5)
    expect(centre).toBeLessThan(media.x + media.width * 0.8)

    /*
     * Die Unterkante steckt 8 bis 14 Pixel hinter dem Rahmen. Gemessen wird die
     * Zeichnung, nicht die Datei: Unter ihr liegen 9,4 Prozent durchsichtiger
     * Rand.
     */
    const drawnBottom = peek.y + peek.height * 0.906
    const overlap = drawnBottom - media.y
    expect(overlap).toBeGreaterThanOrEqual(8)
    expect(overlap).toBeLessThanOrEqual(14)
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
        .locator('.kids-panel, .kids-panel__prompt, .kids-answer__surface, .kids-answer__text')
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
