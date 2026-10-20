import { describe, expect, test } from "bun:test";
import { LANGUAGES } from "../src/convex/languages";
import {
  PIPER_VOICE_REGISTRY,
  pausePiper,
  piperCached,
  piperLanguages,
  piperPaused,
  piperPlaying,
  piperPositionSeconds,
  piperVoiceFor,
  piperVoiceForCommercial,
  piperVoiceForRuntime,
  playPiper,
  resumePiper,
  stopPiper,
} from "../src/lib/tts";

/* ═══════════════════════════════════════════════════════════════════════
   REPLI TTS LIBRE (Piper) — PROMESSES HONNÊTES

   Le module tts.ts ne promet une voix libre QUE pour une langue dont la
   voix existe réellement dans le paquet @realtimex/piper-tts-web
   (conféré par son type VoiceId). Ces tests verrouillent :
     1. chaque voix annoncée appartient bien au catalogue du paquet ;
     2. les langues du catalogue de l'app SANS voix libre restent
        explicitement null — pas de promesse fantôme ;
     3. aucune voix ne référence une langue absente de l'app.
   ═══════════════════════════════════════════════════════════════════════ */

/** Extrait de l'union VoiceId du paquet (dist/types.d.ts, 1.1.1) —
 *  valeurs dont on vérifie l'EXISTENCE réelle côté paquet. */
const VOICES_IN_PACKAGE = new Set([
  "ar_JO-kareem-low", "ar_JO-kareem-medium",
  "de_DE-eva_k-x_low", "de_DE-thorsten-low", "de_DE-thorsten-medium",
  "el_GR-rapunzelina-low",
  "en_US-amy-low", "en_US-amy-medium", "en_US-hfc_female-medium",
  "es_ES-carlfm-x_low", "es_MX-ald-medium",
  "fa_IR-amir-medium", "fa_IR-gyro-medium",
  "fr_FR-siwis-low", "fr_FR-siwis-medium", "fr_FR-upmc-medium",
  "it_IT-riccardo-x_low",
  "pl_PL-gosia-medium", "pl_PL-darkman-medium",
  "pt_BR-edresson-low", "pt_BR-faber-medium", "pt_PT-tugão-medium",
  "ru_RU-denis-medium", "ru_RU-irina-medium", "ru_RU-ruslan-medium",
  "sw_CD-lanfrica-medium",
  "tr_TR-fahrettin-medium", "tr_TR-dfki-medium",
  "vi_VN-vivos-x_low", "vi_VN-25hours_single-low",
  "zh_CN-huayan-x_low", "zh_CN-huayan-medium",
]);

describe("logique d'état du module sans média (déterministe)", () => {
  test("sans aucun média : commands inertes, position null, jamais d'exception", () => {
    expect(() => {
      pausePiper();
      resumePiper();
      stopPiper();
    }).not.toThrow();
    expect(piperPlaying()).toBe(false);
    expect(piperPaused()).toBe(false);
    expect(piperPositionSeconds()).toBeNull();
  });

  test("playPiper hors navigateur : erreur honnête via callback, pas de rejet", () => {
    // bun tourne sans window : la fonction doit renvoyer onError sans lever.
    let err = null;
    playPiper("x", "es", { onError: (e) => { err = e?.message; } });
    expect(err).toContain("Environnement sans audio navigateur");
    expect(piperPlaying()).toBe(false);
  });

  test("piperCached hors navigateur : false, sans exception", async () => {
    // navigator absent en bun : la fonction doit résoudre false.
    expect(await piperCached("es")).toBe(false);
  });
});

