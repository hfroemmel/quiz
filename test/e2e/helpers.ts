/**
 * Helper functions for the end-to-end tests of the test rig.
 *
 * The tests operate the interface the way two people standing in front of it
 * would - via visible labels. Deliberately, nothing ever reaches into state
 * or DevTools (acceptance criterion, specification 32).
 *
 * There is no server here: every page load builds a fresh `LocalQuizRuntime`.
 * Reloading IS the reset button.
 */
import { expect, type Page } from '@playwright/test'

/** The scene's answer rows are present and tappable - and not yet used up. */
export const openAnswer = '[data-answer][data-state="idle"] [data-answer-button]:not([disabled])'

export async function currentPhase(page: Page): Promise<string> {
  return (await page.locator('.stage').first().getAttribute('data-phase')) ?? ''
}

export async function currentScene(page: Page): Promise<string> {
  return (await page.locator('.stage').first().getAttribute('data-scene')) ?? ''
}

export async function expectPhase(page: Page, phase: string): Promise<void> {
  await expect(page.locator('.stage').first()).toHaveAttribute('data-phase', phase)
}
