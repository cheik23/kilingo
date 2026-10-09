import { describe, expect, test } from "bun:test";
import {
  detectPlatform,
  extractTikTokPostId,
  extractYouTubeVideoId,
  normalizeUrl,
  resolveMedia,
} from "../src/convex/mediaResolver";

describe("normalizeUrl", () => {
  test("https:// implicite", () => {
    expect(normalizeUrl("youtube.com/watch?v=abc")?.protocol).toBe("https:");
  });
  test("trim des espaces", () => {
    expect(normalizeUrl("  https://youtu.be/abc  ")?.hostname).toBe("youtu.be");
  });
  test("null pour une URL invalide", () => {
    expect(normalizeUrl("pas une url :::")).toBeNull();
  });
  test("null pour vide", () => {
    expect(normalizeUrl("   ")).toBeNull();
  });
  test("protocole non http rejeté (SSRF: file:, javascript:)", () => {
    expect(normalizeUrl("file:///etc/passwd")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("ftp://example.com/x.mp3")).toBeNull();
  });
});

describe("extractYouTubeVideoId", () => {
  test("watch?v=", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=jNQXAC9IVRw")).toBe("jNQXAC9IVRw");
  });
  test("youtu.be avec timestamp", () => {
    expect(extractYouTubeVideoId("https://youtu.be/jNQXAC9IVRw?t=10")).toBe("jNQXAC9IVRw");
  });
  test("shorts / embed / live", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/shorts/jNQXAC9IVRw")).toBe("jNQXAC9IVRw");
    expect(extractYouTubeVideoId("https://www.youtube.com/embed/jNQXAC9IVRw")).toBe("jNQXAC9IVRw");
    expect(extractYouTubeVideoId("https://www.youtube.com/live/jNQXAC9IVRw")).toBe("jNQXAC9IVRw");
  });
  test("m.youtube.com et music.youtube.com", () => {
    expect(extractYouTubeVideoId("https://m.youtube.com/watch?v=jNQXAC9IVRw")).toBe("jNQXAC9IVRw");
    expect(extractYouTubeVideoId("https://music.youtube.com/watch?v=jNQXAC9IVRw")).toBe("jNQXAC9IVRw");
  });
  test("hors YouTube → null", () => {
    expect(extractYouTubeVideoId("https://vimeo.com/123456")).toBeNull();
    expect(extractYouTubeVideoId("not a url")).toBeNull();
  });
  test("YouTube sans id → null", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/feed/trending")).toBeNull();
  });
});

describe("extractTikTokPostId", () => {
  test("URL longue /@user/video/{id}", () => {
    expect(extractTikTokPostId("https://www.tiktok.com/@scout2015/video/6718335390845095173")).toBe(
      "6718335390845095173",
    );
  });
  test("format lecteur officiel /player/v1/{id}", () => {
    expect(extractTikTokPostId("https://www.tiktok.com/player/v1/6718335390845095173")).toBe(
      "6718335390845095173",
    );
  });
  test("variante /v/{id}", () => {
    expect(extractTikTokPostId("https://www.tiktok.com/v/6718335390845095173")).toBe(
      "6718335390845095173",
    );
  });
  test("hors TikTok → null", () => {
    expect(extractTikTokPostId("https://youtube.com/watch?v=x")).toBeNull();
  });
  test("TikTok sans id → null (lien profil)", () => {
    expect(extractTikTokPostId("https://www.tiktok.com/@scout2015")).toBeNull();
  });
});

describe("detectPlatform", () => {
  test("YouTube (watch, youtu.be, shorts)", () => {
    expect(detectPlatform("https://www.youtube.com/watch?v=abc")?.adapter.key).toBe("youtube");
    expect(detectPlatform("https://youtu.be/abc")?.adapter.key).toBe("youtube");
    expect(detectPlatform("https://www.youtube.com/shorts/abc")?.adapter.key).toBe("youtube");
  });
  test("TikTok", () => {
    expect(detectPlatform("https://www.tiktok.com/@u/video/123")?.adapter.key).toBe("tiktok");
  });
  test("fichier direct par extension (mp3 audio, mp4 vidéo)", () => {
    const mp3 = detectPlatform("https://example.com/a/track.mp3");
    expect(mp3?.adapter.key).toBe("direct");
    expect(mp3?.adapter.resolve(mp3.url).mediaType).toBe("audio");
    const mp4 = detectPlatform("https://example.com/a/clip.mp4");
    expect(mp4?.adapter.key).toBe("direct");
    expect(mp4?.adapter.resolve(mp4.url).mediaType).toBe("video");
  });
  test("plateforme inconnue → null", () => {
    expect(detectPlatform("https://example.org/xyz")).toBeNull();
  });
  test("URL invalide → null", () => {
    expect(detectPlatform(":::")).toBeNull();
  });
});

