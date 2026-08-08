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

test("Startseite: „Reanimation starten“ ist ohne Scrollen erreichbar", async ({ page }) => {
  await appOeffnen(page);
  const sicht = page.viewportSize();
  const knopf = await page.locator("#btn-start").boundingBox();
  /* Vollständig im ersten Bildschirm – wer die App im Einsatz öffnet, darf
     nicht erst scrollen müssen. */
  expect(knopf.y + knopf.height).toBeLessThan(sicht.height);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  /* Und er steht vor allem Erklärenden. */
  const reihenfolge = await page.evaluate(() => {
    const y = s => document.querySelector(s).getBoundingClientRect().top;
    return { start: y("#btn-start"), vorwahl: y(".vorwahl"),
             liste: y(".startliste"), spenden: y(".spendenbox") };
  });
  expect(reihenfolge.start).toBeLessThan(reihenfolge.vorwahl);
  expect(reihenfolge.vorwahl).toBeLessThan(reihenfolge.liste);
  expect(reihenfolge.liste).toBeLessThan(reihenfolge.spenden);
});

test("Probehören auf der Startseite – auch bei abgeschaltetem Metronom", async ({ page }) => {
  await appOeffnen(page);
  /* Der Knopf liegt bewusst außerhalb der Tempo-Chips: die sind gesperrt,
     solange das Metronom aus ist – probehören muss trotzdem gehen. */
  await expect(page.locator("#vw-metro")).not.toBeChecked();
  await expect(page.locator("#vw-metro-test")).toBeEnabled();
  await page.click("#vw-metro-test");
  /* Es bleibt bei der Probe: nichts wird eingeschaltet. */
  expect(await page.evaluate(() => window.CPRA.Einst.werte.metronomAn)).toBe(false);
  expect(await page.evaluate(() => window.CPRA.Metronom.an)).toBe(false);
});

test("Metronom ist auch über die Einstellungen erreichbar – ohne Einsatz still", async ({ page }) => {
  await appOeffnen(page);

  /* Ohne laufenden Einsatz: Einstellungen → Metronom öffnet dieselbe Auswahl. */
  await page.click("#btn-settings");
  await expect(page.locator("#s-metronom-sub")).toHaveText("aus · Ziel 100–120/min");
  await page.click("#s-metronom");
  await expect(page.locator("#modal-settings")).not.toHaveClass(/open/);
  await expect(page.locator("#modal-metronom")).toHaveClass(/open/);
  await expect(page.locator('#metro-wahl button[data-bpm="0"]')).toHaveClass(/active/);

  /* 120 wählen: gespeichert und überall angezeigt – aber es klingt nichts,
     solange kein Einsatz läuft. */
  await page.click('#metro-wahl button[data-bpm="120"]');
  expect(await page.evaluate(() => window.CPRA.Einst.werte.metronomBpm)).toBe(120);
  expect(await page.evaluate(() => window.CPRA.Einst.werte.metronomAn)).toBe(true);
  expect(await page.evaluate(() => window.CPRA.Metronom.an)).toBe(false);
  await expect(page.locator("#vw-metro-sub")).toHaveText("120 pro Minute");
  await expect(page.locator("#vw-metro")).toBeChecked();
  await page.click("#btn-settings");
  await expect(page.locator("#s-metronom-sub")).toHaveText("120 pro Minute");
  await page.click('#modal-settings [data-close="modal-settings"]');

  /* Erst der Einsatz lässt es tatsächlich ticken. */
  await einsatzStarten(page);
  expect(await page.evaluate(() => window.CPRA.Metronom.an)).toBe(true);
  await expect(page.locator("#metro-label")).toHaveText("120");

  /* Und der Weg über die Einstellungen funktioniert auch mitten im Einsatz. */
  await page.click("#btn-settings-einsatz");
  await page.click("#s-metronom");
  await page.click('#metro-wahl button[data-bpm="100"]');
  await expect(page.locator("#metro-label")).toHaveText("100");
  expect(await page.evaluate(() => window.CPRA.Metronom.an)).toBe(true);
});

