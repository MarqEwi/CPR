// Premium-Erweiterungen: eigene Maßnahmen, bearbeitbare Grundeinstellungen
// (Algorithmus-Profile) und der Quellen-Nachweis der Leitlinien.
import { test, expect } from "@playwright/test";
import { appOeffnen, einsatzStarten } from "./helfer.mjs";

/* Premium ohne Kaufvorgang setzen – der Kauf selbst ist nicht Gegenstand
   dieser Tests und im Browser ohnehin nicht möglich. */
async function premiumFreischalten(page){
  await page.evaluate(() => window.CPRA.Edition.set("premium"));
  await page.reload();
  await page.waitForFunction(() => !!window.CPRA);
}
async function einstellungenOeffnen(page){
  const zahnrad = await page.locator("#btn-settings-einsatz").isVisible()
    ? "#btn-settings-einsatz" : "#btn-settings";
  await page.click(zahnrad);
  await expect(page.locator("#modal-settings")).toHaveClass(/open/);
}

/* ------------------------------------------------------------------ */
test("eigene Maßnahmen: ohne Premium gesperrt, mit Premium anlegen, umbenennen, löschen", async ({ page }) => {
  await appOeffnen(page);
  await einstellungenOeffnen(page);

  /* Ohne Premium führt die Zeile in den Premium-Dialog, nicht ins Leere. */
  await page.click("#s-massnahmen");
  await expect(page.locator("#modal-premium")).toHaveClass(/open/);
  await page.click('#modal-premium [data-close="modal-premium"]');

  await premiumFreischalten(page);
  await einstellungenOeffnen(page);
  await page.click("#s-massnahmen");
  await expect(page.locator("#modal-massnahmen-verwaltung")).toHaveClass(/open/);

  await page.fill("#ms-name", "Reanimationsgerät angelegt");
  await page.click("#ms-speichern");
  await expect(page.locator("#ms-liste li")).toHaveCount(1);
  await expect(page.locator("#ms-liste li b")).toHaveText("Reanimationsgerät angelegt");

  /* Umbenennen füllt dasselbe Formular und ersetzt den Eintrag. */
  await page.click("#ms-liste li .umbenennen");
  await expect(page.locator("#ms-name")).toHaveValue("Reanimationsgerät angelegt");
  await page.fill("#ms-name", "LUCAS angelegt");
  await page.click("#ms-speichern");
  await expect(page.locator("#ms-liste li")).toHaveCount(1);
  await expect(page.locator("#ms-liste li b")).toHaveText("LUCAS angelegt");

  /* Im Einsatz steht die eigene Maßnahme unter den festen und wird
     genauso protokolliert. */
  await page.click('#modal-massnahmen-verwaltung [data-close="modal-massnahmen-verwaltung"]');
  await einsatzStarten(page);
  await page.click("#btn-massnahme");
  const knoepfe = page.locator("#massnahmen-wahl button");
  await expect(knoepfe).toHaveCount(7);              // 6 feste + 1 eigene
  await expect(knoepfe.last()).toContainText("LUCAS angelegt");
  await knoepfe.last().click();
  await expect(page.locator("#modal-massnahme")).not.toHaveClass(/open/);
  await expect(page.locator("#massnahme-unter")).toContainText("LUCAS angelegt");

  const protokoll = await page.evaluate(() =>
    window.CPRA.Einsatz.e.ereignisse.filter(x => x.typ === "massnahme").map(x => x.info));
  expect(protokoll).toEqual(["LUCAS angelegt"]);

  /* Löschen entfernt sie aus der Schnellauswahl – der Protokolleintrag des
     laufenden Einsatzes bleibt aber erhalten. */
  await einstellungenOeffnen(page);
  await page.click("#s-massnahmen");
  await page.click("#ms-liste li .weg");
  await expect(page.locator("#ms-liste li")).toHaveCount(0);
  await page.click('#modal-massnahmen-verwaltung [data-close="modal-massnahmen-verwaltung"]');
  await page.click("#btn-massnahme");
  await expect(page.locator("#massnahmen-wahl button")).toHaveCount(6);
  const nachher = await page.evaluate(() =>
    window.CPRA.Einsatz.e.ereignisse.filter(x => x.typ === "massnahme").map(x => x.info));
  expect(nachher).toEqual(["LUCAS angelegt"]);
});

