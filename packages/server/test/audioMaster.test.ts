/**
 * Wahl des Audio-Masters.
 *
 * Der Fall, der diese Tests noetig gemacht hat: Buehne und Operator liefen im
 * Browser, die Tonhoheit lag bei der Buehne - und weil in DEREN Fenster nie
 * jemand klickt, blieb die ganze Veranstaltung still. Kein Fehler, keine
 * Meldung, nur kein Ton.
 */
import { describe, expect, it } from 'vitest'
import { chooseAudioMaster, type AudioCandidate } from '../src/audioMaster.ts'

const stage = (over: Partial<AudioCandidate> = {}): AudioCandidate => ({
  role: 'stage',
  audioReady: false,
  isLocal: false,
  ...over,
})
const operator = (over: Partial<AudioCandidate> = {}): AudioCandidate => ({
  role: 'operator',
  audioReady: false,
  isLocal: true,
  ...over,
})

describe('chooseAudioMaster', () => {
  it('gibt die Tonhoheit der Buehne, sobald sie klingen darf', () => {
    const buehne = stage({ audioReady: true })
    expect(chooseAudioMaster([operator({ audioReady: true }), buehne])).toBe(buehne)
  })

  it('gibt sie dem Operator, solange in der Buehne niemand geklickt hat', () => {
    const bedienung = operator({ audioReady: true })
    expect(chooseAudioMaster([stage(), bedienung])).toBe(bedienung)
  })

  it('holt sie zur Buehne zurueck, sobald dort geklickt wurde', () => {
    const bedienung = operator({ audioReady: true })
    const buehne = stage()
    expect(chooseAudioMaster([bedienung, buehne])).toBe(bedienung)
    buehne.audioReady = true
    expect(chooseAudioMaster([bedienung, buehne])).toBe(buehne)
  })

  it('waehlt die Buehne, solange noch nirgends freigegeben wurde', () => {
    // Vor der ersten Interaktion ist die Buehne die beste Vermutung: In der
    // Desktop-Anwendung darf sie ohnehin klingen und meldet gleich frei.
    const buehne = stage()
    expect(chooseAudioMaster([operator(), buehne])).toBe(buehne)
  })

  it('bevorzugt innerhalb einer Gruppe den lokalen Client', () => {
    const entfernt = stage({ audioReady: true })
    const lokal = stage({ audioReady: true, isLocal: true })
    expect(chooseAudioMaster([entfernt, lokal])).toBe(lokal)
  })

  it('kommt ohne Kandidaten aus', () => {
    expect(chooseAudioMaster([])).toBeUndefined()
  })
})
