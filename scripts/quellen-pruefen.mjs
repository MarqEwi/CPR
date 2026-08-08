// Prüft, ob die in der App hinterlegten Leitlinien-Links noch erreichbar
// sind. Bewusst KEIN Playwright-Test: Der Testlauf soll nicht davon
// abhängen, ob gerade Netz da ist oder eine fremde Website streikt.
//
//   node scripts/quellen-pruefen.mjs
//
// Läuft ein Link ins Leere, gehört die Adresse in KONF.LEITLINIEN
// (index.html) korrigiert – und danach `npm run sync`.
import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");

/* Den LEITLINIEN-Block aus KONF herausschneiden und auswerten. */
const von = html.indexOf("  LEITLINIEN: [");
const bis = html.indexOf("  LEITLINIEN_GEPRUEFT:");
if (von < 0 || bis < 0){ console.error("LEITLINIEN nicht gefunden"); process.exit(1); }
const quelle = "export const LEITLINIEN = [" + html.slice(von + "  LEITLINIEN: [".length, bis)
  .replace(/\],\s*$/, "]");
const url = "data:text/javascript;base64," + Buffer.from(quelle, "utf8").toString("base64");
const { LEITLINIEN } = await import(url);

let fehler = 0;
for (const q of LEITLINIEN){
  let lage;
  try {
    /* Manche Server mögen HEAD nicht – deshalb GET und der Browser-Agent. */
    const a = await fetch(q.url, { redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (CPR-Assist Linkpruefung)" },
      signal: AbortSignal.timeout(25000) });
    lage = a.status;
    if (!a.ok) fehler++;
  } catch(e){
    lage = "Fehler: " + (e && e.message ? e.message : e);
    fehler++;
  }
  console.log(`${String(lage).padEnd(8)} ${q.id.padEnd(6)} ${q.url}`);
}

if (fehler){
  console.error(`\n${fehler} Quelle(n) nicht erreichbar.`);
  process.exit(1);
}
console.log("\nAlle Quellen erreichbar.");
