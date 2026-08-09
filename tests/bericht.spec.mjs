// Einsatzberichte: benennen, als PDF oder Bild teilen und speichern.
//
// Der Bericht wird ohne Bibliothek gesetzt (siehe Modul `Bericht` in der
// index.html). Diese Tests prüfen deshalb beides: dass die erzeugten Dateien
// formal in Ordnung sind und dass die Wege durch die Oberfläche stimmen.
import { test, expect } from "@playwright/test";
import { appOeffnen, capacitorMock } from "./helfer.mjs";

/* Legt einen beendeten Einsatz im Archiv ab. `zusatz` hängt weitere
   Protokollzeilen an – damit lässt sich der Seitenumbruch auslösen. */
async function einsatzArchivieren(page, zusatz = 0){
  return page.evaluate(n => {
    const { Kern, Einsatz } = window.CPRA;
    const t0 = new Date("2026-08-09T14:02:00").getTime();
    Einsatz.starten(t0);
    const e = Einsatz.e;
    Kern.rhythmusSetzen(e, t0 + 5000, "vf");
    Kern.schock(e, t0 + 60000);
    Kern.schock(e, t0 + 180000);
    Kern.schock(e, t0 + 300000);
    Kern.adrenalinGabe(e, t0 + 305000);
    Kern.amiodaronGabe(e, t0 + 310000, null, 1);
    Kern.ursacheSetzen(e, t0 + 330000, "hypoxie", 2);
    for (let i = 0; i < n; i++)
      Kern.ereignis(e, t0 + 340000 + i * 4000, "test",
        "Probeeintrag " + (i + 1) + " mit genug Text, damit eine Zeile auch "
        + "einmal umbrechen muss und der Umbruch geprüft wird");
    Kern.rosc(e, t0 + 700000);
    Einsatz.beenden(t0 + 720000);
    return Einsatz.archiv().length;
  }, zusatz);
}

async function archivOeffnen(page){
  await page.click("#btn-settings");
  await page.click("#s-archiv");
  await expect(page.locator("#modal-archiv")).toHaveClass(/open/);
}

/* Die Datei als Bytes zurück in den Test holen. */
async function dateiBytes(page, art){
  const b64 = await page.evaluate(async a => {
    const { Bericht, Einsatz } = window.CPRA;
    const seiten = Bericht.seiten(Einsatz.archiv()[0]);
    const blob = a === "pdf" ? Bericht.pdf(seiten) : Bericht.bilder(seiten)[0];
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (const x of buf) s += String.fromCharCode(x);
    return btoa(s);
  }, art);
  return Buffer.from(b64, "base64");
}

/* ------------------------------------------------------------------ */
test("ein Bericht lässt sich benennen und der Name führt die Liste an", async ({ page }) => {
  await appOeffnen(page);
  await einsatzArchivieren(page);
  await archivOeffnen(page);

  /* Ohne Namen steht Datum und Uhrzeit vorn. */
  await expect(page.locator("#archiv-liste li b")).toHaveText(/09\.08\.2026 · 14:02 Uhr/);
  await page.click("#archiv-liste li button");
  await expect(page.locator("#archiv-detail")).toBeVisible();
  await expect(page.locator("#archiv-name")).toHaveValue("");

  await page.fill("#archiv-name", "Übung Nachtschicht");
  await page.click("#archiv-name-speichern");
  await expect(page.locator("#toast")).toHaveText(/Übung Nachtschicht/);

  await page.click("#archiv-zurueck");
  await expect(page.locator("#archiv-liste li b")).toHaveText("Übung Nachtschicht");
  /* Datum und Uhrzeit gehen nicht verloren, sie rücken nur eine Zeile tiefer. */
  await expect(page.locator("#archiv-liste li .wann span")).toHaveText(/09\.08\.2026 · 14:02 Uhr/);

  /* Der Name überlebt einen Neustart der App. */
  await page.reload();
  await page.waitForFunction(() => !!window.CPRA);
  await archivOeffnen(page);
  await expect(page.locator("#archiv-liste li b")).toHaveText("Übung Nachtschicht");
});

test("ein leerer Name führt zurück zur Bezeichnung nach Datum", async ({ page }) => {
  await appOeffnen(page);
  await einsatzArchivieren(page);
  await archivOeffnen(page);
  await page.click("#archiv-liste li button");
  await page.fill("#archiv-name", "Zwischenname");
  await page.click("#archiv-name-speichern");
  await page.fill("#archiv-name", "   ");
  await page.click("#archiv-name-speichern");
  await page.click("#archiv-zurueck");
  await expect(page.locator("#archiv-liste li b")).toHaveText(/09\.08\.2026/);
});