test("eigenes Tempo lässt sich über die Einstellungen anlegen und wählen", async ({ page }) => {
  await appOeffnen(page);
  await premiumFreischalten(page);

  await page.click("#btn-settings");
  await page.click("#s-metronom");
  await page.locator("#bpm-regler").fill("117");
  await page.fill("#tempo-name", "Team-Standard");
  await page.click("#regler-speichern");

  /* Gespeichert, ausgewählt und mit Namen sichtbar – ohne dass etwas klingt. */
  await expect(page.locator("#tempi-liste li")).toHaveCount(1);
  await expect(page.locator("#tempi-liste li").first()).toHaveClass(/aktiv/);
  expect(await page.evaluate(() => window.CPRA.Metronom.an)).toBe(false);
  await page.click('#modal-metronom [data-close="modal-metronom"]');
  await page.click("#btn-settings");
  await expect(page.locator("#s-metronom-sub")).toHaveText("Team-Standard · 117 pro Minute");
  await page.click('#modal-settings [data-close="modal-settings"]');

  /* Im Einsatz gilt es dann sofort. */
  await einsatzStarten(page);
  await expect(page.locator("#metro-label")).toHaveText("117");
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

/* ---- Premium ---------------------------------------------------------- */

/* Schaltet Premium frei. Bewusst über den Edition-Schalter statt über die
   Oberfläche: Der Weg über die versteckte Diagnose hat seinen eigenen Test
   weiter unten, hier soll es nur schnell und ohne Nebenwirkungen gehen. */
async function premiumFreischalten(page){
  await page.evaluate(() => {
    document.querySelectorAll(".modal-back.open").forEach(m => m.classList.remove("open"));
    window.CPRA.Edition.set("premium");
  });
  expect(await page.evaluate(() => window.CPRA.Edition.isPremium())).toBe(true);
}

/* Öffnet die Einstellungen über das jeweils sichtbare Zahnrad – im Einsatz
   sitzt es in der Kopfzeile, sonst in der Titelleiste. */
async function einstellungenOeffnen(page){
  const imEinsatz = await page.evaluate(() => !!window.CPRA.Einsatz.e);
  await page.click(imEinsatz ? "#btn-settings-einsatz" : "#btn-settings");
  await expect(page.locator("#modal-settings")).toHaveClass(/open/);
}

test("Premium über die versteckte Diagnose freischalten (Entwicklung)", async ({ page }) => {
  await appOeffnen(page);
  await page.click("#btn-settings");
  await expect(page.locator("#s-premium-test")).toBeHidden();
  for (let i = 0; i < 5; i++) await page.click("#s-version");
  await expect(page.locator("#s-premium-test")).toBeVisible();
  await page.click("#s-premium-test");
  expect(await page.evaluate(() => window.CPRA.Edition.isPremium())).toBe(true);
  /* Nochmal tippen schaltet zurück */
  await page.click("#s-premium-test");
  expect(await page.evaluate(() => window.CPRA.Edition.isPremium())).toBe(false);
});

test("Startseite nennt Werbefreiheit, Premium und Spende", async ({ page }) => {
  await appOeffnen(page);
  const box = page.locator("#spendenbox");
  await expect(box).toContainText("frei von Werbung");
  await expect(box).toContainText("wichtigsten Funktionen für die Reanimation");
  await expect(box).toContainText("Premium");
  await expect(box.locator('a[href="https://www.mercwerk.de"]').first()).toBeVisible();

  /* Der Premium-Dialog erklärt alle drei Funktionen */
  await page.click("#btn-premium");
  await expect(page.locator("#modal-premium")).toHaveClass(/open/);
  await expect(page.locator("#modal-premium")).toContainText("Eigene Hinweistöne");
  await expect(page.locator("#modal-premium")).toContainText("Eigene Metronom-Tempi");
  await expect(page.locator("#modal-premium")).toContainText("Eigene Felder");
  await expect(page.locator("#premium-kaufen")).toBeVisible();
});

test("Hinweistöne: Probehören immer, Umstellen erst mit Premium", async ({ page }) => {
  await appOeffnen(page);
  await page.click("#btn-settings");
  await page.click("#s-toene");
  const zeilen = page.locator("#tone-liste li");
  await expect(zeilen).toHaveCount(4);
  await expect(zeilen.first()).toHaveClass(/aktiv/);          // „Klar" ist Standard

  /* Probehören funktioniert ohne Premium und plant echte Töne */
  await page.evaluate(() => {
    window.__toene = 0;
    const echt = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function(){ window.__toene++; return echt.call(this); };
  });
  await zeilen.nth(2).locator(".probe").click();
  expect(await page.evaluate(() => window.__toene)).toBeGreaterThan(0);

  /* Umstellen ohne Premium führt in den Premium-Dialog, ändert nichts */
  await zeilen.nth(2).locator(".waehlen").click();
  await expect(page.locator("#modal-premium")).toHaveClass(/open/);
  expect(await page.evaluate(() => window.CPRA.Einst.werte.tonVariante)).toBe("klar");
  await page.locator("#modal-premium .modal-x").click();

  /* Mit Premium lässt sich der Klang wechseln */
  await premiumFreischalten(page);
  await einstellungenOeffnen(page);
  await page.click("#s-toene");
  await page.locator("#tone-liste li").nth(2).locator(".waehlen").click();
  expect(await page.evaluate(() => window.CPRA.Einst.werte.tonVariante)).toBe("tief");
  await expect(page.locator("#tone-liste li").nth(2)).toHaveClass(/aktiv/);
});

test("Metronom-Regler: schieben frei, speichern erst mit Premium", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);
  await page.click("#btn-metronom");
  await expect(page.locator("#regler-box")).toHaveClass(/gesperrt/);
  await expect(page.locator("#regler-speichern")).toContainText("Premium");

  /* Schieben zeigt den Wert, ändert aber nichts */
  await page.locator("#bpm-regler").fill("117");
  await expect(page.locator("#regler-wert")).toHaveText("117/min");
  await page.click("#regler-speichern");
  await expect(page.locator("#modal-premium")).toHaveClass(/open/);
  expect(await page.evaluate(() => window.CPRA.Einst.werte.metronomBpm)).toBe(110);
  expect(await page.evaluate(() => window.CPRA.Einst.werte.tempi)).toEqual([]);
  await page.locator("#modal-premium .modal-x").click();
});

