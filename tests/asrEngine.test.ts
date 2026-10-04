import { describe, expect, test } from "bun:test";
import {
  resolveLangPair,
  selectAsrEndpoint,
  selectLocalTranslateUrl,
} from "../src/convex/asrEngine";

describe("selectAsrEndpoint — priorité faster-whisper local", () => {
  test("WHISPER_LOCAL_URL gagne même si GROQ_API_KEY est présent", () => {
    const ep = selectAsrEndpoint({
      WHISPER_LOCAL_URL: "http://localhost:9000",
      GROQ_API_KEY: "gsk_test",
    });
    expect(ep?.kind).toBe("local_whisper");
    expect(ep?.engine).toBe("faster_whisper_local");
  });

  test("URL locale normalisée : /v1/audio/transcriptions ajouté, slash final retiré", () => {
    const ep = selectAsrEndpoint({ WHISPER_LOCAL_URL: "http://worker:9000/" });
    expect(ep?.kind).toBe("local_whisper");
    if (ep?.kind === "local_whisper") {
      expect(ep.url).toBe("http://worker:9000/v1/audio/transcriptions");
    }
  });

  test("URL locale déjà complète conservée telle quelle", () => {
    const ep = selectAsrEndpoint({
      WHISPER_LOCAL_URL: "https://asr.exemple.org/v1/audio/transcriptions",
    });
    if (ep?.kind === "local_whisper") {
      expect(ep.url).toBe("https://asr.exemple.org/v1/audio/transcriptions");
    }
  });

  test("modèle : override > WHISPER_MODEL > défaut faster-whisper", () => {
    const overridden = selectAsrEndpoint(
      { WHISPER_LOCAL_URL: "http://w:9000", WHISPER_MODEL: "tiny" },
      "turbo",
    );
    expect(overridden && overridden.kind === "local_whisper" && overridden.model).toBe("turbo");
    const fromEnv = selectAsrEndpoint({ WHISPER_LOCAL_URL: "http://w:9000", WHISPER_MODEL: "medium" });
    expect(fromEnv && fromEnv.kind === "local_whisper" && fromEnv.model).toBe("medium");
    const def = selectAsrEndpoint({ WHISPER_LOCAL_URL: "http://w:9000" });
    expect(def && def.kind === "local_whisper" && def.model).toBe("large-v3");
  });

  test("GROQ seul → repli groq_whisper avec clé et endpoint officiels", () => {
    const ep = selectAsrEndpoint({ GROQ_API_KEY: "gsk_test" });
    expect(ep?.kind).toBe("groq");
    expect(ep?.engine).toBe("groq_whisper");
    if (ep?.kind === "groq") {
      expect(ep.apiKey).toBe("gsk_test");
      expect(ep.url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
      expect(ep.model).toBe("whisper-large-v3-turbo");
    }
  });

  test("aucun moteur → null (l'appelant doit lever ASR_WORKER_UNAVAILABLE)", () => {
    expect(selectAsrEndpoint({})).toBeNull();
    expect(selectAsrEndpoint({ GROQ_API_KEY: "   " })).toBeNull();
  });
});

describe("selectLocalTranslateUrl — Argos/LibreTranslate local", () => {
  test("URL tronquée des slashes finaux", () => {
    expect(selectLocalTranslateUrl({ TRANSLATE_LOCAL_URL: "http://lt:5000/" })).toBe(
      "http://lt:5000",
    );
  });
  test("absent ou blanc → null (cascade inchangée)", () => {
    expect(selectLocalTranslateUrl({})).toBeNull();
    expect(selectLocalTranslateUrl({ TRANSLATE_LOCAL_URL: "  " })).toBeNull();
  });
});

describe("resolveLangPair — contrat LibreTranslate/Argos", () => {
  test("paire valide en→fr", () => {
    expect(resolveLangPair("en", "fr")).toEqual({ source: "en", target: "fr" });
  });
  test("qualifiants régionaux déposés (pt-BR → pt)", () => {
    expect(resolveLangPair("pt-BR", "fr")).toEqual({ source: "pt", target: "fr" });
  });
  test("langues identiques → null (rien à traduire)", () => {
    expect(resolveLangPair("en", "en")).toBeNull();
  });
  test("codes invalides → null (le caller garde sa cascade)", () => {
    expect(resolveLangPair("", "fr")).toBeNull();
    expect(resolveLangPair("en", "")).toBeNull();
    expect(resolveLangPair("eng", "fr")).toBeNull();
  });
});
