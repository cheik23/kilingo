/* Test jetable du parseur SRT/VTT/TXT (checkpoint A4 du LOT ROBUSTESSE).
   Exécuter : bun run scripts/testSubtitleParse.ts */
import {
  parseSubtitles,
  SubtitleParseError,
} from "../src/lib/subtitleParse";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    failures += 1;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/* ── Échantillon 1 : SRT 10 segments (timestamps exacts attendus) ── */
const srt = Array.from({ length: 10 }, (_, i) => {
  const n = i + 1;
  const s = i * 2; // 0, 2, 4 … 18 s
  const e = s + 1.5;
  const pad = (v: number, l = 2) => String(v).padStart(l, "0");
  const ts = (sec: number) =>
    `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(
      Math.floor(sec % 60),
    )},${pad(Math.round((sec % 1) * 1000), 3)}`;
  return `${n}\n${ts(s)} --> ${ts(e)}\nCue line ${n} <i>styled</i>\n`;
}).join("\n");

console.log("SRT — 10 segments :");
try {
  const r = parseSubtitles(srt);
  check("count = 10", r.segments.length === 10, `got ${r.segments.length}`);
  check("synced = true", r.synced === true);
  const first = r.segments[0];
  const last = r.segments[r.segments.length - 1];
  check("first start = 0", first.start === 0, `got ${first.start}`);
  check(
    "first end = 1.5",
    Math.abs(first.end - 1.5) < 1e-9,
    `got ${first.end}`,
  );
  check("first text = 'Cue line 1 styled'", first.text === "Cue line 1 styled", `got '${first.text}'`);
  check("last start = 18", last.start === 18, `got ${last.start}`);
  check(
    "last end = 19.5",
    Math.abs(last.end - 19.5) < 1e-9,
    `got ${last.end}`,
  );
  check("no truncated flag", r.truncated !== true);
} catch (err) {
  failures += 1;
  console.log(`  ❌ throw inattendu : ${err}`);
}

/* ── Échantillon 2 : WebVTT (NOTE, cue settings, MM:SS.mmm) ── */
const vtt = `WEBVTT

NOTE this is a comment
spanning multiple lines

1
00:01.000 --> 00:03.500 line:0 position:50% align:start
<v Jean>Hello <b>world</b>

00:04.250 --> 00:06.000
Second &amp; last cue
on two lines
`;
console.log("\nVTT — 2 segments :");
try {
  const r = parseSubtitles(vtt);
  check("count = 2", r.segments.length === 2, `got ${r.segments.length}`);
  check("synced = true", r.synced === true);
  const [a, b] = r.segments;
  check("first start = 1", a.start === 1, `got ${a.start}`);
  check(
    "first end = 3.5",
    Math.abs(a.end - 3.5) < 1e-9,
    `got ${a.end}`,
  );
  check("first text = 'Hello world'", a.text === "Hello world", `got '${a.text}'`);
  check(
    "second start = 4.25",
    Math.abs(b.start - 4.25) < 1e-9,
    `got ${b.start}`,
  );
  check(
    "entités + multiligne",
    b.text === "Second & last cue on two lines",
    `got '${b.text}'`,
  );
} catch (err) {
  failures += 1;
  console.log(`  ❌ throw inattendu : ${err}`);
}

/* ── Échantillon 3 : texte nu (mode liste) ── */
const bare = "First line\n\nSecond line\nThird line\n";
console.log("\nTXT nu — mode liste :");
try {
  const r = parseSubtitles(bare);
  check("count = 3", r.segments.length === 3, `got ${r.segments.length}`);
  check("synced = false", r.synced === false);
  check(
    "texte préservé",
    r.segments[1].text === "Second line" && r.segments[2].text === "Third line",
  );
} catch (err) {
  failures += 1;
  console.log(`  ❌ throw inattendu : ${err}`);
}

/* ── Garde-fous : erreurs typées, jamais de crash ── */
console.log("\nErreurs typées :");
try {
  parseSubtitles("");
  failures += 1;
  console.log("  ❌ vide : aucune exception levée");
} catch (err) {
  check(
    "vide → SubtitleParseError('empty')",
    err instanceof SubtitleParseError && err.reason === "empty",
  );
}
try {
  const r = parseSubtitles(
    "lol pas des sous-titres du tout\nencore une ligne sans temps\nsans flèche du tout\n",
  );
  check(
    "bruit sans arrow → texte nu (3 segments)",
    r.synced === false && r.segments.length === 3,
    `got synced=${String(r.synced)}, n=${r.segments.length}`,
  );
} catch (err) {
  failures += 1;
  console.log(`  ❌ texte nu a throwé : ${err}`);
}
try {
  parseSubtitles("une flèche --> mais aucun timestamp valide\n");
  failures += 1;
  console.log("  ❌ arrow malformée : aucune exception levée");
} catch (err) {
  check(
    "arrow malformée → 'no_segments' typé (jamais de crash)",
    err instanceof SubtitleParseError && err.reason === "no_segments",
  );
}
try {
  parseSubtitles("00:00:01,000 --> 00:00:02,000\n".repeat(1));
  failures += 1;
  console.log("  ❌ timestamps sans texte : aucune exception levée");
} catch (err) {
  check(
    "0 cue exploitable → 'no_segments'",
    err instanceof SubtitleParseError && err.reason === "no_segments",
  );
}

console.log(
  failures === 0
    ? "\n🎉 3/3 échantillons + garde-fous OK"
    : `\n💥 ${failures} échec(s)`,
);
process.exit(failures === 0 ? 0 : 1);
