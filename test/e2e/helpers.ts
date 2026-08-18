/**
 * Bedienhilfen fuer die End-to-End-Tests.
 *
 * Die Tests bedienen die Anwendung so, wie der Operator es tut: ueber sichtbare
 * Beschriftungen und die Buzzer-Tasten `A`/`B`. Es wird bewusst nirgends in den
 * Zustand oder in DevTools eingegriffen (Abnahmekriterium Spezifikation 32).
 */
import { expect, type Page } from '@playwright/test'

export async function openOperator(page: Page): Promise<Page> {
  await page.goto('/operator')
  await expect(page.locator('.operator')).toBeVisible()
  return page
}

export async function openStage(page: Page): Promise<Page> {
  await page.goto('/stage')
  await expect(page.locator('.stage')).toBeVisible()
  return page
}

/**
 * Bringt den Operator zurueck auf die Startansicht.
 *
 * Die Tests teilen sich einen laufenden Server - genau wie an einem echten
 * Veranstaltungsabend, an dem viele Spiele hintereinander laufen. Deshalb wird vor
 * jedem Spiel derselbe Weg gegangen, den auch der Operator nimmt.
 */
export async function resetToStartPanel(operator: Page): Promise<void> {
  if (await operator.locator('.start-panel').count()) return

  const backToStart = operator.getByRole('button', { name: 'Zurueck zur Startansicht' })
  if (await backToStart.count()) {
    await backToStart.click()
    await expect(operator.locator('.start-panel')).toBeVisible()
    return
  }

  const abort = operator.getByRole('button', { name: 'Beenden' })
  if (await abort.count()) {
    operator.once('dialog', (dialog) => void dialog.accept())
    await abort.click()
    await expect(operator.locator('.start-panel')).toBeVisible()
  }
}

export async function startGame(operator: Page, options: { mode?: string; preset?: string } = {}): Promise<void> {
  await resetToStartPanel(operator)
  await expect(operator.locator('.start-panel')).toBeVisible()
  const selects = operator.locator('.start-panel__form select')
  await selects.nth(0).selectOption(options.mode ?? 'adults')
  await selects.nth(1).selectOption(options.preset ?? 'medium')
  await operator.getByRole('button', { name: 'Spiel starten' }).click()
  // Der Pausenscreen laeuft kurz, danach steht die erste Frage.
  await expect(operator.locator('.controls')).toBeVisible()
  await waitForQuestionReady(operator)
}

export async function currentPhase(page: Page): Promise<string> {
  return (await page.locator('.stage').first().getAttribute('data-phase')) ?? ''
}

export async function currentScene(page: Page): Promise<string> {
  return (await page.locator('.stage').first().getAttribute('data-scene')) ?? ''
}

export async function expectPhase(page: Page, phase: string): Promise<void> {
  await expect(page.locator('.stage').first()).toHaveAttribute('data-phase', phase)
}

/**
 * Wartet, bis der Pausenscreen durchgelaufen ist und die naechste Frage wirklich steht.
 *
 * Der Pausenscreen ist eine eigene, zeitgesteuerte Praesentationsphase. Wer direkt
 * nach `Weiter` weiterbedient, wuerde sonst gegen eine Phase arbeiten, in der es die
 * erwartete Aktion noch gar nicht gibt.
 */
export async function waitForQuestionReady(page: Page): Promise<void> {
  await expect.poll(async () => currentPhase(page), { timeout: 15_000 }).not.toBe('pause-screen')
}

/**
 * Buzzer-Hardware: Taste `A` = Spieler 1, Taste `B` = Spieler 2.
 *
 * `bringToFront` bildet die Realitaet ab: Die Buzzer haengen am Operatorlaptop und
 * senden ihre Tastendruecke an das Fenster im Vordergrund.
 */
export async function buzz(operator: Page, player: 1 | 2): Promise<void> {
  await operator.bringToFront()
  await operator.keyboard.press(player === 1 ? 'a' : 'b')
}

/** Loggt die richtige Antwort ein - im Operatorfenster als "richtig" markiert. */
export async function logCorrectOption(operator: Page): Promise<void> {
  await operator.locator('.button--marks-correct').first().click()
}

export async function logIncorrectOption(operator: Page): Promise<void> {
  await operator.locator('.controls__row--options .button--option:not(.button--marks-correct)').first().click()
}

export async function resolveAttempt(operator: Page): Promise<void> {
  await operator.getByRole('button', { name: 'Aufloesen und bewerten' }).click()
}

/**
 * `Weiter` - bei nicht letzter Frage zur naechsten Frage, bei letzter zum Ergebnis.
 * Der Button benennt beides unterschiedlich, deshalb wird hier auf beide Varianten
 * gewartet.
 */
export async function continueGame(operator: Page): Promise<void> {
  await operator.locator('.controls button:has-text("Weiter zu")').click()
  // Nach der letzten Frage folgt die Ergebnisansicht, sonst der Pausenscreen.
  if ((await currentPhase(operator)) !== 'result') await waitForQuestionReady(operator)
}

export async function scores(operator: Page): Promise<number[]> {
  const values = await operator.locator('.operator__score-value').allTextContents()
  return values.map((value) => Number(value))
}

/** Bringt eine Frage in eine Phase, in der geantwortet werden kann. */
export async function prepareAnswerPhase(operator: Page): Promise<void> {
  await waitForQuestionReady(operator)
  if ((await currentPhase(operator)) === 'video-ready' || (await currentPhase(operator)) === 'video-playing') {
    await operator.getByRole('button', { name: 'Frage einblenden' }).click()
  }
  if ((await currentPhase(operator)) === 'question-presented') {
    await operator.getByRole('button', { name: 'Buzzer freigeben' }).click()
  }
}

/** Markiert die aktuelle Antwort als richtig - egal ob Optionsvergleich oder manuell. */
export async function markCorrect(operator: Page): Promise<void> {
  if (await operator.locator('.button--marks-correct').count()) {
    await logCorrectOption(operator)
  } else {
    await operator.getByRole('button', { name: 'Antwort war richtig' }).click()
  }
}

export async function markIncorrect(operator: Page): Promise<void> {
  if (await operator.locator('.controls__row--options .button--option').count()) {
    await logIncorrectOption(operator)
  } else {
    await operator.getByRole('button', { name: 'Antwort war falsch' }).click()
  }
}

/** Spielt eine Frage mit richtiger Erstantwort durch, unabhaengig vom Fragetyp. */
export async function playQuestionCorrect(operator: Page, player: 1 | 2 = 1): Promise<void> {
  await prepareAnswerPhase(operator)
  await buzz(operator, player)
  await expectPhase(operator, 'answer-locked')
  await markCorrect(operator)
  await resolveAttempt(operator)
  await expectPhase(operator, 'solution')
}

/** Loest eine Frage ohne Buzzer und ohne Antwort auf. */
export async function resolveWithoutAnswer(operator: Page): Promise<void> {
  await waitForQuestionReady(operator)
  if ((await currentPhase(operator)) === 'video-ready' || (await currentPhase(operator)) === 'video-playing') {
    await operator.getByRole('button', { name: 'Frage einblenden' }).click()
  }
  await operator.getByRole('button', { name: 'Ohne Antwort aufloesen' }).click()
  await expectPhase(operator, 'solution')
}

/** Session-Code des Servers - nur lokal abrufbar. */
export async function sessionCode(page: Page): Promise<string> {
  const response = await page.request.get('/api/session')
  const body = (await response.json()) as { sessionCode: string }
  return body.sessionCode
}
