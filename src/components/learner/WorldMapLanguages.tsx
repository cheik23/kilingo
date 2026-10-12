import React, { useMemo, useEffect, useRef, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

/* Natural Earth 110m (Natural Earth Vector, servi par jsDelivr) : 177 pays avec
   leurs codes ISO alpha-2, ce dont dépend le surlignage par langue.
   L'ancienne URL (raw.githubusercontent.com/zcreativelabs/…/world-110m.json)
   renvoyait 404, d'où une carte vide. Les fichiers topojson `world-atlas`
   écartés ici ne portent que `name` et un id numérique : ils s'affichent mais
   ne peuvent jamais surligner, faute de code pays. */
const geoUrl =
  "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson";

interface WorldMapLanguagesProps {
  selectedLanguage: string | null;
  languagesCountries: Record<string, string[]>;
  className?: string;
}

/* Natural Earth expose les codes en MAJUSCULES (`ISO_A2`) et range certains
   pays sous `ISO_A2_EH` : la France et la Norvège valent `-99` dans ISO_A2.
   On teste donc les deux, en ignorant les codes de remplacement. */
function countryIsoFromProperties(geo: any): string | null {
  const props = geo?.properties;
  if (!props) return null;
  const candidates = [
    props.ISO_A2_EH,
    props.iso_a2_eh,
    props.ISO_A2,
    props.iso_a2,
    props.iso2,
    props.iso_a2_eu,
    props.iso_a2_usa,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length === 2) {
      return candidate.toUpperCase();
    }
  }
  return null;
}

export function WorldMapLanguages({ selectedLanguage, languagesCountries, className }: WorldMapLanguagesProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [countryKeys, setCountryKeys] = useState<Array<{ key: string; code: string | null }>>([]);

  const highlightedCountries = useMemo(() => {
    if (!selectedLanguage || !languagesCountries[selectedLanguage]) return [];
    return languagesCountries[selectedLanguage];
  }, [selectedLanguage, languagesCountries]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const svg = mapRef.current?.querySelector('svg');
      if (!svg) return;
      const paths = Array.from(svg.querySelectorAll('path.rsm-geography'));
      const mapped: Array<{ key: string; code: string | null }> = paths.map((path) => {
        const key = (path as any).dataset?.rsmKey ?? path.getAttribute('data-rsm-key') ?? `geo-${Math.random().toString(36).slice(2)}`;
        // Dans l'Atlas de cet exemple, le code ISO arrive via une propriété topojson
        // différente selon la version ; on déduit la clé depuis l'élément SVG lui-même.
        return { key, code: null };
      });
      setCountryKeys(mapped);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div ref={mapRef} className={`relative w-full ${className ?? 'h-[400px]'}`}>
      <ComposableMap>
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const countryCode = countryIsoFromProperties(geo);
              const isHighlighted = countryCode ? highlightedCountries.includes(countryCode) : false;

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={isHighlighted ? "#F59E0B" : "#334155"}
                  stroke="#1E293B"
                  strokeWidth={0.5}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
    </div>
  );
}
