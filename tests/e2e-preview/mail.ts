/* Boîte de test mail.tm — lecture seule, aucun secret journalisé. */

const MAIL_API = "https://api.mail.tm";

/** L'API mail.tm renvoie tantôt un tableau brut, tantôt `hydra:member`. */
type MailList<T> = T[] | { "hydra:member"?: T[] };

function members<T>(json: MailList<T>): T[] {
  return Array.isArray(json) ? json : (json["hydra:member"] ?? []);
}

export async function mailToken(): Promise<string> {
  const preset = (process.env.MAILTM_API_TOKEN ?? "").trim();
  if (preset) return preset;

  const address = (process.env.MAILTM_ADDRESS ?? "").trim();
  const password = (process.env.MAILTM_PASSWORD ?? "").trim();
  if (!address || !password) {
    throw new Error(
      "Boîte de test non configurée : MAILTM_API_TOKEN ou MAILTM_ADDRESS/MAILTM_PASSWORD requis",
    );
  }
  const response = await fetch(`${MAIL_API}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, password }),
  });
  if (!response.ok) {
    throw new Error(`mail.tm : authentification refusée (HTTP ${response.status})`);
  }
  const json = (await response.json()) as { token?: string };
  if (!json.token) throw new Error("mail.tm : jeton absent");
  return json.token;
}

export async function listMailIds(token: string): Promise<Set<string>> {
  const response = await fetch(`${MAIL_API}/messages?page=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`mail.tm : liste HTTP ${response.status}`);
  const json = (await response.json()) as MailList<{ id: string }>;
  return new Set(members(json).map((message) => message.id));
}

function extractCode(payload: {
  text?: string;
  html?: Array<{ value?: string }>;
}): string | null {
  const body = [payload.text, ...(payload.html ?? []).map((part) => part.value)]
    .filter(Boolean)
    .join("\n")
    .replace(/<[^>]+>/g, " ");
  const match = body.match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

/** Attend un NOUVEAU message contenant un code à 6 chiffres. */
export async function waitForOtp(
  token: string,
  seenIds: Set<string>,
  since: number,
  timeoutMs = 120_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(`${MAIL_API}/messages?page=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const list = members(
        (await response.json()) as MailList<{ id: string; createdAt: string }>,
      );
      for (const summary of list) {
        if (seenIds.has(summary.id)) continue;
        if (new Date(summary.createdAt).getTime() < since - 60_000) continue;
        const detail = await fetch(`${MAIL_API}/messages/${summary.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!detail.ok) continue;
        const code = extractCode(
          (await detail.json()) as { text?: string; html?: Array<{ value?: string }> },
        );
        if (code) return code;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 4_000));
  }
  throw new Error("Aucun code OTP reçu dans le délai imparti");
}
