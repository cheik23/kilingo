/* Charge `.env.preview.e2e.local` (fichier ignoré par Git) dans `process.env`.
   Les variables déjà définies dans l'environnement gagnent : en CI, les
   secrets Actions ne sont jamais écrasés par un fichier local — qui est de
   toute façon absent du checkout. Aucune valeur n'est journalisée. */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const LOCAL_ENV_FILENAME = ".env.preview.e2e.local";

/** @returns {boolean} vrai si le fichier local a été trouvé. */
export function loadLocalPreviewEnv(cwd = process.cwd()) {
  const file = resolve(cwd, LOCAL_ENV_FILENAME);
  if (!existsSync(file)) return false;

  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
  return true;
}
