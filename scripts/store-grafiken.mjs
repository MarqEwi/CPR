// Erzeugt die Feature-Grafik für den Play-Store-Eintrag.
//
//   node scripts/store-grafiken.mjs
//
// Nur noch die Feature-Grafik: Die fünf Store-Screenshots entstehen über den
// Skill "mercwerk-store-grafiken" aus docs/store-grafiken/screenshot-quellen/
// (Konfiguration, Hintergründe). Der Weg dorthin steht in docs/store-texte.md.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const ZIEL = "docs/store-grafiken";
mkdirSync(ZIEL, { recursive: true });
const bild = p => "data:image/png;base64," + readFileSync(p).toString("base64");
const LOGO = readFileSync("icons/logo.svg", "utf8");

const SCHRIFT = 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
/* Ruhiger, klinischer Grund statt farbigem Verlauf – dieselbe Welt wie
   die App. Ein bunter Verlauf würde bei einem Notfallwerkzeug falsch
   wirken und die Screenshots verfälschen. */
const GRUND = "#0b0e10";
const AKZENT = "#3fbfae";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();

/* ---- Feature-Grafik 1024 × 500 ----
   Heller Illustrations-Stil nach dem Vorbild klassischer Medizin-Einträge:
   links Symbol, Wortmarke und Untertitel, rechts die Szene – zwei
   reanimieren, eine dritte Person dokumentiert am Handy. Die Illustration
   (docs/store-grafiken/feature-hintergrund.png, 1584 × 672, erzeugt mit
   Higgsfield AI) ist rechtsbündig auf volle Höhe gelegt; der Überschuss
   läuft links aus dem Bild, wo ohnehin nur leerer Grund ist. So behalten
   die Figuren rechts ihre Luft zum Rand.

   Play beschneidet die Feature-Grafik je nach Platzierung links und rechts.
   Deshalb beginnt der Textblock erst bei 96 px und endet die Szene mit
   deutlichem Abstand vor der rechten Kante – in der Mitte darf nichts
   Wichtiges fehlen, außen nichts Wichtiges stehen.

   Zwei Sprachfassungen aus derselben Illustration: Die Zeichnung enthält
   selbst keinen Text, nur der Block links wechselt. Der Play-Store-Eintrag
   hat je Sprache eine eigene Feature-Grafik – Englisch ist die
   Standardsprache, Deutsch die Übersetzung de-DE.

   Die deutschen Zeilen sind länger als die englischen. Damit sie nicht in
   die Figuren laufen, misst das Skript unten die Breite des Textblocks und
   meldet, wenn er über 480 px hinausreicht – dort beginnt der stehende
   Dokumentierende. Bei 22 px stieß die deutsche Merkmalzeile mit dem
   letzten Buchstaben von „Protokoll" in seine Hose; deshalb steht sie zwei
   Punkt kleiner. Das ist die bessere Lösung als abgekürzte Wörter. */
const FASSUNGEN = [
  { datei: "feature-grafik-1024x500.png",
    unter: "Adult resuscitation",
    merkmale: "Cycles &middot; Medication &middot; Event log", mGroesse: 22 },
  { datei: "feature-grafik-de-1024x500.png",
    unter: "Reanimation Erwachsener",
    merkmale: "Zyklen &middot; Medikamente &middot; Protokoll", mGroesse: 20 },
];

await page.setViewportSize({ width: 1024, height: 500 });
for (const f of FASSUNGEN) {
  await page.setContent(`<style>
    html,body{margin:0;padding:0}
    /* overflow:hidden ist Pflicht: Läuft der Text über, wächst sonst die
       Elementbreite mit, und der Screenshot wird breiter als 1024 px –
       Google verlangt die Maße aber auf den Pixel genau. */
    #b{width:1024px;height:500px;font-family:${SCHRIFT};position:relative;
       background:#F1F1F6 url(${bild(`${ZIEL}/feature-hintergrund.png`)}) right bottom/auto 92% no-repeat;
       overflow:hidden;box-sizing:border-box}
    #t{position:absolute;left:96px;top:50%;transform:translateY(-50%)}
    #s{width:112px;height:112px;margin-bottom:24px}
    #s svg{width:100%;height:100%;display:block;
      filter:drop-shadow(0 8px 18px rgba(16,32,40,.22))}
    h1{color:#121c26;font-size:66px;font-weight:800;letter-spacing:-.03em;margin:0}
    p{color:#54626e;font-size:27px;margin:12px 0 0;font-weight:500}
    p.m{color:#0e8a7a;font-weight:700;font-size:${f.mGroesse}px;margin-top:10px}
  </style><div id="b"><div id="t">
    <div id="s">${LOGO}</div>
    <h1>CPR Assist</h1>
    <p>${f.unter}</p>
    <p class="m">${f.merkmale}</p>
  </div></div>`);
  writeFileSync(`${ZIEL}/${f.datei}`, await page.locator("#b").screenshot());

  const kasten = await page.locator("#t").boundingBox();
  const ende = Math.round(kasten.x + kasten.width);
  console.log(`${ZIEL}/${f.datei}  Text endet bei ${ende} px` +
    (ende > 480 ? "  ACHTUNG: läuft in die Szene" : ""));
}

await browser.close();
