# CPR Assist – Erwachsenen-Reanimation (ALS / ACLS)

CPR Assist ist eine **kognitive Unterstützung und ein strukturiertes
Ereignis-Protokoll** für die Reanimation Erwachsener nach den
Reanimationsleitlinien 2025 – wahlweise nach **ERC / ALS** (Europa)
oder nach **AHA / ACLS** (USA). Die App strukturiert den Ablauf – 2-Minuten-Zyklen,
Rhythmusanalyse, Medikamenten-Status, reversible Ursachen, Post-ROSC – und
protokolliert jedes Ereignis mit Zeitstempel.

> **CPR Assist trifft keine Therapieentscheidungen.** Die App ersetzt weder
> Ausbildung noch klinisches Urteil; verantwortlich bleibt das behandelnde
> Team. Alle Daten bleiben **lokal auf dem Gerät** – kein Konto, kein Server,
> keine Cloud, kein Tracking. **Werbung gibt es nicht** – auch nicht später.
> Es gibt einen freiwilligen Einmalkauf („Premium“) für Komfortfunktionen;
> die **wichtigsten Funktionen für die Reanimation bleiben kostenfrei**.

## Funktionen (V1)

- **2-Minuten-CPR-Zyklen** als großer Fortschrittsring mit Restzeit; die
  letzten 10 Sekunden warnen sichtbar, danach wechselt die App klar in das
  **Analysefenster** (Rhythmus prüfen, Helfer wechseln)
- **Adrenalin-Status** statt roher Zahl: zu früh (&lt; 3 min) · fällig
  (3–5 min) · überfällig (&gt; 5 min) – plus „so bald wie möglich" bei nicht
  schockbarem Rhythmus ohne bisherige Gabe
- **Amiodaron als Dosis-/Ereignisstatus:** 300 mg nach dem 3. Schock bei
  VF/pVT, 150 mg möglich nach dem 5. Schock – kein Wiederhol-Countdown
- **Rhythmusauswahl** VF/pVT · PEA/Asystolie · unklar, mit Auswirkungen auf
  Schock- und Medikamenten-Hinweise
- **Schock-Protokoll** mit Zähler, abgesichert per Halten gegen
  versehentliche Auslösung, danach sofortige Rückkehr in die CPR
- **4 H's &amp; HITS** (reversible Ursachen) als strukturiertes Bottom Sheet:
  jede Ursache mit drei Zuständen (offen · geprüft/unwahrscheinlich ·
  verdächtig/behandelt) und optionaler Kurznotiz
- **Post-ROSC-Modus** mit den Erinnerungen der Leitlinie (Oxygenierung →
  SpO₂ 94–98 %, Normokapnie, Ursache erkennen und behandeln, 12-Kanal-EKG,
  hämodynamische Stabilisierung) und klarem **Re-Arrest**-Weg zurück in die CPR
- **Metronom** 100 / 110 / 120 pro Minute (Standard 110), ein-/ausschaltbar,
  mit optischem Puls. Erreichbar an drei Stellen, die auf denselben Dialog
  führen: Vorwahl auf der Startseite, kleiner Knopf in der Einsatz-Kopfzeile
  und Einstellungen → Metronom. Außerhalb eines Einsatzes wird die Auswahl
  nur gespeichert und klingt nicht
