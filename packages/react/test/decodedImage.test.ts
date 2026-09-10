/**
 * Welche Bildadresse gilt als fertig - ohne Browser.
 *
 * Der interessante Fall ist das schnelle Weiterklicken: Die Bilder kommen in
 * beliebiger Reihenfolge zurueck, und das zuletzt eingetroffene ist nicht das
 * zuletzt gefragte.
 */
import { describe, expect, it } from 'vitest'
import { bildstand, type Bildstand } from '../src/presentation/useDecodedImage'

const leer: Bildstand = { fertig: undefined }

describe('bildstand', () => {
  it('meldet das Bild, das gerade gefragt ist', () => {
    expect(bildstand(leer, '/a.jpg', '/a.jpg')).toEqual({ fertig: '/a.jpg' })
  })

  it('verwirft ein Bild, das niemand mehr fragt', () => {
    const vorher = { fertig: '/b.jpg' }
    expect(bildstand(vorher, '/b.jpg', '/a.jpg')).toBe(vorher)
  })

  it('verwirft jede Meldung, wenn gar kein Bild gefragt ist', () => {
    expect(bildstand(leer, undefined, '/a.jpg')).toBe(leer)
  })

  it('gibt bei einer Wiederholung denselben Stand zurueck - kein neues Rendern', () => {
    const vorher = { fertig: '/a.jpg' }
    expect(bildstand(vorher, '/a.jpg', '/a.jpg')).toBe(vorher)
  })
})
