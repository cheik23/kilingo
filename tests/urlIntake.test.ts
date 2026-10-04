import { describe, expect, test } from "bun:test";
import { parseVideoUrl } from "../src/components/learner/UrlInput";

describe("parseVideoUrl (intake)", () => {
  test("YouTube watch → platform + videoId", () => {
    const p = parseVideoUrl("https://www.youtube.com/watch?v=jNQXAC9IVRw");
    expect(p?.platform).toBe("youtube");
    expect(p?.videoId).toBe("jNQXAC9IVRw");
  });
  test("TikTok longue → postId dans videoId", () => {
    const p = parseVideoUrl("https://www.tiktok.com/@scout2015/video/6718335390845095173");
    expect(p?.platform).toBe("tiktok");
    expect(p?.videoId).toBe("6718335390845095173");
  });
  test("fichier direct → platform direct (sans id)", () => {
    const p = parseVideoUrl("https://example.com/a/track.mp3");
    expect(p?.platform).toBe("direct");
    expect(p?.videoId).toBeUndefined();
  });
  test("URL invalide → null (erreur affichée par la UI)", () => {
    expect(parseVideoUrl(":::pas une url:::")).toBeNull();
    expect(parseVideoUrl("")).toBeNull();
  });
  test("recovery : invalide → erreur, puis média valide repars (§11)", () => {
    expect(parseVideoUrl("https://example.org/inconnu")).toBeNull(); // état d'erreur
    const recovered = parseVideoUrl("https://youtu.be/jNQXAC9IVRw");
    expect(recovered?.platform).toBe("youtube"); // récupération propre
  });
});
