// Mehrsprachigkeit: Umschalten, Vollständigkeit zur Laufzeit, Gerätesprache
// beim ersten Start und das Uhrzeit-Format je Sprache.
import { test, expect } from "@playwright/test";
import { appOeffnen, einsatzStarten } from "./helfer.mjs";

test("Sprache umschalten wechselt die gesamte Oberfläche", async ({ page }) => {
  await appOeffnen(page);
  await expect(page.locator("#btn-start")).toContainText("Reanimation starten");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");

  await page.click("#btn-settings");
  await page.click("#s-sprache");
  await expect(page.locator("#modal-sprache")).toHaveClass(/open/);

  /* Alle sechs Sprachen stehen zur Wahl, die aktive ist markiert. */
  await expect(page.locator("#sprach-liste li")).toHaveCount(6);
  await expect(page.locator("#sprach-liste li.aktiv b")).toHaveText("Deutsch");

  await page.click('#sprach-liste li:has(b:text-is("English")) button');
  await expect(page.locator("#modal-sprache")).not.toHaveClass(/open/);

  /* Fester HTML-Text, aufgebaute Listen und das Dokument selbst ziehen mit. */
  await expect(page.locator("#btn-start")).toContainText("Start resuscitation");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#head-sub")).toHaveText("Adult ALS · Ready");

  /* Und die Wahl übersteht einen Neustart der App. */
  await page.reload();
  await page.waitForFunction(() => !!window.CPRA);
  await expect(page.locator("#btn-start")).toContainText("Start resuscitation");
});

test("jede Sprache liefert für jeden Schlüssel einen eigenen Text", async ({ page }) => {
  await appOeffnen(page);
  const bericht = await page.evaluate(() => {
    const { SPRACHEN, TEXTE } = window.CPRA;
    const de = Object.keys(TEXTE.de);
    return SPRACHEN.map(s => ({
      code: s.code,
      vorhanden: !!TEXTE[s.code],
      fehlend: de.filter(k => !(k in (TEXTE[s.code] || {}))),
      /* Ein Schlüssel, der in einer anderen Sprache wörtlich dem deutschen
         entspricht, ist erlaubt (z. B. "300 mg"), darf aber nicht die Regel
         sein – sonst wurde schlicht kopiert statt übersetzt. */
      gleichWieDe: de.filter(k => TEXTE[s.code] && TEXTE[s.code][k] === TEXTE.de[k]).length,
      gesamt: de.length
    }));
  });
  for (const s of bericht){
    expect(s.vorhanden, s.code + " hat keinen Katalog").toBe(true);
    expect(s.fehlend, s.code + " fehlen Schlüssel").toEqual([]);
    if (s.code !== "de") expect(s.gleichWieDe / s.gesamt).toBeLessThan(0.2);
  }
});

test("Uhrzeiten tragen im Deutschen immer „Uhr“", async ({ page }) => {
  await appOeffnen(page);
  await einsatzStarten(page);
  await page.click("#btn-adrenalin");
  /* Medikamentenkarte, Maßnahmenliste und Zusammenfassung – überall gleich. */
  await expect(page.locator("#adr-sub")).toContainText(/zuletzt \d\d:\d\d Uhr/);

  await page.click("#btn-massnahme");
  await page.click('#massnahmen-wahl button[data-massnahme="ivzugang"]');
  await expect(page.locator("#massnahme-unter")).toContainText(/\d\d:\d\d Uhr$/);

  const suffix = await page.evaluate(() => window.CPRA.t("zeit_suffix"));
  expect(suffix).toBe(" Uhr");
});

test("beim ersten Start wird die Gerätesprache übernommen", async ({ browser }) => {
  /* Ein spanisches Gerät startet auf Spanisch, ohne dass jemand etwas wählt. */
  const ctx = await browser.newContext({ locale: "es-ES" });
  const page = await ctx.newPage();
  await appOeffnen(page);
  expect(await page.evaluate(() => window.CPRA.I18N.code)).toBe("es");
  await expect(page.locator("#btn-start")).toContainText("Iniciar reanimación");
  await ctx.close();
});

test("eine unbekannte Gerätesprache landet auf Deutsch", async ({ browser }) => {
  const ctx = await browser.newContext({ locale: "ja-JP" });
  const page = await ctx.newPage();
  await appOeffnen(page);
  expect(await page.evaluate(() => window.CPRA.I18N.code)).toBe("de");
  await ctx.close();
});

test("Wirkstoffnamen auf der Startseite folgen der Sprache", async ({ page }) => {
  await appOeffnen(page);
  await page.evaluate(() => window.CPRA.standardSetzen("aha"));
  const chips = () => page.locator("#vw-aa button");
  await expect(chips().nth(0)).toHaveText("Amiodaron");
  await expect(chips().nth(1)).toHaveText("Lidocain");

  await page.evaluate(() => window.CPRA.spracheSetzen("en"));
  await expect(chips().nth(0)).toHaveText("Amiodarone");
  await expect(chips().nth(1)).toHaveText("Lidocaine");

  await page.evaluate(() => window.CPRA.spracheSetzen("fr"));
  await expect(chips().nth(0)).toHaveText(/Amiodarone/);
});

test("die Kurzeinführung nennt beide Leitlinien-Standards", async ({ page }) => {
  /* Beim allerersten Start steht der Standard auf ERC. Wer in den USA
     arbeitet, muss trotzdem sofort sehen, dass es AHA/ACLS auch gibt. */
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/index.html");
  await page.waitForFunction(() => !!window.CPRA);
  await expect(page.locator("#modal-onboarding")).toHaveClass(/open/);
  const text = await page.locator('[data-step="0"] p').textContent();
  expect(text).toContain("ERC/ALS");
  expect(text).toContain("AHA/ACLS");

  /* Auch in der englischen Fassung. */
  await page.evaluate(() => window.CPRA.spracheSetzen("en"));
  const en = await page.locator('[data-step="0"] p').textContent();
  expect(en).toContain("ERC/ALS");
  expect(en).toContain("AHA/ACLS");
  expect(en).toMatch(/start screen/i);
});
