import { useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  type StyleSpecification,
} from 'maplibre-gl';
import { useGpsPositions } from '../../hooks/useGpsPositions';
import { useBarcos } from '../../hooks/useFleet';
import { gpsEnabled, normalizarNombre } from '../../services/gps';
import { hace } from '../../utils/format';
import { svgAnclaBlanco } from '../ui/Iconos';
import type { GpsBoat } from '../../types/gps';

/**
 * MAPA NÁUTICO VECTORIAL (MapLibre + Protomaps, sin clave):
 * - Base OSM vectorizada de Protomaps, con el estilo FILTRADO:
 *   se ocultan calles, edificios y transporte; se conservan agua,
 *   costa, límites, nombres de lugares y POIs.
 * - Capa OpenSeaMap (boyas/faros) encima.
 * - Marcadores de flota, GPS en vivo y ruta náutica punteada.
 * - Si el estilo remoto falla, cae a raster OSM simple (nunca se rompe).
 */

export interface MarcadorMapa {
  lat: number;
  lng: number;
  color: string;
  html: string;
}

interface Props {
  centro: [number, number];
  zoom: number;
  marcadores?: MarcadorMapa[];
  ruta?: [number, number][];
}

const ESTILO_URL = 'https://protomaps.github.io/basemaps/assets/tiles.json';
// Capas que ocultamos del estilo base (calles, edificios, transporte)
const OCULTAR = /roads?|buildings?|transit|aeroway/i;

function estiloRaster(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors',
      },
      openseamap: {
        type: 'raster',
        tiles: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; OpenSeaMap contributors',
      },
    },
    layers: [
      { id: 'osm', type: 'raster', source: 'osm' },
      { id: 'openseamap', type: 'raster', source: 'openseamap' },
    ],
  };
}

