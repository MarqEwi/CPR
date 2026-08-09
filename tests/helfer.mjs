// Gemeinsame Helfer für die Playwright-Tests.

/* Öffnet die App mit übersprungener Kurzeinführung, damit die Tests direkt
   auf der Bereit-Ansicht landen. */
export async function appOeffnen(page, opts = {}){
  await page.addInitScript(() => {
    localStorage.setItem("cpra_onboarding_done", "true");
  });
  if (opts.vorher) await page.addInitScript(opts.vorher);
  await page.goto("/index.html");
  await page.waitForFunction(() => !!window.CPRA);
}

/* Stellt die Android-App-Umgebung nach: window.Capacitor mit den Plugins,
   die die App tatsächlich benutzt. Alle Aufrufe landen in window.__calls,
   damit die Tests prüfen können, dass der native Zweig wirklich läuft. */
export function capacitorMock(){
  window.__calls = [];
  const merke = (name, arg) => window.__calls.push({ name, arg });
  window.Capacitor = {
    isNativePlatform: () => true,
    Plugins: {
      App: {
        addListener: (ev, cb) => { (window.__listener ||= {})[ev] = cb; return { remove(){} }; },
        exitApp: () => merke("App.exitApp")
      },
      /* Eigenes Plugin: hält den Bildschirm an (FLAG_KEEP_SCREEN_ON). */
      BildschirmWach: {
        an:  async () => { merke("BildschirmWach.an"); return {}; },
        aus: async () => { merke("BildschirmWach.aus"); return {}; }
      },
      /* Für den Einsatzbericht: ablegen und weitergeben. Die Daten selbst
         werden mitgeschrieben, damit die Tests die Datei prüfen können. */
      Filesystem: {
        writeFile: async o => {
          merke("Filesystem.writeFile", { path: o.path, directory: o.directory, laenge: (o.data || "").length });
          if (o.directory === "DOCUMENTS" && window.__dokumenteGesperrt)
            throw new Error("EACCES");
          (window.__dateien ||= {})[o.path] = o.data;
          return {};
        },
        getUri: async o => {
          merke("Filesystem.getUri", { path: o.path, directory: o.directory });
          return { uri: "file:///" + String(o.directory).toLowerCase() + "/" + o.path };
        }
      },
      Share: {
        share: async o => { merke("Share.share", o); return { activityType: "test" }; }
      }
    }
  };
}

/* Startet einen Einsatz über die Oberfläche. */
export async function einsatzStarten(page){
  await page.click("#btn-start");
  await page.waitForSelector("#view-aktiv.active");
}

/* Hält einen „Halten“-Knopf lange genug gedrückt (Schock, Re-Arrest).
   `uhr: true`, wenn die Playwright-Uhr installiert ist – dann muss die
   gefälschte Zeit weiterlaufen, damit requestAnimationFrame feuert. */
export async function halten(page, selector, uhr){
  const box = await page.locator(selector).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  if (uhr) await page.clock.runFor(900);
  else await page.waitForTimeout(900);
  await page.mouse.up();
}
