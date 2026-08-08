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
  /* Der Zyklus-Knopf oben tritt im Analysefenster hervor */
  await expect(page.locator("#btn-cpr")).toHaveClass(/dran/);
  await expect(page.locator("#cpr-label")).toHaveText("CPR");
  await expect(page.locator("#ring-status")).toContainText("Rhythmus prüfen");
  await expect(page.locator("#ring-status")).toContainText("Helfer wechseln");
  await page.clock.runFor(60000);
  await expect(page.locator("#adr-pill")).toHaveText("fällig");

  /* CPR fortsetzen beendet das Analysefenster */
  await page.click("#btn-cpr");
  await expect(page.locator("#btn-cpr")).not.toHaveClass(/dran/);
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
  await expect(page.locator("#gesamtzeile")).toContainText("Post-ROSC");
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
  await page.click("#btn-settings-einsatz");
  await page.click("#s-ende");
  await expect(page.locator("#modal-ende")).toHaveClass(/open/);
  await expect(page.locator("#ende-zusammen")).toContainText("ROSC");
  await page.click("#ende-ok");

  await expect(page.locator("#view-bereit")).toHaveClass(/active/);
  await expect(page.locator("header.app")).toBeVisible();   // Titelleiste ist zurück
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
  await expect(knopf).toHaveText("aus");
  await expect(knopf).not.toHaveClass(/an/);

  /* Auswahl öffnen: "Aus" ist markiert, solange nichts läuft */
  await knopf.click();
  await expect(page.locator("#modal-metronom")).toHaveClass(/open/);
  await expect(page.locator('#metro-wahl button[data-bpm="0"]')).toHaveClass(/active/);

  /* 110 wählen: Dialog schließt, Knopf zeigt die Frequenz */
  await page.click('#metro-wahl button[data-bpm="110"]');
  await expect(page.locator("#modal-metronom")).not.toHaveClass(/open/);
  await expect(knopf).toHaveText("110");
  await expect(knopf).toHaveClass(/an/);
  expect(await page.evaluate(() => window.CPRA.Metronom.an)).toBe(true);

  /* Frequenz wechseln */
  await knopf.click();
  await expect(page.locator('#metro-wahl button[data-bpm="110"]')).toHaveClass(/active/);
  await page.click('#metro-wahl button[data-bpm="120"]');
  await expect(knopf).toHaveText("120");
  expect(await page.evaluate(() => window.CPRA.Einst.werte.metronomBpm)).toBe(120);

  /* Abschalten über dieselbe Auswahl */
  await knopf.click();
  await page.click('#metro-wahl button[data-bpm="0"]');
  await expect(knopf).toHaveText("aus");
  await expect(knopf).not.toHaveClass(/an/);
  expect(await page.evaluate(() => window.CPRA.Metronom.an)).toBe(false);
  /* Die zuletzt gewählte Frequenz bleibt für das nächste Einschalten erhalten */
  expect(await page.evaluate(() => window.CPRA.Einst.werte.metronomBpm)).toBe(120);
});

test("Einsatz beenden: der Knopf unten erklärt nur den Weg", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);

  /* Der Knopf ganz unten darf den Einsatz NICHT beenden. */
  await page.click("#btn-ende-hinweis");
  await expect(page.locator("#toast")).toContainText("Einstellungen");
  await expect(page.locator("#view-aktiv")).toHaveClass(/active/);
  expect(await page.evaluate(() => !!window.CPRA.Einsatz.e)).toBe(true);

  /* Der echte Weg führt über die Einstellungen. */
  await page.click("#btn-settings-einsatz");
  await page.click("#s-ende");
  await expect(page.locator("#modal-ende")).toHaveClass(/open/);
  await page.click("#ende-ok");
  await expect(page.locator("#view-bereit")).toHaveClass(/active/);
});

test("Gespeicherte Einsätze: Liste, Verlauf und Löschen", async ({ page }) => {
  await appOeffnen(page);

  /* Ohne Einsätze: leerer Zustand */
  await page.click("#btn-settings");
  await expect(page.locator("#s-archiv-sub")).toHaveText("noch keine");
  await page.click("#s-archiv");
  await expect(page.locator("#modal-archiv")).toHaveClass(/open/);
  await expect(page.locator("#archiv-hinweis")).toContainText("Noch keine beendeten Einsätze");
  await expect(page.locator("#archiv-liste li")).toHaveCount(0);
  await page.locator("#modal-archiv [data-close]").last().click();

  /* Einen Einsatz durchspielen und beenden */
  await einsatzStarten(page);
  await page.click("#btn-rhythmus");
  await page.click('[data-rhythmus="schockbar"]');
  await halten(page, "#btn-schock", false);
  await page.click("#btn-adrenalin");
  await page.click("#btn-settings-einsatz");
  await page.click("#s-ende");
  await page.click("#ende-ok");

  /* Jetzt steht er im Archiv */
  await page.click("#btn-settings");
  await expect(page.locator("#s-archiv-sub")).toContainText("1 Einsatz");
  await page.click("#s-archiv");
  const zeilen = page.locator("#archiv-liste li");
  await expect(zeilen).toHaveCount(1);
  await expect(zeilen.first()).toContainText("1× Schock");
  await expect(zeilen.first()).toContainText("1× Adrenalin");

  /* Detail mit Verlauf öffnen */
  await zeilen.first().locator("button").click();
  await expect(page.locator("#archiv-zusammen")).toContainText("Schocks");
  const verlauf = page.locator("#archiv-verlauf li");
  expect(await verlauf.count()).toBeGreaterThan(3);
  await expect(page.locator("#archiv-verlauf")).toContainText("Adrenalin 1 mg");
  await expect(page.locator("#archiv-verlauf")).toContainText("Einsatz beendet");

  /* Zurück zur Liste, dann alles löschen */
  await page.click("#archiv-zurueck");
  await expect(zeilen).toHaveCount(1);
  await page.click("#archiv-loeschen");
  await expect(page.locator("#archiv-liste li")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("cpra_archiv"))).toBe(null);
});

