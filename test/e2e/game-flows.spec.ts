/**
 * Vollstaendige Spiele als End-to-End-Test (Spezifikation 31.4).
 *
 * Jeder Test bedient ausschliesslich die Oberflaeche - kein Eingriff in Daten oder
 * DevTools. Damit belegen sie zugleich das Abnahmekriterium "Ein vollstaendiges Spiel
 * mit sieben Fragen kann ohne manuellen Eingriff durchgefuehrt werden".
 */
import { expect, test, type Page } from '@playwright/test'
import {
  buzz,
  continueGame,
  currentPhase,
  expectPhase,
  logCorrectOption,
  logIncorrectOption,
  markCorrect,
  markIncorrect,
  openOperator,
  openStage,
  playQuestionCorrect,
  prepareAnswerPhase,
  resolveAttempt,
  resolveWithoutAnswer,
  scores,
  sessionCode,
  startGame,
  startReveal,
} from './helpers.ts'

test.describe('Vollstaendige Spielablaeufe', () => {
  test('1 - sieben richtige Erstantworten fuehren zum Ergebnis', async ({ page }) => {
    const operator = await openOperator(page)
    await startGame(operator)

    for (let index = 1; index <= 7; index += 1) {
      await expect(operator.locator('[data-counter-value]')).toContainText(`${index}/7`)
      await playQuestionCorrect(operator, 1)
      await continueGame(operator)
    }

    await expectPhase(operator, 'result')
    expect(await scores(operator)).toEqual([700, 0])
  })

  test('2 - erste Antwort falsch, zweite Chance richtig gibt 50 Punkte', async ({ page }) => {
    const operator = await openOperator(page)
    await startGame(operator)
    await prepareAnswerPhase(operator)

    await buzz(operator, 1)
    await expectPhase(operator, 'answer-locked')
    await markIncorrect(operator)
    await resolveAttempt(operator)

    // Nach dem ersten Fehlversuch folgt die zweite Chance - nicht die Loesung.
    await expectPhase(operator, 'second-chance')
    // Der Punktwert steht oeffentlich auf der Buehne, nicht mehr in einer
    // Anweisungszeile der Bedienleiste.
    await expect(operator.locator('[data-hint]')).toContainText('50 Punkte')

    await markCorrect(operator)
    await resolveAttempt(operator)
    await expectPhase(operator, 'solution')
    expect(await scores(operator)).toEqual([0, 50])
  })

  test('3 - beide Antworten falsch geben keine Punkte und keinen Abzug', async ({ page }) => {
    const operator = await openOperator(page)
    await startGame(operator)
    await prepareAnswerPhase(operator)

    await buzz(operator, 2)
    await markIncorrect(operator)
    await resolveAttempt(operator)
    await expectPhase(operator, 'second-chance')

    await markIncorrect(operator)
    await resolveAttempt(operator)
    await expectPhase(operator, 'solution')
    expect(await scores(operator)).toEqual([0, 0])
  })

  test('4 - Aufloesen ohne Buzzer ist jederzeit moeglich', async ({ page }) => {
    const operator = await openOperator(page)
    const stage = await openStage(await page.context().newPage())
    await startGame(operator)

    // Es gibt keine verbindliche Wartezeit vor dem Aufloesen.
    await resolveWithoutAnswer(operator)
    expect(await scores(operator)).toEqual([0, 0])
    await expect(stage.locator('[data-answer][data-state="correct"]')).toBeVisible()
  })

  test('8 - Punktgleichstand ergibt Unentschieden ohne Konfetti', async ({ page }) => {
    const operator = await openOperator(page)
    const stage = await openStage(await page.context().newPage())
    await startGame(operator)

    // Zwei richtige Antworten je Spieler, danach neutrale Fragen.
    await playQuestionCorrect(operator, 1)
    await continueGame(operator)
    await playQuestionCorrect(operator, 2)
    await continueGame(operator)
    for (let index = 3; index <= 7; index += 1) {
      await resolveWithoutAnswer(operator)
      await continueGame(operator)
    }

    await expectPhase(operator, 'result')
    expect(await scores(operator)).toEqual([100, 100])
    await expect(stage.locator('[data-result-label]')).toHaveText('Unentschieden')
    await expect(stage.locator('[data-confetti]')).toHaveCount(0)
  })

  test('9 - manuelle Korrektur auf der Ergebnisansicht rechnet das Ergebnis neu', async ({ page }) => {
    const operator = await openOperator(page)
    const stage = await openStage(await page.context().newPage())
    await startGame(operator)

    await playQuestionCorrect(operator, 1)
    await continueGame(operator)
    for (let index = 2; index <= 7; index += 1) {
      await resolveWithoutAnswer(operator)
      await continueGame(operator)
    }
    await expectPhase(operator, 'result')
    await expect(stage.locator('[data-result-label]')).toHaveText('Gewinner')
    await expect(stage.locator('[data-confetti]')).toHaveCount(1)

    // Korrektur zugunsten von Spieler 2 - danach Unentschieden.
    // Schrittweite ist `scoringRules.manualAdjustmentStep` = 50 Punkte.
    await operator.getByLabel('Spieler 2 plus 50').click()
    await operator.getByLabel('Spieler 2 plus 50').click()
    await expect(stage.locator('[data-result-label]')).toHaveText('Unentschieden')
    expect(await scores(operator)).toEqual([100, 100])

    // Der Punktestand faellt nicht unter null.
    await operator.getByLabel('Spieler 2 minus 50').click()
    await operator.getByLabel('Spieler 2 minus 50').click()
    await operator.getByLabel('Spieler 2 minus 50').click()
    expect((await scores(operator))[1]).toBe(0)
  })

  test('10 - Spielabbruch nach Bestaetigung zeigt kein Ergebnis', async ({ page }) => {
    const operator = await openOperator(page)
    const stage = await openStage(await page.context().newPage())
    await startGame(operator)
    await playQuestionCorrect(operator, 1)

    await operator.getByRole('button', { name: 'Beenden' }).click()
    // Die Rueckfrage ist ein Dialog der Anwendung, kein Browserfenster.
    await expect(operator.locator('[data-dialog]')).toBeVisible()
    await operator.locator('[data-dialog]').getByRole('button', { name: 'Spiel beenden' }).click()

    await expect(operator.locator('[data-start-panel]')).toBeVisible()
    await expect(stage.locator('.stage[data-scene="start"]')).toBeVisible()
    await expect(stage.locator('[data-result-label]')).toHaveCount(0)
  })

  test('Abbruch kann abgelehnt werden und das Spiel laeuft weiter', async ({ page }) => {
    const operator = await openOperator(page)
    await startGame(operator)

    await operator.getByRole('button', { name: 'Beenden' }).click()
    await operator.locator('[data-dialog]').getByRole('button', { name: 'Abbrechen' }).click()
    await expect(operator.locator('[data-dialog]')).toHaveCount(0)
    await expect(operator.locator('[data-controls]')).toBeVisible()
  })
})

