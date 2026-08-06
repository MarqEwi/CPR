// Erzeugt die Grafiken für den Play-Store-Eintrag unter docs/store-grafiken/.
//
//   node scripts/screenshots.mjs && node scripts/store-grafiken.mjs
//
// Grundlage sind die App-Aufnahmen aus docs/screenshots/. Die Überschriften
// sind bewusst eigenständig formuliert: Bei mehreren Apps im selben Konto ist
// "wiederholter Inhalt" das größte Ablehnungsrisiko beim Play-Review.
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

const AUFNAHMEN = [
  { datei: "02-aktiv",       text: "Der 2-Minuten-Zyklus<br>immer im Blick" },
  { datei: "03-analyse",     text: "Analysefenster:<br>Rhythmus prüfen, Helfer wechseln" },
  { datei: "04-rhythmus",    text: "VF/pVT oder PEA/Asystolie –<br>ein Tipp genügt" },
  { datei: "05-ursachen",    text: "4 H\u2019s &amp; HITS<br>strukturiert abarbeiten" },
  { datei: "08-massnahmen",  text: "Zugang, Atemweg, Kapnographie<br>mit Zeitstempel" },
  { datei: "06-rosc",        text: "Nach ROSC<br>geht es strukturiert weiter" },
  { datei: "01-bereit",      text: "Merkhilfe und Protokoll –<br>keine Therapieentscheidung" }
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();

/* ---- Store-Screenshots 1080 × 1920 ---- */
for (let i = 0; i < AUFNAHMEN.length; i++){
  const a = AUFNAHMEN[i];
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.setContent(`<style>
    html,body{margin:0;padding:0}
    #b{width:1080px;height:1920px;background:${GRUND};font-family:${SCHRIFT};
       display:flex;flex-direction:column;align-items:center;overflow:hidden}
    h1{color:#eef3f5;font-size:60px;line-height:1.18;font-weight:700;letter-spacing:-.022em;
       text-align:center;margin:76px 60px 0}
    h1::after{content:"";display:block;width:96px;height:5px;border-radius:3px;
       background:${AKZENT};margin:30px auto 0}
    img{width:760px;border-radius:38px;margin-top:48px;
        border:1px solid #252c33;box-shadow:0 26px 70px rgba(0,0,0,.55)}
  </style><div id="b"><h1>${a.text}</h1><img src="${bild(`docs/screenshots/${a.datei}.png`)}"></div>`);
  const name = `${ZIEL}/screenshot-${i + 1}-1080x1920.png`;
  writeFileSync(name, await page.locator("#b").screenshot());
  console.log(name);
}

/* ---- Feature-Grafik 1024 × 500 ---- */
await page.setViewportSize({ width: 1024, height: 500 });
await page.setContent(`<style>
  html,body{margin:0;padding:0}
  /* overflow:hidden ist Pflicht: Läuft der Text über, wächst sonst die
     Elementbreite mit, und der Screenshot wird breiter als 1024 px –
     Google verlangt die Maße aber auf den Pixel genau. */
  #b{width:1024px;height:500px;background:${GRUND};font-family:${SCHRIFT};
     display:flex;align-items:center;gap:52px;padding:0 76px;overflow:hidden;
     box-sizing:border-box}
  #s{width:190px;height:190px;flex:none}
  #s svg{width:100%;height:100%;display:block;
    filter:drop-shadow(0 12px 26px rgba(0,0,0,.5))}
  #t{flex:1;min-width:0}
  h1{color:#eef3f5;font-size:76px;font-weight:700;letter-spacing:-.03em;margin:0}
  p{color:#93a0a9;font-size:33px;margin:14px 0 0;font-weight:500}
  p b{color:${AKZENT};font-weight:600}
</style><div id="b"><div id="s">${LOGO}</div>
  <div id="t"><h1>CPR Assist</h1>
  <p>Reanimation Erwachsene &middot; <b>Zyklen, Medikamente, Protokoll</b></p></div></div>`);
writeFileSync(`${ZIEL}/feature-grafik-1024x500.png`, await page.locator("#b").screenshot());
console.log(`${ZIEL}/feature-grafik-1024x500.png`);

await browser.close();
