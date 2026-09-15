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
  it('wraps the address in double quotes', () => {
    expect(cssUrl('/media/img-1')).toBe('url("/media/img-1")')
  })

  it('keeps an embedded graphic with single quotes together', () => {
    const embedded = "data:image/svg+xml,%3csvg%20width='339.417'%20height='55'%3e%3c/svg%3e"
    expect(cssUrl(embedded)).toBe(`url("${embedded}")`)
  })

  it('escapes a double quote inside the address', () => {
    expect(cssUrl('/media/a"b')).toBe('url("/media/a%22b")')
  })
})