test.describe('Bilderkennen', () => {
  test('5 - Pause, mehrere Fehlversuche und spaeter richtige Antwort', async ({ page }) => {
    const operator = await openOperator(page)
    const stage = await openStage(await page.context().newPage())
    // Das Preset "medium" hat den Bilderkennen-Platz an Position 3.
    await startGame(operator)
    await resolveWithoutAnswer(operator)
    await continueGame(operator)
    await resolveWithoutAnswer(operator)
    await continueGame(operator)

    // Das Bild steht zunaechst unscharf, damit der Moderator vorlesen kann.
    await expectPhase(operator, 'reveal-ready')
    await startReveal(operator)
    await expectPhase(operator, 'reveal-running')
    await expect(stage.locator('[data-seconds]')).toBeVisible()

    // Enthuellung pausieren: der Countdown bleibt stehen.
    await operator.getByRole('button', { name: 'Enthüllung pausieren' }).click()
    await expectPhase(operator, 'reveal-paused')
    const frozen = await stage.locator('[data-seconds]').textContent()
    await page.waitForTimeout(1_200)
    expect(await stage.locator('[data-seconds]').textContent()).toBe(frozen)

    await operator.getByRole('button', { name: 'Enthüllung fortsetzen' }).click()
    await expectPhase(operator, 'reveal-running')

    // Drei Fehlversuche - beide Spieler duerfen jedes Mal erneut buzzern.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await buzz(operator, attempt % 2 === 0 ? 1 : 2)
      await expectPhase(operator, 'answer-locked')
      await operator.getByRole('button', { name: 'Antwort war falsch' }).click()
      await resolveAttempt(operator)
      await expectPhase(operator, 'reveal-running')
      // Die Loesung bleibt verborgen.
      await expect(stage.locator('[data-answer][data-state="correct"]')).toHaveCount(0)
    }
    expect(await scores(operator)).toEqual([0, 0])

    // Richtige Antwort nach Fehlversuchen: 50 Punkte.
    await buzz(operator, 2)
    await operator.getByRole('button', { name: 'Antwort war richtig' }).click()
    await resolveAttempt(operator)
    await expectPhase(operator, 'solution')
    expect(await scores(operator)).toEqual([0, 50])
  })

  /*
   * Fall 7 der Spezifikation. Er stand lange aus, weil kein freigegebenes
   * Videomaterial im Repository lag; seit der Testdatei laesst er sich fahren.
   *
   * Der Buzzer ist waehrend des Videos gesperrt - das ist die eigentliche Regel
   * dieses Fragetyps und wird hier zuerst geprueft.
   *
   * Geprueft wird der ABLAUF, nicht die Wiedergabe: Das mitgelieferte Chromium
   * der Testumgebung kennt H.264 und AAC nicht (`canPlayType` liefert leer) und
   * zeigt deshalb "Video nicht verfuegbar". Im ausgelieferten Browser und in der
   * Desktopanwendung spielt dieselbe Datei. Genau dafuer gibt es die
   * Fehlerbehandlung, die der Ablauf hier mit durchlaeuft.
   */
  test('7 - Videofrage mit Springen, danach Buzzer und richtige Antwort', async ({ page }) => {
    const operator = await openOperator(page)
    await startGame(operator, { holdVideoIntro: true })
    await expectPhase(operator, 'video-ready')

    await operator.getByRole('button', { name: 'Video starten' }).click()
    await expectPhase(operator, 'video-playing')

    // Waehrend das Video laeuft, darf kein Buzzer durchkommen.
    await buzz(operator, 1)
    await expectPhase(operator, 'video-playing')

    // Pausieren fuehrt zurueck in die Bereitschaft - eine eigene Pausenphase gibt es nicht.
    await operator.getByRole('button', { name: 'Video pausieren' }).click()
    await expectPhase(operator, 'video-ready')

    /*
     * Springen im Video. Der Regler reicht bis zu der Laufzeit, die der
     * Buehnenclient gemeldet hat - ohne sie nur bis zur bereits erreichten Stelle
     * bzw. eine Sekunde. In dieser Testumgebung laesst sich die Datei nicht
     * dekodieren, es gibt also keine Laufzeit; geprueft wird deshalb, dass der
     * Befehl ankommt und der Server die Position uebernimmt. Dass die gemeldete
     * Laufzeit wirklich beim Operator ankommt, haelt
     * `packages/runtime/test/service.test.ts` fest.
     */
    const seek = operator.locator('[data-controls] input[type="range"]')
    await seek.fill('1000')
    await expect(seek).toHaveValue('1000')

    await operator.getByRole('button', { name: 'Frage einblenden' }).click()
    await expectPhase(operator, 'question-presented')

    // Ab hier ist es eine gewoehnliche Auswahlfrage - zweite Phase derselben Frage.
    await operator.getByRole('button', { name: 'Antworten einblenden' }).click()
    await buzz(operator, 2)
    await expectPhase(operator, 'answer-locked')
    await logCorrectOption(operator)
    await resolveAttempt(operator)
    await expectPhase(operator, 'solution')
    expect(await scores(operator)).toEqual([0, 100])

    /*
     * Die beiden Testfragen stehen bewusst an erster und zweiter Stelle jedes
     * Presets, damit sie sich ohne Durchspielen pruefen lassen. Faellt diese
     * Reihenfolge aus der Konfiguration, faellt es hier auf.
     */
    await continueGame(operator)
    await expect(operator.locator('[data-counter-value]')).toContainText('2/7')
    await expect(operator.locator('.stage').first()).toHaveAttribute('data-presentation', 'person')
  })

  /*
   * Die Fragenkorrektur hat KEIN Feld fuer den Grund mehr. Es stand mitten im
   * Formular, blieb in der Praxis leer, und was sich geaendert hat, steht ohnehin
   * im Protokoll. Der Test haelt die Entfernung fest, damit sie nicht beim
   * naechsten Ausbau des Formulars zurueckkommt.
   */
  test('die Fragenkorrektur fragt nicht nach einem Grund', async ({ page }) => {
    const operator = await openOperator(page)
    await startGame(operator)

    await operator.getByRole('button', { name: 'Fehlerhafte Frage korrigieren' }).click()
    await expect(operator.getByText('Fragetext')).toBeVisible()
    await expect(operator.getByText('Grund')).toHaveCount(0)
  })

  /*
   * Der Platzhalter steht in BEIDEN Ansichten und in derselben Form; abgespielt
   * wird nur auf der Buehne.
   *
   * Ein zweites Medium in der Operatorvorschau liefe auf demselben Rechner mit,
   * ginge unweigerlich auseinander und meldete jeden Ladefehler ein zweites Mal.
   * Was der Operator hier braucht, ist die Komposition - gefahren wird das Video
   * ueber seine Bedienleiste, und was der Saal sieht, steht auf der Buehne.
   *
   * Dieser Test ist bewusst von Fall 7 getrennt: Sobald eine Buehne offen ist,
   * meldet sie in dieser Testumgebung den Dekodierfehler, und der Server setzt
   * das Video zurueck. Der Ablauf laesst sich dann nicht mehr fahren - die
   * Aufteilung der Flaechen dagegen schon.
   */
  test('das Video laeuft nur auf der Buehne, der Operator sieht den Platzhalter', async ({ page }) => {
    const operator = await openOperator(page)
    const stage = await openStage(await page.context().newPage())
    await startGame(operator, { holdVideoIntro: true })
    await expectPhase(operator, 'video-ready')

    await expect(stage.locator('[data-video-placeholder]')).toBeVisible()
    await expect(operator.locator('[data-video-placeholder]')).toBeVisible()
    await expect(stage.locator('video')).toHaveCount(1)
    await expect(operator.locator('video')).toHaveCount(0)

    // Dieselbe Form in beiden Ansichten - nur in unterschiedlicher Groesse.
    const shape = async (target: Page) => {
      const box = await target.locator('[data-video-placeholder]').boundingBox()
      return Number((box!.width / box!.height).toFixed(2))
    }
    expect(await shape(stage)).toBe(await shape(operator))
  })

  test('6 - nach Ablauf des Countdowns bleibt Buzzern erlaubt', async ({ page }) => {
    const operator = await openOperator(page)
    const stage = await openStage(await page.context().newPage())
    await startGame(operator)
    await resolveWithoutAnswer(operator)
    await continueGame(operator)
    await resolveWithoutAnswer(operator)
    await continueGame(operator)
    await expectPhase(operator, 'reveal-ready')
    await startReveal(operator)
    await expectPhase(operator, 'reveal-running')

    // Statt zehn Sekunden zu warten: vollstaendig aufdecken. Der Buzzer bleibt offen.
    await operator.getByRole('button', { name: 'Bild vollständig aufdecken' }).click()
    await expect(stage.locator('[data-seconds]')).toHaveText('0')

    await buzz(operator, 1)
    await expectPhase(operator, 'answer-locked')
    await operator.getByRole('button', { name: 'Antwort war richtig' }).click()
    await resolveAttempt(operator)
    // Ohne vorherigen Fehlversuch gibt es die vollen 100 Punkte.
    expect(await scores(operator)).toEqual([100, 0])
  })
})

