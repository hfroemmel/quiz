/**
 * Directory convention of the content pipeline.
 *
 * Formerly `paths.ts` derived the monorepo root from the location of the
 * source file - as an installed package that pointed nowhere. Now the rule
 * is: whoever calls the pipeline determines the paths. Without a flag,
 * `content/` is expected under the CURRENT WORKING DIRECTORY - so the repo's
 * root scripts behave as before, and a content repo with the same structure
 * needs no configuration.
 */
import { join, resolve } from 'node:path'

/** Value of a `--name <value>` or `--name=<value>` flag. */
export function flagValue(args: string[], name: string): string | undefined {
  const prefix = `--${name}`
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!
    if (arg === prefix) return args[index + 1]
    if (arg.startsWith(`${prefix}=`)) return arg.slice(prefix.length + 1)
  }
  return undefined
}

/** Flag value or the convention `<cwd>/content/<segment>`. */
export function contentDir(args: string[], flag: string, segment: string): string {
  return resolve(flagValue(args, flag) ?? join(process.cwd(), 'content', segment))
}
