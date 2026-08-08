// Leitlinien-Standard: Europa (ERC/GRC) oder USA (AHA/ACLS). Der Wechsel
// muss die Rechenwerte, die Ursachenliste, die Post-ROSC-Ziele, die
// Maßnahmen und die Quellen gleichzeitig umstellen – sonst entsteht ein
// Mischzustand, der in keiner Leitlinie steht.
import { test, expect } from "@playwright/test";
import { appOeffnen, einsatzStarten } from "./helfer.mjs";

async function einstellungenOeffnen(page){
  const zahnrad = await page.locator("#btn-settings-einsatz").isVisible()
    ? "#btn-settings-einsatz" : "#btn-settings";
  await page.click(zahnrad);
  await expect(page.locator("#modal-settings")).toHaveClass(/open/);
}
async function standardWaehlen(page, id){
  await einstellungenOeffnen(page);
  await page.click("#s-standard");
  await expect(page.locator("#modal-standard")).toHaveClass(/open/);
  await page.click(`#standard-liste button[data-standard="${id}"]`);
  await expect(page.locator("#modal-standard")).not.toHaveClass(/open/);
}

test("Voreinstellung ist Europa und die Auswahl nennt beide Standards", async ({ page }) => {
  await appOeffnen(page);
  expect(await page.evaluate(() => window.CPRA.Standard.id())).toBe("erc");
  await einstellungenOeffnen(page);
  await expect(page.locator("#s-standard-sub")).toHaveText("ERC / GRC · Europa");
  await page.click("#s-standard");
  await expect(page.locator("#standard-liste li")).toHaveCount(2);
  await expect(page.locator("#standard-liste li.aktiv b")).toHaveText("ERC / GRC");
  /* Der Dialog nennt die Unterschiede, bevor jemand umschaltet. */
  await expect(page.locator("#standard-unterschiede li")).toHaveCount(5);
  await expect(page.locator("#standard-unterschiede")).toContainText("3. Schock");
});

test("Umschalten auf AHA verschiebt die erste Adrenalingabe auf den 2. Schock", async ({ page }) => {
  await appOeffnen(page);
  expect(await page.evaluate(() => window.CPRA.KONF.ADRENALIN_SCHOCK)).toBe(3);

  await standardWaehlen(page, "aha");
  expect(await page.evaluate(() => window.CPRA.KONF.ADRENALIN_SCHOCK)).toBe(2);
  /* Alles andere bleibt gleich – beide Standards teilen den ILCOR-Kern. */
  const gleich = await page.evaluate(() => {
    const K = window.CPRA.KONF;
    return { zyklus: K.ZYKLUS_MS, frueh: K.ADRENALIN_FRUEH_MS, spaet: K.ADRENALIN_SPAET_MS,
             ami300: K.AMIODARON_SCHOCK_300, ami150: K.AMIODARON_SCHOCK_150 };
  });
  expect(gleich).toEqual({ zyklus: 120000, frueh: 180000, spaet: 300000, ami300: 3, ami150: 5 });

  /* Und die Wahl übersteht einen Neustart. */
  await page.reload();
  await page.waitForFunction(() => !!window.CPRA);
  expect(await page.evaluate(() => window.CPRA.KONF.ADRENALIN_SCHOCK)).toBe(2);
});

test("die verschobene Schwelle wirkt sich im Einsatz tatsächlich aus", async ({ page }) => {
  await appOeffnen(page);
  await standardWaehlen(page, "aha");
  await einsatzStarten(page);

  await page.click("#btn-rhythmus");
  await page.click('[data-rhythmus="schockbar"]');
  /* Ohne Schock: Hinweis auf den 2., nicht den 3. Schock. */
  await expect(page.locator("#adr-sub")).toContainText("nach dem 2. Schock");
  await expect(page.locator("#adr-pill")).toHaveText("zu früh");

  /* Zwei Schocks – danach ist Adrenalin nach ACLS fällig. */
  await page.evaluate(() => {
    const { Kern, Einsatz } = window.CPRA;
    Kern.schock(Einsatz.e, Date.now());
    Kern.schock(Einsatz.e, Date.now());
    Einsatz.speichern();
  });
  await page.waitForTimeout(300);
  await expect(page.locator("#adr-pill")).toHaveText("fällig");
  await expect(page.locator("#adr-sub")).toContainText("nach 2. Schock fällig");
});

