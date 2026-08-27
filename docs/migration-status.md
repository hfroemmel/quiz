# Stand der Aufteilung

Die Aufteilung des Systems in veroeffentlichte Pakete und eigenstaendige
Anwendungs-Repositories laeuft in Phasen. Diese Datei haelt fest, was erledigt
ist und was als Naechstes ansteht.

## Erledigt

| Phase | Inhalt |
|---|---|
| 0 | CI-Regressionsnetz (`ci.yml`), Chromium-Aufloesung in drei Stufen |
| 1 | Emit-Setup: `dist` je Paket, `publishConfig`, publint/attw auf dem Tarball |
| 2 | Pfade kommen vom Aufrufer; das Repo-Wurzel-Orakel ist weg |
| 3 | Kiosk-Selbstbedienung nutzt die Operator-Befehlssequenz (Buzz, Einloggen, Abgeben) |
| 4 | `QuizRuntime`-Vertrag, `QuizScene`, Ereignisableitung, Theme als Host-Sache |
| 5 | Fuenf Pakete `@hfroemmel/quiz-{core,content,themes,react,kiosk}`, Schema v2 |
| 6 | Changesets (fixed), `release.yml`, Vite-lib-Builds, Veroeffentlichung 0.1.0 |
| 7 | Inhalte nach `quiz-content-data`, Testbestand hier, Inhaltsprofile, `pull` |

Nachweis je Phase: `pnpm typecheck`, `pnpm test` (184), `pnpm packages:verify`
(publint + attw fuer sieben Pakete), `pnpm build`, `npx playwright test` (80,
inklusive unveraenderter Screenshot-Baselines).

## CI laeuft

Der frueher gemeldete Kontoblocker ist weg: Seit dem 27.08. starten die
GitHub-gehosteten Runner. Der erste vollstaendig gruene Lauf steht - `checks`
(Typecheck, Unit-Tests, `packages:verify`, Produktionsbuild) und `e2e` (80
Playwright-Tests im Container, gut neun Minuten) beide erfolgreich.

Eine Anpassung war dafuer noetig: Seit Phase 7 ist `content/dist` nicht mehr
versioniert, also bauen beide Jobs das Quizpaket vor dem Testlauf.

## Version 0.1.0 ist veroeffentlicht

Alle fuenf Pakete liegen als 0.1.0 auf GitHub Packages. Der Weg war der
dokumentierte: Der Release-Workflow legte den PR "Version Packages" an, sein
Merge (`0210fb1`) veroeffentlichte.

Zwei Beobachtungen fuer den naechsten Release:

- Der Versions-PR kommt von `github-actions[bot]`; sein CI-Lauf bleibt auf
  `action_required` stehen und braucht einmal *Approve and run*. Auf den
  Inhalt hat das keinen Einfluss - der Versions-PR aendert nur
  `package.json`-Versionen und Changelogs, und `main` prueft ohnehin erneut.
- Die Changesets-Action legt Versions-Tags an, kann sie aus dieser
  Arbeitsumgebung aber nicht pushen (GitHub beantwortet `refs/tags/*` mit 403).
  Die Herkunft steht in den Changelogs und am Merge-Commit; wer die Tags will,
  setzt sie aus einer eigenen Arbeitskopie.

## Blockiert

1. **Die Medien fehlen in `quiz-content-data`.** Der LFS-Endpunkt
   (`lfs.github.com`) ist aus der Migrationssitzung heraus gesperrt. Der
   Textbestand ist dort vollstaendig; das README des Repositories nennt die
   Befehle fuer den einmaligen Upload aus einer Arbeitskopie.

## Als Naechstes (Phasen 8 bis 11)

| Phase | Repository | Inhalt |
|---|---|---|
| 8 | `quiz-live` | Server, Persistenz, Operator/Moderator/Buehne, Electron-Huelle; Inhalte per `content.lock.json` |
| 9 | `quiz-standalone` | Kiosk als Electron-App mit `LocalQuizRuntime`, Inhalte gebuendelt, vollstaendig offline |
| 10 | `app-collection` | Spielemenue mit eingebettetem Quiz, sauberes Aufraeumen beim Verlassen |
| 11 | `quiz` | Rueckbau: `apps/*`, `packages/persistence` und `packages/server` verlassen dieses Repository |

Alle drei Anwendungs-Repositories konsumieren `@hfroemmel/quiz-*@^0.1` aus
GitHub Packages. Diese Voraussetzung steht jetzt.
