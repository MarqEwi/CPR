// Erzeugt Vorschau-Screenshots der App (Handy-Format) unter docs/screenshots/.
//
//   node scripts/screenshots.mjs
//
// Setzt einen laufenden Webserver auf Port 8931 voraus:
//   python3 -m http.server 8931
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const ZIEL = "docs/screenshots";
mkdirSync(ZIEL, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--lang=de-DE"],
  env: { ...process.env, LANG: "de_DE.UTF-8", LC_ALL: "de_DE.UTF-8" }
});

/* Feste Uhrzeit, damit die Screenshots reproduzierbar sind. */
const JETZT = new Date("2026-08-05T10:30:00").getTime();

/* Öffnet die App, baut über den Rechenkern einen definierten Einsatzstand,
   lädt neu (die App nimmt den Einsatz wieder auf) und fotografiert. */
async function schuss(name, { aufbau, schritte } = {}){
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 892 }, deviceScaleFactor: 2,
    colorScheme: "dark", locale: "de-DE", timezoneId: "Europe/Berlin"
  });
  const page = await ctx.newPage();
  await page.clock.install({ time: JETZT });
  await page.addInitScript(() => localStorage.setItem("cpra_onboarding_done", "true"));
  await page.goto("http://127.0.0.1:8931/index.html");
  await page.waitForFunction(() => !!window.CPRA);
  if (aufbau){
    await page.evaluate(aufbau, JETZT);
    await page.evaluate(() => location.reload());
    await page.waitForFunction(() => !!window.CPRA);
  }
  await page.clock.runFor(500);
  if (schritte) await schritte(page);
  await page.clock.runFor(300);
  /* Kurzhinweise sollen die Bedienelemente im Foto nicht verdecken.
     Hart ausblenden – das Entfernen der Klasse würde nur die 200-ms-
     Transition starten und der Screenshot käme ihr zuvor. */
  await page.evaluate(() => { document.getElementById("toast").style.display = "none"; });
  /* CSS-Transitionen (z. B. die Ringfarbe) laufen auf der ECHTEN Uhr –
     die gefälschte Playwright-Uhr bewegt sie nicht. Kurz echt warten. */
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${ZIEL}/${name}.png` });
  console.log(`${ZIEL}/${name}.png`);
  await ctx.close();
}

/* Laufender Einsatz wie im Referenz-Mockup: Zyklus bei 1:24 Rest, Adrenalin
   vor 3:40 gegeben (fällig), Amiodaron 300 mg nach dem 3. Schock. */
const einsatzAktiv = jetzt => {
  const { Kern } = window.CPRA;
  const t0 = jetzt - 8 * 60000;
  const e = Kern.neuerEinsatz(t0);
  Kern.rhythmusSetzen(e, t0 + 110000, "schockbar");
  Kern.schock(e, t0 + 120000);
  Kern.schock(e, t0 + 245000);
  Kern.schock(e, t0 + 372000);
  Kern.adrenalinGabe(e, jetzt - 220000);
  Kern.amiodaronGabe(e, jetzt - 190000, 300);
  e.zyklusNr = 4;
  e.zyklusStart = jetzt - 36000;          /* 1:24 Rest */
  localStorage.setItem("cpra_einsatz", JSON.stringify(e));
};

await schuss("01-bereit");

await schuss("02-aktiv", { aufbau: einsatzAktiv });

await schuss("03-analyse", { aufbau: jetzt => {
  const { Kern } = window.CPRA;
  const t0 = jetzt - 10 * 60000;
  const e = Kern.neuerEinsatz(t0);
  Kern.rhythmusSetzen(e, t0 + 115000, "nichtschockbar");
  Kern.adrenalinGabe(e, t0 + 130000);
  e.zyklusNr = 4;
  e.zyklusStart = jetzt - 124000;         /* Zyklusende überschritten → Analyse */
  localStorage.setItem("cpra_einsatz", JSON.stringify(e));
} });

await schuss("04-rhythmus", { aufbau: einsatzAktiv, schritte: async p => {
  await p.click("#btn-rhythmus");
} });

await schuss("05-ursachen", { aufbau: jetzt => {
  const { Kern } = window.CPRA;
  const t0 = jetzt - 9 * 60000;
  const e = Kern.neuerEinsatz(t0);
  Kern.ursacheSetzen(e, t0 + 200000, "hypoxie", 1);
  Kern.ursacheSetzen(e, t0 + 260000, "kalium", 2);
  e.ursachenNotiz = "Kalium 6,8 – Kalzium/Glukose-Insulin läuft";
  e.zyklusStart = jetzt - 30000;
  localStorage.setItem("cpra_einsatz", JSON.stringify(e));
}, schritte: async p => {
  await p.click("#btn-ursachen");
} });

await schuss("06-rosc", { aufbau: jetzt => {
  const { Kern } = window.CPRA;
  const t0 = jetzt - 14 * 60000;
  const e = Kern.neuerEinsatz(t0);
  Kern.rhythmusSetzen(e, t0 + 110000, "schockbar");
  Kern.schock(e, t0 + 120000);
  Kern.schock(e, t0 + 246000);
  Kern.adrenalinGabe(e, t0 + 380000);
  Kern.rosc(e, jetzt - 150000);
  e.postRosc.atemweg = true;
  e.postRosc.oxygen = true;
  localStorage.setItem("cpra_einsatz", JSON.stringify(e));
} });

await browser.close();
