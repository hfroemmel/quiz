# @quiz/web

**Verantwortung:** React-Einstiegspunkte fuer Operator, Buehnenscreen, Moderator und
die Entwicklungsvorschau.

Die Buehnenflaeche selbst liegt in `@quiz/presentation` und wird von diesem Client
nur eingesetzt - dasselbe Paket bedienen spaeter auch Kiosk und
Multigame-Einbettung.

Ein Build bedient alle Rollen; die Rolle ergibt sich aus dem Pfad (`/operator`,
`/stage`, `/moderator`, `/preview`, `/play`).

`/play` ist die Selbstbedienung am Touchgeraet: dieselbe Komponente aus
`@quiz/game`, die auch der Kiosk und eine Multigame-Anwendung einbinden.

`/shell` ist eine beispielhafte Gastgeberanwendung - eine winzige Spielesammlung,
die das Quiz einbindet, verlaesst und erneut einbindet. Sie gibt es nur im
Entwicklungsmodus und sie ist kein Produkt, sondern der Pruefstand fuer den
Einbettungsvertrag.

```text
src/
  apps/operator/    Operatoransicht: Kopfbereich, Vorschau, privater Bereich, Steuerung,
                    Startpanel, Hotfixes, Diagnose
  apps/stage/       Buehnenscreen (nur oeffentliche Daten)
  apps/moderator/   Moderatoransicht (Session-Code, vier Aktionen)
  apps/preview/     Entwicklungsvorschau fuer Szenen und Uebergaenge
  client/           Buzzer-Tasten und Desktop-Bruecke (die Verbindung liegt in @quiz/client)
  components/       Bausteine der Bedienoberflaeche (Verbindungsbanner)
  styles.css        Stylesheet der Bedienoberflaechen; die Buehne bringt ihres selbst mit
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

**Abhaengigkeiten:** `@quiz/contracts` (Typen), `@quiz/client` (Verbindung),
`@quiz/presentation` (Buehnenflaeche), `@quiz/game` (Touchansicht), `react`, `react-dom`.
