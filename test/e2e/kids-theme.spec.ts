/**
 * Die Kinderwelt in allen drei Ausspielwegen.
 *
 * DIESELBE WELT, DREI GASTGEBER: der Saal (`/preview`), das eigenstaendige
 * Geraet (`/play`) und die eingebettete Anwendung (`/shell`). Sie unterscheiden
 * sich im Rahmen darum - Buzzer, Fussleiste, Menue -, nicht in der Szene. Was
 * hier geprueft wird, ist genau das: dass die Szene ueberall dieselbe ist und
 * nirgends eine Regel steht, die nach dem Gastgeber fragt.
 */
import { expect, test, type Page } from '@playwright/test'

/** Die Figur der Kinderwelt. Ein Element, in jeder Welt im Markup. */
const mascot = '[data-mascot]'

/** Sichtbar heisst: Sie traegt wirklich eine Zeichnung, nicht nur einen Kasten. */
async function mascotVisible(page: Page): Promise<boolean> {
  return page.locator(mascot).evaluate((el) => getComputedStyle(el).backgroundImage !== 'none')
}

/** Was die Figur einnimmt, in Prozent der Szene - so wird sie vergleichbar. */
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
 * Gleicher Platz, gleiche Groesse - auf ein Zehntel Prozentpunkt genau.
 *
 * Exakt gleiche Zahlen kann es nicht geben: Die Szenen sind verschieden breit,
 * und ein halbes Pixel faellt beim Umrechnen mal so und mal so. Gemeint ist,
 * dass dieselbe Regel gilt, nicht dass dieselben Pixel herauskommen.
 */
function expectSameSpot(ist: Record<string, number>, soll: Record<string, number>, wo: string): void {
  for (const schluessel of Object.keys(soll)) {
    expect(Math.abs(ist[schluessel]! - soll[schluessel]!), `${wo}/${schluessel}`).toBeLessThan(0.2)
  }
}

/** Die Buehne im Saal: Vorschau-Pruefstand, Szene und Welt frei waehlbar. */
async function openStage(page: Page, theme: 'kids' | 'default', scene = 'question'): Promise<void> {
  await page.goto('/preview')
  await page.locator('select').first().selectOption(scene)
  await page.locator('select').nth(1).selectOption(theme)
  await expect(page.locator('.stage')).toBeVisible({ timeout: 15_000 })
}

/** Das Geraet - eigenstaendig (`/play`) oder eingebettet (`/shell`). */
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

