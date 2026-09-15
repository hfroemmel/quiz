/**
 * Sets git tags for the current version state - without network access.
 *
 * WHY NOT `changeset publish`: its tag step asks the server
 * (`git ls-remote --tags origin`) for every package whose tag is missing
 * locally. That's five network round trips, and they sit BEHIND a spinner:
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

const pakete = ['core', 'content', 'themes', 'react', 'kiosk']
const probelauf = process.argv.includes('--dry-run')

const vorhanden = new Set(
  execFileSync('git', ['tag'], { encoding: 'utf8' })
    .split('\n')
    .map((zeile) => zeile.trim())
    .filter(Boolean),
)

let gesetzt = 0
for (const name of pakete) {
  const { name: paketName, version } = JSON.parse(readFileSync(`packages/${name}/package.json`, 'utf8'))
  const tag = `${paketName}@${version}`

  if (vorhanden.has(tag)) {
    console.log(`schon da  ${tag}`)
    continue
  }
  if (probelauf) {
    console.log(`waere neu ${tag}`)
    continue
  }
  execFileSync('git', ['tag', tag, '-m', tag])
  console.log(`gesetzt   ${tag}`)
  gesetzt += 1
}

if (!probelauf && gesetzt > 0) console.log('\nNoch zu tun: git push origin --tags')
