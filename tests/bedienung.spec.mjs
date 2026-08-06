// Bedienabläufe: der komplette Einsatz vom Start über Analyse, Schocks,
// Medikamente und 4H/HITS bis zu ROSC, Re-Arrest und Einsatzende.
// Die Playwright-Uhr macht die 2-Minuten-Zyklen im Test beherrschbar.
import { test, expect } from "@playwright/test";
import { appOeffnen, einsatzStarten, halten } from "./helfer.mjs";

test("kompletter Einsatz: Zyklus → Analyse → Schocks → Medikamente", async ({ page }) => {
  await page.clock.install();
  await appOeffnen(page);
  await einsatzStarten(page);

  /* Ring zählt herunter */
  await page.clock.runFor(1400);
  await expect(page.locator("#ring-zeit")).toHaveText("1:59");

  /* Rhythmus: VF/pVT */
  await page.click("#btn-rhythmus");
  await expect(page.locator("#modal-rhythmus")).toHaveClass(/open/);
  await page.click('[data-rhythmus="schockbar"]');
  await expect(page.locator("#modal-rhythmus")).not.toHaveClass(/open/);
  await expect(page.locator("#rhythmus-unter")).toContainText("VF/pVT");

  /* Kurzer Tipp löst KEINEN Schock aus – der Knopf verlangt Halten. */
  await page.locator("#btn-schock").click();
  await expect(page.locator("#schock-unter")).toContainText("bisher 0");

  /* Drei Schocks (gehalten). Jeder Schock startet sofort den nächsten Zyklus. */
  for (let i = 1; i <= 3; i++){
    await halten(page, "#btn-schock", true);
    await expect(page.locator("#schock-unter")).toContainText("bisher " + i);
  }
  const nachSchocks = await page.evaluate(() => ({
    zyklus: window.CPRA.Einsatz.e.zyklusNr,
    phase: window.CPRA.Einsatz.e.phase
  }));
  expect(nachSchocks.phase).toBe("cpr");
  expect(nachSchocks.zyklus).toBe(4);            // 1 + drei Schock-Neustarts

  /* Nach dem 3. Schock: Adrenalin fällig, Amiodaron 300 fällig */
  await expect(page.locator("#adr-pill")).toHaveText("fällig");
  await expect(page.locator("#ami-pill")).toHaveText("300 mg fällig");

  /* Adrenalin geben → zu früh; Amiodaron 300 geben */
  await page.click("#btn-adrenalin");
  await expect(page.locator("#adr-pill")).toHaveText("zu früh");
  await expect(page.locator("#adr-wert")).toHaveText("0:00");
  await page.click("#btn-amiodaron");
  await expect(page.locator("#ami-wert")).toContainText("300 mg gegeben");
  await expect(page.locator("#btn-amiodaron")).toContainText("150 mg gegeben");

  /* Doppel-Tipp-Schutz: direkt nochmal drücken ändert nichts */
  await page.click("#btn-adrenalin");
  const gaben = await page.evaluate(() => window.CPRA.Einsatz.e.adrenalin.length);
  expect(gaben).toBe(1);

  /* 3:00 nach der Gabe wird Adrenalin fällig – unterwegs endet der Zyklus. */
  await page.clock.runFor(125000);
  await expect(page.locator("#view-aktiv")).toHaveClass(/phase-analyse/);
  await expect(page.locator("#ring-zeit")).toHaveText("Analyse");
  await expect(page.locator("#btn-cpr")).toContainText("CPR fortsetzen – Zyklus 5");
  await page.clock.runFor(60000);
  await expect(page.locator("#adr-pill")).toHaveText("fällig");

  /* CPR fortsetzen beendet das Analysefenster */
  await page.click("#btn-cpr");
  await expect(page.locator("#view-aktiv")).not.toHaveClass(/phase-analyse/);
  await expect(page.locator("#ring-status")).toContainText("Zyklus 5");

  /* Adrenalin überfällig ab 5:00 seit Gabe */
  await page.clock.runFor(120000);
  await expect(page.locator("#adr-pill")).toHaveText("überfällig");

  /* Schocks 4 und 5 → Amiodaron-Folgegabe 150 mg möglich, dann erfasst */
  await halten(page, "#btn-schock", true);
  await halten(page, "#btn-schock", true);
  await expect(page.locator("#ami-pill")).toHaveText("150 mg möglich");
  await page.clock.runFor(11000);                 // Doppel-Tipp-Schutz abwarten
  await page.click("#btn-amiodaron");
  await expect(page.locator("#ami-pill")).toHaveText("300 + 150 mg");
  await expect(page.locator("#btn-amiodaron")).toBeDisabled();
});