test("Eigene Tempi: anlegen, wählen, umbenennen, löschen", async ({ page }) => {
  await appOeffnen(page);
  await premiumFreischalten(page);
  await einsatzStarten(page);

  const dlg = page.locator("#modal-metronom");
  const zeilen = page.locator("#tempi-liste li");

  /* Anlegen: Regler auf 117, Name, speichern. Der Dialog bleibt offen –
     man soll die neue Zeile in der Liste sehen. */
  await page.click("#btn-metronom");
  await expect(page.locator("#regler-titel")).toHaveText("Eigenes Tempo anlegen");
  await page.locator("#bpm-regler").fill("117");
  await page.fill("#tempo-name", "Team-Standard");
  await page.click("#regler-speichern");
  await expect(dlg).toHaveClass(/open/);
  await expect(zeilen).toHaveCount(1);
  await expect(zeilen.first()).toContainText("Team-Standard");
  await expect(zeilen.first()).toContainText("117/min");
  await expect(zeilen.first()).toHaveClass(/aktiv/);
  /* Das gespeicherte Tempo gilt sofort */
  await expect(page.locator("#metro-label")).toHaveText("117");
  expect(await page.evaluate(() => window.CPRA.Metronom.an)).toBe(true);
  let w = await page.evaluate(() => window.CPRA.Einst.werte);
  expect(w.tempi).toHaveLength(1);
  expect(w.tempi[0]).toMatchObject({ name: "Team-Standard", bpm: 117 });
  expect(w.metronomBpm).toBe(117);

  /* Ein zweites Tempo ohne Namen: der Wert dient als Name */
  await page.locator("#bpm-regler").fill("104");
  await page.click("#regler-speichern");
  await expect(zeilen).toHaveCount(2);
  w = await page.evaluate(() => window.CPRA.Einst.werte);
  expect(w.tempi[1].name).toBe("104 pro Minute");
  expect(w.metronomBpm).toBe(104);
  await expect(zeilen.nth(1)).toHaveClass(/aktiv/);

  /* Auswählen mit einem Tipp – danach schließt der Dialog */
  await zeilen.nth(0).locator(".waehl").click();
  await expect(dlg).not.toHaveClass(/open/);
  await expect(page.locator("#metro-label")).toHaveText("117");

  /* Eine feste Stufe hebt die Markierung des eigenen Tempos auf */
  await page.click("#btn-metronom");
  await expect(zeilen.nth(0)).toHaveClass(/aktiv/);
  await page.click('#metro-wahl button[data-bpm="120"]');
  await page.click("#btn-metronom");
  await expect(zeilen.nth(0)).not.toHaveClass(/aktiv/);
  await expect(page.locator('#metro-wahl button[data-bpm="120"]')).toHaveClass(/active/);

  /* Umbenennen: Formular wechselt in den Bearbeiten-Modus */
  await zeilen.nth(0).locator(".umbenennen").click();
  await expect(page.locator("#regler-titel")).toHaveText("Tempo bearbeiten");
  await expect(page.locator("#tempo-name")).toHaveValue("Team-Standard");
  await expect(page.locator("#regler-abbrechen")).toBeVisible();
  await page.fill("#tempo-name", "Schnell");
  await page.locator("#bpm-regler").fill("119");
  await page.click("#regler-speichern");
  await expect(zeilen).toHaveCount(2);                   // kein neues angelegt
  await expect(zeilen.nth(0)).toContainText("Schnell");
  w = await page.evaluate(() => window.CPRA.Einst.werte);
  expect(w.tempi[0]).toMatchObject({ name: "Schnell", bpm: 119 });

  /* Abbrechen verwirft die Bearbeitung */
  await zeilen.nth(0).locator(".umbenennen").click();
  await page.fill("#tempo-name", "Verworfen");
  await page.click("#regler-abbrechen");
  await expect(page.locator("#regler-titel")).toHaveText("Eigenes Tempo anlegen");
  await expect(page.locator("#tempo-name")).toHaveValue("");
  w = await page.evaluate(() => window.CPRA.Einst.werte);
  expect(w.tempi[0].name).toBe("Schnell");

  /* Löschen */
  await zeilen.nth(1).locator(".weg").click();
  await expect(zeilen).toHaveCount(1);
  w = await page.evaluate(() => window.CPRA.Einst.werte);
  expect(w.tempi).toHaveLength(1);
  expect(w.tempi[0].name).toBe("Schnell");

  /* Die eigenen Tempi überleben einen Neustart */
  await page.reload();
  await page.waitForFunction(() => !!window.CPRA);
  w = await page.evaluate(() => window.CPRA.Einst.werte);
  expect(w.tempi).toHaveLength(1);
  expect(w.tempi[0]).toMatchObject({ name: "Schnell", bpm: 119 });
});