test("AHA bringt 5 H's und 5 T's statt 4 H's und HITS", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);
  await expect(page.locator("#btn-ursachen")).toContainText("4H / HITS");
  await page.click("#btn-ursachen");
  await expect(page.locator("#ursachen-liste li")).toHaveCount(8);
  await expect(page.locator("#modal-ursachen h3")).toContainText("4 H’s");
  await page.click('#modal-ursachen [data-close="modal-ursachen"]');

  await standardWaehlen(page, "aha");
  await expect(page.locator("#btn-ursachen")).toContainText("5H / 5T");
  await page.click("#btn-ursachen");
  const eintraege = page.locator("#ursachen-liste li");
  await expect(eintraege).toHaveCount(10);
  /* Azidose steht bei der AHA eigenständig, die Thrombose ist geteilt. */
  await expect(eintraege.nth(2)).toContainText("Azidose");
  await expect(eintraege.nth(8)).toContainText("pulmonal");
  await expect(eintraege.nth(9)).toContainText("koronar");
});

test("ein Wechsel im laufenden Einsatz behält gesetzte Ursachen und wird protokolliert", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);
  await page.click("#btn-ursachen");
  /* Hypoxie als „verdächtig" markieren (Zustand 2). */
  await page.click('#ursachen-liste li:first-child .tristate button[data-z="2"]');
  await page.click('#modal-ursachen [data-close="modal-ursachen"]');
  expect(await page.evaluate(() => window.CPRA.Einsatz.e.ursachen.hypoxie)).toBe(2);

  await standardWaehlen(page, "aha");

  const e = await page.evaluate(() => window.CPRA.Einsatz.e);
  /* Der bereits gesetzte Zustand bleibt … */
  expect(e.ursachen.hypoxie).toBe(2);
  /* … und die neuen Ursachen kommen als offen dazu. */
  expect(e.ursachen.azidose).toBe(0);
  expect(e.ursachen.thrombose_pulmonal).toBe(0);
  /* Der Wechsel steht im Protokoll – sonst wäre später nicht erklärbar,
     warum sich die Zeiten geändert haben. */
  expect(e.ereignisse.filter(x => x.typ === "standard").map(x => x.info))
    .toContain("Leitlinien-Standard: AHA/ACLS");
});

test("Post-ROSC-Ziele und Maßnahmen folgen dem Standard", async ({ page }) => {
  await appOeffnen(page);
  await standardWaehlen(page, "aha");
  await einsatzStarten(page);

  /* Lidocain steht bei der AHA gleichwertig neben Amiodaron. */
  await page.click("#btn-massnahme");
  await expect(page.locator("#massnahmen-wahl button")).toHaveCount(7);
  await expect(page.locator("#massnahmen-wahl button").last()).toContainText("Lidocain");
  await page.click('#modal-massnahme [data-close="modal-massnahme"]');

  await page.click("#btn-rosc");
  await page.click("#rosc-ok");
  const texte = await page.locator("#rosc-liste li .t span").allTextContents();
  expect(texte[1]).toContain("90–98 %");
  expect(texte[4]).toContain("65 mmHg");
});

test("die Quellen wechseln mit dem Standard", async ({ page }) => {
  await appOeffnen(page);
  await page.click("#btn-quellen");
  await expect(page.locator("#quellen-liste li").first()).toContainText("European Resuscitation Council");
  await page.click('#modal-quellen [data-close="modal-quellen"]');

  await standardWaehlen(page, "aha");
  await page.click("#btn-quellen");
  const q = page.locator("#quellen-liste li");
  await expect(q).toHaveCount(4);
  await expect(q.nth(0)).toContainText("Highlights");
  await expect(q.nth(1)).toContainText("Adult Advanced Life Support");
  await expect(q.nth(2)).toContainText("Post–Cardiac Arrest Care");
  /* ILCOR bleibt in beiden – es ist die gemeinsame Grundlage. */
  await expect(q.nth(3)).toContainText("ILCOR");
  /* Und die hinterlegten Werte zeigen die AHA-Schwelle. */
  await expect(page.locator("#quellen-werte")).toContainText("2. Schock");
});