test("4H/HITS: Tri-State je Ursache plus Notiz, alles im Protokoll", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);

  await page.click("#btn-ursachen");
  await expect(page.locator("#modal-ursachen")).toHaveClass(/open/);
  const zeilen = page.locator("#ursachen-liste li");
  await expect(zeilen).toHaveCount(8);
  await expect(zeilen.nth(0)).toContainText("Hypoxie");
  await expect(zeilen.nth(7)).toContainText("Spannungspneumothorax");

  /* Hypoxie geprüft, Thrombose verdächtig */
  await zeilen.nth(0).locator('button[data-z="1"]').click();
  await zeilen.nth(6).locator('button[data-z="2"]').click();
  await expect(zeilen.nth(0).locator('button[data-z="1"]')).toHaveClass(/active/);
  await expect(zeilen.nth(6).locator('button[data-z="2"]')).toHaveClass(/active/);

  await page.fill("#ursachen-notiz", "Kalium 6,8 – Therapie läuft");
  await page.locator("#modal-ursachen [data-close]").last().click();
  await expect(page.locator("#modal-ursachen")).not.toHaveClass(/open/);
  await expect(page.locator("#ursachen-unter")).toHaveText("6 offen");

  const e = await page.evaluate(() => window.CPRA.Einsatz.e);
  expect(e.ursachen.hypoxie).toBe(1);
  expect(e.ursachen.thrombose).toBe(2);
  expect(e.ursachenNotiz).toBe("Kalium 6,8 – Therapie läuft");
  expect(e.ereignisse.filter(x => x.typ === "ursache")).toHaveLength(2);

  /* Wieder öffnen: Zustände bleiben erhalten */
  await page.click("#btn-ursachen");
  await expect(zeilen.nth(0).locator('button[data-z="1"]')).toHaveClass(/active/);
});

test("ROSC → Post-ROSC-Checkliste → Re-Arrest → Einsatz beenden", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);

  /* ROSC verlangt eine Bestätigung */
  await page.click("#btn-rosc");
  await expect(page.locator("#modal-rosc")).toHaveClass(/open/);
  await page.click("#rosc-ok");
  await expect(page.locator("#view-rosc")).toHaveClass(/active/);
  await expect(page.locator("#head-sub")).toContainText("Post-ROSC");
  await expect(page.locator("#rosc-liste li")).toHaveCount(6);
  await expect(page.locator("#rosc-liste")).toContainText("SpO₂ messbar: Ziel 94–98");

  /* Checkliste abhaken */
  await page.locator('#rosc-liste li[data-k="oxygen"] button').click();
  await expect(page.locator('#rosc-liste li[data-k="oxygen"]')).toHaveClass(/erledigt/);

  /* Re-Arrest (halten) führt zurück in die CPR mit Zyklus 1 */
  await halten(page, "#btn-rearrest", false);
  await expect(page.locator("#view-aktiv")).toHaveClass(/active/);
  await expect(page.locator("#ring-status")).toContainText("Zyklus 1");
  await expect(page.locator("#rhythmus-unter")).toContainText("unklar");

  /* Wieder ROSC, dann beenden – mit Zusammenfassung */
  await page.click("#btn-rosc");
  await page.click("#rosc-ok");
  await page.click("#btn-ende");
  await expect(page.locator("#modal-ende")).toHaveClass(/open/);
  await expect(page.locator("#ende-zusammen")).toContainText("ROSC");
  await page.click("#ende-ok");

  await expect(page.locator("#view-bereit")).toHaveClass(/active/);
  await expect(page.locator("#head-sub")).toContainText("Bereit");
  const speicher = await page.evaluate(() => ({
    aktiv: localStorage.getItem("cpra_einsatz"),
    letzter: JSON.parse(localStorage.getItem("cpra_letzter_einsatz"))
  }));
  expect(speicher.aktiv).toBe(null);
  expect(speicher.letzter.reArrests).toBe(1);
  expect(speicher.letzter.ereignisse.map(x => x.typ)).toContain("ende");
});

