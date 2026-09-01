import ExcelJS from 'exceljs';
import type { FleetEntry } from '../types';
import { formatDateTime } from '../utils/format';

export interface FilaExportable {
  fecha: string;
  embarcacion: string;
  estado: string;
  operador: string;
  lugar: string;
  pasajeros: number;
  maletas: number;
  bolsos: number;
  equipaje: number;
  lat: string;
  lng: string;
  notas: string;
}

export function filasDesdeEntries(entries: FleetEntry[]): FilaExportable[] {
  return entries.map((e) => ({
    fecha: formatDateTime(e.report.created_at),
    embarcacion: e.barco.nombre,
    estado: e.estado?.nombre ?? '—',
    operador: e.operador?.nombre ?? '—',
    lugar: e.report.lugar || '—',
    pasajeros: e.report.pasajeros,
    maletas: e.report.maletas,
    bolsos: e.report.bolsos,
    equipaje: e.report.equipaje,
    lat: e.report.lat != null ? String(e.report.lat) : '—',
    lng: e.report.lng != null ? String(e.report.lng) : '—',
    notas: e.report.notas || '—',
  }));
}

/**
 * Genera y descarga un archivo .xlsx con los reportes.
 * Encabezados con estilo, autofiltro, fila de totales y vista congelada.
 */
export async function exportarAExcel(filas: FilaExportable[], nombreArchivo: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Colombia Navega';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Reportes');

  sheet.columns = [
    { header: 'Fecha y hora', key: 'fecha', width: 18 },
    { header: 'Embarcación', key: 'embarcacion', width: 22 },
    { header: 'Estado', key: 'estado', width: 16 },
    { header: 'Operador', key: 'operador', width: 20 },
    { header: 'Lugar', key: 'lugar', width: 22 },
    { header: 'Pasajeros', key: 'pasajeros', width: 11 },
    { header: 'Maletas', key: 'maletas', width: 10 },
    { header: 'Bolsos', key: 'bolsos', width: 10 },
    { header: 'Equipaje', key: 'equipaje', width: 11 },
    { header: 'Latitud', key: 'lat', width: 13 },
    { header: 'Longitud', key: 'lng', width: 13 },
    { header: 'Notas', key: 'notas', width: 30 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 22;

  filas.forEach((f) => sheet.addRow(f));

  if (filas.length > 0) {
    const totalPax = filas.reduce((acc, f) => acc + f.pasajeros, 0);
    const totalMaletas = filas.reduce((acc, f) => acc + f.maletas, 0);
    const totalBolsos = filas.reduce((acc, f) => acc + f.bolsos, 0);
    const totalEquip = filas.reduce((acc, f) => acc + f.equipaje, 0);
    const total = sheet.addRow({
      fecha: 'TOTAL',
      embarcacion: `${filas.length} reportes`,
      pasajeros: totalPax,
      maletas: totalMaletas,
      bolsos: totalBolsos,
      equipaje: totalEquip,
    });
    total.font = { bold: true };
    for (let c = 1; c <= 9; c++) {
      total.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    }
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(2, filas.length + 1), column: 12 },
  };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
