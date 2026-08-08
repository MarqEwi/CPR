// Prüft den Textkatalog in index.html:
//   1. Jede Sprache hat exakt dieselben Schlüssel wie Deutsch.
//   2. Jede in SPRACHEN gelistete Sprache hat auch einen Katalog.
//   3. Jeder im HTML per data-i18n* verlangte Schlüssel existiert.
//   4. Jeder im JS per t("…")/tText("…") verlangte Schlüssel existiert.
//
//   node scripts/texte-pruefen.mjs
import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const skript = html.match(/<script>([\s\S]*)<\/script>/)[1];

/* Den Katalog-Abschnitt herausschneiden und als Modul auswerten. */
const von = skript.indexOf("const SPRACHEN");
const bis = skript.indexOf("/* Aktive Sprache");
const quelle = skript.slice(von, bis) + "\nexport { SPRACHEN, TEXTE };";
const url = "data:text/javascript;base64," + Buffer.from(quelle, "utf8").toString("base64");
const { SPRACHEN, TEXTE } = await import(url);

let fehler = 0;
const meckern = m => { console.error("FEHLER: " + m); fehler++; };

const deKeys = Object.keys(TEXTE.de);
console.log(`Deutsch: ${deKeys.length} Schlüssel`);

for (const s of SPRACHEN){
  const k = TEXTE[s.code];
  if (!k){ meckern(`kein Katalog für ${s.code} (${s.name})`); continue; }
  const fehlt = deKeys.filter(x => !(x in k));
  const unbekannt = Object.keys(k).filter(x => deKeys.indexOf(x) < 0);
  const leer = Object.keys(k).filter(x => typeof k[x] !== "string");
  console.log(`${s.code}: ${Object.keys(k).length} Schlüssel`);
  if (fehlt.length) meckern(`${s.code} fehlt: ${fehlt.join(", ")}`);
  if (unbekannt.length) meckern(`${s.code} kennt unbekannte Schlüssel: ${unbekannt.join(", ")}`);
  if (leer.length) meckern(`${s.code} hat Nicht-Text-Werte: ${leer.join(", ")}`);
  /* Platzhalter müssen in jeder Sprache dieselben sein – sonst bleibt zur
     Laufzeit ein "{n}" im Text stehen. */
  for (const key of deKeys){
    if (!(key in k)) continue;
    const p = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(",");
    if (p(TEXTE.de[key]) !== p(k[key]))
      meckern(`${s.code}.${key}: Platzhalter weichen ab `
        + `(de: "${p(TEXTE.de[key])}", ${s.code}: "${p(k[key])}")`);
  }
}

/* Im HTML verlangte Schlüssel */
const ausHtml = new Set();
for (const m of html.matchAll(/data-i18n(?:-html|-aria|-ph)?="([^"]+)"/g)) ausHtml.add(m[1]);
for (const key of ausHtml)
  if (!(key in TEXTE.de)) meckern(`HTML verlangt unbekannten Schlüssel "${key}"`);
console.log(`HTML verlangt ${ausHtml.size} Schlüssel`);

/* Im JS direkt verlangte Schlüssel. Nur vollständig konstante – ein
   t("ur_" + id) wird weiter unten gezielt geprüft, deshalb muss hinter dem
   Anführungszeichen ein ")" oder "," stehen. */
const ausJs = new Set();
for (const m of skript.matchAll(/\bt(?:Text)?\("([a-z0-9_]+)"\s*[),]/g)) ausJs.add(m[1]);
/* tZahl("ar_anzahl", n) braucht zusätzlich den Einzahl-Schlüssel. */
for (const m of skript.matchAll(/\btZahl\("([a-z0-9_]+)"/g)){ ausJs.add(m[1]); ausJs.add(m[1] + "_1"); }
for (const key of ausJs)
  if (!(key in TEXTE.de)) meckern(`JS verlangt unbekannten Schlüssel "${key}"`);
console.log(`JS verlangt ${ausJs.size} feste Schlüssel`);

/* Zusammengesetzte Schlüssel (t("ur_" + id) usw.) prüfen wir gezielt. */
const bausteine = [
  ...["hypoxie","hypovolaemie","kalium","hypothermie","tamponade","intox","thrombose","spannung",
      "azidose","kalium_aha","thrombose_pulmonal","thrombose_koronar"]
      .flatMap(id => ["ur_" + id, "ur_" + id + "_i"]),
  ...["atemweg","oxygen","ekg","ursache","kreislauf","temperatur"]
      .flatMap(k => ["ro_" + k, "ro_" + k + "_i"]),
  ...["ivzugang","iozugang","sga","intubation","kapnographie","mechanisch","lidocain"]
      .map(id => "ms_" + id),
  /* Standardabhängige Fassungen: existiert eine, muss sie für JEDEN
     Standard existieren – sonst fällt einer stillschweigend zurück. */
  ...["erc","aha"].flatMap(std => [
    "std_" + std, "std_" + std + "_sub", "std_" + std + "_kurz",
    "ak_ursachen_" + std, "ur_titel_" + std,
    "ro_oxygen_i_" + std, "ro_kreislauf_i_" + std
  ]),
  ...["klar","sanft","tief","signal"].flatMap(id => ["to_" + id, "to_" + id + "_i"]),
  ...["schockbar","nichtschockbar","unklar"].flatMap(a => ["rh_l_" + a, "rh_k_" + a]),
  ...["ZYKLUS_MS","WARN_MS","ADRENALIN_FRUEH_MS","ADRENALIN_SPAET_MS","ADRENALIN_SCHOCK",
      "AMIODARON_SCHOCK_300","AMIODARON_SCHOCK_150"].flatMap(k => ["al_f_" + k, "al_f_" + k + "_i"]),
  "ur_z0", "ur_z1", "ur_z2"
];
for (const key of bausteine)
  if (!(key in TEXTE.de)) meckern(`zusammengesetzter Schlüssel "${key}" fehlt`);

if (fehler){ console.error(`\n${fehler} Fehler.`); process.exit(1); }
console.log("\nTextkatalog vollständig und stimmig.");
