// Playwright-Konfiguration: testet die Web-Version aus dem Repo-Root
// (Chromium liegt vorinstalliert unter /opt/pw-browsers, siehe PLAYWRIGHT_BROWSERS_PATH).
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  // Großzügig: Mehrere Tests spulen mit der gefälschten Uhr ganze
  // Reanimations-Abläufe durch und laufen dabei parallel. 30 s reichten
  // dafür unter Last nicht zuverlässig.
  timeout: 60000,
  // Die App übernimmt beim ersten Start die Gerätesprache. Damit die Tests
  // eine feste Sprache prüfen, ist der Browser hier deutsch eingestellt;
  // das Umschalten selbst prüft tests/sprache.spec.mjs ausdrücklich.
  use: { baseURL: "http://127.0.0.1:8931", locale: "de-DE" },
  webServer: {
    command: "python3 -m http.server 8931",
    url: "http://127.0.0.1:8931/",
    reuseExistingServer: true
  },
  projects: [{
    name: "chromium",
    use: {
      browserName: "chromium",
      // Vorinstallierter Chromium (kein Download nötig; PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1)
      launchOptions: { executablePath: "/opt/pw-browsers/chromium" }
    }
  }]
});