test("Startseite: Metronom, Hinweistöne und Sofortstart vorwählen", async ({ page }) => {
  await appOeffnen(page);

  /* Standard: Metronom aus, 110 vorgewählt, Töne an, kein Sofortstart */
  await expect(page.locator("#vw-metro")).not.toBeChecked();
  await expect(page.locator("#vw-metro-sub")).toContainText("aus");
  await expect(page.locator('#vw-bpm button[data-bpm="110"]')).toHaveClass(/active/);
  await expect(page.locator("#vw-bpm")).not.toHaveClass(/an/);   // gesperrt solange aus
  await expect(page.locator("#vw-ton")).toBeChecked();
  await expect(page.locator("#vw-autostart")).not.toBeChecked();

  /* Metronom vorwählen und Tempo auf 120 */
  await page.locator("#view-bereit .switchrow", { hasText: "Metronom" }).locator(".switch").click();
  await expect(page.locator("#vw-bpm")).toHaveClass(/an/);
  await expect(page.locator("#vw-metro-sub")).toContainText("110 pro Minute");
  await page.click('#vw-bpm button[data-bpm="120"]');
  await expect(page.locator("#vw-metro-sub")).toContainText("120 pro Minute");

  /* Hinweistöne abwählen – der Einstellungsdialog zeigt denselben Stand */
  await page.locator("#view-bereit .switchrow", { hasText: "Hinweistöne" }).locator(".switch").click();
  await expect(page.locator("#vw-ton")).not.toBeChecked();
  await page.click("#btn-settings");
  await expect(page.locator("#s-ton")).not.toBeChecked();
  await page.locator("#modal-settings .modal-x").click();

  /* Der Einsatz startet mit laufendem Metronom */
  await einsatzStarten(page);
  await expect(page.locator("#btn-metronom")).toHaveClass(/an/);
  await expect(page.locator("#metro-label")).toHaveText("120");
  const w = await page.evaluate(() => window.CPRA.Einst.werte);
  expect(w.metronomAn).toBe(true);
  expect(w.metronomBpm).toBe(120);
  expect(w.ton).toBe(false);
});

test("Sofortstart: die App beginnt beim Öffnen ohne weiteren Tipp", async ({ page }) => {
  await appOeffnen(page);
  /* Ohne Sofortstart landet die App auf der Startseite */
  await page.reload();
  await page.waitForFunction(() => !!window.CPRA);
  await expect(page.locator("#view-bereit")).toHaveClass(/active/);

  /* Sofortstart einschalten */
  await page.locator("#view-bereit .switchrow", { hasText: "Immer mit laufender CPR öffnen" })
    .locator(".switch").click();
  await expect(page.locator("#vw-autostart")).toBeChecked();

  /* Nach dem Neustart läuft die CPR sofort */
  await page.reload();
  await page.waitForFunction(() => !!window.CPRA);
  await expect(page.locator("#view-aktiv")).toHaveClass(/active/);
  await expect(page.locator("#ring-status")).toContainText("Zyklus 1");
  expect(await page.evaluate(() => !!window.CPRA.Einsatz.e)).toBe(true);

  /* Ein laufender Einsatz wird wiederhergestellt statt neu gestartet */
  const start1 = await page.evaluate(() => window.CPRA.Einsatz.e.startZeit);
  await page.reload();
  await page.waitForFunction(() => !!window.CPRA);
  const start2 = await page.evaluate(() => window.CPRA.Einsatz.e.startZeit);
  expect(start2).toBe(start1);

  /* Nach dem Beenden startet der nächste Aufruf wieder sofort */
  await page.click("#btn-settings-einsatz");
  await page.click("#s-ende");
  await page.click("#ende-ok");
  await expect(page.locator("#view-bereit")).toHaveClass(/active/);
  await page.reload();
  await page.waitForFunction(() => !!window.CPRA);
  await expect(page.locator("#view-aktiv")).toHaveClass(/active/);
});

test("Sofortstart ist auch in den Einstellungen abschaltbar", async ({ page }) => {
  await appOeffnen(page);
  /* Einschalten auf der Startseite */
  await page.locator("#view-bereit .switchrow", { hasText: "Immer mit laufender CPR öffnen" })
    .locator(".switch").click();
  expect(await page.evaluate(() => window.CPRA.Einst.werte.autostart)).toBe(true);

  /* Neu öffnen: die Startseite erscheint nicht mehr … */
  await page.reload();
  await page.waitForFunction(() => !!window.CPRA);
  await expect(page.locator("#view-aktiv")).toHaveClass(/active/);

  /* … also muss der Schalter in den Einstellungen erreichbar sein */
  await page.click("#btn-settings-einsatz");
  await expect(page.locator("#s-autostart")).toBeChecked();
  await page.locator("#modal-settings .switchrow", { hasText: "Immer mit laufender CPR öffnen" })
    .locator(".switch").click();
  expect(await page.evaluate(() => window.CPRA.Einst.werte.autostart)).toBe(false);

  /* Einsatz beenden, neu öffnen: wieder die Startseite */
  await page.click("#s-ende");
  await page.click("#ende-ok");
  await page.reload();
  await page.waitForFunction(() => !!window.CPRA);
  await expect(page.locator("#view-bereit")).toHaveClass(/active/);
  await expect(page.locator("#vw-autostart")).not.toBeChecked();
});
