# @quiz/content

**Verantwortung:** Alles rund um Quizdaten - Legacy-Import, Validierung, versionierte
Pakete und das Hotfix-Overlay. Kennt keine Spielregeln und kein Netzwerk.

| Datei | Verantwortung |
|---|---|
| `validate.ts` | strenge Validierung in zwei Stufen plus Poolabdeckung je Modus/Preset/Slot |
| `package.ts` | Quelle lesen, Paket bauen, Paket laden, sichere Asset-Pfadaufloesung |
| `hotfix.ts` | Patches als Overlay ueber dem Basispaket, Aenderungsbericht, Abgleichwarnung |
| `report.ts` | menschenlesbarer Validierungs- und Buildbericht |
| `legacy/parseLiteral.ts` | sicherer Parser fuer JS-Objektliterale - fuehrt nichts aus |
| `legacy/migrate.ts` | Zuordnung der Altdaten zum neuen Fragenmodell plus Korrekturbericht |
| `paths.ts` | Projektpfade (`content/source`, `content/dist`, `runtime`) |
| `cli/` | `content:fetch`, `content:validate`, `content:build`, `content:migrate`, `content:assets` |

**Abhaengigkeiten:** `@quiz/contracts` (Schemas), `@quiz/domain` (Slotfilter und
Wiederholungsschluessel fuer die Poolanalyse), `zod`, Node-Dateisystem.

**Sicherheit:** `resolveAssetPath` stellt sicher, dass Dateipfade aus Quizdaten
niemals ausserhalb des Asset-Verzeichnisses aufgeloest werden. Der Legacy-Parser
verwendet weder `eval` noch `vm`.

Details: [docs/inhalte-import.md](../../docs/inhalte-import.md) und
[docs/quizpaket.md](../../docs/quizpaket.md).