test.describe('Die Figur der Kinderwelt', () => {
  test('steht im Saal, am Geraet und in der eingebetteten Anwendung', async ({ page }) => {
    await openStage(page, 'kids')
    expect(await mascotVisible(page), 'Saal').toBe(true)
    const saal = await mascotShare(page)

    await openDevice(page, 'play', 'kids')
    expect(await mascotVisible(page), 'eigenstaendig').toBe(true)
    /*
     * GLEICHE GROESSE UND GLEICHER PLATZ - gemessen an der Szene, zu der sie
     * gehoert. Am Geraet ist die Szene eine verkleinerte Buehne in der Mitte;
     * die Figur ist dort genauso gross wie im Saal, nur eben von dieser Flaeche
     * aus gerechnet.
     */
    expectSameSpot(await mascotShare(page), saal, 'eigenstaendig')

    await openDevice(page, 'shell', 'kids')
    expect(await mascotVisible(page), 'eingebettet').toBe(true)
    expectSameSpot(await mascotShare(page), saal, 'eingebettet')
  })

  test('steht im Einzelspiel wie im Duell', async ({ page }) => {
    await openDevice(page, 'play', 'kids', 'Allein')
    expect(await mascotVisible(page), 'allein').toBe(true)
    const allein = await mascotShare(page)

    await openDevice(page, 'play', 'kids', 'Zu zweit')
    expect(await mascotVisible(page), 'zu zweit').toBe(true)
    expectSameSpot(await mascotShare(page), allein, 'zu zweit')
  })

  test('deckt weder Text noch Bild noch Bedienelemente zu', async ({ page }) => {
    /*
     * GEPRUEFT WIRD, WAS GELESEN WIRD. Der ausgestreckte Fluegel ragt wie im
     * Entwurf ein Stueck ueber das leere Ende der gezeichneten Karten - im Saal
     * genauso. Verdeckt werden darf davon kein Wort, kein Foto und kein Knopf.
     */
    const freiheiten = async (host: 'play' | 'shell' | null) => {
      if (host) await openDevice(page, host, 'kids')
      else await openStage(page, 'kids')
      return page.evaluate(() => {
        const box = (sel: string) => document.querySelector(sel)?.getBoundingClientRect()
        const figur = box('[data-mascot]')!
        const stoert = (other?: DOMRect | null) =>
          !!other &&
          figur.left < other.right &&
          figur.right > other.left &&
          figur.top < other.bottom &&
          figur.bottom > other.top
        const texte = (sel: string) =>
          Array.from(document.querySelectorAll(sel)).some((el) => stoert(el.getBoundingClientRect()))
        return {
          frageText: texte('[data-prompt]'),
          rubrik: texte('[data-category]'),
          antwortText: texte('[data-answer] [class*="text"]'),
          bild: stoert(box('[class*="media"]')),
          buzzerLinks: stoert(box('[data-buzzer][data-side="left"]')),
          buzzerRechts: stoert(box('[data-buzzer][data-side="right"]')),
        }
      })
    }
    const nichtsVerdeckt = {
      frageText: false,
      rubrik: false,
      antwortText: false,
      bild: false,
      buzzerLinks: false,
      buzzerRechts: false,
    }

    expect(await freiheiten(null), 'Saal').toEqual(nichtsVerdeckt)
    expect(await freiheiten('play'), 'eigenstaendig').toEqual(nichtsVerdeckt)
    expect(await freiheiten('shell'), 'eingebettet').toEqual(nichtsVerdeckt)
  })

  test('bleibt in der Erwachsenenwelt in jedem Gastgeber leer', async ({ page }) => {
    await openStage(page, 'default')
    expect(await mascotVisible(page), 'Saal').toBe(false)

    await openDevice(page, 'play', 'adults')
    expect(await mascotVisible(page), 'eigenstaendig').toBe(false)

    await openDevice(page, 'shell', 'adults')
    expect(await mascotVisible(page), 'eingebettet').toBe(false)
  })

  test('ist Zierde und wird der Sprachausgabe nicht vorgelesen', async ({ page }) => {
    await openStage(page, 'kids')
    await expect(page.locator(mascot)).toHaveAttribute('aria-hidden', 'true')
    // Kein Text, kein Bild mit Beschreibung, keine Schaltflaeche.
    await expect(page.locator(mascot)).toHaveText('')
    await expect(page.locator(`${mascot} img`)).toHaveCount(0)
  })
})

