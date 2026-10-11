/* ═══════════════════════════════════════════════════════════════════════
   DEBUG BINAIRES DE LA CARTE MONDIALE — TEST DE MONTAGE
   ═══════════════════════════════════════════════════════════════════════ */

export function WorldMapLanguages({
  selectedLanguage,
  languagesCountries,
  className,
  center = [20, 0],
  scale = 220,
}: {
  selectedLanguage?: string | null;
  languagesCountries: Record<string, readonly string[] | string[]>;
  className?: string;
  center?: [number, number];
  scale?: number;
}) {
  console.log("🚨 TEST MONTAGE COMPOSANT CARTE 🚨", {
    selectedLanguage,
    keys: Object.keys(languagesCountries),
  });
  return (
    <div className="w-full h-[400px] bg-red-600 flex flex-col items-center justify-center text-white text-2xl font-bold rounded-xl border-4 border-yellow-400 my-4">
      <span>🗺️ TEST CARTE VISIBLE</span>
      <span className="text-sm mt-2">Si tu vois ce rectangle rouge, le composant est monté.</span>
    </div>
  );
}