test("das PDF ist eine gültige Datei mit der angezeigten Seitenzahl", async ({ page }) => {
  await appOeffnen(page);
  await einsatzArchivieren(page, 40);
  const seiten = await page.evaluate(() =>
    window.CPRA.Bericht.seiten(window.CPRA.Einsatz.archiv()[0]).length);
  expect(seiten).toBeGreaterThan(1);

  const pdf = await dateiBytes(page, "pdf");
  const text = pdf.toString("latin1");
  expect(text.startsWith("%PDF-1.4")).toBe(true);
  expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  expect(text).toContain("/Type /Catalog");
  expect(text).toContain("/Count " + seiten);
  expect(text).toContain("/BaseFont /Helvetica-Bold");

  /* Die Querverweistabelle muss auf die tatsächlichen Byte-Positionen der
     Objekte zeigen – sonst öffnet kein Betrachter die Datei. */
  const start = Number(text.slice(text.lastIndexOf("startxref") + 9).trim().split("\n")[0]);
  expect(text.slice(start, start + 4)).toBe("xref");
  /* zeilen[0] "xref", zeilen[1] "0 N", zeilen[2] das freie Objekt 0,
     danach je ein Eintrag für die Objekte 1 … N-1. */
  const zeilen = text.slice(start).split("\n");
  const anzahl = Number(zeilen[1].split(" ")[1]);
  expect(anzahl).toBe(5 + seiten * 2);
  for (let i = 1; i < anzahl; i++){
    const pos = Number(zeilen[i + 2].slice(0, 10));
    expect(text.slice(pos, pos + String(i).length + 6)).toBe(i + " 0 obj");
  }
});

test("Zeichen, die das PDF nicht kennt, bleiben lesbar", async ({ page }) => {
  await appOeffnen(page);
  const proben = await page.evaluate(() => {
    const B = window.CPRA.Bericht;
    return ["SpO₂ 94–98 %", "MAD ≥ 65 mmHg", "etCO₂ → steigend", "Größe ± 5"]
      .map(s => B.pdfText(s));
  });
  expect(proben[0]).toBe("SpO2 94–98 %");
  expect(proben[1]).toBe("MAD >= 65 mmHg");
  expect(proben[2]).toBe("etCO2 -> steigend");
  expect(proben[3]).toBe("Größe ± 5");
});

test("jede Seite wird auch als Bild im A4-Verhältnis ausgegeben", async ({ page }) => {
  await appOeffnen(page);
  await einsatzArchivieren(page, 40);
  const [seiten, bilder] = await page.evaluate(() => {
    const { Bericht, Einsatz } = window.CPRA;
    const s = Bericht.seiten(Einsatz.archiv()[0]);
    return [s.length, Bericht.bilder(s).length];
  });
  expect(bilder).toBe(seiten);

  const png = await dateiBytes(page, "bild");
  expect(png.slice(0, 8).toString("hex")).toBe("89504e470d0a1a0a");   /* PNG-Signatur */
  const breite = png.readUInt32BE(16), hoehe = png.readUInt32BE(20);
  expect(breite).toBe(1191);
  expect(Math.abs(hoehe / breite - 841.89 / 595.28)).toBeLessThan(0.01);
});

test("der Name des Berichts steht im PDF", async ({ page }) => {
  await appOeffnen(page);
  await einsatzArchivieren(page);
  await page.evaluate(() => window.CPRA.Einsatz.archivBenennen(0, "Übung Nachtschicht"));
  const text = (await dateiBytes(page, "pdf")).toString("latin1");
  /* Im PDF steht der Text in WinAnsi – „Ü" ist dort ein einzelnes Byte. */
  expect(text).toContain("(\xdcbung Nachtschicht)");
});

test("PDF herunterladen gibt eine Datei mit sprechendem Namen heraus", async ({ page }) => {
  await appOeffnen(page);
  await einsatzArchivieren(page);
  await page.evaluate(() => window.CPRA.Einsatz.archivBenennen(0, "Übung Nachtschicht"));
  await archivOeffnen(page);
  await page.click("#archiv-liste li button");
  await page.click("#archiv-teilen");
  await expect(page.locator("#modal-bericht")).toHaveClass(/open/);
  await expect(page.locator("#bericht-was")).toHaveText(/Übung Nachtschicht/);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click('[data-bericht="pdf-speichern"]')
  ]);
  expect(download.suggestedFilename()).toBe("Ubung-Nachtschicht_2026-08-09_14-02.pdf");
  await expect(page.locator("#modal-bericht")).not.toHaveClass(/open/);
});