test.describe('Die Zwischenansicht vor der Frage', () => {
  test('stellt Zaehler und Rubrik in der Kinderwelt in eine Tafel', async ({ page }) => {
    await openStage(page, 'kids', 'pause')

    const tafel = page.locator('[data-pause-card]')
    await expect(tafel).toBeVisible()
    // Beide Angaben stehen DARIN - eine Tafel, keine zweite Box.
    await expect(tafel.locator('[data-pause-progress]')).toBeVisible()
    await expect(tafel.locator('[data-pause-category]')).toBeVisible()
    await expect(tafel.locator('[class*="pauseCard"]')).toHaveCount(0)

    const gezeichnet = await tafel.evaluate((el) => getComputedStyle(el, '::before').borderImageSource)
    expect(gezeichnet).toContain('url(')
  })

  test('zeigt beide Angaben groesser als zuvor, den Zaehler voran', async ({ page }) => {
    await openStage(page, 'kids', 'pause')
    const groesse = async (sel: string) =>
      page.locator(sel).evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))

    const zaehler = await groesse('[data-pause-progress]')
    const rubrik = await groesse('[data-pause-category]')
    /*
     * Gemessen wird gegen die BUEHNE: Alle Groessen der Szene stehen in `cqw`,
     * und im Pruefstand steht neben der Buehne noch die Bedienspalte.
     */
    const breite = await page.locator('.stage').evaluate((el) => el.getBoundingClientRect().width)

    /*
     * Die frueheren Werte waren 2.8cqw fuer den Zaehler und 4.4cqw fuer die
     * Rubrik - der Zaehler war das Kleinere. Beide sind jetzt groesser, und die
     * Reihenfolge stimmt: Die Nummer ist die Hauptsache.
     */
    expect(zaehler).toBeGreaterThan(breite * 0.028)
    expect(rubrik).toBeGreaterThan(breite * 0.044)
    expect(zaehler).toBeGreaterThan(rubrik)
  })

  test('haelt auch eine lange Rubrik vollstaendig in der Tafel', async ({ page }) => {
    await openStage(page, 'kids', 'pause')

    await page.locator('[data-pause-category]').evaluate((el) => {
      el.textContent = 'Politik, Gesellschaft und das Zusammenleben in der Demokratie'
    })
    await page.waitForTimeout(150)

    const mass = await page.evaluate(() => {
      const rubrik = document.querySelector('[data-pause-category]') as HTMLElement
      const tafel = document.querySelector('[data-pause-card]') as HTMLElement
      const szene = document.querySelector('[data-scene-root]') as HTMLElement
      const r = rubrik.getBoundingClientRect()
      const t = tafel.getBoundingClientRect()
      const s = szene.getBoundingClientRect()
      return {
        /* Sie bricht um, statt in einer Zeile aus der Tafel zu laufen. */
        zeilen: Math.round(r.height / Number.parseFloat(getComputedStyle(rubrik).lineHeight)),
        abgeschnitten: rubrik.scrollWidth > rubrik.clientWidth + 1,
        /* Der Text bleibt in der Tafel, die Tafel bleibt in der Szene. */
        ausserhalbTafel: r.left < t.left - 1 || r.right > t.right + 1,
        ausserhalbSzene: t.left < s.left - 1 || t.right > s.right + 1,
      }
    })
    expect(mass.abgeschnitten).toBe(false)
    expect(mass.ausserhalbTafel).toBe(false)
    expect(mass.ausserhalbSzene).toBe(false)
    expect(mass.zeilen).toBeGreaterThan(1)
  })

  test('laesst die Erwachsenenwelt, wie sie war', async ({ page }) => {
    await openStage(page, 'default', 'pause')

    /*
     * Der Rahmen steht auch hier im Markup - er ist nur keiner: `display:
     * contents` nimmt ihn aus dem Layout, und die beiden Absaetze bleiben
     * direkte Kinder der Szene wie vorher.
     */
    await expect(page.locator('[data-pause-card]')).toHaveCSS('display', 'contents')
    const gezeichnet = await page
      .locator('[data-pause-card]')
      .evaluate((el) => getComputedStyle(el, '::before').borderImageSource)
    expect(gezeichnet === 'none' || gezeichnet === '').toBe(true)
  })
})

