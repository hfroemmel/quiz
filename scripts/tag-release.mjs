/**
 * Sets git tags for the current version state - without network access.
 *
 * WHY NOT `changeset publish`: its tag step asks the server
 * (`git ls-remote --tags origin`) for every package whose tag is missing
 * locally. That's four network round trips, and they sit BEHIND a spinner:
 * if the network prompts for credentials, the prompt isn't visible and the
 * run appears to hang. Everything has long since been published by then.
 *
 * Only local work happens here. Whatever already exists is left alone.
 *
 *   pnpm changeset publish --no-git-tag
 *   pnpm packages:tag
 *   git push origin --tags
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const packageNames = ['core', 'content', 'themes', 'react']
const dryRun = process.argv.includes('--dry-run')

const existing = new Set(
  execFileSync('git', ['tag'], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean),
)

let written = 0
for (const name of packageNames) {
  const { name: packageName, version } = JSON.parse(readFileSync(`packages/${name}/package.json`, 'utf8'))
  const tag = `${packageName}@${version}`

  if (existing.has(tag)) {
    console.log(`already   ${tag}`)
    continue
  }
  if (dryRun) {
    console.log(`would add ${tag}`)
    continue
  }
  execFileSync('git', ['tag', tag, '-m', tag])
  console.log(`written   ${tag}`)
  written += 1
}

if (!dryRun && written > 0) console.log('\nStill to do: git push origin --tags')
