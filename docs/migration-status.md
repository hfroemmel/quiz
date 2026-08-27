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
| 6 | Changesets (fixed), `release.yml`, Vite-lib-Builds, Veroeffentlichungsdoku |
| 7 | Inhalte nach `quiz-content-data`, Testbestand hier, Inhaltsprofile, `pull` |

Nachweis je Phase: `pnpm typecheck`, `pnpm test` (184), `pnpm packages:verify`
(publint + attw fuer sieben Pakete), `pnpm build`, `npx playwright test` (80,
inklusive unveraenderter Screenshot-Baselines).

## Blockiert

Beides liegt ausserhalb des Codes und braucht eine Entscheidung bzw. eine
Einstellung im GitHub-Konto:

1. **GitHub Actions laufen nicht.** Auch ein leerer Job ohne jede Action
   scheitert nach Sekunden - die Ursache liegt auf Kontoebene (Abrechnung bzw.
   Ausgabenlimit fuer Actions in privaten Repositories). Solange das gilt,
   erscheint keine Paketversion in GitHub Packages, und ohne veroeffentlichte
   Pakete koennen die Anwendungs-Repositories nichts installieren.
2. **Die Medien fehlen in `quiz-content-data`.** Der LFS-Endpunkt
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
GitHub Packages. Sie lassen sich deshalb erst bauen und testen, wenn Blocker 1
geloest ist.