describe("resolveMedia — verdicts purs (sans réseau : oEmbed absent pour ces hosts)", () => {
  test("URL invalide → UNAVAILABLE explicite", async () => {
    const r = await resolveMedia(":::");
    expect(r.mode).toBe("UNAVAILABLE");
    expect(r.platform).toBe("unknown");
    expect(r.reason).toBeTruthy();
  });
  test("plateforme inconnue → UNAVAILABLE avec raison", async () => {
    const r = await resolveMedia("https://example.org/xyz");
    expect(r.mode).toBe("UNAVAILABLE");
    expect(r.reason).toContain("non reconnu");
  });
  test("direct MP3 → DIRECT_STREAM + playableUrl", async () => {
    const r = await resolveMedia("https://example.com/a/track.mp3");
    expect(r.mode).toBe("DIRECT_STREAM");
    expect(r.playableUrl).toBe("https://example.com/a/track.mp3");
    expect(r.mediaType).toBe("audio");
    expect(r.transcriptAvailable).toBe(false);
  });
  test("direct MP4 → DIRECT_STREAM vidéo", async () => {
    const r = await resolveMedia("https://example.com/a/clip.MP4?x=1");
    expect(r.mode).toBe("DIRECT_STREAM");
    expect(r.mediaType).toBe("video");
  });
  test("direct .oga (extension simple, non doublonnée)", async () => {
    const r = await resolveMedia("https://example.com/a/rec.oga");
    expect(r.mode).toBe("DIRECT_STREAM");
    expect(r.mediaType).toBe("audio");
  });

  test("Dailymotion /video/{id} → EMBED_ALLOWED (lecture dans l'app)", async () => {
    const r = await resolveMedia("https://www.dailymotion.com/video/x8abc12");
    expect(r.platform).toBe("dailymotion");
    expect(r.mode).toBe("EMBED_ALLOWED");
    expect(r.embedUrl).toBe("https://www.dailymotion.com/embed/video/x8abc12");
    expect(r.transcriptAvailable).toBe(false);
  });
  test("Dailymotion dai.ly → même verdict", async () => {
    const r = await resolveMedia("https://dai.ly/x8abc12");
    expect(r.mode).toBe("EMBED_ALLOWED");
    expect(r.embedUrl).toContain("/embed/video/x8abc12");
  });
  test("Dailymotion sans id → UNAVAILABLE", async () => {
    const r = await resolveMedia("https://www.dailymotion.com/");
    expect(r.mode).toBe("UNAVAILABLE");
  });

  test("Archive.org /download/{id}/{file} → DIRECT_STREAM lisible", async () => {
    const r = await resolveMedia(
      "https://archive.org/download/night_of_the_living_dead/night_of_the_living_dead_512kb.mp4",
    );
    expect(r.platform).toBe("archive");
    expect(r.mode).toBe("DIRECT_STREAM");
    expect(r.mediaType).toBe("video");
    expect(r.playableUrl).toBe(
      "https://archive.org/download/night_of_the_living_dead/night_of_the_living_dead_512kb.mp4",
    );
  });
  test("Archive.org fichier audio → mediaType audio", async () => {
    const r = await resolveMedia("https://archive.org/download/some-item/track.mp3");
    expect(r.mode).toBe("DIRECT_STREAM");
    expect(r.mediaType).toBe("audio");
  });
  test("Archive.org page /details sans fichier → CATALOG_ONLY (honnête)", async () => {
    const r = await resolveMedia("https://archive.org/details/some-item");
    expect(r.mode).toBe("CATALOG_ONLY");
    expect(r.playableUrl).toBeUndefined();
    expect(r.reason).toBeTruthy();
  });
  test("Archive.org URL sans identifiant → UNAVAILABLE", async () => {
    const r = await resolveMedia("https://archive.org/");
    expect(r.mode).toBe("UNAVAILABLE");
  });
});