test("in der App geht der Bericht über das Filesystem an den Teilen-Dialog",
  async ({ page }) => {
  await appOeffnen(page, { vorher: capacitorMock });
  await einsatzArchivieren(page);
  await archivOeffnen(page);
  await page.click("#archiv-liste li button");
  await page.click("#archiv-teilen");
  await page.click('[data-bericht="pdf-teilen"]');
  await expect(page.locator("#toast")).toHaveText(/geteilt/i);

  const rufe = await page.evaluate(() => window.__calls);
  const schreiben = rufe.find(r => r.name === "Filesystem.writeFile");
  expect(schreiben.arg.directory).toBe("CACHE");
  expect(schreiben.arg.path).toMatch(/\.pdf$/);
  expect(schreiben.arg.laenge).toBeGreaterThan(1000);
  const teilen = rufe.find(r => r.name === "Share.share");
  expect(teilen.arg.files).toHaveLength(1);
  expect(teilen.arg.files[0]).toMatch(/^file:\/\/\/cache\/.*\.pdf$/);
});

test("Speichern legt in der App im Dokumente-Ordner ab", async ({ page }) => {
  await appOeffnen(page, { vorher: capacitorMock });
  await einsatzArchivieren(page);
  await archivOeffnen(page);
  await page.click("#archiv-liste li button");
  await page.click("#archiv-teilen");
  await page.click('[data-bericht="bild-speichern"]');
  await expect(page.locator("#toast")).toHaveText(/Dokumente/);

  const rufe = await page.evaluate(() => window.__calls);
  const schreiben = rufe.filter(r => r.name === "Filesystem.writeFile");
  expect(schreiben[0].arg.directory).toBe("DOCUMENTS");
  expect(schreiben[0].arg.path).toMatch(/\.png$/);
});

test("ist der Dokumente-Ordner gesperrt, führt der Teilen-Dialog zum Ziel",
  async ({ page }) => {
  await appOeffnen(page, { vorher: capacitorMock });
  await page.evaluate(() => { window.__dokumenteGesperrt = true; });
  await einsatzArchivieren(page);
  await archivOeffnen(page);
  await page.click("#archiv-liste li button");
  await page.click("#archiv-teilen");
  await page.click('[data-bericht="pdf-speichern"]');
  await expect(page.locator("#toast")).toHaveText(/geteilt/i);

  const rufe = await page.evaluate(() => window.__calls);
  expect(rufe.some(r => r.name === "Filesystem.writeFile" && r.arg.directory === "DOCUMENTS")).toBe(true);
  expect(rufe.some(r => r.name === "Share.share")).toBe(true);
});

test("der Bericht führt die Fassung, nach der tatsächlich gerechnet wurde",
  async ({ page }) => {
  await appOeffnen(page);
  await page.evaluate(() => window.CPRA.standardSetzen("aha"));
  await einsatzArchivieren(page);
  /* Nach dem Einsatz zurückschalten – der Bericht darf davon nichts merken. */
  await page.evaluate(() => window.CPRA.standardSetzen("erc"));
  const text = (await dateiBytes(page, "pdf")).toString("latin1");
  expect(text).toContain("AHA / ACLS");
  expect(text).toContain("Grundlage: AHA/ACLS 2025");
  expect(text).not.toContain("Grundlage: ERC/ALS");
});

test("ohne Premium zeigt das Maßnahmen-Fenster im Einsatz die Premium-Marke",
  async ({ page }) => {
  await appOeffnen(page);
  await page.click("#btn-start");
  await page.waitForSelector("#view-aktiv.active");
  await page.click("#btn-massnahme");
  await expect(page.locator("#modal-massnahme")).toHaveClass(/open/);
  const marke = page.locator("#ms-verwalten .premium-marke");
  await expect(marke).toBeVisible();
  await expect(marke).toHaveText("Premium");
  /* Der Diamant kommt als Hintergrundbild aus der Marke selbst. */
  const bild = await marke.evaluate(el =>
    getComputedStyle(el, "::before").backgroundImage);
  expect(bild).toContain("svg");

  /* Mit Premium verschwindet der Hinweis – die Funktion ist dann ja offen.
     Der laufende Einsatz wird nach dem Neustart wieder aufgenommen. */
  await page.evaluate(() => window.CPRA.Edition.set("premium"));
  await page.reload();
  await page.waitForFunction(() => !!window.CPRA);
  await page.waitForSelector("#view-aktiv.active");
  await page.click("#btn-massnahme");
  await expect(page.locator("#ms-verwalten .premium-marke")).toBeHidden();
});
