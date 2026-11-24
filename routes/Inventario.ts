import express from 'express';
import { getSheet } from '../config/sheet.config.js';

const router = express.Router();

const obtenerTasaManualGuardada = async () => {
  try {
    const sheetConfig = await getSheet('Configuracion');
    const rows = await sheetConfig.getRows();
    if (rows.length > 0) {
      const val = rows[0].get('TasaManual');
      if (!val) return null;
      return parseFloat(val.toString().replace(',', '.'));
    }
    return null;
  } catch (error) { return null; }
};

const obtenerTasaBCV = async () => {
  const tasaGuardada = await obtenerTasaManualGuardada();
  if (tasaGuardada && tasaGuardada > 0) return tasaGuardada;
  try {
    const res = await fetch('https://www.bcv.org.ve/', { headers: { 'User-Agent': 'Mozilla/5.0...' } });
    const html = await res.text();
    const match = html.match(/<div[^>]*id="dolar"[^>]*>[\s\S]*?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/);
    if (match && match[1]) {
      const tasaStr = match[1].replace(/\./g, '').replace(',', '.');
      const tasa = parseFloat(tasaStr);
      if (tasa > 100 && tasa < 2000) return tasa;
    }
    throw new Error('No match');
  } catch (error) {
    try {
      const resFallback = await fetch('https://allratestoday.com/api/open/central-bank/bcv?source=USD&target=VES');
      const data = await resFallback.json();
      return data.rate || 0;
    } catch (fallbackError) { return 0; }
  }
};

const guardarHistorial = async (tipo: string, codigo: string, cantidad: string, pagoResumen: string, tasa: number, totalUSD: number, totalBS: number) => {
  try {
    const sheetHistorial = await getSheet('Historial');
    const fecha = new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" }); 
    await sheetHistorial.addRow({
      Fecha: fecha, Tipo: tipo, Codigo: codigo, Cantidad: cantidad, Pago: pagoResumen, 
      Tasa: tasa.toFixed(4).toString().replace('.', ','), 
      TotalUSD: totalUSD.toFixed(2).toString().replace('.', ','),
      TotalBS: totalBS.toFixed(2).toString().replace('.', ',')
    });
  } catch (error: any) { console.error('Error historial:', error); }
};

router.get('/', async (req, res) => {
  try {
    const sheet = await getSheet('Inventario');
    const rows = await sheet.getRows();
    const data = rows.map((row: any) => ({
      Codigo: row.get('CODIGO') || '',
      Proveedor: row.get('PROVEEDOR') || '',
      Nombre: row.get('NOMBRE') || '',
      Marca: row.get('MARCA') || '',
      Estante: row.get('ESTANTE') || '',
      Costo: row.get('COSTO') || '0',
      Venta: row.get('VENTA') ? row.get('VENTA').toString().trim() : '0',
      Existencia: row.get('EXISTENCIA') || '0'
    }));
    res.json(data);
  } catch (error) { res.status(500).json({ error: 'Error al leer inventario' }); }
});

router.post('/cargar', async (req, res) => { /* ... (igual que antes) ... */ });
router.post('/vender', async (req, res) => { /* ... (igual que antes) ... */ });
router.get('/tasa', async (req, res) => { res.json({ tasa: await obtenerTasaBCV() }); });
router.post('/tasa-manual', async (req, res) => { /* ... (igual que antes) ... */ });

// --- REPORTE POR FECHAS ---
router.get('/reporte', async (req, res) => {
  try {
    const { fecha } = req.query; // Recibe la fecha como YYYY-MM-DD
    const sheetHistorial = await getSheet('Historial');
    const rows = await sheetHistorial.getRows();
    
    // Formateamos la fecha para buscar en el Sheets (DD/MM/YYYY)
    const fechaBuscar = fecha ? fecha.split('-').reverse().join('/') : new Date().toLocaleDateString("es-VE", { timeZone: "America/Caracas" });
    
    const ventasFiltradas = rows.filter((row: any) => {
      return (row.get('Tipo') || '') === 'Venta' && (row.get('Fecha') || '').startsWith(fechaBuscar);
    }).map((row: any) => ({
      Fecha: row.get('Fecha'),
      Codigo: row.get('Codigo'),
      Cantidad: row.get('Cantidad'),
      Pago: row.get('Pago'),
      TotalUSD: parseFloat((row.get('TotalUSD') || '0').toString().replace(',', '.')),
      TotalBS: parseFloat((row.get('TotalBS') || '0').toString().replace(',', '.'))
    }));

    // Sumamos los totales directamente de las filas filtradas
    const granTotalUSD = ventasFiltradas.reduce((acc: any, v: any) => acc + v.TotalUSD, 0);
    const granTotalBS = ventasFiltradas.reduce((acc: any, v: any) => acc + v.TotalBS, 0);

    const metodosMap: { [key: string]: { transacciones: number, usd: number, bs: number } } = {};
    const tasaHoy = await obtenerTasaBCV();

    ventasFiltradas.forEach((venta: any) => {
      const pagosArray = venta.Pago.split(' | ');
      pagosArray.forEach((pagoStr: string) => {
        const [metodo, montoStr] = pagoStr.split(': $');
        if (metodo && montoStr) {
          const montoUSD = parseFloat(montoStr.replace(',', '.'));
          if (!metodosMap[metodo]) metodosMap[metodo] = { transacciones: 0, usd: 0, bs: 0 };
          
          metodosMap[metodo].transacciones += 1;
          metodosMap[metodo].usd += montoUSD;
          metodosMap[metodo].bs += (montoUSD * tasaHoy);
        }
      });
    });

    res.json({ ventas: ventasFiltradas, granTotalUSD, granTotalBS, desglosePagos: metodosMap });
  } catch (error) {
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
});

export default router;