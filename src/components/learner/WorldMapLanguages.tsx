import React, { useMemo } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

// URL fiable et légère pour la carte du monde (Natural Earth)
const geoUrl = "https://raw.githubusercontent.com/zcreativelabs/react-simple-maps/master/topojson-maps/world-110m.json";

interface WorldMapLanguagesProps {
  selectedLanguage: string | null;
  languagesCountries: Record<string, string[]>;
  className?: string;
}

export function WorldMapLanguages({ selectedLanguage, languagesCountries, className }: WorldMapLanguagesProps) {
  // Liste des codes pays (ISO-2) à mettre en surbrillance
  const highlightedCountries = useMemo(() => {
    if (!selectedLanguage || !languagesCountries[selectedLanguage]) return [];
    return languagesCountries[selectedLanguage];
  }, [selectedLanguage, languagesCountries]);

  return (
    <div className={`relative w-full ${className || 'h-[400px]'}`}>
      <ComposableMap projection="geoMercator" projectionConfig={{ scale: 140, center: [20, 0] }}>
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => {
              // geo.properties.iso_a2 contient le code pays à 2 lettres (ex: "SN", "FR")
              const countryCode = (geo.properties ?? {}).iso_a2 ?? null;
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
