/**
 * Verzeichniskonvention der Inhaltspipeline.
 *
 * Frueher rechnete `paths.ts` die Monorepo-Wurzel aus der Lage der Quelldatei
 * aus - als installiertes Paket zeigte das ins Leere. Jetzt gilt: Wer die
 * Pipeline aufruft, bestimmt die Pfade. Ohne Flag wird `content/` unter dem
 * AKTUELLEN ARBEITSVERZEICHNIS erwartet - so verhalten sich die Root-Skripte
 * des Repos wie bisher, und ein Inhalte-Repo mit derselben Struktur braucht
 * keine Konfiguration.
 */
import { join, resolve } from 'node:path'

/** Wert eines `--name <wert>`- oder `--name=<wert>`-Flags. */
export function flagValue(args: string[], name: string): string | undefined {
  const prefix = `--${name}`
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!
    if (arg === prefix) return args[index + 1]
    if (arg.startsWith(`${prefix}=`)) return arg.slice(prefix.length + 1)
  }
  return undefined
}

/** Flagwert oder die Konvention `<cwd>/content/<segment>`. */
export function contentDir(args: string[], flag: string, segment: string): string {
  return resolve(flagValue(args, flag) ?? join(process.cwd(), 'content', segment))
}
