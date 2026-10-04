import QRCode from "qrcode";

export type ShareAvatar = { avatar: string; hat: string | null; glasses: string | null; background: string | null };
export type ShareCardData = { userId: string; expressions: number; days: number; streak: number; league: string; achievements: number; avatar: ShareAvatar };

const BRAND = "LINGUA NOIR";
const INVITE_ORIGIN = "https://linguanoir.app";

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.closePath();
}
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 3) {
  const lines: string[] = []; let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
}
async function drawBase(ctx: CanvasRenderingContext2D, avatar: ShareAvatar) {
  const background = avatar.background;
  ctx.fillStyle = "#0A0A0A";
  ctx.fillRect(0, 0, 1080, 1350);
  if (background?.startsWith("data:image/")) {
    try {
      const image = new Image();
      image.src = background;
      await image.decode();
      ctx.globalAlpha = .28;
      ctx.drawImage(image, 0, 0, 1080, 1350);
      ctx.globalAlpha = 1;
    } catch {
      // A malformed custom background must never prevent the share card.
    }
  } else {
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
    const firstStop = background && (/^#|^rgb|^hsl/.test(background)) ? background : "#0A0A0A";
    gradient.addColorStop(0, firstStop); gradient.addColorStop(.55, "#0A0A0A"); gradient.addColorStop(1, "#241A05");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1350);
  }
  ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fillRect(0, 0, 1080, 1350);
  ctx.strokeStyle = "rgba(212,165,116,.55)"; ctx.lineWidth = 3; roundedRect(ctx, 36, 36, 1008, 1278, 42); ctx.stroke();
  ctx.fillStyle = "#D4A574"; ctx.font = "600 24px Inter, sans-serif"; ctx.fillText(BRAND, 84, 116);
}
function drawAvatar(ctx: CanvasRenderingContext2D, avatar: ShareAvatar, x: number, y: number, size: number) {
  ctx.save(); ctx.fillStyle = "rgba(0,0,0,.35)"; roundedRect(ctx, x, y, size, size, size * .28); ctx.fill();
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `${Math.round(size * .55)}px sans-serif`; ctx.fillText(avatar.avatar, x + size / 2, y + size * .54);
  if (avatar.hat) { ctx.font = `${Math.round(size * .30)}px sans-serif`; ctx.fillText(avatar.hat, x + size / 2, y + size * .16); }
  if (avatar.glasses) { ctx.font = `${Math.round(size * .18)}px sans-serif`; ctx.fillText(avatar.glasses, x + size / 2, y + size * .51); }
  ctx.restore();
}
async function finishCard(canvas: HTMLCanvasElement, inviteUrl: string) {
  const ctx = canvas.getContext("2d")!;
  try {
    const qrDataUrl = await QRCode.toDataURL(inviteUrl, { width: 180, margin: 1, color: { dark: "#0A0A0A", light: "#D4A574" } });
    const image = new Image(); image.src = qrDataUrl; await image.decode();
    ctx.fillStyle = "#D4A574"; roundedRect(ctx, 786, 1082, 210, 210, 24); ctx.fill(); ctx.drawImage(image, 800, 1096, 182, 182);
  } catch { /* carte reste partageable sans QR */ }
  return canvas.toDataURL("image/png", .94);
}

