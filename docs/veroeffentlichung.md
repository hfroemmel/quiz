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

`@quiz/persistence`, `@quiz/server` und die Apps bleiben privat im Repository -
sie ziehen spaeter nach `quiz-live`.

## Versionierung

Changesets mit **fixed-Versioning**: Alle fuenf Pakete tragen immer dieselbe
Version und erscheinen im Gleichschritt. Eine Aenderung bekommt vor dem Merge
einen Changeset (`pnpm changeset`); SemVer gilt ab 1.0 streng
(View-Modell-, Befehls- und Schemabrueche sind major).

## Ablauf eines Releases

1. Push auf `main` mit offenen Changesets -> der Workflow `release.yml`
   erzeugt bzw. aktualisiert den PR **"Version Packages"**.
2. Diesen PR mergen -> derselbe Workflow veroeffentlicht die Pakete mit dem
   automatischen `GITHUB_TOKEN` (`permissions: packages: write`) und legt
   Git-Tags an.

Veroeffentlicht wird ueber pnpm; erst beim Packen biegt `publishConfig.exports`
die Eintrittspunkte von `src/` auf `dist/` um. `pnpm packages:verify` prueft
mit publint und @arethetypeswrong/cli genau dieses Artefakt.

## Konsum in anderen Repositories

In jedem konsumierenden Repository (`quiz-live`, `quiz-standalone`,
`app-collection`):

```ini
# .npmrc im Repository
@hfroemmel:registry=https://npm.pkg.github.com
```

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
