# Veroeffentlichung der Pakete

Die fuenf Bibliotheken des Quiz-Systems erscheinen als PRIVATE Pakete auf
GitHub Packages unter dem Scope `@hfroemmel`:

| Paket | Inhalt |
|---|---|
| `@hfroemmel/quiz-core` | Vertraege, Engine, Laufzeit (QuizService, Local-/RemoteQuizRuntime) |
| `@hfroemmel/quiz-content` | Inhalts-Pipeline: Validierung, Paketbau, Legacy-Import, CLI |
| `@hfroemmel/quiz-themes` | Farbpaletten, Schriften, Theme-Objekte, palette.css/fonts.css |
| `@hfroemmel/quiz-react` | QuizScene, StageScreen, Szenen, Klaenge, Verbindungs-Hooks |
| `@hfroemmel/quiz-kiosk` | Das spielbare Quiz als eine Komponente (QuizGame) |

Ausgeliefert wird sonst nichts: Der Pruefstand unter `harness/` ist von der
Versionierung ausgenommen, die Anwendungen liegen in eigenen Repositories.

## Versionierung

Changesets mit **fixed-Versioning**: Alle fuenf Pakete tragen immer dieselbe
Version und erscheinen im Gleichschritt. Eine Aenderung bekommt vor dem Merge
einen Changeset (`pnpm changeset`); SemVer gilt ab 1.0 streng
(View-Modell-, Befehls- und Schemabrueche sind major).

## Ablauf eines Releases

1. Push auf `main` mit offenen Changesets -> der Workflow `release.yml`
   erzeugt bzw. aktualisiert den PR **"Version Packages"**.

   Dafuer muss in *Settings -> Actions -> General -> Workflow permissions* die
   Option „Allow GitHub Actions to create and approve pull requests" aktiv
   sein; sonst pusht der Lauf zwar den Branch `changeset-release/main`,
   scheitert aber beim Anlegen des PR. Wer ohne PR arbeiten will, fuehrt
   `pnpm changeset version` lokal aus und pusht den Versionsstand - der
   naechste Release-Lauf veroeffentlicht dann direkt.

   Der PR gehoert `github-actions[bot]`; sein CI-Lauf wartet deshalb auf ein
   einmaliges *Approve and run*.
2. Diesen PR mergen -> derselbe Workflow veroeffentlicht die Pakete mit dem
   automatischen `GITHUB_TOKEN` (`permissions: packages: write`) und legt
   Git-Tags an.

Veroeffentlicht wird ueber pnpm; erst beim Packen biegt `publishConfig.exports`
die Eintrittspunkte von `src/` auf `dist/` um. `pnpm packages:verify` prueft
mit publint und @arethetypeswrong/cli genau dieses Artefakt.

## Von Hand veroeffentlichen

Der Weg ueber CI setzt voraus, dass GitHub Actions fuer dieses Konto ueberhaupt
Jobs startet. Tut es das nicht - erkennbar daran, dass Laeufe nach ein bis zwei
Sekunden ohne einen einzigen Schritt und ohne Logdateien scheitern -, geht
dasselbe von Hand. Es sind genau die Schritte, die `release.yml` ausfuehrt:

```bash
pnpm changeset version   # Versionen und Changelogs schreiben, Changeset aufzehren
pnpm packages:build
pnpm packages:verify     # publint + attw auf den gepackten Tarballs
pnpm changeset publish --no-git-tag   # veroeffentlichen
pnpm packages:tag                     # Git-Tags setzen, rein lokal
git add -A && git commit -m "Version Packages" && git push
git push origin --tags
```

**Warum `--no-git-tag`.** Der eingebaute Tag-Schritt fragt fuer jedes Paket,
dessen Tag lokal fehlt, beim Server nach, ob es ihn dort schon gibt
(`git ls-remote --tags origin`). Das sind fuenf Netzrunden, und sie stehen
hinter einem Spinner: Fragt das Netz nach Zugangsdaten, ist die Frage nicht zu
sehen und der Lauf scheint bei "Creating git tags..." zu haengen.
Veroeffentlicht ist zu dem Zeitpunkt bereits alles - ein Abbruch mit Strg+C
kostet nur die Tags. `pnpm packages:tag` setzt dieselben Tags ohne Netzzugriff.

Bleibt der Lauf trotzdem stehen, zeigt

```bash
time git ls-remote --tags origin
```

ob es am Netz oder an einer unsichtbaren Passwortfrage liegt.

**Danach die App-Repositories nachziehen.** `^0.5.0` heisst bei einer
0.x-Version `>=0.5.0 <0.6.0` - der Caret laesst in `0.x` nur Patches derselben
Minor zu. Jede neue Minor faellt damit aus dem Bereich, den quiz-standalone,
app-collection und quiz-live gepinnt haben; dort bleibt `pnpm install` auf der
alten Fassung stehen und meldet dabei nichts, weil die Aufloesung korrekt ist.

In jedem der drei Repositories nach einer Veroeffentlichung:

```bash
pnpm up "@hfroemmel/*" --latest   # schreibt den Bereich in package.json neu
git add -A && git commit -m "Pakete auf <Version> ziehen" && git push
```

Das ist Absicht und kein Schoenheitsfehler: Die fuenf Pakete evolvieren im
Gleichschritt (`fixed`-Versionierung), und welche Fassung eine Anwendung
erwartet, soll in ihrer `package.json` stehen und nicht dem Zufall des
Installationszeitpunkts ueberlassen bleiben.

**Den Versionsstand ZURUECKSCHREIBEN.** `changeset version` aendert die
`package.json` der fuenf Pakete und zehrt die Changesets auf; dieser Stand
gehoert committet und gepusht. Bleibt er auf dem Rechner liegen, fuehrt das
Repository weiter die alte Nummer, und der naechste Lauf schlaegt eine Version
vor, die in der Registry laengst vergeben ist.


Dafuer braucht die persoenliche `~/.npmrc` ein classic PAT mit **`write:packages`**
(zum Lesen genuegt `read:packages`):

```ini
//npm.pkg.github.com/:_authToken=<PAT>
```

Wichtig ist die Reihenfolge: Erst veroeffentlichen, dann den Versionsstand
pushen. Bricht das Veroeffentlichen ab, steht im Repository keine Version, die
es in der Registry nicht gibt.

## Konsum in anderen Repositories

In jedem konsumierenden Repository (`quiz-live`, `quiz-standalone`,
`app-collection`):

```ini
# .npmrc im Repository
@hfroemmel:registry=https://npm.pkg.github.com
```

Ein privates Paket gehoert zunaechst NUR dem Repository, aus dem es
veroeffentlicht wurde. Jedes konsumierende Repository muss deshalb einmalig
freigeschaltet werden: bei jedem der fuenf Pakete unter *Package settings ->
Manage Actions access -> Add repository* das Repository mit `Read` eintragen.
Fehlt der Eintrag, antwortet die Registry mit `403`, obwohl das Token gueltig
ist und der Job `packages: read` besitzt.

CI braucht `permissions: packages: read` und uebergibt das Token:

```yaml
- uses: actions/setup-node@v4
  with:
    registry-url: https://npm.pkg.github.com
    scope: '@hfroemmel'
# NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }} beim Installationsschritt
```

Fuer die lokale Entwicklung braucht jede Person einmalig ein classic PAT mit
`read:packages` in der persoenlichen `~/.npmrc`:

```ini
//npm.pkg.github.com/:_authToken=<PAT>
```

Die Apps pinnen einen festen kompatiblen Bereich (z. B. `^0.1.0`); durch das
fixed-Versioning passen die fuenf Pakete darin garantiert zusammen.