describe("registre à double statut — technique ≠ commercial", () => {
  const CATALOGUE = ["en", "zh", "es", "ar", "ru", "sw", "ln", "ha", "yo",
    "zu", "wo", "de", "hi", "bn", "pt", "ur", "id", "ja", "tr", "ko", "it",
    "th", "vi", "am", "ig", "fa", "tl", "pl", "el"];

  test("les 9 voix auditées live gardent leur statut technique correct", () => {
    for (const lang of piperLanguages()) {
      expect(PIPER_VOICE_REGISTRY[lang]?.technicalStatus).toBe<"tested-working" | "inference-failure" | "untested">("tested-working");
      expect(PIPER_VOICE_REGISTRY[lang]?.voiceId).toBe(piperVoiceFor(lang));
    }
  });

  test("les 5 modèles incompatibles (zh, it, vi, ru, fa) restent désactivés", () => {
    for (const lang of ["zh", "it", "vi", "ru", "fa"]) {
      expect(PIPER_VOICE_REGISTRY[lang]?.technicalStatus).not.toBe("tested-working");
      expect(piperVoiceFor(lang)).toBeNull();
      expect(piperVoiceForCommercial(lang)).toBeNull();
    }
  });

  test("aucune voix inconnue ou non commerciale n'est autorisée commercialement", () => {
    for (const [lang, rec] of Object.entries(PIPER_VOICE_REGISTRY)) {
      if (rec.commercialStatus === "unknown" ||
          rec.commercialStatus === "non-commercial") {
        expect(piperVoiceForCommercial(lang)).toBeNull();
      }
      // conditional : jamais transformé en autorisation arbitraire —
      // il doit être accompagné des obligations documentées.
      if (rec.commercialStatus === "conditional") {
        expect(obligationsDocumented(rec)).toBe(true);
      }
    }
  });

  test("chaque statut non vérifié garde son incertitude documentée", () => {
    for (const rec of Object.values(PIPER_VOICE_REGISTRY)) {
      if (rec.commercialStatus === "unknown" ||
          rec.commercialStatus === "non-commercial") {
        expect((rec.notes ?? "").length).toBeGreaterThan(15);
        expect(rec.licenseSource.startsWith("https://")).toBe(true);
      }
    }
  });

  test("le build production ne choisit AUCUNE voix bloquée", () => {
    // La liste attendue est DÉRIVÉE du registre unique (jamais recopiée) :
    // tested-working ET (verified OU conditional avec obligations remplies).
    const attendu = Object.entries(PIPER_VOICE_REGISTRY)
      .filter(([, r]) =>
        r.technicalStatus === "tested-working" &&
        (r.commercialStatus === "verified" ||
          (r.commercialStatus === "conditional" && r.obligationsMet === true))
      )
      .map(([lang]) => lang)
      .sort();
    const viaPorte = Object.keys(PIPER_VOICE_REGISTRY)
      .filter((lang) => piperVoiceForCommercial(lang) !== null)
      .sort();
    expect(viaPorte).toEqual(attendu);
    // Après l'audit de filiation : seules les voix « trained from scratch »
    // dont le corpus est démontré libre (es) restent autorisées.
    expect(viaPorte).toEqual(["es"]);
  });

  test("filiation restrictive ou douteuse : jamais dans la liste commerciale", () => {
    // Dériver du registre (notes) : toute voix dont la note cite une
    // filiation Ryan (corpus carte NC) ou Lessac/Blizzard (recherche seule),
    // ou un corpus invérifiable, doit être exclue de la porte commerciale.
    for (const [lang, rec] of Object.entries(PIPER_VOICE_REGISTRY)) {
      const filiationRestrictive =
        /Ryan/.test(rec.notes ?? "") || /Lessac/.test(rec.notes ?? "");
      if (filiationRestrictive) {
        expect(piperVoiceForCommercial(lang)).toBeNull();
      }
    }
  });

  test("conditionnels désactivés en commercial tant que obligations pas remplies", () => {
    for (const [lang, rec] of Object.entries(PIPER_VOICE_REGISTRY)) {
      if (rec.commercialStatus === "conditional" &&
          rec.obligationsMet !== true) {
        expect(piperVoiceForCommercial(lang)).toBeNull();
      }
    }
    // pt et de : obligations (CC BY 4.0 / M-AILABS) NON encore remplies.
    expect(PIPER_VOICE_REGISTRY["pt"]?.obligationsMet).toBeUndefined();
    expect(PIPER_VOICE_REGISTRY["de"]?.obligationsMet).toBeUndefined();
    expect(piperVoiceForCommercial("pt")).toBeNull();
    expect(piperVoiceForCommercial("de")).toBeNull();
  });

  test("en est rétrogradé à « unknown » : aucune autorisation commerciale", () => {
    expect(PIPER_VOICE_REGISTRY["en"]?.commercialStatus).toBe<"verified" | "conditional" | "non-commercial" | "unknown">("unknown");
    expect(piperVoiceForCommercial("en")).toBeNull();
    // …mais toujours testable en développement (voix auditée).
    expect(piperVoiceFor("en")).toBe("en_US-amy-low");
  });

  test("les 9 voix auditées restent techniquement reconnaissables", () => {
    expect([...piperLanguages()].sort()).toEqual([
      "ar", "de", "el", "en", "es", "pl", "pt", "sw", "tr"
    ]);
  });

  test("registre : 14 enregistrements = 9 fonctionnels + 5 incompatibles, une seule source de vérité", () => {
    const stats = { working: 0, failure: 0, autres: 0 };
    for (const rec of Object.values(PIPER_VOICE_REGISTRY)) {
      if (rec.technicalStatus === "tested-working") stats.working++;
      else if (rec.technicalStatus === "inference-failure") stats.failure++;
      else stats.autres++;
    }
    expect(stats).toEqual({ working: 9, failure: 5, autres: 0 });
  });

  test("le mode développement reste libre : runtime = porte technique", () => {
    // En non-prod, piperVoiceForRuntime est un passe-plat de piperVoiceFor :
    // les 9 voix auditées restent essayables, les autres restent null.
    for (const lang of piperLanguages()) {
      expect(piperVoiceForRuntime(lang)).toBe(piperVoiceFor(lang));
    }
    for (const lang of ["zh", "it", "vi", "ru", "fa", "hi", "id", "xx"]) {
      expect(piperVoiceForRuntime(lang)).toBeNull();
    }
  });

  test("fail-safe : statut incomplet jamais activable en commercial", () => {
    // La porte exige voiceId + licenseSource + les deux statuts explicitement
    // définis — toute lacune brute donne null (protection par défaut).
    for (const [lang, rec] of Object.entries(PIPER_VOICE_REGISTRY)) {
      const complet = !!rec.voiceId && !!rec.licenseSource &&
        !!rec.technicalStatus && !!rec.commercialStatus;
      if (!complet) {
        expect(piperVoiceForCommercial(lang)).toBeNull();
      }
    }
  });

  test("le registre ne contient QUE des langues du catalogue de l'app", () => {
    for (const lang of Object.keys(PIPER_VOICE_REGISTRY)) {
      expect(CATALOGUE.includes(lang)).toBe(true);
    }
  });
});

