export interface Punto {
  lat: number;
  lng: number;
}

/** Distancia en km entre dos coordenadas (fórmula del haversine). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Distancia total de una ruta (suma de tramos). */
export function distanciaRuta(puntos: Punto[]): number {
  let total = 0;
  for (let i = 1; i < puntos.length; i++) {
    total += haversineKm(puntos[i - 1].lat, puntos[i - 1].lng, puntos[i].lat, puntos[i].lng);
  }
  return total;
}

export function formatKm(km: number): string {
  return km >= 10 ? `${km.toFixed(1)} km` : `${km.toFixed(2)} km`;
}
