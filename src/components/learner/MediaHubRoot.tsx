import { useState } from "react";
import { Languages } from "lucide-react";
import { MediaTabs, MusicTab } from "./MediaHubView";
import { ScreenTab } from "./MediaHubScreen";
import { BooksTab, TalkTab } from "./MediaHubBooksTalk";
import { MediaRoomView, type HubMedia } from "@/components/media/MediaRoomView";
import { Rayon } from "@/components/openverse/Rayon";
import type { Kind } from "@/openverse/model";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════
   Media Hub — racine : 4 rayons (Musique, Films/Séries, Livres, Talk).

   Chaque rayon s'ouvre sur le moteur de contenus : fiches MOOVY
   réelles, nouveautés et tendances, lecture intégrée quand la source
   l'autorise. Les panneaux d'outils historiques (import de fichiers,
   MediaRoom d'analyse) restent accessibles sous « Outils » : rien n'a été
   supprimé, l'expérience par défaut est simplement devenue interne.
   ═══════════════════════════════════════════════════════════════════ */

type RayonConfig = {
  kinds: Kind[];
  title: string;
  subtitle: string;
  suggestions: string[];
  searchPlaceholder: string;
  allowFeed?: boolean;
  legacyLabel: string;
};

const RAYONS: Record<string, RayonConfig> = {
  screen: {
    kinds: ["movie", "series", "video"],
    title: "Films, séries & vidéos",
    subtitle:
      "Une fiche MOOVY pour chaque titre : genres, pays, année, durée. Tu le regardes ici quand c'est possible, et tu vois toujours où le trouver.",
    suggestions: ["public domain film", "documentary", "Nosferatu", "animation"],
    searchPlaceholder: "Un film, une série, un documentaire…",
    legacyLabel: "Outils d'analyse",
  },
  music: {
    kinds: ["music"],
    title: "Musiques",
    subtitle:
      "Cherche par artiste, titre ou album : classements par pays et extraits à écouter, avec leur analyse linguistique.",
    suggestions: ["jazz", "chanson française", "hip hop", "classique"],
    searchPlaceholder: "Un morceau, un artiste, un album…",
    legacyLabel: "Outils d'analyse",
  },
  books: {
    kinds: ["book"],
    title: "Livres",
    subtitle:
      "Des livres en texte intégral à lire et à traduire ici, et une fiche pour tous les autres titres.",
    suggestions: ["sherlock holmes", "pride and prejudice", "poésie", "romans"],
    searchPlaceholder: "Un titre, un auteur…",
    legacyLabel: "Outils de lecture",
  },
  talk: {
    kinds: ["podcast", "audio"],
    title: "Podcasts & audio",
    subtitle:
      "Des émissions et leurs épisodes, et des webradios du monde entier : tu écoutes en streaming, et tu analyses le passage qui t'intéresse.",
    suggestions: ["interview", "actualité", "société", "culture"],
    searchPlaceholder: "Une émission, un sujet, une station…",
    allowFeed: true,
    legacyLabel: "Outils d'analyse",
  },
};

export function MediaHubRoot({
  language,
  initialTab = "music",
}: {
  language: string;
  /** Onglet ouvert au montage — permet une route par module du Hub. */
  initialTab?: string;
}) {
  const [tab, setTab] = useState(initialTab);
  const [lang, setLang] = useState(language || "en");
  const [room, setRoom] = useState<HubMedia | null>(null);
  const [tools, setTools] = useState(false);

  if (room) {
    return <MediaRoomView media={room} onBack={() => setRoom(null)} />;
  }

  const config = RAYONS[tab] ?? RAYONS.music;

  const legacy =
    tab === "screen" ? (
      <ScreenTab language={lang} onOpenRoom={setRoom} />
    ) : tab === "books" ? (
      <BooksTab language={lang} onOpenRoom={setRoom} />
    ) : tab === "talk" ? (
      <TalkTab language={lang} onOpenRoom={setRoom} />
    ) : (
      <MusicTab language={lang} onOpenRoom={setRoom} />
    );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <span className="font-display text-lg font-bold text-ink">Media Hub</span>
        <span className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-ink-2">
          <Languages className="size-3.5 text-gold" />
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            aria-label="Langue du média"
            className="bg-transparent text-xs text-ink focus:outline-none"
          >
            <option value="en">Anglais</option>
            <option value="fr">Français</option>
            <option value="es">Espagnol</option>
            <option value="de">Allemand</option>
            <option value="it">Italien</option>
            <option value="ru">Russe</option>
            <option value="ar">Arabe</option>
            <option value="zh">Mandarin</option>
          </select>
        </span>
      </div>

      <MediaTabs
        tab={tab}
        onTab={(next) => {
          setTab(next);
          setTools(false);
        }}
      />

      {/* HYGIÈNE : le contenu réel (charts/albums/films/podcasts des
          connecteurs) est le mode PAR DÉFAUT. Le moteur OpenVerse
          (ovContents — index de recherche, contenu seedé) est déplacé
          derrière « Studio IA », accessible mais jamais présélectionné. */}
      <div className="flex items-center gap-2">
        {[
          { key: false, label: "Catalogue réel" },
          { key: true, label: "Studio IA" },
        ].map(({ key, label }) => (
          <button
            key={String(key)}
            type="button"
            onClick={() => setTools(key)}
            className={cn(
              "rounded-full border px-3 py-1.5 font-mono text-[0.625rem] uppercase tracking-widest transition-colors",
              tools === key
                ? "border-gold/50 bg-gold/10 text-gold"
                : "border-white/10 text-ink-3 hover:border-gold/30 hover:text-gold",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div key={`${tab}-${tools}`} className="ln-tab-in">
        {tools ? (
          <Rayon
            kinds={config.kinds}
            title={config.title}
            subtitle={config.subtitle}
            suggestions={config.suggestions}
            searchPlaceholder={config.searchPlaceholder}
            allowFeed={config.allowFeed}
            language={lang}
          />
        ) : (
          legacy
        )}
      </div>
    </div>
  );
}
