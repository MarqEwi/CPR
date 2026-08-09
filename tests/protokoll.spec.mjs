// Korrigierbarkeit während des Einsatzes: letzte Maßnahme rückgängig machen,
// Medikamente jederzeit manuell geben, Live-Protokoll mit Löschfunktion.
import { test, expect } from "@playwright/test";
import { appOeffnen, einsatzStarten } from "./helfer.mjs";

async function massnahmeDokumentieren(page, index = 0){
  await page.click("#btn-massnahme");
  await expect(page.locator("#modal-massnahme")).toHaveClass(/open/);
  await page.locator("#massnahmen-wahl button").nth(index).click();
  await expect(page.locator("#modal-massnahme")).not.toHaveClass(/open/);
}

/* ------------------------------------------------------------------ */
test("die letzte Maßnahme lässt sich rückgängig machen und wird benannt", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);

  /* Ohne Maßnahme keine Rückgängig-Zeile. */
  await page.click("#btn-massnahme");
  await expect(page.locator("#ms-undo")).toBeHidden();
  await page.locator("#massnahmen-wahl button").first().click();

  /* Nach dem Dokumentieren nennt die Zeile die Maßnahme mit Uhrzeit. */
  await page.click("#btn-massnahme");
  await expect(page.locator("#ms-undo")).toBeVisible();
  await expect(page.locator("#ms-undo-was")).toContainText("i.v.-Zugang");
  await expect(page.locator("#ms-undo-was")).toContainText("Uhr");

  await page.click("#ms-undo-btn");
  await expect(page.locator("#toast")).toContainText("i.v.-Zugang");
  await expect(page.locator("#ms-undo")).toBeHidden();

  /* Weg aus Schnellauswahl-Haken UND Protokoll. */
  const stand = await page.evaluate(() => {
    const e = window.CPRA.Einsatz.e;
    return {
      massnahmen: e.massnahmen.length,
      imProtokoll: e.ereignisse.some(ev => ev.typ === "massnahme")
    };
  });
  expect(stand.massnahmen).toBe(0);
  expect(stand.imProtokoll).toBe(false);
  await expect(page.locator("#massnahmen-wahl button").first()).not.toHaveClass(/erfasst/);
});

test("rückgängig trifft immer die zuletzt dokumentierte Maßnahme", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);
  await massnahmeDokumentieren(page, 0);   /* i.v.-Zugang */
  await massnahmeDokumentieren(page, 3);   /* Intubation */

  await page.click("#btn-massnahme");
  await expect(page.locator("#ms-undo-was")).toContainText("Intubation");
  await page.click("#ms-undo-btn");

  /* Die erste Maßnahme bleibt unberührt. */
  await expect(page.locator("#ms-undo-was")).toContainText("i.v.-Zugang");
  const namen = await page.evaluate(() =>
    window.CPRA.Einsatz.e.massnahmen.map(m => m.id));
  expect(namen).toEqual(["ivzugang"]);
});

test("Adrenalin und Antiarrhythmikum lassen sich sofort geben, auch zu früh", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);

  /* Direkt nach dem Start funktioniert der Knopf – und dass die Gabe zu
     früh war, zeigt der Status danach: "zu früh" heißt, das Fenster von
     3 Minuten war noch nicht erreicht, die Gabe wurde trotzdem erfasst. */
  await expect(page.locator("#btn-adrenalin")).toBeEnabled();
  await page.click("#btn-adrenalin");
  await expect(page.locator("#toast")).toContainText("Adrenalin");
  await expect(page.locator("#adr-pill")).toHaveText(/zu früh/i);

  /* Amiodaron vor jedem Schock – ebenfalls möglich. */
  await expect(page.locator("#btn-amiodaron")).toBeEnabled();
  await page.click("#btn-amiodaron");
  await expect(page.locator("#toast")).toContainText(/Amiodaron/i);

  const stand = await page.evaluate(() => ({
    adrenalin: window.CPRA.Einsatz.e.adrenalin.length,
    aa: window.CPRA.Einsatz.e.amiodaron.length,
    schocks: window.CPRA.Einsatz.e.schocks.length
  }));
  expect(stand.adrenalin).toBe(1);
  expect(stand.aa).toBe(1);
  expect(stand.schocks).toBe(0);
});

test("das Live-Protokoll zeigt den laufenden Einsatz und löscht nur Maßnahmen", async ({ page }) => {
  await appOeffnen(page);

  /* Ohne Einsatz gibt es die Zeile nicht. */
  await page.click("#btn-settings");
  await expect(page.locator("#s-protokoll")).toBeHidden();
  await page.click('#modal-settings [data-close="modal-settings"]');

  await einsatzStarten(page);
  await massnahmeDokumentieren(page, 0);
  await page.click("#btn-adrenalin");

  await page.click("#btn-settings-einsatz");
  await expect(page.locator("#s-protokoll")).toBeVisible();
  await page.click("#s-protokoll");
  await expect(page.locator("#modal-protokoll")).toHaveClass(/open/);

  /* Start, Maßnahme und Adrenalin stehen drin – mit Uhrzeit samt "Uhr". */
  const liste = page.locator("#protokoll-liste li");
  await expect(liste).toHaveCount(3);
  await expect(liste.nth(0)).toContainText("Einsatz gestartet");
  await expect(liste.nth(1)).toContainText("i.v.-Zugang");
  await expect(liste.nth(2)).toContainText("Adrenalin");
  await expect(liste.nth(1).locator(".uhr")).toContainText("Uhr");

  /* Löschknopf nur an der Maßnahme, nicht an Start oder Adrenalin. */
  await expect(liste.nth(0).locator(".klein-btn")).toHaveCount(0);
  await expect(liste.nth(1).locator(".klein-btn")).toHaveCount(1);
  await expect(liste.nth(2).locator(".klein-btn")).toHaveCount(0);

  await liste.nth(1).locator(".klein-btn").click();
  await expect(page.locator("#protokoll-liste li")).toHaveCount(2);
  await expect(page.locator("#protokoll-liste")).not.toContainText("i.v.-Zugang");

  /* Die Löschung überlebt einen Neustart der App. */
  await page.reload();
  await page.waitForFunction(() => !!window.CPRA);
  await page.waitForSelector("#view-aktiv.active");
  const stand = await page.evaluate(() => ({
    massnahmen: window.CPRA.Einsatz.e.massnahmen.length,
    adrenalin: window.CPRA.Einsatz.e.adrenalin.length
  }));
  expect(stand.massnahmen).toBe(0);
  expect(stand.adrenalin).toBe(1);
});

test("eine gelöschte Maßnahme fehlt auch im Bericht des Einsatzes", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);
  await massnahmeDokumentieren(page, 0);
  await massnahmeDokumentieren(page, 4);   /* Kapnographie bleibt */

  await page.click("#btn-settings-einsatz");
  await page.click("#s-protokoll");
  await page.locator('#protokoll-liste li:has-text("i.v.-Zugang") .klein-btn').click();
  await page.click('#modal-protokoll [data-close="modal-protokoll"]');

  /* Einsatz beenden und den Bericht setzen lassen. */
  await page.evaluate(() => window.CPRA.Einsatz.beenden(Date.now()));
  const text = await page.evaluate(() => {
    const { Bericht, Einsatz } = window.CPRA;
    return JSON.stringify(Bericht.seiten(Einsatz.archiv()[0]));
  });
  expect(text).toContain("Kapnographie");
  expect(text).not.toContain("i.v.-Zugang");
});