test.describe('Moderator und Operator gleichzeitig', () => {
  test('12 - der zuerst angenommene Befehl gewinnt, der zweite wird erklaert abgewiesen', async ({ page }) => {
    const operator = await openOperator(page)
    const code = await sessionCode(operator)

    const moderator = await page.context().newPage()
    await moderator.addInitScript(
      (value) => window.localStorage.setItem('quiz.moderator.session-code', value),
      code,
    )
    await moderator.goto('/moderator')
    await expect(moderator.locator('[data-moderator-actions]')).toBeVisible()

    await startGame(operator)
    await expect(moderator.locator('[data-moderator-hint]')).toContainText('Antworten einblenden')

    // Der Moderator sieht die Loesung privat, der Buehnenscreen nicht.
    await expect(moderator.locator('[data-moderator-answer]')).toBeVisible()

    // Der Moderator gibt die Runde frei - der Operator sieht die Aenderung sofort.
    await moderator.getByRole('button', { name: 'Antworten einblenden' }).click()
    await expectPhase(operator, 'buzzer-open')

    // Zwei gleichzeitige Klicks duerfen nicht zwei Wirkungen haben.
    await buzz(operator, 1)
    await expectPhase(operator, 'answer-locked')
    await buzz(operator, 2)
    await expectPhase(operator, 'answer-locked')
    await expect(operator.locator('[data-banner="error"]')).toBeVisible()

    // Der Moderator darf keine Punkte aendern - der Button existiert dort gar nicht.
    await expect(moderator.getByLabel('Spieler 1 plus 50')).toHaveCount(0)
  })
})
