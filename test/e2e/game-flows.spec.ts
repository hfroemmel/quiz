/**
 * Vollstaendige Spiele als End-to-End-Test (Spezifikation 31.4).
 *
 * Jeder Test bedient ausschliesslich die Oberflaeche - kein Eingriff in Daten oder
 * DevTools. Damit belegen sie zugleich das Abnahmekriterium "Ein vollstaendiges Spiel
 * mit sieben Fragen kann ohne manuellen Eingriff durchgefuehrt werden".
 */
import { expect, test } from '@playwright/test'
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
      await expect(operator.locator('.stage-header__progress .tile__value')).toContainText(`${index}/7`)
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
    await expect(operator.locator('.scene__hint')).toContainText('50 Punkte')

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
    await expect(stage.locator('.solution__answer')).toBeVisible()
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
    await expect(stage.locator('.result__label')).toHaveText('Unentschieden')
    await expect(stage.locator('.confetti')).toHaveCount(0)
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
    await expect(stage.locator('.result__label')).toHaveText('Gewinner')
    await expect(stage.locator('.confetti')).toHaveCount(1)

    // Korrektur zugunsten von Spieler 2 - danach Unentschieden.
    // Schrittweite ist `scoringRules.manualAdjustmentStep` = 50 Punkte.
    await operator.getByLabel('Spieler 2 plus 50').click()
    await operator.getByLabel('Spieler 2 plus 50').click()
    await expect(stage.locator('.result__label')).toHaveText('Unentschieden')
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

    operator.once('dialog', (dialog) => void dialog.accept())
    await operator.getByRole('button', { name: 'Beenden' }).click()

    await expect(operator.locator('.start-panel')).toBeVisible()
    await expect(stage.locator('.scene--start')).toBeVisible()
    await expect(stage.locator('.result__label')).toHaveCount(0)
  })

  test('Abbruch kann abgelehnt werden und das Spiel laeuft weiter', async ({ page }) => {
    const operator = await openOperator(page)
    await startGame(operator)

    operator.once('dialog', (dialog) => void dialog.dismiss())
    await operator.getByRole('button', { name: 'Beenden' }).click()
    await expect(operator.locator('.controls')).toBeVisible()
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
    await expect(stage.locator('.reveal__seconds')).toBeVisible()

    // Enthuellung pausieren: der Countdown bleibt stehen.
    await operator.getByRole('button', { name: 'Enthuellung pausieren' }).click()
    await expectPhase(operator, 'reveal-paused')
    const frozen = await stage.locator('.reveal__seconds').textContent()
    await page.waitForTimeout(1_200)
    expect(await stage.locator('.reveal__seconds').textContent()).toBe(frozen)

    await operator.getByRole('button', { name: 'Enthuellung fortsetzen' }).click()
    await expectPhase(operator, 'reveal-running')

    // Drei Fehlversuche - beide Spieler duerfen jedes Mal erneut buzzern.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await buzz(operator, attempt % 2 === 0 ? 1 : 2)
      await expectPhase(operator, 'answer-locked')
      await operator.getByRole('button', { name: 'Antwort war falsch' }).click()
      await resolveAttempt(operator)
      await expectPhase(operator, 'reveal-running')
      // Die Loesung bleibt verborgen.
      await expect(stage.locator('.solution__answer')).toHaveCount(0)
    }
    expect(await scores(operator)).toEqual([0, 0])

    // Richtige Antwort nach Fehlversuchen: 50 Punkte.
    await buzz(operator, 2)
    await operator.getByRole('button', { name: 'Antwort war richtig' }).click()
    await resolveAttempt(operator)
    await expectPhase(operator, 'solution')
    expect(await scores(operator)).toEqual([0, 50])
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
    await operator.getByRole('button', { name: 'Bild vollstaendig aufdecken' }).click()
    await expect(stage.locator('.reveal__seconds')).toHaveText('0')

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
    await expect(moderator.locator('.moderator__actions')).toBeVisible()

    await startGame(operator)
    await expect(moderator.locator('.moderator__hint')).toContainText('Antworten einblenden')

    // Der Moderator sieht die Loesung privat, der Buehnenscreen nicht.
    await expect(moderator.locator('.moderator__answer')).toBeVisible()

    // Der Moderator gibt die Runde frei - der Operator sieht die Aenderung sofort.
    await moderator.getByRole('button', { name: 'Antworten einblenden' }).click()
    await expectPhase(operator, 'buzzer-open')

    // Zwei gleichzeitige Klicks duerfen nicht zwei Wirkungen haben.
    await buzz(operator, 1)
    await expectPhase(operator, 'answer-locked')
    await buzz(operator, 2)
    await expectPhase(operator, 'answer-locked')
    await expect(operator.locator('.banner--error')).toBeVisible()

    // Der Moderator darf keine Punkte aendern - der Button existiert dort gar nicht.
    await expect(moderator.getByLabel('Spieler 1 plus 50')).toHaveCount(0)
  })
})
