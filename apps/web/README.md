# @quiz/web

**Verantwortung:** React-Einstiegspunkte fuer Operator, Buehnenscreen, Moderator und
die Entwicklungsvorschau - plus die gesamte Praesentationsschicht.

Ein Build bedient alle Rollen; die Rolle ergibt sich aus dem Pfad (`/operator`,
`/stage`, `/moderator`, `/preview`).

```text
src/
  apps/operator/    Operatoransicht: Kopfbereich, Vorschau, privater Bereich, Steuerung,
                    Startpanel, Hotfixes, Diagnose
  apps/stage/       Buehnenscreen (nur oeffentliche Daten)
  apps/moderator/   Moderatoransicht (Session-Code, vier Aktionen)
  apps/preview/     Entwicklungsvorschau fuer Szenen und Uebergaenge
  client/           WebSocket-Anbindung, Reveal-Uhr, Buzzer-Tasten, Desktop-Bruecke
  components/       tatsaechlich gemeinsam genutzte Bausteine
  presentation/     Szenen, Uebergaenge, Timings, Sound-Cues (siehe eigene README)
```

## Regeln fuer diesen Client

* Komponenten rendern View-Modelle und senden Befehle. Sie implementieren keine
  Spielregeln und berechnen keine Punkte.
* Sichtbare Aktionen werden aus `view.allowedCommands` abgeleitet, nicht aus eigenen
  Bedingungen.
* Keine verteilten `setTimeout`-Ketten zur Steuerung des Spielablaufs. Zeitgesteuerte
  Phasen beendet der Server.
* Seiteneffekte liegen in benannten Hooks (`useQuizConnection`, `useRevealClock`,
  `useBuzzerKeys`); Listener, Timer und Abonnements werden zuverlaessig bereinigt.
* Animationsdauern stehen nie im JSX, sondern kommen aus dem Uebergangsregistry.

**Abhaengigkeiten:** `@quiz/contracts` (Typen), `@quiz/domain` (reine Reveal-Mathematik),
`react`, `react-dom`.
