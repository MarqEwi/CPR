// Metronom-Takt: Ein Taktgeber, der falsch geht, ist schlimmer als keiner.
// Deshalb wird hier der AudioContext instrumentiert und der tatsächliche
// Abstand der geplanten Klicks gemessen – nicht nur die Anzeige geprüft.
import { test, expect } from "@playwright/test";
import { einsatzStarten } from "./helfer.mjs";

/* Zeichnet jeden geplanten Ton mit seiner WebAudio-Startzeit auf. */
function audioMitschnitt(){
  localStorage.setItem("cpra_onboarding_done", "true");
  window.__klicks = [];
  const echt = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function(){
    const o = echt.call(this);
    const start = o.start.bind(o);
    o.start = w => { window.__klicks.push(w); return start(w); };
    return o;
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(audioMitschnitt);
  await page.goto("/index.html");
  await page.waitForFunction(() => !!window.CPRA);
  await einsatzStarten(page);
});

async function metronomWaehlen(page, bpm){
  await page.click("#btn-metronom");
  await page.click(`#metro-wahl button[data-bpm="${bpm}"]`);
}

test("schlägt in exakt dem gewählten Takt (100 / 110 / 120 pro Minute)", async ({ page }) => {
  for (const bpm of [100, 110, 120]){
    await metronomWaehlen(page, bpm);
    await page.evaluate(() => { window.__klicks.length = 0; });
    await page.waitForTimeout(1800);
    const abstaende = await page.evaluate(() =>
      window.__klicks.slice(1).map((w, i) => (w - window.__klicks[i]) * 1000));

    const soll = 60000 / bpm;
    expect(abstaende.length).toBeGreaterThanOrEqual(2);
    /* Die Klicks werden über die WebAudio-Uhr vorausgeplant, deshalb darf
       hier eng geprüft werden: eine Millisekunde Abweichung wäre schon
       ein Fehler in der Rechnung. */
    abstaende.forEach(a => expect(Math.abs(a - soll)).toBeLessThan(1));
  }
});

test("nach einer Drosselung kein Klick-Stau: der Takt setzt neu an", async ({ page }) => {
  await metronomWaehlen(page, 110);
  /* App war im Hintergrund: der Planer kam zwei Sekunden lang nicht dran.
     Verpasste Klicks dürfen NICHT nachgeholt werden – sie lägen alle in
     der Vergangenheit und würden gleichzeitig als Knall abgespielt. */
  const r = await page.evaluate(() => {
    const M = window.CPRA.Metronom, A = window.CPRA.Audio;
    M.naechster = A.ctx.currentTime - 2.0;
    window.__klicks.length = 0;
    M.planen();
    const jetzt = A.ctx.currentTime;
    return { geplant: window.__klicks.length,
             inVergangenheit: window.__klicks.filter(w => w < jetzt).length };
  });
  expect(r.inVergangenheit).toBe(0);
  expect(r.geplant).toBeLessThanOrEqual(1);
});

test("Probehören spielt den Takt, ohne das Metronom einzuschalten", async ({ page }) => {
  await page.click("#btn-metronom");
  await expect(page.locator("#metro-test-wert")).toHaveText("110/min");
  await page.evaluate(() => { window.__klicks.length = 0; });
  await page.click("#metro-test");
  await page.waitForTimeout(300);

  const r = await page.evaluate(() => ({
    klicks: window.__klicks.length,
    abstaende: window.__klicks.slice(1).map((w, i) => (w - window.__klicks[i]) * 1000),
    metronomAn: window.CPRA.Metronom.an,
    einstellung: window.CPRA.Einst.werte.metronomAn
  }));
  /* Eine begrenzte Probe, kein Dauerlauf … */
  expect(r.klicks).toBe(6);
  r.abstaende.forEach(a => expect(Math.abs(a - 60000 / 110)).toBeLessThan(1));
  /* … und sie schaltet nichts ein. */
  expect(r.metronomAn).toBe(false);
  expect(r.einstellung).toBe(false);

  /* Danach wird auch nichts weitergeplant. */
  await page.waitForTimeout(1200);
  await page.evaluate(() => { window.__klicks.length = 0; });
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => window.__klicks.length)).toBe(0);
});

test("Probehören am Regler nimmt den geschobenen Wert", async ({ page }) => {
  await page.click("#btn-metronom");
  await page.locator("#bpm-regler").fill("104");
  await page.locator("#bpm-regler").dispatchEvent("input");
  await expect(page.locator("#regler-test-wert")).toHaveText("104/min");

  await page.evaluate(() => { window.__klicks.length = 0; });
  await page.click("#regler-test");
  await page.waitForTimeout(300);
  const abstaende = await page.evaluate(() =>
    window.__klicks.slice(1).map((w, i) => (w - window.__klicks[i]) * 1000));
  expect(abstaende.length).toBeGreaterThanOrEqual(3);
  abstaende.forEach(a => expect(Math.abs(a - 60000 / 104)).toBeLessThan(1));
  /* Der Wert ist nur probiert, nicht übernommen. */
  expect(await page.evaluate(() => window.CPRA.Einst.werte.metronomBpm)).toBe(110);
});

test("läuft das Metronom, legt die Probe keinen zweiten Takt darüber", async ({ page }) => {
  await metronomWaehlen(page, 110);
  await page.waitForTimeout(300);
  await page.click("#btn-metronom");
  const vorher = await page.evaluate(() => window.__klicks.length);
  await page.click("#metro-test");
  const nachher = await page.evaluate(() => window.__klicks.length);
  /* Der laufende Takt plant weiter – die Probe fügt nichts hinzu. */
  expect(nachher - vorher).toBeLessThanOrEqual(1);
});

test("ausgeschaltet wird kein Ton mehr geplant", async ({ page }) => {
  await metronomWaehlen(page, 120);
  await page.waitForTimeout(600);
  await metronomWaehlen(page, 0);
  await page.evaluate(() => { window.__klicks.length = 0; });
  await page.waitForTimeout(900);
  const nach = await page.evaluate(() => window.__klicks.length);
  expect(nach).toBe(0);
});
