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
    const button = [...document.querySelectorAll<HTMLButtonElement>('[data-controls] button')].find((entry) =>
      entry.textContent?.includes('Weiter zu'),
    )
    button?.click()
    button?.click()
  })

  await waitForQuestionReady(operator)
  await expect(operator.locator('[data-counter-value]')).toContainText('2/7')
})

test('doppelte Bewertung bucht keine doppelten Punkte', async ({ page }) => {
  const operator = await openOperator(page)
  await startGame(operator)
  await operator.getByRole('button', { name: 'Antworten einblenden' }).click()
  await buzz(operator, 1)
  await expectPhase(operator, 'answer-locked')

  if (await operator.locator('[data-marks-correct]').count()) {
    await operator.locator('[data-marks-correct]').first().click()
  } else {
    await operator.getByRole('button', { name: 'Antwort war richtig' }).click()
  }

  /*
   * Erst warten, bis die eingeloggte Antwort vom Server zurueck ist: Vorher ist
   * "Auflösen und bewerten" bewusst deaktiviert, und ein Klick darauf ginge ins
   * Leere - der Test wuerde dann nicht den Doppelklick pruefen, sondern das
   * Timing der Verbindung.
   */
  await expect(operator.getByRole('button', { name: 'Auflösen und bewerten' })).toBeEnabled()

  // Doppelklick im selben Tick auf "Aufloesen und bewerten".
  await operator.evaluate(() => {
    const button = [...document.querySelectorAll<HTMLButtonElement>('[data-controls] button')].find((entry) =>
      entry.textContent?.includes('Auflösen und bewerten'),
    )
    button?.click()
    button?.click()
  })

  await expectPhase(operator, 'solution')
  const scores = await operator
    .locator('[data-score]')
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
  await operator.getByRole('button', { name: 'Enthüllung pausieren' }).click()
  await expectPhase(operator, 'reveal-paused')
  const beforeReload = await stage.locator('[data-seconds]').textContent()

  // Der Buehnenclient verliert die Verbindung und verbindet neu.
  await stage.reload()
  await expect(stage.locator('[data-seconds]')).toBeVisible()

  // Er uebernimmt sofort wieder den Serverstand, statt bei 10 neu zu starten.
  expect(await stage.locator('[data-seconds]').textContent()).toBe(beforeReload)
  await expect(stage.locator('[data-countdown][data-paused="true"]')).toBeVisible()
})

test('ein neu verbundener Buehnenclient bekommt sofort den vollstaendigen Snapshot', async ({ page }) => {
  const operator = await openOperator(page)
  await startGame(operator)
  await playQuestionCorrect(operator, 1)

  // Erst jetzt wird der Buehnenscreen geoeffnet - er darf keine Ereignisse nachholen muessen.
  const stage = await openStage(await page.context().newPage())
  await expect(stage.locator('[data-answer][data-state="correct"]')).toBeVisible()
  await expect(stage.locator('[data-score]').first()).toHaveAttribute('data-score', '100')
})

test('das Praesentationsfenster kann geschlossen und neu geoeffnet werden', async ({ page }) => {
  const operator = await openOperator(page)
  const stage = await openStage(await page.context().newPage())
  await startGame(operator)
  await playQuestionCorrect(operator, 1)

  // Verlust des Praesentationsfensters beendet das Spiel nicht.
  await stage.close()
  await expect(operator.locator('[data-controls]')).toBeVisible()
  expect(await currentPhase(operator)).toBe('solution')

  const reopened = await openStage(await page.context().newPage())
  await expect(reopened.locator('[data-answer][data-state="correct"]')).toBeVisible()
})

test('der Buehnenscreen erhaelt die Loesung erst in der Loesungsszene', async ({ page }) => {
  const operator = await openOperator(page)
  const stage = await openStage(await page.context().newPage())
  await startGame(operator)

  // Waehrend der Frage darf im gesamten DOM des Buehnenclients keine Loesung stehen.
  const privateAnswer = (await operator.locator('[data-private-answer]').textContent()) ?? ''
  expect(privateAnswer.length).toBeGreaterThan(0)
  const stageHtml = await stage.content()
  expect(stageHtml).not.toContain('private__answer')

  await operator.getByRole('button', { name: 'Ohne Antwort auflösen' }).click()
  await expect(stage.locator('[data-answer][data-state="correct"] [data-answer-text]')).toHaveText(privateAnswer)
})

/*
 * Die Tonhoheit folgt nicht der Rolle, sondern der Freigabe.
 *
 * Der Fall aus dem Betrieb: Buehne und Operator liefen im Browser, den Ton hatte
 * die Buehne - und weil in DEREN Fenster nie jemand klickt, verweigerte der
 * Browser dort jede Wiedergabe. Die Veranstaltung blieb still, ohne dass
 * irgendwo ein Fehler zu sehen war. Seitdem bekommt die Buehne den Ton erst,
 * wenn sie gemeldet hat, dass sie ihn ueberhaupt ausgeben darf.
 */
test('die Tonhoheit geht an das Fenster, das wirklich klingen darf', async ({ page }) => {
  const operator = await openOperator(page)
  const audioState = operator.locator('[data-diagnostics-facts] [data-audio-master]')
  await operator.locator('[data-diagnostics-summary]').click()

  // Allein im Betrieb - sonst gaebe es ueberhaupt keinen Ton.
  await expect(audioState).toHaveAttribute('data-audio-master', 'true')

  // Ein blosses Buehnenfenster genuegt nicht: Dort wurde noch nicht geklickt.
  const stage = await openStage(await page.context().newPage())
  await expect(audioState).toHaveAttribute('data-audio-master', 'true')

  // Nach dem ersten Klick in der Buehne gehoert ihr der Ton. Es klingt immer nur ein Client.
  await stage.locator('body').click({ position: { x: 5, y: 5 } })
  await expect(audioState).toHaveAttribute('data-audio-master', 'false')

  // Faellt die Buehne weg, uebernimmt der Operator wieder.
  await stage.close()
  await expect(audioState).toHaveAttribute('data-audio-master', 'true')
})

test('das Spielprotokoll zaehlt gespielte Spiele und laesst sich zuruecksetzen', async ({ page }) => {
  const operator = await openOperator(page)
  await startGame(operator)

  await operator.getByRole('button', { name: 'Spielprotokoll' }).click()
  const dialog = operator.locator('[data-dialog]')
  await expect(dialog).toBeVisible()

  // Jeder konfigurierte Modus steht in der Tabelle, auch ohne Spiel.
  const rows = dialog.locator('[data-game-log] tbody tr')
  expect(await rows.count()).toBeGreaterThan(1)
  const adults = rows.filter({ hasText: 'Erwachsene' })
  expect(Number(await adults.locator('td').nth(1).textContent())).toBeGreaterThan(0)

  // Zuruecksetzen ist zweistufig - in derselben Flaeche, ohne zweites Popup.
  await dialog.getByRole('button', { name: 'Protokoll zurücksetzen' }).click()
  await dialog.getByRole('button', { name: 'Wirklich zurücksetzen' }).click()
  await expect(adults.locator('td').nth(1)).toHaveText('0')

  await dialog.getByRole('button', { name: 'Schließen' }).click()
  await expect(operator.locator('[data-dialog]')).toHaveCount(0)
})
