// Grundprüfung: Die App lädt fehlerfrei, zeigt die Bereit-Ansicht mit dem
// Hinweis auf ihre Grenzen und belegt im localStorage ausschließlich
// eigene Schlüssel (alle Web-Versionen teilen sich die Origin!).
import { test, expect } from "@playwright/test";
import { appOeffnen, einsatzStarten } from "./helfer.mjs";

test("lädt ohne Konsolenfehler und zeigt die Bereit-Ansicht", async ({ page }) => {
  const fehler = [];
  page.on("console", m => { if (m.type() === "error") fehler.push(m.text()); });
  page.on("pageerror", e => fehler.push("PAGEERROR: " + e.message));

  await appOeffnen(page);

  expect(fehler).toEqual([]);
  await expect(page).toHaveTitle(/CPR Assist/);
  await expect(page.locator("#view-bereit")).toHaveClass(/active/);
  await expect(page.locator("#view-bereit .hinweisbox"))
    .toContainText("keine Therapieentscheidungen");
  await expect(page.locator("#btn-start")).toBeVisible();
  await expect(page.locator("#head-sub")).toContainText("Bereit");
});

test("Kurzeinführung erscheint beim ersten Start und nie wieder", async ({ page }) => {
  await page.goto("/index.html");                 // ohne übersprungenes Onboarding
  await page.waitForFunction(() => !!window.CPRA);
  await expect(page.locator("#modal-onboarding")).toHaveClass(/open/);
  await expect(page.locator('.ob-step[data-step="0"]'))
    .toContainText("keine Diagnose- oder Therapieentscheidungen");
  await page.click("#ob-next");
  await page.click("#ob-next");
  await page.click("#ob-next");                   // "Verstanden – los geht's"
  await expect(page.locator("#modal-onboarding")).not.toHaveClass(/open/);

  await page.reload();
  await page.waitForFunction(() => !!window.CPRA);
  await expect(page.locator("#modal-onboarding")).not.toHaveClass(/open/);
});

test("Einsatz starten: aktiver Screen, Ring läuft, nur cpra_-Schlüssel", async ({ page }) => {
  const fehler = [];
  page.on("console", m => { if (m.type() === "error") fehler.push(m.text()); });
  page.on("pageerror", e => fehler.push("PAGEERROR: " + e.message));

  await appOeffnen(page);
  await einsatzStarten(page);

  await expect(page.locator("#ring-zeit")).toContainText(/^[12]:\d\d$/);
  await expect(page.locator("#ring-status")).toContainText("Zyklus 1");
  await expect(page.locator("#head-sub")).toContainText("Aktiver Einsatz");
  await expect(page.locator("#btn-cpr")).toContainText("Zyklus neu starten");

  /* Metronom-Standard: 110 aktiv, aus */
  await expect(page.locator('#bpm-chips button[data-bpm="110"]')).toHaveClass(/active/);
  await expect(page.locator("#metro-an")).not.toBeChecked();

  const fremde = await page.evaluate(() =>
    Object.keys(localStorage).filter(k => !k.startsWith("cpra_")));
  expect(fremde).toEqual([]);
  expect(fehler).toEqual([]);
});

test("laufender Einsatz übersteht einen Neustart der App", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);
  await page.click("#btn-rhythmus");
  await page.click('[data-rhythmus="schockbar"]');

  await page.reload();
  await page.waitForFunction(() => !!window.CPRA);

  await expect(page.locator("#view-aktiv")).toHaveClass(/active/);
  await expect(page.locator("#rhythmus-unter")).toContainText("VF/pVT");
  const e = await page.evaluate(() => window.CPRA.Einsatz.e);
  expect(e.rhythmus).toBe("schockbar");
});
