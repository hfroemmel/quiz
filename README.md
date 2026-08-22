# Live-Quiz

Live-Regiesystem fuer ein Buehnenquiz mit zwei Spielern: ein Operator bedient das
Quiz am Laptop, ein Beamer oder zweiter Bildschirm zeigt ausschliesslich die
oeffentliche Praesentation, ein Moderator kann optional ein iPad im lokalen Netzwerk
verwenden.

**Der Kernbetrieb laeuft vollstaendig offline auf einem einzigen Laptop.** Internet und
WLAN sind nicht erforderlich; LAN-Clients sind eine optionale Ergaenzung.

---

## Schnellstart

```bash
pnpm install                 # Abhaengigkeiten
pnpm content:assets          # Platzhalter-Grafiken erzeugen (einmalig)
pnpm content:validate        # Inhalte pruefen (Pflicht vor jedem Build)
pnpm content:build           # versioniertes Quizpaket bauen
pnpm --filter @quiz/web build
pnpm server                  # lokaler Server auf http://localhost:4319
```

Danach:

| Ansicht | Adresse | Zugriff |
|---|---|---|
| Operator | `http://localhost:4319/operator` | nur vom Veranstaltungslaptop |
| Buehnenscreen | `http://localhost:4319/stage` | oeffentlich, nur oeffentliche Daten |
| Moderator | `http://<laptop-ip>:4319/moderator` | Session-Code erforderlich |
| Entwicklungsvorschau | `http://localhost:5180/preview` | nur im Entwicklungsmodus |

Der Session-Code fuer den Moderator wird beim Start im Terminal und im
Operatorfenster unter „Technik, Protokoll und Verbindung“ angezeigt.

### Desktop-Anwendung (Electron)

```bash
pnpm build:desktop           # Web-Client und Electron-Hauptprozess bauen
pnpm desktop:rebuild-native  # SQLite fuer die Electron-Laufzeit bauen (einmalig)
pnpm dev:desktop             # Operator- und Praesentationsfenster starten
```

Die Desktop-Anwendung startet den lokalen Server selbst, oeffnet das Operatorfenster
und legt das Praesentationsfenster auf das zweite Display (HDMI).

> **Wichtig:** `better-sqlite3` ist ein natives Modul und passt immer nur zu einer
> Laufzeit. Nach `pnpm desktop:rebuild-native` funktionieren `pnpm server` und
> `pnpm test` erst wieder nach `pnpm server:rebuild-native`. Die Anwendung meldet
> das im Fehlerfall im Klartext.

### Entwicklung

```bash
pnpm dev        # Vite-Dev-Server und Quizserver parallel
pnpm test       # Domain-, Inhalts- und Servertests (100 Tests)
pnpm test:e2e   # Playwright: vollstaendige Spiele und Praesentation (32 Tests)
pnpm typecheck  # TypeScript ueber alle Pakete
```

---

## Bedienung in einem Satz

Der Operator waehlt Quizmodus und Schwierigkeits-Preset, startet das Spiel, gibt pro
Frage den Buzzer frei, loggt die genannte Antwort ein, loest auf und klickt `Weiter`.
Nach sieben Fragen zeigt `Weiter` das Ergebnis.

Die ausfuehrliche Fassung steht in [`docs/operator-kurzanleitung.md`](docs/operator-kurzanleitung.md).

---

## Projektstruktur

```text
apps/
  desktop/     Electron: Hauptprozess, Preload, Fenster, Geraeteintegration
  web/         React: Operator, Buehne, Moderator, Entwicklungsvorschau
packages/
  contracts/   Typen, Laufzeitschemas, Befehle, View-Modelle, zentrale Konfiguration
  domain/      Spielregeln: Zustandsmaschine, Scoring, Buzzer, Fragenauswahl
  content/     Quizdaten: Legacy-Import, Validierung, Pakete, Hotfix-Overlay
  persistence/ SQLite: Migrationen, transaktionale Befehlsuebernahme
  presentation/ Buehnenflaeche: Szenen, Uebergaenge, Bausteine, Stylesheet
  runtime/     Anwendungsschicht: Befehlsverarbeitung, Timer, Wiederherstellung
  server/      Transport des Buehnenbetriebs: HTTP-Auslieferung und WebSocket
content/
  source/      redaktionelle Quelle (JSON) und Medien
  dist/        gebautes, versioniertes Quizpaket - einzige Laufzeitquelle
  reports/     Validierungs- und Build-Berichte
test/e2e/      Playwright-Tests
runtime/       SQLite-Datenbank und Exporte (nicht im Repository)
```

Jedes Paket besitzt eine eigene `README.md` mit Verantwortung, oeffentlicher API und
Abhaengigkeiten.

---

## Dokumentation

| Thema | Datei |
|---|---|
| Architektur und Modulverantwortungen | [docs/architektur.md](docs/architektur.md) |
| Entwurf: ein Kern, drei Kontexte (Buehne, alleinstehend, Multigame) | [docs/mehrkontext-architektur.md](docs/mehrkontext-architektur.md) |
| Phasen und Zustandsdiagramm | [docs/zustandsmaschine.md](docs/zustandsmaschine.md) |
| Alle Befehle und Rollenrechte | [docs/befehle.md](docs/befehle.md) |
| Quizpaket-Schema mit Beispiel | [docs/quizpaket.md](docs/quizpaket.md) |
| Import und Validierung | [docs/inhalte-import.md](docs/inhalte-import.md) |
| Uebernahme des Original-Fragenkatalogs | [docs/inhalte-uebernahme.md](docs/inhalte-uebernahme.md) |
| Neue Quizmodi und Presets | [docs/neue-modi-und-presets.md](docs/neue-modi-und-presets.md) |
| Neue Fragetypen | [docs/neue-fragetypen.md](docs/neue-fragetypen.md) |
| Designsystem: Farben, Raster, Typografie | [docs/design-system.md](docs/design-system.md) |
| Screens Zustand fuer Zustand | [docs/screens.md](docs/screens.md) |
| Animationskatalog (Freigabe) | [docs/animationskatalog.md](docs/animationskatalog.md) |
| Ergaenzung der Spezifikation: visuelle Umsetzung | [docs/spezifikation-ergaenzung-design.md](docs/spezifikation-ergaenzung-design.md) |
| Umsetzungsplan der Oberflaeche | [docs/umsetzungsplan-ui.md](docs/umsetzungsplan-ui.md) |
| Uebergangsanimationen anpassen und testen | [docs/animationen.md](docs/animationen.md) |
| Datenbank und Wiederherstellung | [docs/datenbank-und-wiederherstellung.md](docs/datenbank-und-wiederherstellung.md) |
| Operator-Kurzanleitung fuer den Live-Betrieb | [docs/operator-kurzanleitung.md](docs/operator-kurzanleitung.md) |
| Bekannte Einschraenkungen | [docs/bekannte-einschraenkungen.md](docs/bekannte-einschraenkungen.md) |

---

## Leitprinzipien

1. Der Serverzustand ist verbindlich; Clients senden Befehle und rendern Zustand.
2. Private Loesungen werden serverseitig vom oeffentlichen Modell getrennt.
3. Jede irreversible Aktion ist transaktional, idempotent und protokolliert.
4. Der Offline-Ein-Laptop-Betrieb funktioniert immer.
5. Wiederherstellung ist Teil des Kernprodukts.
6. Eine fachliche Regel existiert an genau einer Stelle.
7. Animationen sind austauschbare Praesentation, nie Geschaeftslogik.
