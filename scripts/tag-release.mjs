/**
 * Git-Tags fuer den aktuellen Versionsstand setzen - ohne Netzzugriff.
 *
 * WARUM NICHT `changeset publish`: Dessen Tag-Schritt fragt fuer jedes Paket,
 * dessen Tag lokal fehlt, beim Server nach (`git ls-remote --tags origin`).
 * Das sind fuenf Netzrunden, und sie stehen HINTER einem Spinner: Fragt das
 * Netz nach Zugangsdaten, sieht man die Frage nicht und der Lauf scheint zu
 * haengen. Veroeffentlicht ist zu dem Zeitpunkt laengst alles.
 *
 * Hier wird nur lokal gearbeitet. Was schon existiert, bleibt stehen.
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