async function estiloNautico(): Promise<StyleSpecification> {
  const res = await fetch(ESTILO_URL);
  const estilo = (await res.json()) as StyleSpecification;
  estilo.layers = (estilo.layers ?? []).filter(
    (l) => !OCULTAR.test(l.id ?? '') && !OCULTAR.test((l as { 'source-layer'?: string })['source-layer'] ?? ''),
  );
  // Capa OpenSeaMap encima de todo (transparente: deja ver nombres y POIs)
  estilo.sources = { ...(estilo.sources ?? {}), openseamap: { type: 'raster', tiles: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'], tileSize: 256, attribution: '&copy; OpenSeaMap contributors' } };
  estilo.layers.push({ id: 'openseamap', type: 'raster', source: 'openseamap' });
  return estilo;
}

export default function MapaNautico({ centro, zoom, marcadores = [], ruta }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<MapLibreMap | null>(null);
  const [estilo, setEstilo] = useState<StyleSpecification | null>(null);
  const [mapListo, setMapListo] = useState(false);

  const { data: gps } = useGpsPositions();
  const { data: barcos = [] } = useBarcos();

  // Cargar estilo vectorial (con fallback raster)
  useEffect(() => {
    let vivo = true;
    estiloNautico()
      .then((e) => vivo && setEstilo(e))
      .catch(() => vivo && setEstilo(estiloRaster()));
    return () => {
      vivo = false;
    };
  }, []);

  // Crear el mapa una vez cargado el estilo
  useEffect(() => {
    if (!contenedor.current || !estilo) return;
    const map = new MapLibreMap({
      container: contenedor.current,
      style: estilo,
      center: centro,
      zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    mapaRef.current = map;
    setMapListo(true);
    return () => {
      setMapListo(false);
      map.remove();
      mapaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estilo]);

  // Re-centrar cuando cambian las props
  useEffect(() => {
    mapaRef.current?.jumpTo({ center: centro, zoom });
  }, [centro, zoom]);

  // Marcadores + ruta (se reconstruyen en cada cambio de datos)
  useEffect(() => {
    const map = mapaRef.current;
    if (!map || !mapListo) return;
    const limpiar: (() => void)[] = [];

    marcadores.forEach((m) => {
      const el = document.createElement('div');
      el.className = 'fleet-dot';
      el.innerHTML = `<span class="dot" style="background:${m.color}"></span>`;
      const mk = new Marker({ element: el, anchor: 'center' }).setLngLat([m.lng, m.lat]).addTo(map);
      mk.setPopup(new Popup({ offset: 14, closeButton: false }).setHTML(m.html));
      limpiar.push(() => mk.remove());
    });

    const items = gps?.items ?? [];
    items.forEach((b) => {
      if (b.lat == null || b.lng == null) return;
      const el = document.createElement('div');
      el.className = `gps-marker${(b.speed ?? 0) >= 1 ? ' moviendo' : ''}`;
      el.style.background = estadoColor(b);
      el.innerHTML = svgAnclaBlanco;
      const mk = new Marker({ element: el, anchor: 'center' }).setLngLat([b.lng, b.lat]).addTo(map);
      const barco = barcos.find((x) => normalizarNombre(x.nombre) === normalizarNombre(b.name));
      mk.setPopup(
        new Popup({ offset: 16, closeButton: false }).setHTML(
          `<div class="popup"><b>${b.name}</b>` +
            `<div>Estado GPS: <b style="color:${estadoColor(b)}">${estadoTexto(b)}</b></div>` +
            `<div>Velocidad: <b style="color:${estadoColor(b)}">${b.speed != null ? `${b.speed} nudos` : '—'}</b>${b.course != null ? ` · rumbo ${b.course}°` : ''}</div>` +
            `<div class="muted">Pos: ${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}</div>` +
            `<div class="muted">${b.time ? hace(b.time) : 'sin hora'} · GPS GomezGPS</div>` +
            (barco ? `<a href="#/barco/${barco.id}">Ver bitácora del día →</a>` : '') +
            `</div>`,
        ),
      );
      limpiar.push(() => mk.remove());
    });

    if (ruta && ruta.length > 1) {
      map.addSource('ruta-nautica', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: ruta.map(([lat, lng]) => [lng, lat]) },
        },
      });
      map.addLayer({
        id: 'ruta-nautica',
        type: 'line',
        source: 'ruta-nautica',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#185a9c', 'line-width': 4, 'line-opacity': 0.9, 'line-dasharray': [2, 2] },
      });
      limpiar.push(() => {
        if (map.getLayer('ruta-nautica')) map.removeLayer('ruta-nautica');
        if (map.getSource('ruta-nautica')) map.removeSource('ruta-nautica');
      });
    }

    return () => limpiar.forEach((f) => f());
  }, [mapListo, marcadores, gps, barcos, ruta]);

  return (
    <>
      <div ref={contenedor} className="mapa" />
      {!mapListo && <div className="esqueleto mapa-esqueleto" />}
    </>
  );
}

/** Chip pequeño "GPS en vivo" para los filtros del dashboard. */
export function GpsStatusChip() {
  const { data, isLoading, error } = useGpsPositions();
  if (!gpsEnabled) return null;
  const n = data?.items.length ?? 0;
  const texto = error
    ? 'GPS sin conexión'
    : isLoading && !data
      ? 'GPS conectando…'
      : data && data.fetched_at
        ? `GPS en vivo · ${n} barcos · ${hace(data.fetched_at)}`
        : 'GPS en vivo';
  return <span className={`gps-chip${error ? ' err' : ''}`}>{texto}</span>;
}

function estadoColor(b: GpsBoat): string {
  if (b.online === 'online') return '#22c55e';
  if (b.online === 'offline') return '#ef4444';
  return '#f59e0b';
}

function estadoTexto(b: GpsBoat): string {
  if (b.online === 'online') return 'En movimiento';
  if (b.online === 'offline') return 'Sin señal';
  return 'Conectado';
}
