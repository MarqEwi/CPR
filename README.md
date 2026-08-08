# CPR Assist – Erwachsenen-Reanimation (ALS)

CPR Assist ist eine **kognitive Unterstützung und ein strukturiertes
Ereignis-Protokoll** für die Reanimation Erwachsener nach den
Reanimationsleitlinien 2025 (GRC/ERC). Die App strukturiert den Ablauf –
2-Minuten-Zyklen, Rhythmusanalyse, Medikamenten-Status, reversible Ursachen,
Post-ROSC – und protokolliert jedes Ereignis mit Zeitstempel.

> **CPR Assist trifft keine Therapieentscheidungen.** Die App ersetzt weder
> Ausbildung noch klinisches Urteil; verantwortlich bleibt das behandelnde
> Team. Alle Daten bleiben **lokal auf dem Gerät** – kein Konto, kein Server,
> keine Cloud, kein Tracking. **Werbung gibt es nicht** – auch nicht später.
> Es gibt einen freiwilligen Einmalkauf („Premium“) für Komfortfunktionen;
> alles Notwendige bleibt kostenlos.

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
  mit optischem Puls
- **Ereignis-Protokoll** im Hintergrund: jeder Schritt mit Zeitstempel
- **Premium (einmaliger Kauf, freiwillig):** eigene Hinweistöne (vier
  Klangvarianten, Probehören immer möglich), frei einstellbares
  Metronom-Tempo im Zielbereich 100–120/min, eigene Felder mit Timer
  (z. B. BGA alle 10 min). Alles für die Reanimation selbst bleibt kostenlos
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
  im Premium-Dialog statt in einer stummen Sackgasse
- Das AdMob-Modul liegt als ungenutzte Infrastruktur bei und ist
  abgeschaltet – Werbung ist in dieser App nicht vorgesehen

## Tests

Playwright-Tests (vorinstalliertes Chromium, kein `playwright install`):

```
npx playwright test
```

Drei Ebenen: Rechenkern (jede Status- und Zeitgrenze der Leitlinienlogik),
Smoke/Bedienung (kompletter Einsatzablauf ohne Konsolenfehler) und native
Funktionen (nachgestellte Capacitor-Umgebung).

## Web-Version

Die App läuft als Web-Version unter: <https://marqewi.github.io/CPR/>
(GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root)
