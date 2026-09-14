/**
 * Welche Bildadresse gilt als fertig - ohne Browser.
 *
 * Der interessante Fall ist das schnelle Weiterklicken: Die Bilder kommen in
 * beliebiger Reihenfolge zurueck, und das zuletzt eingetroffene ist nicht das
 * zuletzt gefragte.
 */
import { describe, expect, it } from 'vitest'
import { imageState, type ImageState } from '../src/presentation/useDecodedImage'

const empty: ImageState = { done: undefined }

describe('bildstand', () => {
  it('meldet das Bild, das gerade gefragt ist', () => {
    expect(imageState(empty, '/a.jpg', '/a.jpg')).toEqual({ done: '/a.jpg' })
  })

  it('verwirft ein Bild, das niemand mehr fragt', () => {
    const before = { done: '/b.jpg' }
    expect(imageState(before, '/b.jpg', '/a.jpg')).toBe(before)
  })

  it('verwirft jede Meldung, wenn gar kein Bild gefragt ist', () => {
    expect(imageState(empty, undefined, '/a.jpg')).toBe(empty)
  })

  it('gibt bei einer Wiederholung denselben Stand zurueck - kein neues Rendern', () => {
    const before = { done: '/a.jpg' }
    expect(imageState(before, '/a.jpg', '/a.jpg')).toBe(before)
  })
})
