# Bekannte Einschraenkungen

## Bewusst nicht Teil des initialen Umfangs

Entsprechend Abschnitt 4.2 der Spezifikation fehlen absichtlich: ein oeffentlich
gehostetes Cloud-Backend, Benutzerkonten ueber das Internet, ein vollstaendiges
redaktionelles CMS, mehrere gleichzeitige Spiele, frei konfigurierbare Buzzer-Tasten,
Buzzer-Beleuchtung, negative Punkte, manuelle Gewinnerauswahl, eine automatische
Entscheidungsfrage bei Gleichstand, automatisch eingeblendete Zusatzinformationen auf
dem Buehnenscreen und ungeprueft uebernommene KI-Korrekturen.

## Inhalte

* Der Katalog enthaelt die **199 uebernommenen Fragen** des gelieferten Bestands
  sowie zwei Lorem-Ipsum-Testfragen (`test-video`, `test-person`). Die Bilder sind
  echtes Material, kein Platzhalter.
* Die Validierung meldet **85 Warnungen**. Der groesste Teil sind fehlende
  Erklaerungstexte (42) und fehlende Bildnachweise (17) - beides redaktionelle
  Arbeit, kein technischer Mangel. 21 Warnungen betreffen die absichtlich kleinen
  Pools der beiden Testplaetze (siehe unten). Zwei Fragen (119, 127) tragen zwei
  identische Antwortoptionen und sind so nicht spielbar.

## Testplaetze am Anfang jedes Spiels

Fragenplatz 1 und 2 sind in **allen** Presets auf die beiden Testfragen
festgelegt, damit sich Videofrage und Portraetanordnung ohne Durchspielen pruefen
lassen. Das ist eine Vorrichtung fuer die Entwicklung, keine Dramaturgie: Vor der
Veranstaltung werden die beiden Plaetze in `content/source/config.json` wieder
durch redaktionelle Filter ersetzt.

Die Testfragen tragen die Kategorie `saarbruecken` als zweite Kategorie. Das ist
kein Inhalt, sondern der Schluessel zum regionalen Modus - er filtert auf diese
Kategorie und haette sonst keinen Kandidaten fuer die beiden Plaetze.

## Videofragen

Das mitgelieferte `testvideo.mp4` ist **Testmaterial ohne redaktionelle
Freigabe**. Es liegt unter `content/source/assets/video/` und haengt an der Frage
`test-video`.

Die Videologik ist vollstaendig umgesetzt und getestet: Buzzersperre waehrend des
Videos, Start/Pause/Neustart/Springen, `Frage einblenden` als zweite Phase
derselben Frage, Fehlermeldung mit `Frage ueberspringen` bei nicht ladbarem
Medium. Der End-to-End-Fall 7 der Spezifikation laeuft.

Zwei Punkte dazu:

* **Das Chromium der Testumgebung spielt die Datei nicht.** Es kennt H.264 und
  AAC nicht (`canPlayType` liefert leer) und zeigt "Video nicht verfuegbar". Im
  ausgelieferten Browser und in der Desktopanwendung spielt dieselbe Datei. Der
  End-to-End-Test prueft deshalb den Ablauf, nicht die Wiedergabe.
* **Der Positionsregler reicht nur bis zur bereits erreichten Stelle.** Die
  Spieldauer steht im Serverzustand nicht zur Verfuegung; der Regler behilft sich
  mit der aktuellen Position. Vorwaerts springen laesst sich damit nicht. Wer das
  braucht, muss die Dauer in den Zustand aufnehmen - der Buehnenclient kennt sie
  aus `loadedmetadata`.

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

## Ton und Medien im Browserbetrieb

- **Tonausgabe braucht eine Interaktion je Fenster.** Browser geben Audio erst
  frei, nachdem im jeweiligen Dokument geklickt oder getippt wurde. Operator und
  Buehne holen die Freigabe beim ersten Klick selbst; die Desktop-Anwendung
  erlaubt die Wiedergabe ohnehin. Ein Buehnenfenster, das nie angeklickt wird,
  kann im Browser stumm bleiben - dann zeigt die Diagnose unter `Tonausgabe`,
  welches Fenster gerade den Ton fuehrt.
- **Mediendateien werden zuerst im gebauten Paket gesucht, danach unter
  `content/source/assets`.** Die Kopien im Paket entstehen erst bei
  `pnpm content:build`; ohne diesen Rueckfall zeigte eine frisch geklonte
  Arbeitskopie ueberall Ersatzbilder. In einer ausgelieferten Anwendung gibt es
  das Quellverzeichnis nicht - dort gilt allein das Paket.
- **Nach `git pull` neu bauen.** `apps/web/dist` und die Bildkopien in
  `content/dist/assets` liegen nicht im Repository. Wer den ausgelieferten Stand
  testen will, ruft `pnpm build` auf; im Alltag genuegt `pnpm dev`, weil Vite die
  Quellen direkt ausliefert.
