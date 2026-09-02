import { useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  type StyleSpecification,
} from 'maplibre-gl';
import { useGpsPositions } from '../../hooks/useGpsPositions';
import { gpsEnabled } from '../../services/gps';
import { hace } from '../../utils/format';
import { svgAnclaBlanco } from '../ui/Iconos';

/**
 * MAPA NÁUTICO VECTORIAL (MapLibre + Protomaps, sin clave).
 * - Render puro de marcadores: recibe `marcadores` ya mezclados
 *   (GPS en vivo si existe, si no el último reporte/bitácora).
 * - Al montar ajusta el encuadre para mostrar TODOS los marcadores.
 * - `enfoque` centra el mapa en un barco (clic en la flota).
 */

export interface MarcadorMapa {
  id?: string;
  lat: number;
  lng: number;
  color: string;
  html: string;
  /** 'gps' = ancla de rastreador en vivo; por defecto = punto de flota. */
  tipo?: 'gps' | 'reporte' | 'bitacora';
  speed?: number | null;
  course?: number | null;
  name?: string;
}

interface Props {
  centro: [number, number]; // [lat, lng]
  zoom: number;
  marcadores?: MarcadorMapa[];
  ruta?: [number, number][]; // [lat, lng][]
  enfoque?: { lat: number; lng: number; id?: string } | null;
}

const ESTILO_URL = 'https://protomaps.github.io/basemaps/assets/tiles.json';
const OCULTAR = /roads?|buildings?|transit|aeroway/i;

function estiloRaster(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '&copy; OpenStreetMap contributors' },
      openseamap: { type: 'raster', tiles: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'], tileSize: 256, attribution: '&copy; OpenSeaMap contributors' },
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
  estilo.sources = {
    ...(estilo.sources ?? {}),
    openseamap: { type: 'raster', tiles: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'], tileSize: 256, attribution: '&copy; OpenSeaMap contributors' },
  };
  estilo.layers.push({ id: 'openseamap', type: 'raster', source: 'openseamap' });
  return estilo;
}

export default function MapaNautico({ centro, zoom, marcadores = [], ruta, enfoque }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<MapLibreMap | null>(null);
  const marcadoresRef = useRef(new Map<string, Marker>());
  const [estilo, setEstilo] = useState<StyleSpecification | null>(null);
  const [mapListo, setMapListo] = useState(false);
  const encuadreHecho = useRef(false);

  useEffect(() => {
    let vivo = true;
    estiloNautico()
      .then((e) => vivo && setEstilo(e))
      .catch(() => vivo && setEstilo(estiloRaster()));
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (!contenedor.current || !estilo) return;
    const map = new MapLibreMap({
      container: contenedor.current,
      style: estilo,
      center: [centro[1], centro[0]], // MapLibre usa [lng, lat]
      zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    mapaRef.current = map;
    setMapListo(true);
    encuadreHecho.current = false;
    return () => {
      setMapListo(false);
      map.remove();
      mapaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estilo]);

  // Enfoque a un barco concreto (clic en la flota): centra y abre su popup.
  useEffect(() => {
    const map = mapaRef.current;
    if (!map || !enfoque) return;
    map.jumpTo({ center: [enfoque.lng, enfoque.lat], zoom: 13 });
    if (enfoque.id) marcadoresRef.current.get(enfoque.id)?.togglePopup();
  }, [enfoque]);

  // Marcadores + ruta + encuadre inicial
  useEffect(() => {
    const map = mapaRef.current;
    if (!map || !mapListo) return;
    const limpiar: (() => void)[] = [];

    marcadores.forEach((m) => {
      const esGps = m.tipo === 'gps';
      const el = document.createElement('div');
      if (esGps) {
        el.className = `gps-marker${(m.speed ?? 0) >= 1 ? ' moviendo' : ''}`;
        el.style.background = m.color;
        el.innerHTML = svgAnclaBlanco;
      } else {
        el.className = 'fleet-dot';
        el.innerHTML = `<span class="dot" style="background:${m.color}"></span>`;
      }
      const mk = new Marker({ element: el, anchor: 'center' }).setLngLat([m.lng, m.lat]).addTo(map);
      mk.setPopup(new Popup({ offset: 14, closeButton: false }).setHTML(m.html));
      if (m.id) marcadoresRef.current.set(m.id, mk);
      limpiar.push(() => {
        mk.remove();
        if (m.id) marcadoresRef.current.delete(m.id);
      });
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

    // Encuadre inicial: muestra TODOS los marcadores (GPS + reportes).
    // Si aún no hay marcadores, espera (no marca "hecho") hasta que lleguen.
    if (!encuadreHecho.current && (marcadores.length > 0 || (ruta && ruta.length > 1))) {
      const puntos = [
        ...marcadores.map((m) => [m.lng, m.lat] as [number, number]),
        ...(ruta ?? []).map(([lat, lng]) => [lng, lat] as [number, number]),
      ];
      const lngs = puntos.map((p) => p[0]);
      const lats = puntos.map((p) => p[1]);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      if (minLng === maxLng && minLat === maxLat) {
        map.jumpTo({ center: [minLng, minLat], zoom: 12 });
      } else {
        map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          { padding: 90, maxZoom: 12 },
        );
      }
      encuadreHecho.current = true;
    }

    return () => limpiar.forEach((f) => f());
  }, [mapListo, marcadores, ruta, centro, zoom]);

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