export async function shareStats(data: ShareCardData) {
  const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1350; const ctx = canvas.getContext("2d")!; await drawBase(ctx, data.avatar); drawAvatar(ctx, data.avatar, 84, 172, 270);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#FAFAF7"; ctx.font = "700 66px Playfair Display, serif";
  wrapText(ctx, `J'ai appris ${data.expressions} expressions en ${data.days} jours sur LinguaNoir !`, 410, 235, 570, 78, 4);
  [[`${data.streak} 🔥`, "STREAK"], [data.league.toUpperCase(), "LIGUE"], [`${data.achievements}/150`, "SUCCÈS"]].forEach(([value, label], index) => {
    const x = 410 + index * 190; ctx.fillStyle = "rgba(255,255,255,.055)"; roundedRect(ctx, x, 570, 165, 145, 22); ctx.fill(); ctx.strokeStyle = "rgba(212,165,116,.28)"; roundedRect(ctx, x, 570, 165, 145, 22); ctx.stroke();
    ctx.fillStyle = "#D4A574"; ctx.font = "700 30px Inter, sans-serif"; ctx.fillText(value, x + 20, 625); ctx.fillStyle = "#9A9A9A"; ctx.font = "600 15px Inter, sans-serif"; ctx.fillText(label, x + 20, 680);
  });
  ctx.fillStyle = "#FAFAF7"; ctx.font = "700 34px Playfair Display, serif"; ctx.fillText("APPRENDS LA LANGUE QUE LES GENS PARLENT.", 84, 930); ctx.fillStyle = "#A0A0A0"; ctx.font = "400 22px Inter, sans-serif"; ctx.fillText("Culture · lifestyle · slang", 84, 978);
  return finishCard(canvas, inviteFriend(data.userId));
}
export async function shareAchievement(input: { userId: string; title: string; icon: string; completedAt: number; avatar: ShareAvatar }) {
  const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1350; const ctx = canvas.getContext("2d")!; await drawBase(ctx, input.avatar); drawAvatar(ctx, input.avatar, 84, 172, 270);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#D4A574"; ctx.font = "600 18px Inter, sans-serif"; ctx.fillText("ACHIEVEMENT DÉBLOQUÉ", 410, 225); ctx.fillStyle = "#FAFAF7"; ctx.font = "700 64px Playfair Display, serif"; wrapText(ctx, `${input.icon} ${input.title}`, 410, 315, 560, 72, 3);
  ctx.fillStyle = "#A0A0A0"; ctx.font = "400 22px Inter, sans-serif"; ctx.fillText(new Date(input.completedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }), 410, 570); ctx.fillStyle = "#FAFAF7"; ctx.font = "700 36px Playfair Display, serif"; ctx.fillText("LA COLLECTION SE CONSTRUIT ÉTAPE PAR ÉTAPE.", 84, 920);
  return finishCard(canvas, inviteFriend(input.userId));
}
export async function shareStreak(input: { userId: string; streak: number; league: string; avatar: ShareAvatar }) {
  const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1350; const ctx = canvas.getContext("2d")!; await drawBase(ctx, input.avatar); drawAvatar(ctx, input.avatar, 84, 172, 270);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#D4A574"; ctx.font = "600 20px Inter, sans-serif"; ctx.fillText("MON STREAK", 410, 240); ctx.fillStyle = "#FAFAF7"; ctx.font = "800 150px Playfair Display, serif"; ctx.fillText(`${input.streak} 🔥`, 410, 405);
  ctx.fillStyle = "#A0A0A0"; ctx.font = "400 28px Inter, sans-serif"; ctx.fillText(`Ligue ${input.league} · je reviens encore demain`, 410, 475); ctx.fillStyle = "#FAFAF7"; ctx.font = "700 38px Playfair Display, serif"; ctx.fillText("UNE JOURNÉE DE PLUS. LA RUE ATTEND.", 84, 920);
  return finishCard(canvas, inviteFriend(input.userId));
}
export function inviteFriend(userId: string) { return `${INVITE_ORIGIN}/invite?ref=${encodeURIComponent(userId)}`; }

/* ═══════════════════════════════════════════════════════════════════
   PERSISTANCE DU CODE DE PARRAINAGE
   Le `?ref=` ne survit pas à l'authentification OAuth : le retour du
   fournisseur peut perdre le query string. On le mémorise donc au
   premier visite, et on le relit à l'inscription.
   ═══════════════════════════════════════════════════════════════════ */

const REF_STORAGE_KEY = "ln.ref";

/** Mémorise le code d'invitation. Ignore les valeurs vides ou abusees
 *  (on ne garde que des identifiants Convex raisonnablement courts). */
export function rememberReferral(code: string | null | undefined): void {
  if (!code) return;
  const clean = code.trim();
  // Un Id<"users"> Convex fait 32 caractères ; on tolère un peu plus large
  // mais on refuse les chaînes arbitraires (injection, URL complète).
  if (clean.length < 8 || clean.length > 64) return;
  if (!/^[A-Za-z0-9_-]+$/.test(clean)) return;
  try { localStorage.setItem(REF_STORAGE_KEY, clean); } catch { /* private mode */ }
}

/** Code mémorisé, ou null. */
export function readRememberedReferral(): string | null {
  try { return localStorage.getItem(REF_STORAGE_KEY); } catch { return null; }
}

/** Appelé après un `trackReferral` réussi : le code est consommé. */
export function clearRememberedReferral(): void {
  try { localStorage.removeItem(REF_STORAGE_KEY); } catch { /* ignore */ }
}
export function downloadShareImage(dataUrl: string, filename: string) { const anchor = document.createElement("a"); anchor.href = dataUrl; anchor.download = filename; anchor.click(); }
export async function copyText(value: string) { if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value); const textarea = document.createElement("textarea"); textarea.value = value; document.body.appendChild(textarea); textarea.select(); document.execCommand("copy"); textarea.remove(); }