test("Maßnahmen: ein Tipp dokumentiert, Fenster schließt sofort", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);

  const taste = page.locator("#btn-massnahme");
  await expect(taste).toContainText("Maßnahme dokumentieren");
  await expect(page.locator("#massnahme-unter")).toHaveText("");

  /* Schnellauswahl: nur die Liste, keine Rückfrage */
  await taste.click();
  await expect(page.locator("#modal-massnahme")).toHaveClass(/open/);
  const zeilen = page.locator("#massnahmen-wahl button");
  await expect(zeilen).toHaveCount(6);
  await expect(zeilen.nth(0)).toContainText("i.v.-Zugang");
  await expect(zeilen.nth(3)).toContainText("Intubation");

  /* Ein Tipp: protokolliert, Fenster zu, Taste zeigt die Maßnahme */
  await page.click('#massnahmen-wahl button[data-massnahme="ivzugang"]');
  await expect(page.locator("#modal-massnahme")).not.toHaveClass(/open/);
  await expect(page.locator("#massnahme-unter")).toContainText("i.v.-Zugang · ");

  /* Zweite Maßnahme; bereits erfasste zeigen ihre Uhrzeit */
  await taste.click();
  await expect(zeilen.nth(0)).toHaveClass(/erfasst/);
  await expect(zeilen.nth(0)).toContainText(/\d\d:\d\d/);
  await page.click('#massnahmen-wahl button[data-massnahme="intubation"]');
  await expect(page.locator("#massnahme-unter")).toContainText("Intubation · ");

  const e = await page.evaluate(() => window.CPRA.Einsatz.e);
  expect(e.massnahmen.map(m => m.id)).toEqual(["ivzugang", "intubation"]);
  expect(e.ereignisse.filter(x => x.typ === "massnahme")).toHaveLength(2);

  /* Im Beenden-Dialog stehen sie in der Zusammenfassung */
  await page.click("#btn-rosc");
  await page.click("#rosc-ok");
  await page.click("#btn-ende");
  await expect(page.locator("#ende-zusammen")).toContainText("i.v.-Zugang, Intubation");
});

test("Maßnahmen sind auch im Post-ROSC-Modus dokumentierbar", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);
  await page.click("#btn-rosc");
  await page.click("#rosc-ok");

  await page.click("#btn-rosc-massnahme");
  await expect(page.locator("#modal-massnahme")).toHaveClass(/open/);
  await page.click('#massnahmen-wahl button[data-massnahme="kapnographie"]');
  await expect(page.locator("#modal-massnahme")).not.toHaveClass(/open/);

  const ids = await page.evaluate(() => window.CPRA.Einsatz.e.massnahmen.map(m => m.id));
  expect(ids).toEqual(["kapnographie"]);
  await expect(page.locator("#view-rosc")).toHaveClass(/active/);
});

test("Metronom: kleiner Eckknopf öffnet die Auswahl, 110 als Standard", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);

  const knopf = page.locator("#btn-metronom");
  await expect(knopf).toHaveText("Metronom aus");
  await expect(knopf).not.toHaveClass(/an/);

  /* Auswahl öffnen: "Aus" ist markiert, solange nichts läuft */
  await knopf.click();
  await expect(page.locator("#modal-metronom")).toHaveClass(/open/);
  await expect(page.locator('#metro-wahl button[data-bpm="0"]')).toHaveClass(/active/);

  /* 110 wählen: Dialog schließt, Knopf zeigt die Frequenz */
  await page.click('#metro-wahl button[data-bpm="110"]');
  await expect(page.locator("#modal-metronom")).not.toHaveClass(/open/);
  await expect(knopf).toHaveText("110/min");
  await expect(knopf).toHaveClass(/an/);
  expect(await page.evaluate(() => window.CPRA.Metronom.an)).toBe(true);

  /* Frequenz wechseln */
  await knopf.click();
  await expect(page.locator('#metro-wahl button[data-bpm="110"]')).toHaveClass(/active/);
  await page.click('#metro-wahl button[data-bpm="120"]');
  await expect(knopf).toHaveText("120/min");
  expect(await page.evaluate(() => window.CPRA.Einst.werte.metronomBpm)).toBe(120);

  /* Abschalten über dieselbe Auswahl */
  await knopf.click();
  await page.click('#metro-wahl button[data-bpm="0"]');
  await expect(knopf).toHaveText("Metronom aus");
  await expect(knopf).not.toHaveClass(/an/);
  expect(await page.evaluate(() => window.CPRA.Metronom.an)).toBe(false);
  /* Die zuletzt gewählte Frequenz bleibt für das nächste Einschalten erhalten */
  expect(await page.evaluate(() => window.CPRA.Einst.werte.metronomBpm)).toBe(120);
});