test.describe('Bild und Fragetafel', () => {
  /** Die Fuge zwischen Bild und Tafel, in Prozent der Szene. */
  async function layout(page: Page) {
    return page.evaluate(() => {
      const head = document.querySelector('[data-panel]')!.closest('[class*="head"]') as HTMLElement
      const scene = document.querySelector('[data-scene-root]') as HTMLElement
      const media = head.querySelector('[class*="media"]') as HTMLElement | null
      const panel = head.querySelector('[data-panel]') as HTMLElement
      const b = (el: HTMLElement) => el.getBoundingClientRect()
      const breite = b(scene).width
      return {
        headClass: (head.className.match(/_head_\w+/) ?? [''])[0],
        gap: media ? +(((b(panel).left - b(media).right) / breite) * 100).toFixed(2) : null,
        /* Rechts neben der Tafel darf nichts uebrig bleiben. */
        restRechts: +((b(head).right - b(panel).right).toFixed(1)),
        panelBreite: +((b(panel).width / breite) * 100).toFixed(1),
        bildVerhaeltnis: media ? +(b(media).width / b(media).height).toFixed(2) : null,
        ueberlauf: head.scrollWidth > head.clientWidth + 1,
      }
    })
  }

  /**
   * Spielt am Geraet vor, bis eine Frage MIT Bild steht.
   *
   * Welche Frage zuerst kommt, entscheidet die Auswahl des Servers - eine Frage
   * ohne Bild hat keine Fuge, und dann pruefte dieser Test nichts.
   */
  async function advanceToImageQuestion(page: Page): Promise<void> {
    for (let runde = 0; runde < 6; runde += 1) {
      const hatBild = await page
        .locator('[data-panel]')
        .evaluate((el) => !!el.closest('[class*="head"]')!.querySelector('[class*="media"]'))
      if (hatBild) return
      /* Im Einzelspiel holt der erste Tipp den Zuschlag; abgegeben wird getrennt. */
      await page.locator('[data-answer]:not([disabled])').first().click()
      await page.locator('[data-confirm]').click()
      // Nach der Loesung wartet das Geraet auf ein Tippen - es schaltet nicht selbst.
      await expect(page.locator('[data-continue]')).toBeVisible({ timeout: 30_000 })
      await page.locator('[data-continue]').click()
      await expect(page.locator('[data-answers]')).toBeVisible({ timeout: 30_000 })
    }
    throw new Error('Keine Frage mit Bild gefunden.')
  }

  test('setzt in allen drei Gastgebern dieselbe Fuge aus demselben Bauteil', async ({ page }) => {
    // Zwei Geraete, die sich bis zu einer Bildfrage vorspielen - das dauert.
    test.setTimeout(180_000)
    await openStage(page, 'kids')
    const saal = await layout(page)

    await openDevice(page, 'play', 'kids', 'Allein')
    await advanceToImageQuestion(page)
    const geraet = await layout(page)

    await openDevice(page, 'shell', 'kids', 'Allein')
    await advanceToImageQuestion(page)
    const eingebettet = await layout(page)

    // Dieselbe Klasse heisst: dasselbe Bauteil, nicht drei Abschriften.
    expect(geraet.headClass).toBe(saal.headClass)
    expect(eingebettet.headClass).toBe(saal.headClass)
    // Und dieselbe Fuge - der Token ist einer (`--kids-stage-gap`).
    expect(geraet.gap).toBe(saal.gap)
    expect(eingebettet.gap).toBe(saal.gap)
  })

  test('haelt die Fuge bei kurzem wie bei langem Fragetext', async ({ page }) => {
    await openStage(page, 'kids')
    const kurz = await layout(page)

    // Der Pruefstand hat den langen Text als Schalter.
    await page.getByText('Lange Texte', { exact: false }).click()
    await page.waitForTimeout(200)
    const lang = await layout(page)

    expect(lang.gap).toBe(kurz.gap)
    expect(lang.ueberlauf).toBe(false)
    expect(kurz.ueberlauf).toBe(false)
  })

  test('laesst die Tafel den ganzen Rest der Zeile fuellen', async ({ page }) => {
    await openStage(page, 'kids')
    const mit = await layout(page)

    // Kein Leerraum zwischen Tafel und rechtem Rand der Zeile.
    expect(Math.abs(mit.restRechts)).toBeLessThan(1)
    // Das Bild behaelt sein Seitenverhaeltnis (4:3).
    expect(mit.bildVerhaeltnis).toBeCloseTo(4 / 3, 1)
  })

  test('gibt der Tafel ohne Bild die ganze Breite', async ({ page }) => {
    await openStage(page, 'kids')
    const mit = await layout(page)

    /*
     * Eine Enthuellungsfrage traegt ihr Bild nicht in der Kopfzone, sondern
     * gross auf der Buehne - dort laeuft die Tafel ueber die volle Breite.
     */
    await page.locator('select').first().selectOption('reveal')
    await expect(page.locator('[data-reveal-tiles]')).toBeVisible()
    const ohne = await layout(page)

    expect(ohne.gap).toBeNull()
    expect(ohne.panelBreite).toBeGreaterThan(mit.panelBreite)
  })
})
