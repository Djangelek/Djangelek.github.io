#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scrape_gomezgps.py
==================
Extrae los datos GPS de cada barco/vehículo de la plataforma
Gomez GPS (https://plataforma.gomezgps.com/objects).

Cómo funciona (endpoints descubiertos inspeccionando el HTML/JS de la app):
  1. GET  /objects                            -> página (token CSRF + cookie)
  2. POST /authentication/store               -> login (cookie de sesión)
  3. GET  /objects/items                      -> SNAPSHOT: TODOS los barcos
                                                 con su posición actual (JSON)
  4. GET  /objects/items_json?id=&time=&filters=  -> actualización "en vivo"
                                                 (solo lo que cambió desde
                                                 `time`; es el poll de 5 s
                                                 que usa la web)
  5. GET  /history?device_id=&from_date=&from_time=&to_date=&to_time=
                                               -> histórico de un barco
                                                 (JSON "positions" embebido
                                                 en el HTML)
  6. GET  /history/export?<mismos filtros>&format=csv
                                               -> genera un CSV del histórico
  7. GET  /history/download/<hash>/<archivo>.csv -> descarga ese CSV

Uso:
  python scrape_gomezgps.py snapshot [--out DIR]
  python scrape_gomezgps.py history --device 56 --from "2026-08-30 00:00" --to "2026-08-31 10:30"
  python scrape_gomezgps.py history-all --from "2026-08-30 00:00" --to "2026-08-31 10:30"
  python scrape_gomezgps.py live --seconds 120        # muestreo cada 10 s

Credenciales (cualquiera de las dos):
  - variables de entorno GOMEZGPS_EMAIL / GOMEZGPS_PASSWORD
  - argumentos --email / --password

Notas:
  - Las fechas se interpretan en la zona horaria del servidor
    (Colombia, UTC-5).
  - El snapshot incluye: id, nombre, estado (online/ack/offline), lat/lng,
    velocidad (nudos), rumbo, altitud, hora del último reporte, distancia
    total y cola de puntos recientes ("tail").
  - El CSV de histórico (export) trae 25 columnas: dt, lat, lng, altitude,
    course, speed, status, ignition, charge, blocked, batterylevel, rssi,
    sequence, distance, totaldistance, motion, valid, enginehours, accuracy,
    iccid, event, archive, gsmsignal, sat, alarm.
"""

import argparse
import csv
import json
import os
import re
import sys
import time
from datetime import datetime

import requests

BASE_URL = "https://plataforma.gomezgps.com"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")


class GomezGPS:
    """Cliente de la plataforma Gomez GPS."""

    def __init__(self, email, password):
        self.email = email
        self.password = password
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": UA})
        self._token = None

    # ------------------------------------------------------------------ #
    # Login                                                              #
    # ------------------------------------------------------------------ #
    def login(self):
        """GET /objects para obtener el token CSRF y luego POST login."""
        r = self.session.get(f"{BASE_URL}/objects", timeout=30)
        r.raise_for_status()

        m = re.search(r'name="_token" type="hidden" value="([^"]+)"', r.text)
        if not m:
            m = re.search(r'<meta name="csrf-token" content="([^"]+)"', r.text)
        self._token = m.group(1) if m else ""

        r = self.session.post(
            f"{BASE_URL}/authentication/store",
            data={
                "identifier": self.email,
                "password": self.password,
                "remember_me": "1",
                "_token": self._token,
            },
            allow_redirects=True,
            timeout=30,
        )
        r.raise_for_status()

        # Tras el login la app inyecta el objeto `app.urls` en la página.
        check = self.session.get(f"{BASE_URL}/objects", timeout=30)
        if "sign-in-layout" in check.text or '"urls"' not in check.text:
            raise RuntimeError(
                "Login fallido: revisa credenciales o el token CSRF."
            )
        return True

    # ------------------------------------------------------------------ #
    # Snapshot (todos los barcos, posición actual)                       #
    # ------------------------------------------------------------------ #
    def snapshot(self):
        """GET /objects/items -> lista de barcos con posición actual."""
        r = self.session.get(f"{BASE_URL}/objects/items", timeout=30)
        r.raise_for_status()
        data = r.json()
        return data.get("data", [])

    def boats(self):
        """Lista de (id, nombre) de todos los barcos."""
        return [(b["id"], b["name"]) for b in self.snapshot()]

    # ------------------------------------------------------------------ #
    # Histórico                                                          #
    # ------------------------------------------------------------------ #
    def _history_params(self, device_id, dt_from, dt_to):
        return {
            "device_id": device_id,
            "from_date": dt_from.strftime("%Y-%m-%d"),
            "from_time": dt_from.strftime("%H:%M"),
            "to_date": dt_to.strftime("%Y-%m-%d"),
            "to_time": dt_to.strftime("%H:%M"),
            "snap_to_road": "",
            "stops": "0",
            "show_invalid": "",
        }

    def history_points(self, device_id, dt_from, dt_to):
        """
        GET /history -> extrae el JSON embebido `"positions": [...]`.
        Cada punto: {id, t, a (altitud), s (velocidad), c (color),
                     v (validez), lat, lng}.
        """
        r = self.session.get(
            f"{BASE_URL}/history",
            params=self._history_params(device_id, dt_from, dt_to),
            timeout=90,
        )
        r.raise_for_status()
        return extract_positions_json(r.text)

    def history_csv(self, device_id, dt_from, dt_to):
        """
        Flujo de exportación oficial: /history/export?format=csv devuelve
        {"download": <url>} y luego se descarga el CSV.
        """
        params = self._history_params(device_id, dt_from, dt_to)
        params["format"] = "csv"
        r = self.session.get(f"{BASE_URL}/history/export",
                             params=params, timeout=90)
        r.raise_for_status()
        out = r.json()
        if "download" not in out:
            raise RuntimeError(f"El export no devolvió CSV: {out}")
        dl = self.session.get(out["download"], timeout=120)
        dl.raise_for_status()
        return dl.content.decode("utf-8", errors="replace")

    # ------------------------------------------------------------------ #
    # En vivo (poll cada N segundos)                                     #
    # ------------------------------------------------------------------ #
    def live_snapshot(self):
        """GET /objects/items_json (mismo poll que usa la web, 5 s)."""
        r = self.session.get(f"{BASE_URL}/objects/items_json", timeout=30)
        r.raise_for_status()
        return r.json().get("items", [])


# ---------------------------------------------------------------------- #
# Utilidades                                                             #
# ---------------------------------------------------------------------- #
def extract_positions_json(html):
    """
    Localiza `"positions":[...]` en el HTML del histórico y devuelve la
    lista de puntos parseada (balanceando corchetes, no usa regex frágil).
    """
    key = '"positions":['
    i = html.find(key)
    if i == -1:
        return []
    i += len(key) - 1  # apuntar al '['
    depth = 0
    j = i
    in_str = False
    esc = False
    while j < len(html):
        ch = html[j]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
        else:
            if ch == '"':
                in_str = True
            elif ch == "[":
                depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0:
                    return json.loads(html[i:j + 1])
        j += 1
    return []


SNAPSHOT_COLS = [
    "id", "name", "online", "lat", "lng", "speed", "course", "altitude",
    "time", "timestamp", "stop_duration_sec", "total_distance", "group_id",
    "engine_status", "tail_points",
]


def snapshot_rows(boats):
    rows = []
    for b in boats:
        rows.append({
            "id": b.get("id"),
            "name": b.get("name"),
            "online": b.get("online"),
            "lat": b.get("lat"),
            "lng": b.get("lng"),
            "speed": b.get("speed"),
            "course": b.get("course"),
            "altitude": b.get("altitude"),
            "time": b.get("time"),
            "timestamp": b.get("timestamp"),
            "stop_duration_sec": b.get("stop_duration_sec"),
            "total_distance": b.get("total_distance"),
            "group_id": b.get("group_id"),
            "engine_status": b.get("engine_status"),
            "tail_points": len(b.get("tail") or []),
        })
    return rows


def write_csv(path, rows, cols):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    return path


def parse_dt(s):
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    raise argparse.ArgumentTypeError(
        f"Fecha inválida: {s!r} (usa 'YYYY-MM-DD HH:MM')")


# ---------------------------------------------------------------------- #
# Comandos                                                               #
# ---------------------------------------------------------------------- #
def cmd_snapshot(gps, args):
    boats = gps.snapshot()
    if not boats:
        print("Sin barcos en la cuenta.")
        return
    rows = snapshot_rows(boats)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    os.makedirs(args.out, exist_ok=True)
    csv_path = write_csv(os.path.join(args.out, f"barcos_snapshot_{ts}.csv"),
                         rows, SNAPSHOT_COLS)
    json_path = os.path.join(args.out, f"barcos_snapshot_{ts}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(boats, f, ensure_ascii=False, indent=2)

    print(f"\n{len(boats)} barcos encontrados:\n")
    print(f"{'ID':>4}  {'NOMBRE':<18} {'ESTADO':<8} {'LAT':>11} "
          f"{'LNG':>12} {'VEL(nudos)':>10} {'RUMBO':>5}  ÚLTIMO REPORTE")
    for b in boats:
        print(f"{b['id']:>4}  {b['name']:<18} {b.get('online',''):<8} "
              f"{b.get('lat',''):>11} {b.get('lng',''):>12} "
              f"{b.get('speed',''):>10} {b.get('course',''):>5}  "
              f"{b.get('time','')}")
    print(f"\nCSV : {csv_path}")
    print(f"JSON: {json_path}")


def cmd_history(gps, args):
    from_dt, to_dt = parse_dt(args.from_), parse_dt(args.to)
    if args.name is None:
        args.name = f"device_{args.device}"

    try:
        csv_text = gps.history_csv(args.device, from_dt, to_dt)
        os.makedirs(args.out, exist_ok=True)
        safe = re.sub(r"[^\w.-]+", "_", args.name)
        path = os.path.join(
            args.out,
            f"hist_{safe}_{from_dt:%Y%m%d_%H%M}_{to_dt:%Y%m%d_%H%M}.csv")
        with open(path, "w", encoding="utf-8") as f:
            f.write(csv_text)
        n = len(csv_text.strip().splitlines()) - 1
        print(f"Histórico de {args.name} (id {args.device}): {n} filas -> {path}")
        return path
    except Exception as e:  # fallback: JSON embebido en /history
        points = gps.history_points(args.device, from_dt, to_dt)
        if not points:
            print(f"Sin posiciones para {args.name} en ese rango.")
            return
        os.makedirs(args.out, exist_ok=True)
        safe = re.sub(r"[^\w.-]+", "_", args.name)
        path = os.path.join(
            args.out,
            f"hist_{safe}_{from_dt:%Y%m%d_%H%M}_{to_dt:%Y%m%d_%H%M}_points.csv")
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["id", "time", "lat", "lng", "altitude", "speed",
                        "color", "valid"])
            for p in points:
                w.writerow([p["id"], p["t"], p["lat"], p["lng"],
                            p.get("a"), p.get("s"), p.get("c"), p.get("v")])
        print(f"Histórico de {args.name} (id {args.device}): "
              f"{len(points)} puntos -> {path}  (fallback: export CSV falló: {e})")
        return path


def cmd_history_all(gps, args):
    from_dt, to_dt = parse_dt(args.from_), parse_dt(args.to)
    boats = gps.boats()
    print(f"{len(boats)} barcos; rango {from_dt} -> {to_dt}\n")
    for bid, name in boats:
        try:
            cmd_history(gps, argparse.Namespace(
                device=bid, name=name, from_=args.from_, to=args.to,
                out=args.out))
        except Exception as e:
            print(f"  ! {name} (id {bid}): error -> {e}")
        time.sleep(0.5)


def cmd_live(gps, args):
    os.makedirs(args.out, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(args.out, f"barcos_live_{ts}.csv")
    cols = ["sample_time"] + SNAPSHOT_COLS
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        deadline = time.time() + args.seconds
        while time.time() < deadline:
            items = gps.live_snapshot()
            stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            for row in snapshot_rows(items):
                row = dict(row)
                row["sample_time"] = stamp
                w.writerow(row)
            f.flush()
            print(f"{stamp}: {len(items)} barcos (muestreo cada 10 s)")
            time.sleep(10)
    print(f"Live finalizado -> {path}")


# ---------------------------------------------------------------------- #
# Main                                                                   #
# ---------------------------------------------------------------------- #
def main():
    p = argparse.ArgumentParser(
        description="Extrae datos GPS de los barcos de Gomez GPS.")
    p.add_argument("--email", default=os.environ.get("GOMEZGPS_EMAIL"))
    p.add_argument("--password", default=os.environ.get("GOMEZGPS_PASSWORD"))
    p.add_argument("--out", default=os.path.join(os.path.dirname(
        os.path.abspath(__file__)), "output"), help="Directorio de salida")

    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("snapshot", help="Posición actual de todos los barcos")
    sp.set_defaults(fn=cmd_snapshot)

    hp = sub.add_parser("history", help="Histórico de un barco (CSV)")
    hp.add_argument("--device", type=int, required=True)
    hp.add_argument("--name", default=None)
    hp.add_argument("--from", dest="from_", required=True)
    hp.add_argument("--to", required=True)
    hp.set_defaults(fn=cmd_history)

    ha = sub.add_parser("history-all",
                        help="Histórico de TODOS los barcos (CSV)")
    ha.add_argument("--from", dest="from_", required=True)
    ha.add_argument("--to", required=True)
    ha.set_defaults(fn=cmd_history_all)

    lp = sub.add_parser("live", help="Muestreo en vivo cada 10 s")
    lp.add_argument("--seconds", type=int, default=60)
    lp.set_defaults(fn=cmd_live)

    args = p.parse_args()
    if not args.email or not args.password:
        p.error("Faltan credenciales: usa --email/--password o las "
                "variables GOMEZGPS_EMAIL/GOMEZGPS_PASSWORD")

    gps = GomezGPS(args.email, args.password)
    print("Iniciando sesión...")
    gps.login()
    print("Sesión OK.\n")
    args.fn(gps, args)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