/* ------------------------------------------------------------------ */
test("Grundeinstellungen: eigenes Profil verändert die Logik und ist oben sichtbar", async ({ page }) => {
  await appOeffnen(page);
  await premiumFreischalten(page);
  await einstellungenOeffnen(page);
  await page.click("#s-algo");
  await expect(page.locator("#modal-algo")).toHaveClass(/open/);

  /* Der Standard steht immer an erster Stelle und ist aktiv. */
  await expect(page.locator("#algo-liste li").first()).toHaveClass(/aktiv/);
  await expect(page.locator("#algo-liste li").first().locator("b"))
    .toHaveText("Standard nach Leitlinie");

  /* Adrenalin erst nach 4 Minuten als fällig werten. */
  const regler = page.locator('.algofeld[data-key="ADRENALIN_FRUEH_MS"] input');
  await regler.fill("4");
  await regler.dispatchEvent("input");
  await expect(page.locator('.algofeld[data-key="ADRENALIN_FRUEH_MS"] .wert')).toHaveText("4 min");
  await page.fill("#algo-name", "Klinik Nord");
  await page.click("#algo-speichern");

  /* Der Rechenkern rechnet ab sofort mit dem eigenen Wert. */
  expect(await page.evaluate(() => window.CPRA.KONF.ADRENALIN_FRUEH_MS)).toBe(240000);
  expect(await page.evaluate(() => window.CPRA.ALGO_STANDARD.ADRENALIN_FRUEH_MS)).toBe(180000);

  /* Und das Banner sagt es deutlich – auf der Startseite wie im Einsatz. */
  await page.click('#modal-algo [data-close="modal-algo"]');
  await expect(page.locator("#algo-banner")).toBeVisible();
  await expect(page.locator("#algo-banner")).toContainText("Benutzerdefinierter Algorithmus");
  await expect(page.locator("#algo-banner")).toContainText("Klinik Nord");

  await einsatzStarten(page);
  await expect(page.locator("#algo-banner")).toBeVisible();
  /* Der Einsatz merkt sich, nach welchem Profil er gerechnet wurde. */
  expect(await page.evaluate(() => window.CPRA.Einsatz.e.algo.name)).toBe("Klinik Nord");
  const protokoll = await page.evaluate(() =>
    window.CPRA.Einsatz.e.ereignisse.filter(x => x.typ === "algo").map(x => x.info));
  expect(protokoll).toContain("Algorithmus: Klinik Nord");

  /* Zurück auf den Standard: ein Tipp, Banner weg, Wert zurück. */
  await einstellungenOeffnen(page);
  await page.click("#s-algo");
  await page.click("#algo-liste li:first-child .waehl");
  expect(await page.evaluate(() => window.CPRA.KONF.ADRENALIN_FRUEH_MS)).toBe(180000);
  await page.click('#modal-algo [data-close="modal-algo"]');
  await expect(page.locator("#algo-banner")).toBeHidden();
});

test("Grundeinstellungen wirken sich messbar auf den Zyklus aus", async ({ page }) => {
  await page.clock.install();
  await appOeffnen(page);
  await premiumFreischalten(page);
  await page.evaluate(() => {
    const { Einst, ALGO_STANDARD, Algo } = window.CPRA;
    Einst.set("algoProfile", [{ id: "a1", name: "Kurzzyklus",
      werte: Object.assign({}, ALGO_STANDARD, { ZYKLUS_MS: 90000 }) }]);
    Einst.set("algoId", "a1");
    Algo.anwenden();
  });
  await einsatzStarten(page);
  await page.clock.runFor(1400);
  await expect(page.locator("#ring-zeit")).toHaveText("1:29");
  await page.clock.runFor(89000);
  await expect(page.locator("#view-aktiv")).toHaveClass(/phase-analyse/);
});

test("ohne Premium gilt immer der Standard, auch bei gespeichertem Profil", async ({ page }) => {
  await appOeffnen(page, { vorher: () => {
    localStorage.setItem("cpra_einstellungen", JSON.stringify({
      algoProfile: [{ id: "a1", name: "Fremd", werte: { ZYKLUS_MS: 90000 } }],
      algoId: "a1"
    }));
  } });
  expect(await page.evaluate(() => window.CPRA.KONF.ZYKLUS_MS)).toBe(120000);
  await expect(page.locator("#algo-banner")).toBeHidden();
});

