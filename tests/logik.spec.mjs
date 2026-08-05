// Rechenkern-Tests: jede Zeit- und Statusgrenze der Leitlinienlogik
// (GRC/ERC 2025, Erwachsene). Der Kern (window.CPRA.Kern) ist bewusst
// DOM- und uhrenfrei – die Zeit kommt als Parameter, deshalb lässt sich
// hier jede Grenze exakt prüfen.
import { test, expect } from "@playwright/test";
import { appOeffnen } from "./helfer.mjs";

test.beforeEach(async ({ page }) => { await appOeffnen(page); });

/* Fester Bezugspunkt: beliebiger Zeitstempel, nur die Differenzen zählen. */
const T = 1700000000000;

test("Zyklus: Fortschritt, 10-Sekunden-Warnung und Ablauf bei exakt 2:00", async ({ page }) => {
  const r = await page.evaluate(T => {
    const { Kern } = window.CPRA;
    const e = Kern.neuerEinsatz(T);
    const um = ms => Kern.zyklusInfo(e, T + ms);
    return {
      start:      um(0),
      mitte:      um(60000),
      vorWarnung: um(109999),
      warnung:    um(110000),
      kurzVorEnde:um(119999),
      ende:       um(120000),
      danach:     um(125000)
    };
  }, T);
  expect(r.start.restMs).toBe(120000);
  expect(r.start.anteil).toBe(0);
  expect(r.start.warnung).toBe(false);
  expect(r.mitte.anteil).toBeCloseTo(0.5, 5);
  expect(r.vorWarnung.warnung).toBe(false);     // 1:50,001 Rest > 10 s
  expect(r.warnung.warnung).toBe(true);         // exakt 10 s Rest
  expect(r.kurzVorEnde.warnung).toBe(true);
  expect(r.kurzVorEnde.abgelaufen).toBe(false);
  expect(r.ende.abgelaufen).toBe(true);         // exakt 2:00
  expect(r.ende.restMs).toBe(0);
  expect(r.danach.anteil).toBe(1);              // gekappt, läuft nicht über
});

test("Adrenalin nach einer Gabe: zu früh < 3:00 ≤ fällig < 5:00 ≤ überfällig", async ({ page }) => {
  const r = await page.evaluate(T => {
    const { Kern } = window.CPRA;
    const e = Kern.neuerEinsatz(T);
    Kern.adrenalinGabe(e, T);
    const um = ms => Kern.adrenalinStatus(e, T + ms).code;
    return {
      sofort:  um(0),
      s179:    um(179999),
      s180:    um(180000),
      s299:    um(299999),
      s300:    um(300000),
      s600:    um(600000),
      seit:    Kern.adrenalinStatus(e, T + 222000).seitMs
    };
  }, T);
  expect(r.sofort).toBe("zufrueh");
  expect(r.s179).toBe("zufrueh");        // 2:59,999
  expect(r.s180).toBe("faellig");        // exakt 3:00
  expect(r.s299).toBe("faellig");        // 4:59,999
  expect(r.s300).toBe("ueberfaellig");   // exakt 5:00
  expect(r.s600).toBe("ueberfaellig");
  expect(r.seit).toBe(222000);
});

test("Adrenalin ohne Gabe: hängt vom Rhythmus und der Schockzahl ab", async ({ page }) => {
  const r = await page.evaluate(T => {
    const { Kern } = window.CPRA;
    const status = vorbereiten => {
      const e = Kern.neuerEinsatz(T);
      vorbereiten(e);
      return Kern.adrenalinStatus(e, T + 60000).code;
    };
    return {
      ohneRhythmus:   status(() => {}),
      unklar:         status(e => Kern.rhythmusSetzen(e, T, "unklar")),
      nichtschockbar: status(e => Kern.rhythmusSetzen(e, T, "nichtschockbar")),
      schockbar0:     status(e => Kern.rhythmusSetzen(e, T, "schockbar")),
      schockbar2:     status(e => {
        Kern.rhythmusSetzen(e, T, "schockbar");
        Kern.schock(e, T + 1000); Kern.schock(e, T + 2000);
      }),
      schockbar3:     status(e => {
        Kern.rhythmusSetzen(e, T, "schockbar");
        Kern.schock(e, T + 1000); Kern.schock(e, T + 2000); Kern.schock(e, T + 3000);
      })
    };
  }, T);
  expect(r.ohneRhythmus).toBe("offen");
  expect(r.unklar).toBe("offen");
  expect(r.nichtschockbar).toBe("sofort");   // so bald wie möglich
  expect(r.schockbar0).toBe("zufrueh");      // erst nach dem 3. Schock
  expect(r.schockbar2).toBe("zufrueh");
  expect(r.schockbar3).toBe("faellig");      // nach dem 3. Schock
});

test("Amiodaron: Dosisstatus statt Countdown (300 nach 3., 150 nach 5. Schock)", async ({ page }) => {
  const r = await page.evaluate(T => {
    const { Kern } = window.CPRA;
    const e = Kern.neuerEinsatz(T);
    const codes = [];
    const merke = name => codes.push([name, Kern.amiodaronStatus(e).code]);

    merke("start");
    Kern.rhythmusSetzen(e, T, "schockbar");
    Kern.schock(e, T + 1000); Kern.schock(e, T + 2000);
    merke("zweiSchocks");
    Kern.schock(e, T + 3000);
    merke("dreiSchocks");
    Kern.amiodaronGabe(e, T + 4000, 300);
    merke("nach300");
    Kern.schock(e, T + 5000);
    merke("vierSchocks");
    Kern.schock(e, T + 6000);
    merke("fuenfSchocks");
    Kern.amiodaronGabe(e, T + 7000, 150);
    merke("nach150");
    return Object.fromEntries(codes);
  }, T);
  expect(r.start).toBe("keine");
  expect(r.zweiSchocks).toBe("keine");        // vor dem 3. Schock nichts fällig
  expect(r.dreiSchocks).toBe("faellig300");
  expect(r.nach300).toBe("gegeben300");
  expect(r.vierSchocks).toBe("gegeben300");   // 150 erst nach dem 5. Schock
  expect(r.fuenfSchocks).toBe("moeglich150");
  expect(r.nach150).toBe("gegeben150");
});