test("ein eigenes Profil setzt auf dem gewählten Standard auf", async ({ page }) => {
  await appOeffnen(page, { vorher: () => {
    localStorage.setItem("cpra_edition", JSON.stringify("premium"));
  } });
  await standardWaehlen(page, "aha");

  await einstellungenOeffnen(page);
  await page.click("#s-algo");
  /* Der Basiswert im Editor ist der des Standards, nicht der europäische. */
  await expect(page.locator('.algofeld[data-key="ADRENALIN_SCHOCK"] .wert')).toHaveText("2. Schock");
  await expect(page.locator('.algofeld[data-key="ADRENALIN_SCHOCK"]')).not.toHaveClass(/geaendert/);
  await expect(page.locator("#algo-liste li").first()).toContainText("AHA/ACLS");

  /* Ein eigenes Profil überschreibt den Standard, nicht umgekehrt. */
  const regler = page.locator('.algofeld[data-key="ZYKLUS_MS"] input');
  await regler.fill("90");
  await regler.dispatchEvent("input");
  await page.fill("#algo-name", "Kurzzyklus");
  await page.click("#algo-speichern");
  const k = await page.evaluate(() => window.CPRA.KONF);
  expect(k.ZYKLUS_MS).toBe(90000);
  expect(k.ADRENALIN_SCHOCK).toBe(2);          // vom Standard geerbt
});

test("Antiarrhythmikum: Amiodaron voreingestellt, Lidocain waehlbar", async ({ page }) => {
  await appOeffnen(page);
  /* Bei ERC gibt es die Wahl nicht – dort ist Amiodaron gesetzt. */
  await einstellungenOeffnen(page);
  await page.click("#s-standard");
  await expect(page.locator("#aa-wahl")).toBeHidden();
  await page.click('#standard-liste button[data-standard="aha"]');

  await einstellungenOeffnen(page);
  await page.click("#s-standard");
  await expect(page.locator("#aa-wahl")).toBeVisible();
  await expect(page.locator("#aa-liste li.aktiv b")).toHaveText("Amiodaron");
  await expect(page.locator("#aa-liste li.aktiv")).toContainText("300 mg");

  /* Umschalten auf Lidocain: Karte und Maßnahmenliste tauschen. */
  await page.click('#aa-liste button[data-aa="lidocain"]');
  await expect(page.locator("#aa-liste li.aktiv b")).toHaveText("Lidocain");
  await page.click('#modal-standard [data-close="modal-standard"]');

  await einsatzStarten(page);
  await expect(page.locator("#card-amiodaron .kopf b")).toHaveText("Lidocain");
  await expect(page.locator("#btn-amiodaron")).toContainText("1–1,5 mg/kg");
  await page.click("#btn-massnahme");
  await expect(page.locator("#massnahmen-wahl button").last()).toContainText("Amiodaron");
  await page.click('#modal-massnahme [data-close="modal-massnahme"]');

  /* Dosis erfassen: gespeichert wird die Dosisnummer, nicht eine mg-Zahl. */
  await page.evaluate(() => {
    const { Kern, Einsatz } = window.CPRA;
    Kern.rhythmusSetzen(Einsatz.e, Date.now(), "schockbar");
    Kern.schock(Einsatz.e, Date.now());
    Kern.schock(Einsatz.e, Date.now());
    Kern.schock(Einsatz.e, Date.now());
    Einsatz.speichern();
  });
  await page.waitForTimeout(300);
  await expect(page.locator("#ami-pill")).toHaveText("1–1,5 mg/kg fällig");
  await page.click("#btn-amiodaron");
  const gabe = await page.evaluate(() => window.CPRA.Einsatz.e.amiodaron[0]);
  expect(gabe.dosis).toBe(1);
  expect(gabe.mg).toBe(null);
  /* Im Protokoll steht das Mittel mit seiner Dosisangabe, nicht "null mg". */
  const protokoll = await page.evaluate(() =>
    window.CPRA.Einsatz.e.ereignisse.filter(x => x.typ === "amiodaron").map(x => x.info));
  expect(protokoll).toEqual(["Lidocain 1–1,5 mg/kg"]);
});

test("ein laufender Einsatz behaelt sein Antiarrhythmikum", async ({ page }) => {
  await appOeffnen(page);
  await standardWaehlen(page, "aha");
  await einsatzStarten(page);
  expect(await page.evaluate(() => window.CPRA.Einsatz.e.antiarrhythmikum)).toBe("amiodaron");

  await einstellungenOeffnen(page);
  await page.click("#s-standard");
  await page.click('#aa-liste button[data-aa="lidocain"]');
  await page.click('#modal-standard [data-close="modal-standard"]');

  /* Die Einstellung ist umgestellt, der laufende Einsatz aber nicht –
     bereits erfasste Dosen gehoeren zum bisherigen Mittel. */
  expect(await page.evaluate(() => window.CPRA.Einst.werte.antiarrhythmikum)).toBe("lidocain");
  expect(await page.evaluate(() => window.CPRA.Einsatz.e.antiarrhythmikum)).toBe("amiodaron");
  await expect(page.locator("#card-amiodaron .kopf b")).toHaveText("Amiodaron");
});
