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
  await page.locator('[data-preview-panel] select').first().selectOption(scene)
  await expect(page.locator('.stage')).toHaveAttribute('data-scene', scene)
}

async function selectTheme(page: Page, theme: string): Promise<void> {
  await page.locator('[data-preview-panel] select').nth(1).selectOption(theme)
}

/** Nur in Frage- und Loesungsszene vorhanden; dort steht die Auswahl an dritter Stelle. */
async function selectQuestionType(page: Page, type: string): Promise<void> {
  await page.locator('[data-preview-panel] select').nth(2).selectOption(type)
  await expect(page.locator('.stage')).toHaveAttribute('data-presentation', type)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/preview')
  await expect(page.locator('[data-preview-stage]')).toBeVisible()
})

test.describe('Visuelle Smoke-Tests aller Szenen', () => {
  test('Startbild zeigt nur Branding', async ({ page }) => {
    await selectScene(page, 'start')
    await expect(page.locator('.stage[data-scene="start"]')).toBeVisible()
    // Auf dem Startbild darf keine Frage stehen.
    await expect(page.locator('[data-prompt]')).toHaveCount(0)
  })

  test('Pausenscreen zeigt keine Frageninhalte', async ({ page }) => {
    await selectScene(page, 'pause')
    await expect(page.locator('.stage[data-scene="pause"]')).toBeVisible()
    await expect(page.locator('[data-prompt]')).toHaveCount(0)
    await expect(page.locator('[data-answer]')).toHaveCount(0)
  })

  test('Frageszene zeigt die eingeloggte Antwort, aber keinen Loesungshinweis', async ({ page }) => {
    await selectScene(page, 'question')
    await expect(page.locator('[data-prompt]')).toBeVisible()
    await expect(page.locator('[data-answer]')).toHaveCount(4)
    // Die Festlegung des Spielers ist oeffentlich - genau eine Leiste ist markiert.
    await expect(page.locator('[data-answer][data-state="selected"]')).toHaveCount(1)
    // Ob sie stimmt, verraet die Buehne erst in der Loesungsszene.
    await expect(page.locator('[data-answer][data-state="correct"]')).toHaveCount(0)
  })

  test('der unscharfe Bildgrund blendet auf und traegt nie das vorige Bild', async ({ page }) => {
    /*
     * EIN `background-image` WECHSELT ERST, WENN DAS NEUE BILD DA IST. Direkt
     * gesetzt stuende auf einer neuen Frage deshalb einen Moment lang der Grund
     * der vorigen. Das Bild wird darum vorgeladen und der Grund erst fertig
     * gezeigt; bis dahin liegt dort nichts als der Verlauf der Buehne.
     */
    await selectScene(page, 'question')
    await selectQuestionType(page, 'image-choice')

    const grund = page.locator('[data-backdrop]')
    await expect(grund).toHaveAttribute('data-ready', 'true', { timeout: 10_000 })
    const bild = () => grund.evaluate((node) => getComputedStyle(node).backgroundImage)
    const ersteFrage = await bild()
    expect(ersteFrage).not.toBe('none')

    // Aufgeblendet, nicht eingesetzt - und ohne eine Beruehrung abzufangen.
    const stil = await grund.evaluate((node) => {
      const gemessen = getComputedStyle(node)
      return { eigenschaft: gemessen.transitionProperty, zeiger: gemessen.pointerEvents }
    })
    expect(stil.eigenschaft).toContain('opacity')
    expect(stil.zeiger).toBe('none')

    /*
     * Anderes Bild, andere Adresse: Der Grund traegt danach entweder noch
     * nichts oder schon das neue - nie das alte.
     */
    await selectQuestionType(page, 'person')
    await expect(grund).toHaveAttribute('data-ready', 'true', { timeout: 10_000 })
    expect(await bild()).not.toBe(ersteFrage)

    // Eine Frage ohne Bild hat auch keinen Grund.
    await selectQuestionType(page, 'text-choice')
    await expect(grund).toHaveCount(0)
  })

  test('Portraetfrage stellt das Bild neben Rubrik, Frage und Antworten', async ({ page }) => {
    await selectScene(page, 'question')
    await selectQuestionType(page, 'person')
    await expect(page.locator('[data-media][data-variant="portrait"] [data-media-image]')).toBeVisible()
    await expect(page.locator('[data-answer]')).toHaveCount(4)

    /*
     * Der Kern dieser Anordnung ist die Nebeneinanderstellung: Das Portraet steht
     * links, alles andere in einer Spalte rechts DANEBEN - nicht darunter wie bei
     * den uebrigen Bildfragen.
     */
    const portrait = await page.locator('[data-variant="portrait"]').boundingBox()
    const prompt = await page.locator('[data-prompt]').boundingBox()
    const answers = await page.locator('[data-answers]').boundingBox()
    expect(portrait && prompt && answers).toBeTruthy()
    expect(prompt!.x).toBeGreaterThanOrEqual(portrait!.x + portrait!.width)
    expect(answers!.x).toBeGreaterThanOrEqual(portrait!.x + portrait!.width)
    expect(answers!.y).toBeLessThan(portrait!.y + portrait!.height)
  })

  test('Bilderkennen zeigt ein verdecktes Bild und keinen Countdown', async ({ page }) => {
    await selectScene(page, 'reveal')
    await expect(page.locator('[data-media][data-variant="reveal"] [data-media-image]')).toBeVisible()
    // Das Bild ist vollstaendig da - was fehlt, ist der Blick darauf.
    await expect(page.locator('[data-reveal-tiles]')).toBeVisible()
    // Die Kacheln sind die Uhr; eine Zahl daneben gibt es nicht mehr.
    await expect(page.locator('[data-seconds]')).toHaveCount(0)
  })

  test('Videoszene zeigt die Videoflaeche', async ({ page }) => {
    await selectScene(page, 'video')
    await expect(page.locator('.stage[data-scene="video"]')).toBeVisible()
  })

  test('Feedbackszene zeigt Richtig und Falsch unterschiedlich', async ({ page }) => {
    await selectScene(page, 'feedback')
    await expect(page.locator('.stage[data-scene="feedback"] [data-outcome="correct"]')).toBeVisible()
    await expect(page.locator('[data-clip="correct"]')).toBeVisible()

    await page.locator('[data-preview-panel] select').nth(2).selectOption('incorrect')
    await expect(page.locator('.stage[data-scene="feedback"] [data-outcome="incorrect"]')).toBeVisible()
    await expect(page.locator('[data-clip="wrong"]')).toBeVisible()
    // Die Falsch-Animation darf die Loesung nicht vorwegnehmen.
    await expect(page.locator('[data-answer][data-state="correct"]')).toHaveCount(0)
  })

  test('Loesungsszene faerbt ausschliesslich die richtige Antwort', async ({ page }) => {
    await selectScene(page, 'solution')
    await expect(page.locator('[data-answer][data-state="correct"]')).toBeVisible()
    await expect(page.locator('[data-answer][data-state="correct"]')).toHaveCount(1)
    // Auch eine vorher gewaehlte falsche Antwort tritt hier zurueck.
    await expect(page.locator('[data-answer][data-state="selected"]')).toHaveCount(0)
  })

  test('Ergebnisszene zeigt Konfetti nur bei einem Gewinner', async ({ page }) => {
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
   * Geprueft wird der Mechanismus, nicht der Farbwert: Jeder Modus bringt seinen
   * eigenen, vollstaendigen Tokensatz mit. Derzeit tragen alle drei Modi dasselbe
   * Graustufensystem - die eigenen Farbsysteme fuer Kinder und Saarbruecken
   * werden nachgeliefert.
   */
  const DESIGN_TOKENS = [
    'pageTop', 'pageBottom', 'stageTop', 'stageBottom', 'controls',
    'tile', 'tileDisabled', 'tileQuiet', 'option',
    'accent', 'accentQuiet', 'primary', 'solution', 'solutionChip',
    'correct', 'incorrect', 'text', 'textMuted',
  ]

  test('jeder Modus setzt den vollstaendigen Tokensatz auf der Buehne', async ({ page }) => {
    await selectScene(page, 'question')

    // Es gibt genau zwei Gestaltungswelten - Saarbruecken benutzt die der Erwachsenen.
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

test.describe('Enthuellung: das Raster folgt dem Fortschritt des Servers', () => {
  test('die Kacheln folgen dem Fortschritt', async ({ page }) => {
    await selectScene(page, 'reveal')
    const slider = page.locator('[data-preview-panel] input[type="range"]')
    const tiles = page.locator('[data-reveal-tiles] [data-reveal-tile]')

    const offen = () => page.locator('[data-reveal-tile][data-open="true"]').count()

    // Die Rastergroesse steht in `revealGrid` - hier zaehlt nur, dass ALLE Kacheln da sind.
    const gesamt = await tiles.count()
    expect(gesamt).toBeGreaterThan(1)

    await slider.fill('0')
    // Zu Beginn ist das Bild vollstaendig verdeckt.
    expect(await offen()).toBe(0)

    // Halber Fortschritt, halbes Bild - dieselbe Variable wie im Server.
    await slider.fill('5000')
    expect(await offen()).toBe(Math.floor(gesamt / 2))

    // Bei null Sekunden ist nichts mehr verdeckt.
    await slider.fill('10000')
    expect(await offen()).toBe(gesamt)
  })

  test('einmal offene Kacheln bleiben offen', async ({ page }) => {
    await selectScene(page, 'reveal')
    const slider = page.locator('[data-preview-panel] input[type="range"]')
    const offeneIndizes = () =>
      page.locator('[data-reveal-tile]').evaluateAll((nodes) =>
        nodes.map((node, index) => (node.getAttribute('data-open') === 'true' ? index : -1)).filter((index) => index >= 0),
      )

    await slider.fill('3000')
    const frueh = await offeneIndizes()
    await slider.fill('7000')
    const spaet = await offeneIndizes()

    expect(frueh.length).toBeGreaterThan(0)
    expect(spaet.length).toBeGreaterThan(frueh.length)
    // Keine Kachel darf sich wieder schliessen: Der Vorrat waechst nur.
    expect(spaet).toEqual(expect.arrayContaining(frueh))
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
    await expect(page.locator('[data-preview-stage]')).toBeVisible()
    await selectScene(page, 'question')
    // Reduced-Motion-Fallback der Definition question-enter.
    expect(await readDuration()).toBe('140ms')

    await selectScene(page, 'result')
    await expect(page.locator('[data-confetti]')).toBeHidden()
  })
})

/*
 * Lange Fragen (Spezifikation 22.1).
 *
 * Der Fall aus dem Betrieb: Eine Frage ueber mehrere Zeilen schob die unteren
 * Antwortzeilen aus dem Bild. Im Saal fehlten dann schlicht die Antworten C und
 * D, und nichts daran sah nach einem Fehler aus.
 *
 * Gemessen wird die AUSSAGE - steht noch etwas ueber der Inhaltskante der Szene?
 * - und nicht eine bestimmte Schriftgroesse. Welche Groesse herauskommt, haengt
 * an Bild, Antwortlaenge und Zielformat; festzulegen waere sie nur eine zweite
 * Abschrift der Rechnung, die der Anpassung selbst zugrunde liegt.
 */
test.describe('Lange Fragen', () => {
  const VIEWPORTS = [
    { name: '1920x1080', width: 1920, height: 1080 },
    { name: '1280x720', width: 1280, height: 720 },
  ] as const

  /** Blendet die Bedienspalte aus - danach hat die Buehne die ganze Flaeche. */
  async function fullBleed(page: Page): Promise<void> {
    await page.addStyleTag({
      content:
        '[data-preview]{grid-template-columns:1fr !important}[data-preview-panel]{position:absolute;opacity:0;pointer-events:none}',
    })
  }

  /** Groesster Ueberstand ueber die Inhaltskante der Szene, in Pixeln. */
  async function overshoot(page: Page): Promise<number> {
    return await page.locator('[data-fit-box]').evaluate((box) => {
      const limit = box.getBoundingClientRect().bottom - Number.parseFloat(getComputedStyle(box).paddingBottom)
      let worst = 0
      for (const node of box.querySelectorAll('*')) {
        const position = getComputedStyle(node).position
        // Absolut gesetzte Teile stehen bewusst ueber der Kante - siehe Regiehinweis.
        if (position === 'absolute' || position === 'fixed') continue
        worst = Math.max(worst, node.getBoundingClientRect().bottom - limit)
      }
      return Math.round(worst)
    })
  }

  /*
   * Der Schalter wird ueber das DOM bedient, nicht ueber einen Klick: Nach
   * `fullBleed` nimmt die Bedienspalte keine Zeigereingaben mehr an, damit sie
   * die Buehnenflaeche nicht verdeckt.
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
    test(`Portraetfrage haelt alle vier Antworten im Bild - ${viewport.name}`, async ({ page }) => {
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

  test('verkleinert die Frage nur so weit wie noetig', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await selectScene(page, 'question')
    await selectQuestionType(page, 'person')
    await fullBleed(page)
    await page.waitForTimeout(400)

    // Eine kurze Frage passt ohnehin und bleibt deshalb in voller Groesse.
    const base = await promptSize(page)
    expect(base).toBeCloseTo(1920 * 0.028, 0)

    await toggleLongText(page)
    await page.waitForTimeout(400)
    const fitted = await promptSize(page)

    expect(fitted).toBeLessThan(base)
    // Und nicht ins Bodenlose: Unter der Untergrenze waere sie im Saal unlesbar.
    expect(fitted).toBeGreaterThanOrEqual(base * 0.55 - 1)
  })

  test('laesst die Frage gross, wenn das Verkleinern nichts bringt', async ({ page }) => {
    /*
     * Bei der Bildfrage tragen die langen ANTWORTEN den Ueberstand. Die Frage
     * kleiner zu setzen wuerde daran nichts aendern - eine winzige Frage UND ein
     * Ueberstand waeren zweimal schlecht.
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

  test('laesst eine kurze Frage in jeder Szene unangetastet', async ({ page }) => {
    /*
     * Die Gegenprobe zur Anpassung: Eine kurze Frage passt in jeder Szene und
     * muss deshalb ihre Grundgroesse behalten. Waere die Messung vom Einlauf der
     * Antwortzeilen abhaengig - die stehen waehrend der Animation tiefer als am
     * Ende -, bliebe die Frage danach zu klein, obwohl sie laengst passt.
     */
    await page.setViewportSize({ width: 1920, height: 1080 })
    await fullBleed(page)

    for (const scene of ['question', 'solution'] as const) {
      await selectScene(page, scene)
      await selectQuestionType(page, 'person')
      // Die Flaeche mitten im Einlauf aendern - im Betrieb der Sprung ins
      // Vollbild. Das stoesst eine zweite Messung an, waehrend die Zeilen noch
      // unterwegs sind.
      await page.setViewportSize({ width: 1900, height: 1080 })
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.waitForTimeout(600)
      expect(await promptSize(page), `Szene ${scene}`).toBeCloseTo(1920 * 0.028, 0)
    }
  })
})

test.describe('Screenshot-Regression zentraler Zustaende', () => {
  // Animationen werden fuer die Aufnahme abgeschaltet, damit die Bilder stabil sind.
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await expect(page.locator('[data-preview-stage]')).toBeVisible()
  })

  for (const scene of ['question', 'solution', 'result', 'pause'] as const) {
    test(`Szene ${scene}`, async ({ page }) => {
      await selectScene(page, scene)
      await page.waitForTimeout(300)
      await expect(page.locator('[data-preview-stage]')).toHaveScreenshot(`scene-${scene}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      })
    })
  }

  test('Szene question als Portraetfrage', async ({ page }) => {
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
 * Videoszene
 * ------------------------------------------------------------------ */

test.describe('Video', () => {
  /*
   * In der Vorschau des Operators laeuft kein zweites Medium - dort stand
   * bisher ein leeres Rechteck. Es sagte ihm, dass ein Video laeuft, aber nicht,
   * wann er wieder dran ist.
   */
  test('die Operatorvorschau zeigt die Restzeit statt eines leeren Rechtecks', async ({ page }) => {
    await page.goto('/preview')
    await page.locator('[data-preview-panel] select').first().selectOption('video')
    await page.locator('[data-preview-variant]').selectOption('preview')

    const uhr = page.locator('[data-video-clock]')
    await expect(uhr).toBeVisible()
    // 95 Sekunden Laufzeit, 12 davon gespielt.
    await expect(uhr).toContainText('1:2')
    await expect(uhr).toContainText('bis zur Frage', { ignoreCase: true })

    // Sie laeuft auch: nach zwei Sekunden steht eine andere Zahl da.
    const zuerst = await uhr.innerText()
    await page.waitForTimeout(2_200)
    expect(await uhr.innerText()).not.toBe(zuerst)
  })

  /*
   * Auf der Buehne hat sie nichts zu suchen: Dort laeuft das Bild, und eine
   * Uhr darueber waere ein Regiehinweis im Saal.
   */
  test('auf der Buehne steht keine Uhr', async ({ page }) => {
    await page.goto('/preview')
    await page.locator('[data-preview-panel] select').first().selectOption('video')
    await expect(page.locator('[data-video-placeholder]')).toBeVisible()
    await expect(page.locator('[data-video-clock]')).toHaveCount(0)
  })
})
