// Prüft, ob die in der App hinterlegten Leitlinien-Links noch erreichbar
// sind – für BEIDE Standards (ERC/GRC und AHA/ACLS).
//
//   node scripts/quellen-pruefen.mjs
//
// Bewusst KEIN Playwright-Test im Testlauf: Der soll nicht davon abhängen,
// ob gerade Netz da ist oder eine fremde Website streikt.
//
// WICHTIG ZUR BEWERTUNG: Ein 403 ist hier kein kaputter Link. Die Server der
// American Heart Association (ahajournals.org, heart.org) beantworten JEDE
// automatisierte Anfrage mit 403 – auch ihre Startseite. Im Browser
// funktionieren die Adressen. Solche Antworten werden deshalb als
// „im Browser prüfen" gemeldet und nicht als Fehler gezählt. Echte Fehler
// sind 404/410 (Seite weg) und Verbindungsabbrüche.
//
// Läuft ein Link tatsächlich ins Leere, gehört die Adresse im STANDARDS-Block
// (index.html) korrigiert – und danach `npm run sync`.
import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");

/* Den STANDARDS-Block herausschneiden und auswerten – er trägt die Quellen
   beider Leitlinien-Fassungen. */
const von = html.indexOf("const STANDARDS = [");
const bis = html.indexOf("\n];", von);
if (von < 0 || bis < 0){ console.error("STANDARDS nicht gefunden"); process.exit(1); }
const quelle = "export " + html.slice(von, bis + 3);
const url = "data:text/javascript;base64," + Buffer.from(quelle, "utf8").toString("base64");
const { STANDARDS } = await import(url);

/* Jede Quelle nur einmal prüfen – ILCOR steht in beiden Standards. */
const quellen = [];
for (const s of STANDARDS)
  for (const q of s.leitlinien)
    if (!quellen.some(x => x.url === q.url)) quellen.push({ ...q, standard: s.id });

let fehler = 0, handpruefung = 0;

for (const q of quellen){
  let lage;
  try {
    /* GET statt HEAD und ein Browser-Agent: manche Server mögen beides nicht. */
    const a = await fetch(q.url, { redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (CPR-Assist Linkpruefung)" },
      signal: AbortSignal.timeout(25000) });
    if (a.ok){
      lage = a.status + " erreichbar";
    } else if (a.status === 403 || a.status === 401 || a.status === 429){
      lage = a.status + " – Server blockt Automatisierung, im Browser prüfen";
      handpruefung++;
    } else {
      lage = a.status + " FEHLER";
      fehler++;
    }
  } catch(e){
    lage = "FEHLER: " + (e && e.message ? e.message : e);
    fehler++;
  }
  console.log(`${q.standard.padEnd(4)} ${q.id.padEnd(6)} ${lage}`);
  console.log(`            ${q.url}`);
}

if (handpruefung)
  console.log(`\n${handpruefung} Quelle(n) lassen sich nur im Browser prüfen `
    + `(Bot-Schutz des Anbieters) – das ist kein Fehler.`);

if (fehler){
  console.error(`\n${fehler} Quelle(n) nicht erreichbar.`);
  process.exit(1);
}
console.log("\nKeine kaputten Links.");
