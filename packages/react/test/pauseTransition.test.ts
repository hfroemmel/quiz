/**
 * Die Zwischenansicht vor der Frage - ihr TAKT, nicht ihr Aussehen.
 *
 * Wie sie aussieht, ist in der Kinderwelt neu: Zaehler und Rubrik stehen jetzt
 * gross auf einer gezeichneten Tafel. Wie lange sie steht, ist NICHT neu, und
 * genau das haelt dieser Test fest. Die Dauer haengt am Uebergang, der Wechsel
 * danach kommt vom Server - ein Wert, der hier unbemerkt wanderte, verschoebe
 * den Fragenwechsel eines ganzen Abends.
 */
import { describe, expect, it } from 'vitest'
import { fadeThroughPause } from '../src/presentation/transitions/fadeThrough'
import { presentationTiming } from '../src/presentation/animationPresets'

describe('the interstitial before a question', () => {
  it('keeps the timing it always had', () => {
    expect(presentationTiming.sceneFadeMs).toBe(400)
    expect(fadeThroughPause.durationMs).toBe(400)
    // Wer keine Bewegung will, bekommt weiterhin die kurze Fassung.
    expect(fadeThroughPause.reducedMotionDurationMs).toBe(120)
  })

  it('is a presentation step and decides nothing about the game', () => {
    /*
     * Der Uebergang haengt an der SZENE und nicht an einer Frage: Er beschreibt,
     * wie gewechselt wird, und nicht wann. Traege er einen Zielzustand, waere
     * die Zwischenansicht eine zweite Spielsteuerung neben dem Server.
     */
    expect(fadeThroughPause.appliesTo).toEqual({ from: '*', to: 'pause' })
    expect(Object.keys(fadeThroughPause)).not.toContain('nextPhase')
    expect(Object.keys(fadeThroughPause)).not.toContain('advance')
  })
})