test("Eigene Felder: nur mit Premium, dann als Karte mit Timer im Einsatz", async ({ page }) => {
  await appOeffnen(page);

  /* Ohne Premium führt der Weg in den Premium-Dialog */
  await page.click("#btn-settings");
  await expect(page.locator("#s-felder-sub")).toContainText("Premium");
  await page.click("#s-felder");
  await expect(page.locator("#modal-premium")).toHaveClass(/open/);
  await page.locator("#modal-premium .modal-x").click();

  /* Mit Premium: zwei Felder anlegen */
  await premiumFreischalten(page);
  await einstellungenOeffnen(page);
  await page.click("#s-felder");
  await page.fill("#feld-name", "BGA");
  await page.selectOption("#feld-intervall", "10");
  await page.click("#feld-anlegen");
  await page.fill("#feld-name", "Temperatur");
  await page.selectOption("#feld-intervall", "0");
  await page.click("#feld-anlegen");
  await expect(page.locator("#felder-liste li")).toHaveCount(2);
  await expect(page.locator("#felder-liste")).toContainText("Erinnerung nach 10 min");
  await expect(page.locator("#felder-liste")).toContainText("ohne Intervall");
  await page.locator("#modal-felder .modal-x").click();

  /* Im Einsatz erscheinen sie als Karten */
  await einsatzStarten(page);
  const karten = page.locator("#feldgrid .feldcard");
  await expect(karten).toHaveCount(2);
  await expect(karten.first()).toContainText("BGA");
  await expect(karten.first()).toContainText("offen");

  /* Erfassen setzt die Uhr und schreibt ins Protokoll */
  await karten.first().locator("button").click();
  await expect(karten.first()).toContainText("1×");
  const e = await page.evaluate(() => window.CPRA.Einsatz.e);
  expect(Object.keys(e.felder)).toHaveLength(1);
  expect(e.ereignisse.filter(x => x.typ === "feld").map(x => x.info)).toEqual(["BGA"]);

  /* Ein Feld wieder entfernen */
  await page.click("#btn-settings-einsatz");
  await page.click("#s-felder");
  await page.locator("#felder-liste li").first().locator(".weg").click();
  await expect(page.locator("#felder-liste li")).toHaveCount(1);
  await page.locator("#modal-felder .modal-x").click();
  await expect(page.locator("#feldgrid .feldcard")).toHaveCount(1);
});