test("Amiodaron: bei nicht schockbarem Rhythmus nie fällig", async ({ page }) => {
  const r = await page.evaluate(T => {
    const { Kern } = window.CPRA;
    const e = Kern.neuerEinsatz(T);
    Kern.rhythmusSetzen(e, T, "nichtschockbar");
    Kern.schock(e, T + 1000); Kern.schock(e, T + 2000); Kern.schock(e, T + 3000);
    return Kern.amiodaronStatus(e).code;
  }, T);
  expect(r).toBe("keine");
});

test("Zustandsmaschine: Zyklus → Analyse → Schock → ROSC → Re-Arrest", async ({ page }) => {
  const r = await page.evaluate(T => {
    const { Kern } = window.CPRA;
    const e = Kern.neuerEinsatz(T);
    const bilder = [];
    const foto = name => bilder.push([name, {
      phase: e.phase, zyklus: e.zyklusNr, schocks: e.schocks.length,
      rhythmus: e.rhythmus, reArrests: e.reArrests
    }]);

    foto("start");
    Kern.analyseBeginnen(e, T + 120000);
    foto("analyse");
    Kern.analyseBeginnen(e, T + 121000);          // doppelt: darf nichts ändern
    const doppelt = e.ereignisse.filter(x => x.typ === "analyse").length;
    Kern.rhythmusSetzen(e, T + 125000, "schockbar");
    Kern.schock(e, T + 130000);                   // Schock startet sofort Zyklus 2
    foto("nachSchock");
    Kern.rosc(e, T + 200000);
    foto("rosc");
    Kern.reArrest(e, T + 260000);
    foto("reArrest");
    return { bilder: Object.fromEntries(bilder), doppelt,
             roscZeit: e.roscZeit, ereignisTypen: e.ereignisse.map(x => x.typ) };
  }, T);
  expect(r.bilder.start).toEqual({ phase: "cpr", zyklus: 1, schocks: 0, rhythmus: null, reArrests: 0 });
  expect(r.bilder.analyse.phase).toBe("analyse");
  expect(r.doppelt).toBe(1);
  expect(r.bilder.nachSchock).toEqual({ phase: "cpr", zyklus: 2, schocks: 1, rhythmus: "schockbar", reArrests: 0 });
  expect(r.bilder.rosc.phase).toBe("rosc");
  expect(r.bilder.reArrest).toEqual({ phase: "cpr", zyklus: 1, schocks: 1, rhythmus: "unklar", reArrests: 1 });
  expect(r.roscZeit).toBe(null);                  // nach Re-Arrest zurückgesetzt
  expect(r.ereignisTypen).toEqual(
    ["start", "analyse", "rhythmus", "schock", "zyklus", "rosc", "rearrest"]);
});

test("Re-Arrest: die Adrenalin-Uhr läuft über den ROSC hinweg weiter", async ({ page }) => {
  const r = await page.evaluate(T => {
    const { Kern } = window.CPRA;
    const e = Kern.neuerEinsatz(T);
    Kern.adrenalinGabe(e, T + 10000);
    Kern.rosc(e, T + 60000);
    Kern.reArrest(e, T + 100000);
    /* 4:30 nach der Gabe → fällig, nicht "noch keine Gabe" */
    return Kern.adrenalinStatus(e, T + 280000);
  }, T);
  expect(r.code).toBe("faellig");
  expect(r.seitMs).toBe(270000);
});

test("Uhr-Formate: fmtUhr, fmtRest (aufgerundet) und Stundenformat", async ({ page }) => {
  const r = await page.evaluate(() => {
    const { Kern } = window.CPRA;
    return {
      null_: Kern.fmtUhr(0),
      sek: Kern.fmtUhr(5000),
      min: Kern.fmtUhr(65000),
      stunde: Kern.fmtUhr(3600000),
      lang: Kern.fmtUhr(3725000),
      restVoll: Kern.fmtRest(120000),
      restAngebrochen: Kern.fmtRest(119001),   // aufgerundet → 2:00
      restKurz: Kern.fmtRest(9400),
      restNull: Kern.fmtRest(0)
    };
  });
  expect(r.null_).toBe("0:00");
  expect(r.sek).toBe("0:05");
  expect(r.min).toBe("1:05");
  expect(r.stunde).toBe("1:00:00");
  expect(r.lang).toBe("1:02:05");
  expect(r.restVoll).toBe("2:00");
  expect(r.restAngebrochen).toBe("2:00");
  expect(r.restKurz).toBe("0:10");
  expect(r.restNull).toBe("0:00");
});

test("Konfiguration entspricht der Leitlinie (Erwachsene)", async ({ page }) => {
  const k = await page.evaluate(() => window.CPRA.KONF);
  expect(k.ZYKLUS_MS).toBe(120000);
  expect(k.ADRENALIN_FRUEH_MS).toBe(180000);
  expect(k.ADRENALIN_SPAET_MS).toBe(300000);
  expect(k.AMIODARON_SCHOCK_300).toBe(3);
  expect(k.AMIODARON_SCHOCK_150).toBe(5);
  expect(k.BPM_PRESETS).toEqual([100, 110, 120]);
  expect(k.BPM_STANDARD).toBe(110);
  expect(k.URSACHEN).toHaveLength(8);
});
