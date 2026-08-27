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
| 8 | Buehnenbetrieb nach `quiz-live`: Server, Persistenz, Rollen-Clients, Electron-Huelle |
| 9 | Kiosk nach `quiz-standalone`: `LocalQuizRuntime` im Fenster, kein Server, kein Netz |
| 10 | `app-collection`: Spielesammlung mit eingebettetem Quiz, Auf- und Abbau beim Gastgeber |

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

## Veroeffentlichte Versionen

| Version | Was |
|---|---|
| 0.1.0 | Erste Veroeffentlichung aller fuenf Pakete |
| 0.2.0 | `QuizGame` nimmt die Laufzeit vom Gastgeber entgegen (`runtime`-Prop) |

Der Weg ist der dokumentierte: Der Release-Workflow legt den PR
"Version Packages" an, sein Merge veroeffentlicht.

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

1. **Die Pakete sind fuer die Anwendungs-Repositories noch nicht freigegeben.**
   Deren CI-Laeufe scheitern an der Registry mit `403`, obwohl das Token gueltig
   ist und der Job `packages: read` besitzt: Ein privates Paket gehoert nur dem
   Repository, aus dem es veroeffentlicht wurde. Abhilfe: bei jedem der fuenf
   Pakete unter *Package settings -> Manage Actions access -> Add repository*
   das konsumierende Repository mit `Read` eintragen - fuer `quiz-live`,
   `quiz-standalone` und `app-collection`.
2. **Die Medien fehlen in `quiz-content-data`.** Der LFS-Endpunkt
   (`lfs.github.com`) ist aus der Migrationssitzung heraus gesperrt. Der
   Textbestand ist dort vollstaendig; das README des Repositories nennt die
   Befehle fuer den einmaligen Upload aus einer Arbeitskopie.

## Als Naechstes (Phase 11)

| Phase | Repository | Inhalt |
|---|---|---|
| 11 | `quiz` | Rueckbau: `apps/*`, `packages/persistence` und `packages/server` verlassen dieses Repository |

Alle drei Anwendungs-Repositories konsumieren `@hfroemmel/quiz-*@^0.2` aus
GitHub Packages. Die Pakete sind veroeffentlicht; was jedem neuen Repository
noch fehlt, ist die Lesefreigabe (siehe Blocker 1).
