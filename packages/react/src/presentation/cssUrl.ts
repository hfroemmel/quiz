/**
 * Write an address as a CSS `url()` - IN QUOTES.
 *
 * Without them, the value breaks on a single quote. That is exactly what
 * happens in the built package: the bundler embeds small SVG as a `data:`
 * address and writes their attributes with single quotes
 * (`width='339.417'`) - for an unquoted `url()` that is an invalid
 * character. The rule then silently fails, and where a mask should sit, the
 * bare colour area beneath it remains: a white bar instead of the wordmark.
 *
 * In development this goes unnoticed, because a file address sits there
 * instead.
 *
 * Double quotes are the right choice: the bundler replaces them in the
 * embedded SVG with single ones, so that the value stays usable exactly as
 * it is.
 */
export function cssUrl(address: string): string {
  return `url("${address.replace(/"/g, '%22')}")`
}
