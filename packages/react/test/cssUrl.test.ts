/**
 * Der Waechter ueber dem weissen Balken.
 *
 * Ein unquotiertes `url()` bricht an einem Hochkomma - und genau die stecken in
 * den `data:`-Adressen, die der Bundler fuer eingebettete SVG erzeugt. Die
 * Regel faellt dann stillschweigend aus; sichtbar wird es erst im gebauten
 * Paket, wo statt der Wortmarke ihre nackte Farbflaeche steht.
 */
import { describe, expect, it } from 'vitest'
import { cssUrl } from '../src/presentation/cssUrl'

describe('cssUrl', () => {
  it('setzt die Adresse in doppelte Anfuehrungszeichen', () => {
    expect(cssUrl('/media/img-1')).toBe('url("/media/img-1")')
  })

  it('haelt eine eingebettete Grafik mit Hochkommata zusammen', () => {
    const eingebettet = "data:image/svg+xml,%3csvg%20width='339.417'%20height='55'%3e%3c/svg%3e"
    expect(cssUrl(eingebettet)).toBe(`url("${eingebettet}")`)
  })

  it('entschaerft ein doppeltes Anfuehrungszeichen in der Adresse', () => {
    expect(cssUrl('/media/a"b')).toBe('url("/media/a%22b")')
  })
})
