# @quiz/contracts

**Verantwortung:** Gemeinsame Sprache aller Schichten. Typen, Laufzeitschemas (Zod),
Befehle mit Rollenrechten, View-Modelle und die zentrale Regel-/Timingkonfiguration.

**Oeffentliche API:** alles aus `src/index.ts`.

| Datei | Inhalt |
|---|---|
| `content.ts` | Fragen-, Medien- und Konfigurationsmodell, Quizpaket-Manifest, Hotfix-Patches |
| `config.ts` | `scoringRules`, `gameTiming`, `selectionTuning`, `contentThresholds` |
| `state.ts` | `GameState`, `GamePhase`, Buzzer-, Reveal- und Videozustand |
| `commands.ts` | Befehls-Union, Envelope, `commandRoles` (einzige Quelle der Rollenrechte) |
| `viewModels.ts` | oeffentliches / Moderator- / Operator-View-Modell, WebSocket-Protokoll |

**Abhaengigkeiten:** nur `zod`. Dieses Paket kennt weder React noch Electron,
WebSocket, SQLite oder Dateisystem.

**Aenderungshinweis:** Ein neuer Befehl wird in `commandSchema` **und** `commandRoles`
ergaenzt. Der Compiler erzwingt danach die Behandlung in `@quiz/domain`.
