/**
 * Wann das Videoelement angefasst werden darf - und vor allem: wann nicht.
 *
 * Der Fall, der diese Regel erzwungen hat: Zwei Fenster nebeneinander, das Video
 * auf Play, und das Bild flackerte. Die Ursache war kein Fehler im Video,
 * sondern der gut gemeinte Abgleich - er sprang bei jedem Schnappschuss auf die
 * Serverposition, und jeder Sprung kostete den Bruchteil, der die naechste
 * Abweichung erzeugte.
 */
import { describe, expect, it } from 'vitest'
import {
  angleichToleranzMs,
  laufzeitMelden,
  serverpositionJetzt,
  videoangleich,
  type Elementstand,
} from '../src/presentation/videoSync'

const element = (ueberschreibung: Partial<Elementstand> = {}): Elementstand => ({
  positionMs: 0,
  paused: false,
  ended: false,
  ...ueberschreibung,
})

describe('videoangleich', () => {
  it('laesst ein laufendes Bild in Ruhe, auch wenn es dem Server hinterherhinkt', () => {
    const befund = videoangleich({ status: 'playing', positionMs: 12_000 }, element({ positionMs: 8_000 }))
    expect(befund.springeNachMs).toBeUndefined()
    expect(befund.starten).toBe(false)
    expect(befund.anhalten).toBe(false)
  })

  it('gleicht ein Fenster an, das mitten im Video dazukommt', () => {
    const befund = videoangleich({ status: 'playing', positionMs: 30_000 }, element({ paused: true }))
    expect(befund.springeNachMs).toBe(30_000)
    expect(befund.starten).toBe(true)
  })

  it('springt zurueck, wenn das Video neu gestartet wurde', () => {
    /*
     * Waehrend das Video laeuft, kommt kein Schnappschuss: Zuletzt gesehen hat
     * die Buehne die Position beim Start - null. Nach dem Neustart steht sie
     * wieder bei null. Erkennbar ist der Neustart allein daran, dass das
     * Element weit vorn liegt.
     */
    const befund = videoangleich({ status: 'playing', positionMs: 0 }, element({ positionMs: 4_000 }))
    expect(befund.springeNachMs).toBe(0)
    expect(befund.anhalten).toBe(false)
  })

  it('haelt an, sobald der Server nicht mehr spielt', () => {
    const befund = videoangleich({ status: 'paused', positionMs: 9_000 }, element({ positionMs: 9_100 }))
    expect(befund.anhalten).toBe(true)
    expect(befund.starten).toBe(false)
    expect(befund.springeNachMs).toBeUndefined()
  })

  it('startet ein Element am Ende nicht von vorn', () => {
    const befund = videoangleich(
      { status: 'playing', positionMs: 60_000 },
      element({ positionMs: 60_000, paused: true, ended: true }),
    )
    expect(befund.starten).toBe(false)
  })

  it('startet ein Element am Ende doch, wenn das Video neu gestartet wurde', () => {
    const befund = videoangleich(
      { status: 'playing', positionMs: 0 },
      element({ positionMs: 60_000, paused: true, ended: true }),
    )
    expect(befund.springeNachMs).toBe(0)
    expect(befund.starten).toBe(true)
  })

  it('springt nicht wegen eines Versatzes unterhalb der Toleranz', () => {
    const befund = videoangleich(
      { status: 'idle', positionMs: 5_000 },
      element({ positionMs: 5_000 + angleichToleranzMs - 1, paused: true }),
    )
    expect(befund.springeNachMs).toBeUndefined()
  })
})

describe('serverpositionJetzt', () => {
  it('rechnet ein laufendes Video vom Schnappschuss bis jetzt hoch', () => {
    expect(serverpositionJetzt({ status: 'playing', positionMs: 4_000 }, 1_000_000, 1_003_000)).toBe(7_000)
  })

  it('laesst ein stehendes Video, wo es ist', () => {
    expect(serverpositionJetzt({ status: 'paused', positionMs: 4_000 }, 1_000_000, 1_003_000)).toBe(4_000)
    expect(serverpositionJetzt({ status: 'ended', positionMs: 4_000 }, 1_000_000, 1_003_000)).toBe(4_000)
  })

  /*
   * Der Fall, den die Hochrechnung verhindert: Ein Schnappschuss wird erst
   * spaeter ausgewertet - etwa weil die Tonfreigabe die Szene neu zeichnet. Ohne
   * Hochrechnung laege das Element scheinbar weit vor dem Server, und das Video
   * spraenge grundlos an den Anfang.
   */
  it('haelt einen spaet ausgewerteten Schnappschuss nicht fuer einen Neustart', () => {
    const jetzt = serverpositionJetzt({ status: 'playing', positionMs: 1_000 }, 1_000_000, 1_010_000)
    const befund = videoangleich({ status: 'playing', positionMs: jetzt }, element({ positionMs: 10_800 }))
    expect(befund.springeNachMs).toBeUndefined()
  })
})

describe('laufzeitMelden', () => {
  it('meldet eine noch unbekannte Laufzeit', () => {
    expect(laufzeitMelden(undefined, 60_000)).toBe(true)
  })

  it('meldet dieselbe Laufzeit kein zweites Mal', () => {
    expect(laufzeitMelden(60_000, 60_000)).toBe(false)
    expect(laufzeitMelden(60_000, 60_100)).toBe(false)
  })

  it('meldet eine geaenderte Laufzeit', () => {
    expect(laufzeitMelden(60_000, 45_000)).toBe(true)
  })

  it('meldet keine unbestimmte Laufzeit', () => {
    expect(laufzeitMelden(undefined, Number.POSITIVE_INFINITY)).toBe(false)
    expect(laufzeitMelden(undefined, Number.NaN)).toBe(false)
    expect(laufzeitMelden(undefined, 0)).toBe(false)
  })
})