// Obligations documentées pour un statut conditionnel (source + note).
function obligationsDocumented(rec: {
  commercialStatus: string;
  notes?: string;
  licenseSource: string;
}): boolean {
  return rec.licenseSource.startsWith("https://") &&
    (rec.notes ?? "").length > 15;
}

describe("piperVoiceFor — voix libre réelle ou JAMAIS annoncée", () => {
  test("chaque voix annoncée existe dans le catalogue du paquet ( licence MIT du paquet : rien à payer ni à signer)", () => {
    for (const lang of piperLanguages()) {
      const voice = piperVoiceFor(lang);
      expect(voice).not.toBeNull();
      expect(VOICES_IN_PACKAGE.has(voice as string)).toBe(true);
    }
  });

  test("les 20 langues du catalogue sans voix libre restent « null » (honnêteté > promesse)", () => {
    // Statuts matériels audités live (sonde tts-probe.html) :
    //  — hi et id : voix au dépôt rhasspy mais ABSENTES du paquet 1.1.1
    //    (commande/license NC ou non résolue) ;
    //  — zh, it, vi, ru, fa : modèles présents dans le paquet mais inférence
    //    OrtRun cassée avec ONNX Runtime 1.22.0 (indices out of bounds,
    //    reproduite live sur texte natif) ;
    //  — les 13 restantes : aucune voix Piper au dépôt.
    const sansVoixLibre = ["zh", "it", "vi", "ru", "fa", "hi", "bn", "ur", "id",
      "ja", "ko", "th", "am", "ig", "ln", "ha", "yo", "zu", "wo", "tl"];
    for (const lang of sansVoixLibre) {
      expect(piperVoiceFor(lang)).toBeNull();
    }
  });

  test("toutes les langues couvertes existent bien dans le catalogue de l'app", () => {
    const appCodes = new Set(LANGUAGES.map((l) => l.code));
    for (const lang of piperLanguages()) {
      expect(appCodes.has(lang as never)).toBe(true);
    }
  });

  test("code inconnu → null (jamais une autre langue par défaut)", () => {
    expect(piperVoiceFor("xx")).toBeNull();
    expect(piperVoiceFor("")).toBeNull();
    expect(piperVoiceFor("en-US")).toBeNull(); // code brut, pas de la carte
  });
});