test("unsinnige Profilwerte werden ignoriert, nicht übernommen", async ({ page }) => {
  await appOeffnen(page, { vorher: () => {
    localStorage.setItem("cpra_edition", JSON.stringify("premium"));
    localStorage.setItem("cpra_einstellungen", JSON.stringify({
      algoProfile: [{ id: "a1", name: "Kaputt",
        werte: { ZYKLUS_MS: 1, ADRENALIN_SPAET_MS: 99999999 } }],
      algoId: "a1"
    }));
  } });
  /* Beide Werte liegen außerhalb der erlaubten Grenzen → Standard bleibt. */
  expect(await page.evaluate(() => window.CPRA.KONF.ZYKLUS_MS)).toBe(120000);
  expect(await page.evaluate(() => window.CPRA.KONF.ADRENALIN_SPAET_MS)).toBe(300000);
});

/* ------------------------------------------------------------------ */
test("Leitlinien-Quellen: Titel, Herausgeber, Stand und Link je Quelle", async ({ page }) => {
  await appOeffnen(page);
  await page.click("#btn-quellen");
  await expect(page.locator("#modal-quellen")).toHaveClass(/open/);

  const eintraege = page.locator("#quellen-liste li");
  await expect(eintraege).toHaveCount(3);
  await expect(eintraege.nth(0)).toContainText("ERC Guidelines for Resuscitation 2025");
  await expect(eintraege.nth(0)).toContainText("European Resuscitation Council");
  await expect(eintraege.nth(0)).toContainText("Stand 2025");
  await expect(eintraege.nth(1)).toContainText("German Resuscitation Council");
  await expect(eintraege.nth(2)).toContainText("ILCOR");
  for (const l of await page.locator("#quellen-liste a").all())
    expect(await l.getAttribute("href")).toMatch(/^https:\/\//);

  /* Daneben die Werte, mit denen die App tatsächlich rechnet. */
  await expect(page.locator("#quellen-werte")).toContainText("Länge eines CPR-Zyklus");
  await expect(page.locator("#quellen-werte")).toContainText("2:00 min");
  await expect(page.locator("#quellen-werte")).toContainText("3. Schock");
  await expect(page.locator("#quellen-stand")).toContainText("2026-08-08");
  await expect(page.locator("#quellen-abweichung")).toBeHidden();
});

test("Quellen weisen ausdrücklich auf ein eigenes Profil hin", async ({ page }) => {
  await appOeffnen(page, { vorher: () => {
    localStorage.setItem("cpra_edition", JSON.stringify("premium"));
    localStorage.setItem("cpra_einstellungen", JSON.stringify({
      algoProfile: [{ id: "a1", name: "Klinik Nord", werte: { ZYKLUS_MS: 150000 } }],
      algoId: "a1"
    }));
  } });
  await page.click("#btn-quellen");
  await expect(page.locator("#quellen-abweichung")).toBeVisible();
  await expect(page.locator("#quellen-abweichung")).toContainText("Klinik Nord");
  await expect(page.locator("#quellen-werte")).toContainText("2:30 min");
});

/* ------------------------------------------------------------------ */
test("Protokoll führt jedes Ereignis mit verstrichener Zeit UND Uhrzeit", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);
  await page.click("#btn-adrenalin");
  await einstellungenOeffnen(page);
  await page.click("#s-ende");
  await page.click("#ende-ok");

  await einstellungenOeffnen(page);
  await page.click("#s-archiv");
  await page.click("#archiv-liste li button");
  const zeilen = page.locator("#archiv-verlauf li");
  expect(await zeilen.count()).toBeGreaterThan(2);
  /* Links die Zeit seit Einsatzbeginn, darunter die tatsächliche Uhrzeit. */
  await expect(zeilen.first().locator(".zeit")).toHaveText("0:00");
  await expect(zeilen.first().locator(".uhr")).toHaveText(/^\d\d:\d\d:\d\d Uhr$/);
  await expect(zeilen.nth(1).locator(".uhr")).toHaveText(/ Uhr$/);
  /* Die Zusammenfassung nennt Beginn (mit Uhrzeit) und den Algorithmus. */
  await expect(page.locator("#archiv-zusammen")).toContainText(/\d\d:\d\d Uhr/);
  await expect(page.locator("#archiv-zusammen")).toContainText("Standard nach Leitlinie");
});
