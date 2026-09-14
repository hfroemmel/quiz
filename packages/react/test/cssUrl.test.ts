/**
 * The guard over the white bar.
 *
 * An unquoted `url()` breaks on a single quote - and exactly those are found
 * in the `data:` addresses the bundler generates for embedded SVG. The rule
 * then silently fails, and it only becomes visible in the built package,
 * where the wordmark's bare colour area stands instead of the mark.
 */
import { describe, expect, it } from 'vitest'
import { cssUrl } from '../src/presentation/cssUrl'

describe('cssUrl', () => {
  it('setzt die Adresse in doppelte Anfuehrungszeichen', () => {
    expect(cssUrl('/media/img-1')).toBe('url("/media/img-1")')
  })

  it('haelt eine eingebettete Grafik mit Hochkommata zusammen', () => {
    const embedded = "data:image/svg+xml,%3csvg%20width='339.417'%20height='55'%3e%3c/svg%3e"
    expect(cssUrl(embedded)).toBe(`url("${embedded}")`)
  })

  it('entschaerft ein doppeltes Anfuehrungszeichen in der Adresse', () => {
    expect(cssUrl('/media/a"b')).toBe('url("/media/a%22b")')
  })
})
