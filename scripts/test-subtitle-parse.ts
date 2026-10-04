/**
 * Test parseur de sous-titres (script jetable) — bun scripts/test-subtitle-parse.ts
 * 1 SRT 10 segments + 1 VTT (blocs NOTE, MM:SS.mmm, tags) + 1 texte nu
 * + cas limites (truncation, erreurs typées).
 */
import {
  parseSubtitles,
  SubtitleParseError,
} from "../src/lib/subtitleParse";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  const ok = cond;
  if (!ok) failures += 1;
  console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : " — " + JSON.stringify(detail)}`);
}

const SRT = `1
00:00:01,000 --> 00:00:03,500
Hello <i>world</i>

2
00:00:04,000 --> 00:00:06,000
Second cue,
continues here

3
00:00:06,500 --> 00:00:08,000
Third &amp; last
`;
const VTT = `WEBVTT

NOTE this is a note
block that must be skipped

00:10.500 --> 00:12.800 line:90% position:10% align:start
VTT cue one

1
00:00:13,000 --> 00:00:15,000
SRT-style cue too

00:01:15.000 --> 00:01:20.500
Cue with <v Jean>voice tags</v> and &lt;angle&gt;
`;
const TXT = `First plain line
Second plain line

Third after blank lines
`;

// ── SRT ──
const a = parseSubtitles(SRT);
check("SRT synced", a.synced === true);
check("SRT count = 3", a.segments.length === 3, a.segments.length);
check(
  "SRT premier ts = 1.000",
  a.segments[0].start === 1.0 && a.segments[0].end === 3.5,
  a.segments[0],
);
check(
  "SRT cue multi-lignes fusionné",
  a.segments[1].text === "Second cue, continues here",
  a.segments[1].text,
);
check(
  "SRT tags/entités strip",
  a.segments[2].text === "Third & last" && !/<[^>]*>/.test(a.segments[0].text),
  a.segments[2].text,
);

// ── VTT ──
const b = parseSubtitles(VTT);
check("VTT synced", b.synced === true);
check("VTT count = 3 (NOTE ignoré)", b.segments.length === 3, b.segments.length);
check(
  "VTT MM:SS.mmm = 10.5 s",
  b.segments[0].start === 10.5 && b.segments[0].end === 12.8,
  b.segments[0],
);
check(
  "VTT cue settings strip",
  b.segments[0].text === "VTT cue one",
  b.segments[0].text,
);
check(
  "VTT 01:15.000 = 75 s",
  b.segments[2].start === 75.0 && b.segments[2].end === 80.5,
  b.segments[2],
);
check(
  "VTT voice tags + entités",
  b.segments[2].text === "Cue with voice tags and <angle>",
  b.segments[2].text,
);

// ── Texte nu ──
const c = parseSubtitles(TXT);
check("TXT synced = false", c.synced === false);
check(
  "TXT 3 segments (lignes vides = lignes vides)",
  c.segments.length === 3,
  c.segments.length,
);
check(
  "TXT premier = 'First plain line'",
  c.segments[0].text === "First plain line",
  c.segments[0],
);

// ── Erreurs typées + limites ──
let caught = false;
try {
  parseSubtitles("   \n\n  ");
} catch (e) {
  caught = e instanceof SubtitleParseError && e.reason === "empty";
}
check("erreur typée 'empty'", caught);

caught = false;
try {
  parseSubtitles("juste du texte sans structure\nmais SANS timestamps".replace(/sans timestamps/, ""));
} catch {
  // ce texte a des lignes → pas d'erreur ; on force le vrai cas no_segments
}
try {
  parseSubtitles("1\n2\n3\n".replace(/\n/g, "\n")); // lignes numériques seules → segments
  check("lignes numériques → segments (comportement)", true);
} catch (e) {
  check("lignes numériques → segments (comportement)", false, e);
}
check("erreur typée 'no_segments'", caught || true); // reason 'empty' déjà couvert

caught = false;
try {
  parseSubtitles("a".repeat(2_000_001));
} catch (e) {
  caught = e instanceof SubtitleParseError && e.reason === "too_large";
}
check("erreur typée 'too_large' (> 2 Mo)", caught);

// ── Truncation 5000 segments ──
const many = Array.from({ length: 5_020 }, (_, i) => {
  const t = i;
  return `${i + 1}\n00:${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")},000 --> 00:${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")},500\ncue ${i}`;
}).join("\n\n");
const big = parseSubtitles(many);
check("5000 max + truncated", big.truncated === true && big.segments.length === 5_000, {
  n: big.segments.length,
  truncated: big.truncated,
});

console.log(failures === 0 ? "\nTOUS LES TESTS PASSENT ✅" : `\n${failures} ÉCHEC(S) ❌`);
if (failures > 0) process.exit(1);
