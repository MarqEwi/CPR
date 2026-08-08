// Native Zweige: Diese Fehlerklasse ist im Browser unsichtbar, weil dort
// alles klaglos funktioniert, während die WebView native Wege braucht.
// Deshalb wird hier die App-Umgebung nachgestellt und geprüft, dass die
// Capacitor-Plugins wirklich angesprochen werden.
import { test, expect } from "@playwright/test";
import { appOeffnen, capacitorMock, einsatzStarten } from "./helfer.mjs";

test.beforeEach(async ({ page }) => {
  await appOeffnen(page, { vorher: capacitorMock });
});

test("startet in der App-Umgebung ohne Konsolenfehler und registriert Listener", async ({ page }) => {
  const fehler = [];
  page.on("pageerror", e => fehler.push("PAGEERROR: " + e.message));
  await page.reload();
  await page.waitForFunction(() => !!window.CPRA);

  const listener = await page.evaluate(() => Object.keys(window.__listener || {}));
  expect(listener).toContain("backButton");
  expect(listener).toContain("appStateChange");
  expect(fehler).toEqual([]);
});

test("Zurück-Taste: schließt erst Dialoge, beendet nie einen laufenden Einsatz", async ({ page }) => {
  /* Offener Dialog: Zurück schließt ihn nur */
  await page.click("#btn-settings");   // ohne Einsatz: Titelleiste ist sichtbar
  await expect(page.locator("#modal-settings")).toHaveClass(/open/);
  await page.evaluate(() => window.__listener.backButton());
  await expect(page.locator("#modal-settings")).not.toHaveClass(/open/);

  /* Laufender Einsatz: Zurück beendet die App NICHT, sondern erklärt den Weg */
  await einsatzStarten(page);
  await page.evaluate(() => { window.__listener.backButton(); window.__listener.backButton(); });
  const beendetImEinsatz = await page.evaluate(() =>
    window.__calls.filter(c => c.name === "App.exitApp").length);
  expect(beendetImEinsatz).toBe(0);
  await expect(page.locator("#view-aktiv")).toHaveClass(/active/);
  await expect(page.locator("#toast")).toContainText("Einsatz läuft");

  /* Ohne Einsatz: erst Hinweis, zweites Drücken beendet */
  await page.click("#btn-rosc");
  await page.click("#rosc-ok");
  await page.click("#btn-ende");
  await page.click("#ende-ok");
  await page.evaluate(() => window.__listener.backButton());
  const nachHinweis = await page.evaluate(() =>
    window.__calls.filter(c => c.name === "App.exitApp").length);
  expect(nachHinweis).toBe(0);
  await page.evaluate(() => window.__listener.backButton());
  const nachZweitem = await page.evaluate(() =>
    window.__calls.filter(c => c.name === "App.exitApp").length);
  expect(nachZweitem).toBe(1);
});

test("Bildschirm anlassen: natives Plugin wird beim Einsatz gerufen und am Ende freigegeben", async ({ page }) => {
  const rufe = async () => page.evaluate(() =>
    window.__calls.filter(c => c.name.startsWith("BildschirmWach")).map(c => c.name));

  expect(await rufe()).toEqual([]);            // ohne Einsatz kein Zugriff

  await einsatzStarten(page);
  await expect.poll(rufe).toEqual(["BildschirmWach.an"]);

  /* Einsatz beenden gibt den Bildschirm wieder frei */
  await page.click("#btn-rosc");
  await page.click("#rosc-ok");
  await page.click("#btn-ende");
  await page.click("#ende-ok");
  await expect.poll(rufe).toEqual(["BildschirmWach.an", "BildschirmWach.aus"]);
});

test("Bildschirm anlassen: der Schalter in den Einstellungen wirkt sofort", async ({ page }) => {
  const rufe = async () => page.evaluate(() =>
    window.__calls.filter(c => c.name.startsWith("BildschirmWach")).map(c => c.name));

  await einsatzStarten(page);
  await expect.poll(rufe).toEqual(["BildschirmWach.an"]);

  /* Mitten im Einsatz abschalten: Bildschirm wird sofort freigegeben.
     Das Zahnrad sitzt im Einsatz in der Kopfzeile, nicht in der Titelleiste. */
  await page.click("#btn-settings-einsatz");
  await expect(page.locator("#s-bildschirm")).toBeChecked();
  await page.locator("#modal-settings .switchrow", { hasText: "Bildschirm anlassen" })
    .locator(".switch").click();
  await expect.poll(rufe).toEqual(["BildschirmWach.an", "BildschirmWach.aus"]);
  expect(await page.evaluate(() => window.CPRA.Einst.werte.bildschirmAn)).toBe(false);

  /* Wieder einschalten: sofort wieder aktiv */
  await page.locator("#modal-settings .switchrow", { hasText: "Bildschirm anlassen" })
    .locator(".switch").click();
  await expect.poll(rufe).toEqual(
    ["BildschirmWach.an", "BildschirmWach.aus", "BildschirmWach.an"]);

  /* Die Einstellung überlebt einen Neustart und gilt auch dann */
  await page.reload();
  await page.waitForFunction(() => !!window.CPRA);
  expect(await page.evaluate(() => window.CPRA.Einst.werte.bildschirmAn)).toBe(true);
  await expect.poll(rufe).toContain("BildschirmWach.an");
});

test("appStateChange: Rückkehr in die App fordert den WakeLock neu an", async ({ page }) => {
  await einsatzStarten(page);
  /* Die Wake-Lock-API existiert in der Testumgebung; entscheidend ist,
     dass die App sie beim Aktivwerden erneut anfordert. */
  const angefordert = await page.evaluate(async () => {
    let zaehler = 0;
    const echt = navigator.wakeLock;
    Object.defineProperty(navigator, "wakeLock", {
      value: { request: async () => { zaehler++; return { addEventListener(){}, release: async () => {} }; } },
      configurable: true
    });
    window.CPRA.WakeLock.sperre = null;
    window.__listener.appStateChange({ isActive: true });
    await new Promise(r => setTimeout(r, 50));
    if (echt) Object.defineProperty(navigator, "wakeLock", { value: echt, configurable: true });
    return zaehler;
  });
  expect(angefordert).toBe(1);
});

test("Werbung bleibt aus, der Kauf ist aktiv aber ohne Store nicht verfügbar", async ({ page }) => {
  const r = await page.evaluate(() => ({
    ads: window.CPRA.Ads.ENABLED,
    adsVerfuegbar: window.CPRA.Ads.available(),
    billing: window.CPRA.Billing.ENABLED,
    /* Ohne das Store-Modul (CdvPurchase) darf kein Kauf versucht werden. */
    billingVerfuegbar: window.CPRA.Billing.available(),
    adbarSichtbar: getComputedStyle(document.getElementById("adbar")).display
  }));
  expect(r.ads).toBe(false);
  expect(r.adsVerfuegbar).toBe(false);
  expect(r.billing).toBe(true);
  expect(r.billingVerfuegbar).toBe(false);
  expect(r.adbarSichtbar).toBe("none");

  /* Ein Kaufversuch ohne Store endet mit einem Hinweis, nicht mit einem Fehler */
  const fehler = [];
  page.on("pageerror", e => fehler.push(e.message));
  await page.evaluate(() => window.CPRA.Billing.kaufen());
  await expect(page.locator("#toast")).toContainText("Play Store");
  expect(fehler).toEqual([]);
});
