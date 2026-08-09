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

test("das Live-Protokoll zeigt den laufenden Einsatz mit Löschknöpfen", async ({ page }) => {
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

  /* Löschknopf an Maßnahme und Adrenalin – nicht am Start-Ereignis. */
  await expect(liste.nth(0).locator(".klein-btn")).toHaveCount(0);
  await expect(liste.nth(1).locator(".klein-btn")).toHaveCount(1);
  await expect(liste.nth(2).locator(".klein-btn")).toHaveCount(1);

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

/* ------------------------------------------------------------------ */
test("die Rückgängig-Taste nimmt die letzte Handlung komplett zurück", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);

  /* Ohne Handlung keine Taste. */
  await expect(page.locator("#btn-undo")).toBeHidden();

  /* Adrenalin geben → Taste erscheint und nennt die Protokollzeile. */
  await page.click("#btn-adrenalin");
  await expect(page.locator("#btn-undo")).toBeVisible();
  await expect(page.locator("#btn-undo-was")).toContainText("Adrenalin 1 mg");

  await page.click("#btn-undo");
  await expect(page.locator("#toast")).toContainText("Adrenalin");
  await expect(page.locator("#btn-undo")).toBeHidden();
  const adrenalin = await page.evaluate(() => window.CPRA.Einsatz.e.adrenalin.length);
  expect(adrenalin).toBe(0);
});

test("Rückgängig nach einem Schock stellt auch den Zyklus wieder her", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);

  const vorher = await page.evaluate(() => ({
    zyklus: window.CPRA.Einsatz.e.zyklusNr,
    start: window.CPRA.Einsatz.e.zyklusStart
  }));

  /* Schock auslösen (halten) – zählt hoch und startet Zyklus 2. */
  const box = await page.locator("#btn-schock").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();
  await expect(page.locator("#btn-undo-was")).toContainText("Schock 1");
  const mitSchock = await page.evaluate(() => ({
    schocks: window.CPRA.Einsatz.e.schocks.length,
    zyklus: window.CPRA.Einsatz.e.zyklusNr
  }));
  expect(mitSchock.schocks).toBe(1);
  expect(mitSchock.zyklus).toBe(vorher.zyklus + 1);

  /* Rückgängig: Schock UND Zyklusstart verschwinden gemeinsam. */
  await page.click("#btn-undo");
  const nachher = await page.evaluate(() => ({
    schocks: window.CPRA.Einsatz.e.schocks.length,
    zyklus: window.CPRA.Einsatz.e.zyklusNr,
    start: window.CPRA.Einsatz.e.zyklusStart,
    ereignisse: window.CPRA.Einsatz.e.ereignisse.length
  }));
  expect(nachher.schocks).toBe(0);
  expect(nachher.zyklus).toBe(vorher.zyklus);
  expect(nachher.start).toBe(vorher.start);
  expect(nachher.ereignisse).toBe(1);   /* nur noch "Einsatz gestartet" */
});

test("die Rückgängig-Sicherung überlebt einen App-Neustart", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);
  await page.click("#btn-adrenalin");
  await page.reload();
  await page.waitForFunction(() => !!window.CPRA);
  await page.waitForSelector("#view-aktiv.active");
  await expect(page.locator("#btn-undo")).toBeVisible();
  await page.click("#btn-undo");
  const adrenalin = await page.evaluate(() => window.CPRA.Einsatz.e.adrenalin.length);
  expect(adrenalin).toBe(0);
});

test("im Live-Protokoll sind auch Schock und Adrenalin löschbar", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);
  await page.click("#btn-adrenalin");
  const box = await page.locator("#btn-schock").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();

  await page.click("#btn-settings-einsatz");
  await page.click("#s-protokoll");

  /* Adrenalin und Schock tragen Löschknöpfe, Start und Zyklus nicht. */
  const liste = page.locator("#protokoll-liste li");
  await expect(liste).toHaveCount(4);   /* Start, Adrenalin, Schock, Zyklus 2 */
  await expect(liste.nth(0).locator(".klein-btn")).toHaveCount(0);
  await expect(liste.nth(1).locator(".klein-btn")).toHaveCount(1);
  await expect(liste.nth(2).locator(".klein-btn")).toHaveCount(1);
  await expect(liste.nth(3).locator(".klein-btn")).toHaveCount(0);

  /* Schock löschen: Zähler geht auf 0, Statuskarten rechnen neu. */
  await liste.nth(2).locator(".klein-btn").click();
  await expect(page.locator("#protokoll-liste li")).toHaveCount(3);
  let stand = await page.evaluate(() => ({
    schocks: window.CPRA.Einsatz.e.schocks.length,
    adrenalin: window.CPRA.Einsatz.e.adrenalin.length
  }));
  expect(stand.schocks).toBe(0);
  expect(stand.adrenalin).toBe(1);
  await expect(page.locator("#schock-unter")).toContainText("0");

  /* Adrenalin löschen: Status fällt zurück auf "keine Gabe". */
  await page.locator('#protokoll-liste li:has-text("Adrenalin") .klein-btn').click();
  stand = await page.evaluate(() => window.CPRA.Einsatz.e.adrenalin.length);
  expect(stand).toBe(0);
  await expect(page.locator("#adr-wert")).toHaveText("–");

  /* Nach dem Hand-Eingriff gibt es nichts mehr "rückgängig" zu machen. */
  await page.click('#modal-protokoll [data-close="modal-protokoll"]');
  await expect(page.locator("#btn-undo")).toBeHidden();
});