- **Ereignis-Protokoll** im Hintergrund: jeder Schritt mit Zeitstempel
- **Korrigierbar im Einsatz:** Die Taste **Rückgängig** (direkt unter
  „Maßnahme dokumentieren") nimmt die letzte Handlung komplett zurück –
  Schock samt gestartetem Zyklus, Adrenalin- oder Antiarrhythmikum-Gabe,
  Maßnahme, Zyklus-Neustart, Feld-Eintrag – und nennt vorher, was
  zurückgeht (beim Schock den Schock selbst, nicht den Zyklusstart danach).
  Bis zu zehn Schritte nacheinander, per Schnappschuss des ganzen Standes,
  damit auch verkettete Folgen sauber verschwinden; die Taste bleibt
  stehen, bis nichts mehr zurückzunehmen ist. Das **Live-Protokoll**
  (Einstellungen, unter „Einsatz beenden") zeigt den laufenden Verlauf mit
  Uhrzeiten; versehentliche Einträge – Maßnahmen, Schocks,
  Medikamentengaben, eigene Felder – lassen sich dort einzeln löschen, die
  Zähler und Status rechnen danach ohne sie. Zyklen und Zustandswechsel
  tragen die Zeitstruktur und bleiben stehen. Das Maßnahmen-Fenster nennt
  zusätzlich die zuletzt dokumentierte Maßnahme mit eigener
  Rückgängig-Zeile. Das Live-Protokoll ist doppelt erreichbar: als Taste
  unten in der Einsatz-Ansicht und in den Einstellungen
- **Medikamente jederzeit dokumentierbar:** Adrenalin und das
  Antiarrhythmikum lassen sich immer erfassen, auch vor dem empfohlenen
  Fenster – die App zeigt dann „zu früh", entscheidet aber nicht für das
  Team. Ein Doppeltipp-Schutz von fünf Sekunden fängt nur versehentliche
  Mehrfach-Tipps ab
- **Einsatzberichte benennen und weitergeben:** Jeder gespeicherte Einsatz
  bekommt auf Wunsch einen eigenen Namen und führt danach die Liste damit an.
  Aus ihm entsteht auf dem Gerät ein Bericht mit Zusammenfassung und
  vollständigem Protokoll (verstrichene Zeit **und** Uhrzeit), wahlweise als
  mehrseitiges **PDF** oder als **PNG je Seite** – jeweils zum Teilen oder zum
  Ablegen auf dem Gerät. Erzeugt wird ohne Fremdbibliothek: eine einzige
  Seitenbeschreibung wird einmal für das PDF und einmal auf ein Canvas
  gezeichnet, damit beide Ausgaben nicht auseinanderlaufen. Der Bericht
  verlässt das Gerät erst, wenn ein Ziel gewählt wurde
- **Leitlinien-Standard umschaltbar** (kostenfrei, direkt auf der Startseite
  und in den Einstellungen):
  **ERC / ALS** (Europa) oder **AHA / ACLS** (USA). Beide beruhen auf demselben
  ILCOR-Konsens; der Wechsel stellt gleichzeitig um: erste Adrenalingabe bei
  VF/pVT (3. gegenüber 2. Schock), reversible Ursachen (4 H's & HITS
  gegenüber 5 H's & 5 T's), Zielwerte nach ROSC (SpO₂ 94–98 % gegenüber
  90–98 %, systolisch &gt; 100 mmHg gegenüber MAD ≥ 65 mmHg) sowie die
  hinterlegten Quellen. Ein Wechsel im laufenden Einsatz behält gesetzte
  Ursachen und wird protokolliert
- **Antiarrhythmikum wählbar (nur AHA/ACLS):** Amiodaron (Voreinstellung)
  oder Lidocain. Beide gelten als Alternativen zueinander, nicht als
  Kombination – die App führt deshalb immer genau eines als Dosis-Status;
  das andere steht in der Maßnahmen-Schnellauswahl. Ein laufender Einsatz
  behält sein Mittel, weil bereits erfasste Dosen dazugehören
- **Quellenhinweise in der App**: Unter den fachlichen Inhalten (4H/HITS,
  Post-ROSC, Metronom, Grundeinstellungen, Standardwahl) führt je ein
  Hinweis auf Herausgeber, Stand und Link der gerade gültigen Fassung
- **Sechs Sprachen** – Deutsch, English, Français, Español, Italiano,
  Português. Beim ersten Start übernimmt die App die Gerätesprache, danach
  ist sie in den Einstellungen jederzeit umstellbar. International
  gebräuchliche Kurzformen (VF/pVT, PEA, ROSC, etCO₂) bleiben stehen
- **Uhrzeiten im Klartext:** jede Tageszeit erscheint mit dem sprachüblichen
  Zusatz („14:44 Uhr“); das Protokoll führt jedes Ereignis mit der
  verstrichenen Zeit **und** der tatsächlichen Uhrzeit auf die Sekunde
- **Leitlinien &amp; Quellen** in der App hinterlegt: ERC, GRC und ILCOR mit
  Herausgeber, Stand und Link – daneben die Werte, mit denen die App
  tatsächlich rechnet
- **Premium (einmaliger Kauf, freiwillig):** eigene Hinweistöne (vier
  Klangvarianten, Probehören immer möglich), eigene benannte Metronom-Tempi
  im Zielbereich 100–120/min (speichern, umbenennen, löschen, mit einem Tipp
  wählen), eigene Felder mit Timer (z. B. BGA alle 10 min), eigene Maßnahmen
  für die Schnellauswahl (anlegen, umbenennen, löschen) und **bearbeitbare
  Grundeinstellungen** – Zykluslänge, Adrenalin-Fenster und Schock-Schwellen
  als benanntes Profil speicherbar. Die wichtigsten Funktionen für die
  Reanimation bleiben kostenfrei
- **Sichtbarer Hinweis bei eigenem Algorithmus:** Sobald ein eigenes Profil
  aktiv ist, steht „Benutzerdefinierter Algorithmus“ dauerhaft oben – auf der
  Startseite wie im Einsatz. Der Standard der Leitlinie ist immer einen Tipp
  entfernt und lässt sich nicht löschen
- **Bildschirm bleibt im Einsatz an** – weder Abdunkeln noch automatisches
  Sperren; in den Einstellungen abschaltbar
- Dunkles, kontrastreiches Einsatz-Design mit großen Touchflächen

## Technik

- Eine einzige, in sich geschlossene `index.html` (inline CSS/JS, keine
  externen Abhängigkeiten)
- Klar getrennte Ebenen im Code: Konfiguration (alle medizinischen Konstanten
  an einer Stelle) → Rechenkern (Zustandsmaschine und Statusableitung,
  DOM-frei und testbar) → Zustand/Persistenz (localStorage unter
  `cpra_`-Schlüsseln) → Oberfläche → Metronom/Audio → native Module
- Ein laufender Einsatz wird zeitstempelbasiert gerechnet und fortlaufend
  gespeichert – nach einem versehentlichen App-Neustart wird er wieder
  aufgenommen
- `npm run sync` kopiert die Web-Dateien nach `www/` (Quelle für die
  Capacitor-App)
- Service Worker (`sw.js`) wird nur auf `github.io` registriert, nicht in der App
- Plugins werden ausschließlich über `window.Capacitor.Plugins.<Name>`
  angesprochen (kein Bundler, daher kein `Capacitor.registerPlugin`)
- Der Bildschirm wird zweigleisig wachgehalten: nativ über das mitgelieferte
  Plugin `BildschirmWach` (`FLAG_KEEP_SCREEN_ON`, der verlässliche Weg in der
  App, ohne zusätzliche Berechtigung) und zusätzlich über die
  Screen-Wake-Lock-API, die die Web-Version trägt
- Premium hängt an einer einzigen Wahrheit (`Edition.isPremium()`); jede
  Premium-Funktion geht durch dasselbe Tor (`premiumTor()`) und landet sonst
  im Premium-Dialog statt in einer stummen Sackgasse. Der Diamant ist das
  Zeichen dafür: er liegt einmal als `--diamant` im Stylesheet und steckt im
  Hintergrund der Premium-Marke – jeder Premium-Hinweis trägt ihn dadurch von
  selbst, auch der im Maßnahmen-Fenster während des Einsatzes
- Der Bericht wird von Hand gesetzt (`Bericht`): `seiten()` rechnet den
  Umbruch mit den Zeichenbreiten von Helvetica aus und liefert reine
  Zeichenbefehle; `pdf()` macht daraus PDF-Operatoren, `bilder()` zeichnet
  dieselben Befehle auf ein Canvas. Ausgeben übernimmt `Datei` – im Browser
  Download bzw. Web-Share, in der App Filesystem plus Share-Plugin
- Alle sichtbaren Texte stehen in einem Katalog (`TEXTE`), Deutsch ist die
  Leitfassung. Fest im HTML stehende Texte tragen `data-i18n`-Attribute,
  alles Dynamische holt sich seinen Text über `t()`. `npm run texte` prüft,
  dass jede Sprache dieselben Schlüssel und dieselben Platzhalter hat und
  dass kein Schlüssel verlangt wird, den es nicht gibt
- Die Grundeinstellungen der Leitlinie liegen unveränderlich in
  `ALGO_STANDARD`; ein eigenes Profil überschreibt einzelne Werte in `KONF`.
  Der Rechenkern weiß davon nichts und rechnet unverändert weiter. Werte
  außerhalb der erlaubten Grenzen werden verworfen, und ohne Premium gilt
  immer der Standard
- Das AdMob-Modul liegt als ungenutzte Infrastruktur bei und ist
  abgeschaltet – Werbung ist in dieser App nicht vorgesehen

## Tests

Playwright-Tests (vorinstalliertes Chromium, kein `playwright install`):

```
npx playwright test
```

Sechs Ebenen: Rechenkern (jede Status- und Zeitgrenze der Leitlinienlogik),
Smoke/Bedienung (kompletter Einsatzablauf ohne Konsolenfehler), native
Funktionen (nachgestellte Capacitor-Umgebung), Sprache (Umschalten,
Vollständigkeit, Gerätesprache, Uhrzeit-Format), Grundeinstellungen
(eigene Maßnahmen, Algorithmus-Profile, Quellen, Protokoll-Uhrzeiten) und
Berichte (Benennen, PDF-Aufbau samt Querverweistabelle, Bild je Seite,
Download, Teilen über das Share-Plugin).

Der Textkatalog wird zusätzlich ohne Browser geprüft:

```
npm run texte
```

Und die hinterlegten Leitlinien-Links – bewusst getrennt, weil ein Testlauf
nicht davon abhängen soll, ob gerade Netz da ist:

```
npm run quellen
```

## Quellen

Die medizinischen Werte der App folgen den Reanimationsleitlinien 2025. Je
nach gewähltem Standard zeigt die App die zugehörigen Quellen an:

**ERC/GRC (Europa)**

- **ERC Guidelines for Resuscitation 2025**, European Resuscitation Council –
  <https://www.erc.edu/science-research/guidelines/guidelines-2025/guidelines-2025-english/>
- **Reanimation 2025 – Leitlinien des ERC in deutscher Übersetzung**,
  German Resuscitation Council (GRC) –
  <https://www.grc-org.de/wissenschaft/leitlinien>

**AHA/ACLS (USA)**

- **2025 AHA Guidelines for CPR and ECC – Part 9: Adult Advanced Life
  Support**, American Heart Association –
  <https://www.ahajournals.org/doi/10.1161/CIR.0000000000001376>
- **2025 AHA Guidelines for CPR and ECC – Part 11: Post–Cardiac Arrest
  Care**, American Heart Association –
  <https://www.ahajournals.org/doi/10.1161/CIR.0000000000001375>

**Gemeinsame Grundlage beider Standards**

- **ILCOR CoSTR 2025**, International Liaison Committee on Resuscitation –
  <https://www.ilcor.org>

Dieselben Angaben stehen in der App unter „Leitlinien &amp; Quellen“, zusammen
mit dem Datum, an dem die Werte zuletzt dagegen abgeglichen wurden
(`KONF.LEITLINIEN_GEPRUEFT`). Die App gibt keinen Leitlinientext wieder,
sondern bildet nur Zeiten und Reihenfolgen ab.

## Web-Version

Die App läuft als Web-Version unter: <https://marqewi.github.io/CPR/>
(GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root)
