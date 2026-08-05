'use client';

import { useEffect, useRef, useState } from 'react';

interface Company {
  id: string;
  name: string;
  website?: string;
  phone?: string;
  email?: string;
  industry?: string;
  city?: string;
  country?: string;
  rating?: number;
  review_count?: number;
  logo_url?: string;
  lead_score?: number;
  opportunity_score?: number;
  latitude?: number;
  longitude?: number;
  social_links?: Record<string, string>;
}

interface SearchMapProps {
  results: Company[];
  selectedResult: Company | null;
  onSelectResult: (company: Company) => void;
}

function getScoreColor(score?: number): string {
  if (!score) return '#64748b';
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#eab308';
  return '#ef4444';
}

export default function SearchMap({ results, selectedResult, onSelectResult }: SearchMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const popupsRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    let cancelled = false;

    const initMap = async () => {
      const maplibregl = await import('maplibre-gl');
      await import('maplibre-gl/dist/maplibre-gl.css');

      if (cancelled || !mapContainer.current) return;

      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'osm': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap contributors',
            },
          },
          layers: [
            {
              id: 'osm',
              type: 'raster',
              source: 'osm',
            },
          ],
        },
        center: [20, 25],
        zoom: 2,
        pitch: 0,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      map.addControl(new maplibregl.ScaleControl(), 'bottom-right');

      map.on('load', () => {
        if (!cancelled) setMapReady(true);
      });

      mapRef.current = map;
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when results change
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const updateMarkers = async () => {
      const maplibregl = await import('maplibre-gl');

      // Clear existing markers
      markersRef.current.forEach(m => m.remove());
      popupsRef.current.forEach(p => p.remove());
      markersRef.current = [];
      popupsRef.current = [];

      if (results.length === 0) return;

      const validResults = results.filter(r => r.latitude && r.longitude);

      validResults.forEach(company => {
        const score = company.lead_score || company.opportunity_score || 0;
        const color = getScoreColor(score);

        const el = document.createElement('div');
        el.style.cssText = `
          width: 28px; height: 28px; border-radius: 50%;
          background: ${color}; border: 2.5px solid rgba(255,255,255,0.9);
          box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 12px ${color}44;
          cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
          display: flex; align-items: center; justify-content: center;
        `;
        const inner = document.createElement('div');
        inner.style.cssText = `width: 8px; height: 8px; border-radius: 50%; background: white;`;
        el.appendChild(inner);

        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.25)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([company.longitude!, company.latitude!])
          .addTo(mapRef.current);

        marker.getElement().addEventListener('click', (e: Event) => {
          e.stopPropagation();
          onSelectResult(company);
        });

        markersRef.current.push(marker);
      });

      // Fit bounds
      if (validResults.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        validResults.forEach(r => bounds.extend([r.longitude!, r.latitude!]));
        mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 800 });
      }
    };

    updateMarkers();
  }, [results, mapReady, onSelectResult]);

  // Handle selection
  useEffect(() => {
    if (!mapRef.current || !selectedResult?.latitude || !selectedResult?.longitude || !mapReady) return;

    const updateSelection = async () => {
      const maplibregl = await import('maplibre-gl');

      popupsRef.current.forEach(p => p.remove());
      popupsRef.current = [];

      mapRef.current.flyTo({
        center: [selectedResult.longitude, selectedResult.latitude],
        zoom: 15,
        duration: 600,
      });

      const score = selectedResult.lead_score || 0;
      const scoreColor = score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444';
      const scoreLabel = score >= 70 ? 'Hot' : score >= 40 ? 'Warm' : 'Cold';

      const popup = new maplibregl.Popup({
        offset: 20,
        closeButton: true,
        maxWidth: '320px',
      })
        .setLngLat([selectedResult.longitude!, selectedResult.latitude!])
        .setHTML(`
          <div style="padding: 12px; min-width: 240px; max-width: 300px;">
            <div style="display: flex; align-items: start; gap: 10px; margin-bottom: 8px;">
              <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden;">
                ${selectedResult.logo_url
                  ? `<img src="${selectedResult.logo_url}" style="width:100%;height:100%;object-fit:cover;" />`
                  : `<span style="font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.4);">${selectedResult.name.charAt(0)}</span>`
                }
              </div>
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: 13px; font-weight: 600; color: white; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${selectedResult.name}</div>
                <div style="font-size: 11px; color: rgba(148,163,184,0.7);">
                  ${selectedResult.industry || ''}${selectedResult.city ? ' · ' + selectedResult.city : ''}${selectedResult.country ? ', ' + selectedResult.country : ''}
                </div>
              </div>
              <div style="padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: ${scoreColor}18; color: ${scoreColor}; border: 1px solid ${scoreColor}33;">
                ${scoreLabel} ${score}
              </div>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${selectedResult.phone ? `<a href="tel:${selectedResult.phone}" style="display:flex;align-items:center;gap:3px;padding:3px 8px;background:rgba(255,255,255,0.06);border-radius:6px;font-size:11px;color:rgba(255,255,255,0.7);text-decoration:none;">📞 ${selectedResult.phone}</a>` : ''}
              ${selectedResult.email ? `<a href="mailto:${selectedResult.email}" style="display:flex;align-items:center;gap:3px;padding:3px 8px;background:rgba(255,255,255,0.06);border-radius:6px;font-size:11px;color:rgba(255,255,255,0.7);text-decoration:none;">✉️ ${selectedResult.email}</a>` : ''}
              ${selectedResult.website ? `<a href="${selectedResult.website}" target="_blank" style="display:flex;align-items:center;gap:3px;padding:3px 8px;background:rgba(59,130,246,0.15);border-radius:6px;font-size:11px;color:#60a5fa;text-decoration:none;">🌐 Website</a>` : ''}
            </div>
          </div>
        `)
        .addTo(mapRef.current);

      popupsRef.current.push(popup);

      // Highlight marker
      markersRef.current.forEach((m, i) => {
        const el = m.getElement();
        if (results[i]?.id === selectedResult.id) {
          el.style.transform = 'scale(1.3)';
          el.style.zIndex = '10';
        } else {
          el.style.transform = 'scale(1)';
          el.style.zIndex = '1';
        }
      });
    };

    updateSelection();
  }, [selectedResult, results, mapReady]);

  return (
    <div ref={mapContainer} className="w-full h-full" />
  );
}
