import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { cn } from "@/lib/utils";

const geoUrl =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

/* ═══════════════════════════════════════════════════════════════════════
   CARTE MONDIALE INTERACTIVE DES LANGUES
   Colors:
   • amber-500 f59e0b — pays où la langue sélectionnée est parlée
   • slate-700/30 1e293b30 — autres pays (40 % opacité)
   • hover tooltip + transition 300ms
   ═══════════════════════════════════════════════════════════════════════ */

export type WorldMapLanguagesProps = {
  selectedLanguage?: string | null;
  languagesCountries: Record<string, readonly string[] | string[]>;
  className?: string;
  center?: [number, number];
  scale?: number;
};

export function WorldMapLanguages({
  selectedLanguage,
  languagesCountries,
  className,
  center = [20, 0],
  scale = 220,
}: WorldMapLanguagesProps) {
  const [tooltip, setTooltip] = useState<{
    name: string;
    iso: string;
    visible: boolean;
    x: number;
    y: number;
  }>({ name: "", iso: "", visible: false, x: 0, y: 0 });

  const highlighted = useMemo(() => {
    if (!selectedLanguage) return new Set<string>();
    const countries = languagesCountries[selectedLanguage];
    if (!countries) return new Set<string>();
    return new Set<string>(countries.map((c) => c.toUpperCase()));
  }, [selectedLanguage, languagesCountries]);

  const isHighlighted = (iso: string) => highlighted.has((iso || "").toUpperCase());

  const handleMouseEnter = (
    e: React.MouseEvent<SVGPathElement, MouseEvent>,
    geo: any,
  ) => {
    setTooltip({
      name: geo.properties?.name || "",
      iso: geo.id || "",
      visible: true,
      x: e.clientX + 10,
      y: e.clientY + 10,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGPathElement, MouseEvent>) => {
    setTooltip((prev) => ({ ...prev, x: e.clientX + 10, y: e.clientY + 10 }));
  };

  const handleMouseLeave = () => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  return (
    <div className={cn("relative w-full", className)}>
      {/* Tailwind v4 scoped styles for the map */}
      <style>{`
        .worldmap-country {
          transition: fill 300ms ease, stroke 300ms ease;
          stroke: rgba(71,85,105,0.6);
          stroke-width: 0.5px;
          fill: rgba(30,41,59,0.35);
          cursor: pointer;
        }
        .worldmap-country:hover {
          fill: #334155;
          stroke: #f59e0b;
          stroke-width: 0.8px;
        }
        .worldmap-country.highlighted {
          fill: rgba(245,158,11,0.9);
          stroke: rgba(251,191,36,0.9);
        }
        .worldmap-country.highlighted:hover {
          fill: #fbbf24;
          stroke: #f59e0b;
        }
      `}</style>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center, scale }}
        className="w-full h-full"
      >
        <ZoomableGroup center={center} zoom={1} maxZoom={2} minZoom={0.8}>
          <Geographies geography={geoUrl}>
            {({ geographies }: { geographies: any[] }) => (
              <>
                {geographies.map((geo) => {
                  const iso = String(geo.id || "");
                  const highlightedCountry = isHighlighted(iso);
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={(e) =>
                        handleMouseEnter(e, geo as any)
                      }
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                      className={cn(
                        "outline-none worldmap-country",
                        highlightedCountry && "highlighted",
                      )}
                    />
                  );
                })}
              </>
            )}
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
      {tooltip.visible && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-white/10 bg-noir-2/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          <div className="font-medium text-ink">{tooltip.name}</div>
          <div className="text-ink-3">{tooltip.iso}</div>
        </div>
      )}
    </div>
  );
}
