/**
 * Praesentationsverhalten im echten Betrieb (Spezifikation 22.7 und 23.4).
 *
 * Diese Tests laufen gegen den lokalen Server, weil sie genau das pruefen, was die
 * serverfreie Vorschau nicht abbilden kann: Doppelklicks, Reconnect waehrend einer
 * laufenden Animation und die Synchronitaet der Enthuellung ueber mehrere Clients.
 */
import { expect, test } from '@playwright/test'
import {
  buzz,
  continueGame,
  currentPhase,
  expectPhase,
  openOperator,
  openStage,
  playQuestionCorrect,
  resolveWithoutAnswer,
  startGame,
  startReveal,
  waitForQuestionReady,
} from './helpers.ts'

test('schneller Doppelklick auf "Weiter" ueberspringt keine Frage', async ({ page }) => {
  const operator = await openOperator(page)
  await startGame(operator)
  await resolveWithoutAnswer(operator)

  // Zwei Klicks im selben Tick - also bevor irgendein Snapshot eintreffen kann.
  // Der zweite Klick trifft eine veraltete Revision und darf keine zweite Frage
  // ueberspringen.
  await operator.evaluate(() => {
    const button = [...document.querySelectorAll<HTMLButtonElement>('.controls button')].find((entry) =>
      entry.textContent?.includes('Weiter zu'),
    )
    button?.click()
    button?.click()
  })

  await waitForQuestionReady(operator)
  await expect(operator.locator('.stage-header__progress .tile__value')).toContainText('2/7')
})

test('doppelte Bewertung bucht keine doppelten Punkte', async ({ page }) => {
  const operator = await openOperator(page)
  await startGame(operator)
  await operator.getByRole('button', { name: 'Antworten einblenden' }).click()
  await buzz(operator, 1)
  await expectPhase(operator, 'answer-locked')

  if (await operator.locator('.button--marks-correct').count()) {
    await operator.locator('.button--marks-correct').first().click()
  } else {
    await operator.getByRole('button', { name: 'Antwort war richtig' }).click()
  }

  // Doppelklick im selben Tick auf "Aufloesen und bewerten".
  await operator.evaluate(() => {
    const button = [...document.querySelectorAll<HTMLButtonElement>('.controls button')].find((entry) =>
      entry.textContent?.includes('Aufloesen und bewerten'),
    )
    button?.click()
    button?.click()
  })

  await expectPhase(operator, 'solution')
  const scores = await operator
    .locator('.score-tile')
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset['score'] ?? ''))
  expect(scores[0]).toBe('100')
})

test('Reconnect mitten in der Enthuellung zeigt den korrekten Serverstand', async ({ page }) => {
  const operator = await openOperator(page)
  const stage = await openStage(await page.context().newPage())
  await startGame(operator)

  // Bis zur Bilderkennen-Frage an Position 3 vorspielen.
  await resolveWithoutAnswer(operator)
  await continueGame(operator)
  await resolveWithoutAnswer(operator)
  await continueGame(operator)
  await expectPhase(operator, 'reveal-ready')
  await startReveal(operator)
  await expectPhase(operator, 'reveal-running')

  // Enthuellung anhalten, damit der erwartete Wert eindeutig ist.
  await operator.getByRole('button', { name: 'Enthuellung pausieren' }).click()
  await expectPhase(operator, 'reveal-paused')
  const beforeReload = await stage.locator('.reveal__seconds').textContent()

  // Der Buehnenclient verliert die Verbindung und verbindet neu.
  await stage.reload()
  await expect(stage.locator('.reveal__seconds')).toBeVisible()

  // Er uebernimmt sofort wieder den Serverstand, statt bei 10 neu zu starten.
  expect(await stage.locator('.reveal__seconds').textContent()).toBe(beforeReload)
  await expect(stage.locator('.reveal__countdown--paused')).toBeVisible()
})

test('ein neu verbundener Buehnenclient bekommt sofort den vollstaendigen Snapshot', async ({ page }) => {
  const operator = await openOperator(page)
  await startGame(operator)
  await playQuestionCorrect(operator, 1)

  // Erst jetzt wird der Buehnenscreen geoeffnet - er darf keine Ereignisse nachholen muessen.
  const stage = await openStage(await page.context().newPage())
  await expect(stage.locator('.solution__answer')).toBeVisible()
  await expect(stage.locator('.score-tile').first()).toHaveAttribute('data-score', '100')
})

test('das Praesentationsfenster kann geschlossen und neu geoeffnet werden', async ({ page }) => {
  const operator = await openOperator(page)
  const stage = await openStage(await page.context().newPage())
  await startGame(operator)
  await playQuestionCorrect(operator, 1)

  // Verlust des Praesentationsfensters beendet das Spiel nicht.
  await stage.close()
  await expect(operator.locator('.controls')).toBeVisible()
  expect(await currentPhase(operator)).toBe('solution')

  const reopened = await openStage(await page.context().newPage())
  await expect(reopened.locator('.solution__answer')).toBeVisible()
})

test('der Buehnenscreen erhaelt die Loesung erst in der Loesungsszene', async ({ page }) => {
  const operator = await openOperator(page)
  const stage = await openStage(await page.context().newPage())
  await startGame(operator)

  // Waehrend der Frage darf im gesamten DOM des Buehnenclients keine Loesung stehen.
  const privateAnswer = (await operator.locator('.private__answer').textContent()) ?? ''
  expect(privateAnswer.length).toBeGreaterThan(0)
  const stageHtml = await stage.content()
  expect(stageHtml).not.toContain('private__answer')

  await operator.getByRole('button', { name: 'Ohne Antwort aufloesen' }).click()
  await expect(stage.locator('.solution__answer .option-bar__text')).toHaveText(privateAnswer)
})
