/**
 * Bedienhilfen fuer die End-to-End-Tests des Pruefstands.
 *
 * Die Tests bedienen die Oberflaeche so, wie zwei Menschen davor es tun - ueber
 * sichtbare Beschriftungen. Es wird bewusst nirgends in den Zustand oder in
 * DevTools eingegriffen (Abnahmekriterium Spezifikation 32).
 *
 * Einen Server gibt es hier nicht: Jeder Seitenaufruf baut eine frische
 * `LocalQuizRuntime`. Das Neuladen IST der Ruecksetzknopf.
 */
import { expect, type Page } from '@playwright/test'

/** Die Antwortzeilen der Szene sind da und tippbar - und noch nicht verbraucht. */
export const offeneAntwort = '[data-answer][data-state="idle"] [data-answer-button]:not([disabled])'

export async function currentPhase(page: Page): Promise<string> {
  return (await page.locator('.stage').first().getAttribute('data-phase')) ?? ''
}

export async function currentScene(page: Page): Promise<string> {
  return (await page.locator('.stage').first().getAttribute('data-scene')) ?? ''
}

export async function expectPhase(page: Page, phase: string): Promise<void> {
  await expect(page.locator('.stage').first()).toHaveAttribute('data-phase', phase)
}
