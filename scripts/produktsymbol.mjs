// Erzeugt das Produktsymbol für den In-App-Kauf „Premium".
//
//   node scripts/produktsymbol.mjs   →  docs/store-grafiken/produkt-premium-512.png
//
// Google verlangt für Kaufprodukte ein eigenes Bild und verbietet dort
// ausdrücklich Text, Werbung und Branding. Das App-Icon scheidet damit aus –
// es ist Branding. Genommen wird deshalb genau das Zeichen, das in der App
// selbst Premium markiert: der Diamant aus der CSS-Variablen --diamant.
// So kennt man das Symbol aus der App wieder, ohne eine Marke zu zeigen.
//
// Die Quelle ist bewusst index.html und keine Kopie: Ändert sich der Diamant
// in der App, ändert sich das Produktsymbol beim nächsten Lauf mit.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ZIEL = "docs/store-grafiken";
mkdirSync(ZIEL, { recursive: true });

const quelle = readFileSync("index.html", "utf8");
const treffer = quelle.match(/--diamant:url\("data:image\/svg\+xml,(.*?)"\);/s);
if (!treffer) throw new Error("--diamant nicht in index.html gefunden");
const SVG = decodeURIComponent(treffer[1]);

/* Ruhiger heller Grund statt Verlauf: Das Symbol steht im Play-Store neben
   dem Preis in einer kleinen Kachel – dort trägt jede Verzierung nur Unruhe
   bei. Der Diamant füllt 60 % der Fläche, damit er auch bei 48 px trägt.

   Google verlangt ein 32-Bit-PNG. Chromium schreibt aber Farbtyp 2 (24 Bit,
   ohne Alphakanal), sobald kein Pixel durchsichtig ist – auch mit
   omitBackground. Deshalb hängt hinten ein Umwandlungsschritt: Pillow legt
   den Alphakanal an (Farbtyp 6), ohne ein einziges Pixel zu verändern. Die
   Prüfung liest den Farbtyp danach aus der Datei zurück. */
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
await page.setContent(`<style>
  html,body{margin:0;padding:0}
  #b{width:512px;height:512px;background:#eaf1fb;display:flex;
     align-items:center;justify-content:center;box-sizing:border-box}
  #d{width:60%}
  #d svg{width:100%;height:auto;display:block;
    filter:drop-shadow(0 10px 22px rgba(29,37,54,.22))}
</style><div id="b"><div id="d">${SVG}</div></div>`);
const datei = `${ZIEL}/produkt-premium-512.png`;
writeFileSync(datei, await page.locator("#b").screenshot());
await browser.close();

execFileSync("python3", ["-c",
  `from PIL import Image; Image.open(${JSON.stringify(datei)}).convert("RGBA").save(${JSON.stringify(datei)})`]);

/* Farbtyp steht im IHDR an Byte 25: 2 = RGB, 6 = RGBA. */
const farbtyp = readFileSync(datei)[25];
console.log(`${datei}  512×512, Farbtyp ${farbtyp}` +
  (farbtyp === 6 ? " (32 Bit)" : "  ACHTUNG: kein Alphakanal"));
if (farbtyp !== 6) process.exitCode = 1;
