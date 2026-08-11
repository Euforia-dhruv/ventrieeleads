'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MaplibreMap, MapLayerMouseEvent, Popup, GeoJSONSource } from 'maplibre-gl';
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson';

export interface SearchArea {
  lat: number;
  lng: number;
  radiusKm: number;
}

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
  website_score?: number;
  latitude?: number;
  longitude?: number;
  social_links?: Record<string, string>;
}

type MapLngLatEvent = { lngLat: { lat: number; lng: number } };

interface SearchMapProps {
  results: Company[];
  selectedResult: Company | null;
  hoveredId?: string | null;
  onSelectResult: (company: Company) => void;
  area?: SearchArea | null;
  onAreaSelected?: (area: SearchArea) => void;
  onClearArea?: () => void;
}

function getScoreColor(score?: number): string {
  if (!score) return '#64748b';
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#eab308';
  return '#ef4444';
}

function haversineKm(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371;
  const dLat = ((la2 - la1) * Math.PI) / 180;
  const dLon = ((lo2 - lo1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((la1 * Math.PI) / 180) * Math.cos((la2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildCircleGeoJSON(lat: number, lng: number, radiusKm: number): Feature<Polygon> {
  const points: [number, number][] = [];
  const dLat = radiusKm / 110.574;
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    points.push([lng + Math.sin(t) * dLng, lat + Math.cos(t) * dLat]);
  }
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [[...points, points[0]]] },
  } as Feature<Polygon>;
}

export default function SearchMap({
  results,
  selectedResult,
  hoveredId,
  onSelectResult,
  area,
  onAreaSelected,
  onClearArea,
}: SearchMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const popupsRef = useRef<Popup[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [drawStatus, setDrawStatus] = useState('');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [mapClickHandler, setMapClickHandler] = useState<((e: MapLngLatEvent) => void) | null>(null);
  const mapClickHandlerRef = useRef<((e: MapLngLatEvent) => void) | null>(null);
  const resultsRef = useRef<Company[]>(results);
  const areaRef = useRef<SearchArea | null>(area || null);
  const drawModeRef = useRef(false);
  const drawingCenterRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    mapClickHandlerRef.current = mapClickHandler;
  }, [mapClickHandler]);
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);
  useEffect(() => {
    areaRef.current = area || null;
  }, [area]);

  // ── Init map ──────────────────────────────────────────────────────────
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
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap contributors',
            },
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
        center: [20, 25],
        zoom: 2,
        pitch: 0,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      map.addControl(new maplibregl.ScaleControl(), 'bottom-right');

      map.on('load', () => {
        if (cancelled) return;
        const EMPTY_FULL: FeatureCollection = { type: 'FeatureCollection', features: [] };

        // Clustered results
        map.addSource('clusters', {
          type: 'geojson',
          data: EMPTY_FULL,
          cluster: true,
          clusterMaxZoom: 13,
          clusterRadius: 48,
        });
        map.addLayer({
          id: 'cluster-circle',
          type: 'circle',
          source: 'clusters',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'case',
              ['>', ['get', 'point_count'], 20],
              '#7c3aed',
              ['>', ['get', 'point_count'], 8],
              '#8b5cf6',
              '#a78bfa',
            ],
            'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 80, 28],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': 'rgba(255,255,255,0.9)',
          },
        });
        map.addLayer({
          id: 'cluster-text',
          type: 'symbol',
          source: 'clusters',
          filter: ['has', 'point_count'],
          layout: { 'text-field': ['get', 'point_count'], 'text-size': 12, 'text-allow-overlap': true },
          paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.4)', 'text-halo-width': 1 },
        });
        map.addLayer({
          id: 'unclustered-point',
          type: 'circle',
          source: 'clusters',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': [
              'case',
              ['>=', ['get', 'score'], 70],
              '#22c55e',
              ['>=', ['get', 'score'], 40],
              '#eab308',
              '#ef4444',
            ],
            'circle-radius': ['case', ['boolean', ['feature-state', 'hovered'], false], 11, 7],
            'circle-stroke-width': 2,
            'circle-stroke-color': 'rgba(255,255,255,0.9)',
          },
        });

        // Heatmap
        map.addSource('heatmap', { type: 'geojson', data: EMPTY_FULL });
        map.addLayer({
          id: 'heatmap-fill',
          type: 'heatmap',
          source: 'heatmap',
          paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 30, 1.2],
            'heatmap-intensity': 1.2,
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 18, 15, 48],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0,
              'rgba(59,130,246,0)',
              0.2,
              'rgba(59,130,246,0.35)',
              0.4,
              'rgba(139,92,246,0.6)',
              0.6,
              'rgba(236,72,153,0.75)',
              0.8,
              'rgba(244,63,94,0.9)',
              1,
              'rgba(255,80,80,1)',
            ],
            'heatmap-opacity': 0.8,
          },
        });
        map.setLayoutProperty('heatmap', 'visibility', 'none');

        // Search-area overlay
        map.addSource('search-area', { type: 'geojson', data: EMPTY_FULL });
        map.addLayer({
          id: 'area-fill',
          type: 'fill',
          source: 'search-area',
          paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.12 },
        });
        map.addLayer({
          id: 'area-outline',
          type: 'line',
          source: 'search-area',
          paint: { 'line-color': '#3b82f6', 'line-width': 2, 'line-dasharray': [2, 1.5], 'line-opacity': 0.9 },
        });
        map.addSource('area-center', { type: 'geojson', data: EMPTY_FULL });
        map.addLayer({
          id: 'area-center-dot',
          type: 'circle',
          source: 'area-center',
          paint: {
            'circle-color': '#3b82f6',
            'circle-radius': 7,
            'circle-stroke-width': 3,
            'circle-stroke-color': 'rgba(255,255,255,0.9)',
          },
        });

        // Feature click (clusters / points)
        map.on('click', async (e: MapLayerMouseEvent) => {
          if (mapClickHandlerRef.current) {
            mapClickHandlerRef.current(e);
            return;
          }
          const features = map.queryRenderedFeatures(e.point, { layers: ['cluster-circle', 'unclustered-point'] });
          if (features.length > 0) {
            const f = features[0];
            if (f.properties && f.properties.cluster) {
              const clusterId = f.properties.cluster_id as number;
              const source = map.getSource('clusters') as GeoJSONSource;
              const expansion = await source.getClusterExpansionZoom(clusterId);
              const coords = (f.geometry as Point).coordinates;
              map.easeTo({ center: coords as [number, number], zoom: expansion });
              return;
            }
            const idx = f.properties?.idx as number;
            const company = resultsRef.current[idx];
            if (company) onSelectResult(company);
          }
        });

        map.on('mousemove', (e) => {
          const layers = ['cluster-circle', 'unclustered-point'];
          const feats = map.queryRenderedFeatures(e.point, { layers });
          map.getCanvas().style.cursor = feats.length > 0 ? 'pointer' : '';
          for (let i = 0; i < resultsRef.current.length; i++) {
            const hovered = feats.some((x) => x.properties?.idx === i);
            map.setFeatureState({ source: 'clusters', id: i }, { hovered });
          }
        });

        mapRef.current = map;
        setMapReady(true);
      });
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [onSelectResult]);

  // ── Sync data into sources ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const sync = async () => {
      const clusterSource = map.getSource('clusters') as GeoJSONSource | undefined;
      const heatSource = map.getSource('heatmap') as GeoJSONSource | undefined;
      if (!clusterSource || !heatSource) return;

      const validResults = results.filter((r) => r.latitude && r.longitude);
      const clusterFeatures: Feature<Point>[] = validResults.map((c, i) => ({
        type: 'Feature',
        id: i,
        properties: { score: Math.round(c.lead_score || c.opportunity_score || 0), idx: i },
        geometry: { type: 'Point', coordinates: [c.longitude as number, c.latitude as number] },
      }));
      const heatFeatures: Feature<Point>[] = validResults.map((c) => ({
        type: 'Feature',
        properties: { weight: Math.max(1, c.review_count || 1) },
        geometry: { type: 'Point', coordinates: [c.longitude as number, c.latitude as number] },
      }));
      clusterSource.setData({ type: 'FeatureCollection', features: clusterFeatures });
      heatSource.setData({ type: 'FeatureCollection', features: heatFeatures });

      const areaSrc = map.getSource('search-area') as GeoJSONSource | undefined;
      const centerSrc = map.getSource('area-center') as GeoJSONSource | undefined;
      if (areaSrc)
        areaSrc.setData(
          areaRef.current
            ? buildCircleGeoJSON(areaRef.current.lat, areaRef.current.lng, areaRef.current.radiusKm)
            : EMPTY(),
        );
      if (centerSrc) {
        centerSrc.setData(
          areaRef.current
            ? {
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'Point', coordinates: [areaRef.current.lng, areaRef.current.lat] },
                  } as Feature<Point>,
                ],
              }
            : EMPTY(),
        );
      }

      if (validResults.length > 0) {
        const { LngLatBounds } = await import('maplibre-gl');
        const bounds = new LngLatBounds();
        validResults.forEach((r) => bounds.extend([r.longitude!, r.latitude!]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 500 });
      } else if (areaRef.current) {
        map.flyTo({ center: [areaRef.current.lng, areaRef.current.lat], zoom: 11, duration: 500 });
      }
    };
    sync();
  }, [results, mapReady]);

  // ── Selection popup ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedResult?.latitude || !selectedResult?.longitude || !mapReady) return;
    const show = async () => {
      const maplibregl = await import('maplibre-gl');
      popupsRef.current.forEach((p) => p.remove());
      popupsRef.current = [];
      map.flyTo({
        center: [selectedResult.longitude as number, selectedResult.latitude as number],
        zoom: 15,
        duration: 500,
      });

      const score = selectedResult.lead_score || 0;
      const scoreColor = getScoreColor(score);
      const scoreLabel = score >= 70 ? 'Hot' : score >= 40 ? 'Warm' : 'Cold';
      const oppScore = selectedResult.opportunity_score || 0;
      const webScore = selectedResult.website_score || 0;

      const popup = new maplibregl.Popup({ offset: 24, closeButton: true, maxWidth: '360px' })
        .setLngLat([selectedResult.longitude!, selectedResult.latitude!])
        .setHTML(
          `
          <div style="padding: 14px; min-width: 260px; max-width: 340px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
            <div style="display: flex; align-items: start; gap: 10px; margin-bottom: 10px;">
              <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; border: 1px solid rgba(255,255,255,0.08);">
                ${selectedResult.logo_url ? `<img src="${selectedResult.logo_url}" style="width:100%;height:100%;object-fit:cover;" />` : `<span style="font-size: 16px; font-weight: 700; color: rgba(255,255,255,0.3);">${selectedResult.name.charAt(0)}</span>`}
              </div>
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: 14px; font-weight: 700; color: white; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${selectedResult.name}</div>
                <div style="font-size: 11px; color: rgba(148,163,184,0.8); display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                  ${selectedResult.industry ? `<span>${selectedResult.industry}</span>` : ''}
                  ${selectedResult.city ? `<span style="color: rgba(148,163,184,0.4);">·</span><span>${selectedResult.city}${selectedResult.country ? ', ' + selectedResult.country : ''}</span>` : ''}
                </div>
              </div>
              <div style="padding: 3px 10px; border-radius: 14px; font-size: 11px; font-weight: 700; background: ${scoreColor}18; color: ${scoreColor}; border: 1px solid ${scoreColor}33; white-space: nowrap;">${scoreLabel} ${score}</div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 10px;">
              <div style="text-align: center; padding: 6px 4px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                <div style="font-size: 16px; font-weight: 700; color: ${scoreColor};">${score}</div>
                <div style="font-size: 9px; color: rgba(148,163,184,0.6); text-transform: uppercase; letter-spacing: 0.5px;">Lead Score</div>
              </div>
              <div style="text-align: center; padding: 6px 4px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                <div style="font-size: 16px; font-weight: 700; color: ${oppScore >= 70 ? '#22c55e' : oppScore >= 40 ? '#eab308' : '#ef4444'};">${oppScore}</div>
                <div style="font-size: 9px; color: rgba(148,163,184,0.6); text-transform: uppercase; letter-spacing: 0.5px;">Opportunity</div>
              </div>
              <div style="text-align: center; padding: 6px 4px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                <div style="font-size: 16px; font-weight: 700; color: ${webScore >= 70 ? '#22c55e' : webScore >= 40 ? '#eab308' : '#ef4444'};">${webScore}</div>
                <div style="font-size: 9px; color: rgba(148,163,184,0.6); text-transform: uppercase; letter-spacing: 0.5px;">Website</div>
              </div>
            </div>

            ${selectedResult.rating ? `
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; padding: 6px 8px; background: rgba(255,255,255,0.03); border-radius: 8px;">
              <span style="color: #eab308; font-size: 12px;">★</span>
              <span style="font-size: 12px; font-weight: 600; color: white;">${selectedResult.rating}</span>
              <span style="font-size: 11px; color: rgba(148,163,184,0.6);">(${selectedResult.review_count || 0} reviews)</span>
            </div>` : ''}

            <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px;">
              ${selectedResult.phone ? `<a href="tel:${selectedResult.phone}" style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:rgba(255,255,255,0.04);border-radius:6px;font-size:11px;color:rgba(255,255,255,0.8);text-decoration:none;"><span style="color:#60a5fa;">📞</span> ${selectedResult.phone}</a>` : ''}
              ${selectedResult.email ? `<a href="mailto:${selectedResult.email}" style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:rgba(255,255,255,0.04);border-radius:6px;font-size:11px;color:rgba(255,255,255,0.8);text-decoration:none;"><span style="color:#60a5fa;">✉️</span> ${selectedResult.email}</a>` : ''}
              ${selectedResult.website ? `<a href="${selectedResult.website}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:rgba(59,130,246,0.1);border-radius:6px;font-size:11px;color:#60a5fa;text-decoration:none;"><span>🌐</span> Visit Website <span style="margin-left:auto;font-size:9px;opacity:0.6;">↗</span></a>` : ''}
            </div>

            <a href="/leads/${selectedResult.id}" style="display: block; width: 100%; padding: 8px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; text-align: center; border-radius: 8px; font-size: 12px; font-weight: 600; text-decoration: none; transition: all 0.15s;">
              Open Lead →
            </a>
          </div>
        `,
        )
        .addTo(map);
      popupsRef.current.push(popup);
    };
    show();
  }, [selectedResult, mapReady]);

  // ── Hover sync from sidebar ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    for (let i = 0; i < results.length; i++) {
      const isHovered = !!hoveredId && results[i]?.id === hoveredId;
      map.setFeatureState({ source: 'clusters', id: i }, { hovered: isHovered });
    }
  }, [hoveredId, results, mapReady]);

  // ── Area drawing ────────────────────────────────────────────────────
  const handleDrawClick = async (e: MapLngLatEvent) => {
    const map = mapRef.current;
    if (!map) return;

    if (!drawModeRef.current) return;
    const centerSrc = map.getSource('area-center') as GeoJSONSource | undefined;
    const areaSrc = map.getSource('search-area') as GeoJSONSource | undefined;

    if (!drawingCenterRef.current) {
      // first click: set center
      drawingCenterRef.current = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      setDrawStatus('Click again to choose the radius');
      if (centerSrc) {
        centerSrc.setData({
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] } },
          ],
        });
      }
      if (areaSrc) areaSrc.setData(EMPTY());
    } else {
      // second click: compute radius
      const center = drawingCenterRef.current;
      const radiusKm = Math.max(0.5, haversineKm(center.lat, center.lng, e.lngLat.lat, e.lngLat.lng));
      drawingCenterRef.current = null;
      setDrawMode(false);
      drawModeRef.current = false;
      setDrawStatus('');
      setMapClickHandler(null);
      if (onAreaSelected) onAreaSelected({ lat: center.lat, lng: center.lng, radiusKm });
    }
  };

  const beginDraw = () => {
    drawingCenterRef.current = null;
    setDrawMode(true);
    drawModeRef.current = true;
    setDrawStatus('Click the map to pick a center point');
    if (onClearArea) onClearArea();
    function drawListener(e: MapLngLatEvent) {
      void handleDrawClick(e);
    }
    setMapClickHandler(drawListener);
  };

  const toggleHeatmap = () => {
    const next = !showHeatmap;
    setShowHeatmap(next);
    const map = mapRef.current;
    if (map) map.setLayoutProperty('heatmap', 'visibility', next ? 'visible' : 'none');
  };

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
        <button
          onClick={beginDraw}
          aria-pressed={drawMode}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border backdrop-blur transition-all ${
            drawMode
              ? 'border-blue-500/40 bg-blue-500/20 text-blue-300'
              : 'border-white/[0.08] bg-[hsl(224,71%,7%)]/90 text-[hsl(215,20%,70%)] hover:bg-white/[0.08]'
          }`}
        >
          {drawMode ? 'Drawing radius…' : '⭕ Search area'}
        </button>
        <button
          onClick={toggleHeatmap}
          aria-pressed={showHeatmap}
          className="px-3 py-1.5 rounded-lg text-[12px] font-medium border backdrop-blur transition-all border-white/[0.08] bg-[hsl(224,71%,12%,0.9)] text-[hsl(215,20%,70%)] hover:bg-white/[0.08]"
        >
          {showHeatmap ? '🔥 Heatmap on' : '🌡 Heatmap'}
        </button>
        {area && (
          <div className="px-3 py-1.5 rounded-lg text-[11px] text-white bg-[hsl(224,71%,12%,0.92)] border border-blue-500/30 backdrop-blur">
            {area.lat.toFixed(3)}, {area.lng.toFixed(3)} · {area.radiusKm.toFixed(1)} km
            {onClearArea && (
              <button
                onClick={onClearArea}
                className="ml-2 text-red-400 hover:text-red-300"
                aria-label="Clear search area"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>
      {drawStatus && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-lg text-[12px] text-blue-100 bg-blue-600/90 border border-blue-400/30 backdrop-blur">
          {drawStatus}
        </div>
      )}
    </div>
  );
}

function EMPTY(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}
