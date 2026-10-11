import React, { useMemo, useEffect, useRef, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

// URL fiable et légère pour la carte du monde (Natural Earth)
const geoUrl = "https://raw.githubusercontent.com/zcreativelabs/react-simple-maps/master/topojson-maps/world-110m.json";

interface WorldMapLanguagesProps {
  selectedLanguage: string | null;
  languagesCountries: Record<string, string[]>;
  className?: string;
}

function countryIsoFromProperties(geo: any): string | null {
  const props = geo?.properties;
  if (!props) return null;
  return props.iso_a2 ?? props.iso2 ?? props.iso_a2_eu ?? props.iso_a2_usa ?? null;
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
