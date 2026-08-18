# Bekannte Einschraenkungen

## Bewusst nicht Teil des initialen Umfangs

Entsprechend Abschnitt 4.2 der Spezifikation fehlen absichtlich: ein oeffentlich
gehostetes Cloud-Backend, Benutzerkonten ueber das Internet, ein vollstaendiges
redaktionelles CMS, mehrere gleichzeitige Spiele, frei konfigurierbare Buzzer-Tasten,
Buzzer-Beleuchtung, negative Punkte, manuelle Gewinnerauswahl, eine automatische
Entscheidungsfrage bei Gleichstand, automatisch eingeblendete Zusatzinformationen auf
dem Buehnenscreen und ungeprueft uebernommene KI-Korrekturen.

## Inhalte des Beispielpakets

* Das mitgelieferte Paket enthaelt **53 Beispielfragen** und dient dem Start, nicht der
  Veranstaltung. Die Validierung meldet dafuer 27 Warnungen - fast ausschliesslich
  „kleiner Kandidatenpool“. Fuer einen Abend mit vielen aufeinanderfolgenden Spielen
  sollte der Pool deutlich groesser sein; der Bericht nennt pro Fragenplatz die
  konkrete Kandidatenzahl.
* Die Bilder sind **abstrakte Platzhaltergrafiken** (`pnpm content:assets`). Vor einer
  echten Veranstaltung werden sie durch freigegebenes Bildmaterial ersetzt.

## Videofragen

Dem Repository liegt kein freigegebenes Videomaterial bei. Die Beispielfrage
`a-video-01` ist deshalb auf `"enabled": false` gesetzt und wird nie gespielt; die
Validierung meldet dafuer eine Warnung statt eines Fehlers.

Die Videologik selbst ist vollstaendig umgesetzt und getestet: Buzzersperre waehrend
des Videos, Start/Pause/Neustart/Springen, `Frage einblenden` als zweite Phase
derselben Frage, Fehlermeldung mit `Frage ueberspringen` bei nicht ladbarem Medium.
Abgedeckt ist das durch Domain-Unit-Tests; ein End-to-End-Test fuer den Videoablauf
fehlt, weil dafuer eine abspielbare Datei noetig waere.

Anleitung zum Aktivieren: `content/source/assets/video/README.md`.

## Natives SQLite-Modul

`better-sqlite3` ist ein natives Modul und passt immer nur zu **einer** Laufzeit.
Nach `pnpm desktop:rebuild-native` (Electron) funktionieren `pnpm server` und
`pnpm test` erst wieder nach `pnpm server:rebuild-native` (Node). Die Anwendung
erkennt den Fall und nennt den passenden Befehl im Klartext.

Der Rebuild fuer Electron braucht **Node 22.12 oder neuer**: `@electron/rebuild`
setzt das ab Version 4 voraus. Server, Web und Tests laufen weiterhin ab Node 20.
Aeltere Fassungen des Werkzeugs kommen fuer die Installation nicht in Frage - sie
holen `@electron/node-gyp` per SSH aus einem Git-Repository. Neuere pnpm-Fassungen
lehnen das mit `ERR_PNPM_EXOTIC_SUBDEP` ab, und ohne hinterlegten SSH-Schluessel
scheitert es ohnehin.

## Sicherheit im lokalen Netzwerk

* Die Operatoransicht ist nur ueber Loopback erreichbar; ein Fernzugriff ist nicht
  vorgesehen.
* Der Moderatorzugang ist ueber einen sechsstelligen Session-Code geschuetzt, der beim
  Start neu erzeugt wird. Es gibt keine Ratebegrenzung - fuer den Veranstaltungsbetrieb
  im eigenen LAN ist das bewusst einfach gehalten.
* Buehnenclients duerfen sich ohne Code verbinden. Sie erhalten ausschliesslich
  oeffentliche Daten und koennen keine Steuerbefehle senden. In einem fremden Netzwerk
  koennte damit jeder die oeffentliche Ansicht mitlesen.
* Die Verbindung ist unverschluesseltes HTTP/WS im lokalen Netz.

## Weitere Punkte

* **Kein allgemeines Undo.** Jede Aenderung ist vollstaendig nachvollziehbar
  (Auditlog, Punktetransaktionen, Hotfix-Bericht), aber es gibt keinen Rueckgaengig-Knopf.
  Punkte lassen sich manuell korrigieren.
* **Sound wird synthetisiert** (Web Audio) statt aus Dateien geladen. Das haelt den
  Offline-Betrieb einfach; wer echte Klaenge will, ersetzt `playCue` in
  `apps/web/src/presentation/soundCues.ts`.
* **Screenshot-Baselines sind plattformabhaengig.** Auf einem neuen System einmalig
  `npx playwright test --project=preview --update-snapshots`.
* **Vollbildsteuerung des Buehnenfensters aus dem Operatorfenster** funktioniert nur in
  der Electron-Anwendung. Im reinen Browserbetrieb schaltet der Buehnenclient sein
  Vollbild selbst um (Taste `F` oder Doppelklick).
* **Kein Installer.** Es gibt keinen `electron-builder`-Schritt; die Desktop-Anwendung
  wird aus dem Projektverzeichnis gestartet.
