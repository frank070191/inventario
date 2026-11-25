import express from 'express';
import https from 'https';
import { getSheet } from '../config/sheet.config.js';

const router = express.Router();

const ZONA = 'America/Caracas';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/* =====================================================================
   UTILIDADES DE FECHA Y NÚMEROS
   ===================================================================== */

// Fecha de hoy en Venezuela con formato AAAA-MM-DD
const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA });

// Convierte "24/11/2026, 10:39:00 p. m." (o "24/11/2026") en "2026-11-24"
const fechaAISO = (texto: string): string | null => {
  const m = (texto || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};

// Convierte "919,8227" o "919.8227" en número
const aNumero = (valor: any): number => parseFloat((valor ?? '').toString().replace(',', '.'));

/* =====================================================================
   TASA BCV
   Orden de prioridad:
   1) Tasa manual guardada HOY (si alguien la corrigió a mano ese día)
   2) Tasa publicada en la página del BCV (se registra sola en la hoja "Tasas")
   3) Servicio de respaldo
   4) Última tasa guardada en la hoja "Tasas" (fines de semana, feriados o si todo falla)
   ===================================================================== */

type ResultadoTasa = { tasa: number; fuente: string; fechaTasa: string };
type RegistroTasa = { iso: string; tasa: number; fecha: string };

let cacheTasa: { resultado: ResultadoTasa; vence: number } | null = null;
let calculoEnCurso: Promise<ResultadoTasa> | null = null;

const obtenerTasaManualGuardada = async (): Promise<{ tasa: number; iso: string | null } | null> => {
  try {
    const sheetConfig = await getSheet('Configuracion');
    const rows = await sheetConfig.getRows();
    if (rows.length > 0) {
      const val = rows[0].get('TasaManual');
      if (!val) return null;
      const tasa = aNumero(val);
      if (!(tasa > 0)) return null;
      return { tasa, iso: fechaAISO((rows[0].get('Fecha') || '').toString()) };
    }
    return null;
  } catch (error) { return null; }
};

const leerHistorialTasas = async (): Promise<RegistroTasa[]> => {
  try {
    const sheetTasas = await getSheet('Tasas');
    const rows = await sheetTasas.getRows();
    const lista: RegistroTasa[] = [];
    for (const r of rows as any[]) {
      const fecha = (r.get('Fecha') || '').toString();
      const iso = fechaAISO(fecha);
      const tasa = aNumero(r.get('Tasa'));
      if (iso && tasa > 0) lista.push({ iso, tasa, fecha });
    }
    return lista;
  } catch (error) { return []; }
};

// Devuelve la tasa vigente en una fecha: la del mismo día o, si no hay, la más reciente anterior
const tasaVigenteEn = (historial: RegistroTasa[], fechaISO: string): RegistroTasa | null => {
  let mejor: RegistroTasa | null = null;
  for (const h of historial) {
    if (h.iso <= fechaISO && (mejor === null || h.iso >= mejor.iso)) mejor = h;
  }
  return mejor;
};

const registrarTasaAutomatica = async (tasa: number, origen: string) => {
  try {
    const sheetTasas = await getSheet('Tasas');
    const fecha = new Date().toLocaleString('es-VE', { timeZone: ZONA });
    await sheetTasas.addRow({ Fecha: fecha, Tasa: tasa.toFixed(4).replace('.', ','), Usuario: origen });
  } catch (error) { console.error('Error registrando tasa automática:', error); }
};

// Descarga con verificación estricta de certificado; si falla (el sitio del BCV a veces
// tiene problemas de certificado), reintenta sin verificar. Solo se lee una cifra pública
// y se valida que sea razonable antes de usarla.
const descargarHTMLConHttps = (url: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { rejectUnauthorized: false, headers: { 'User-Agent': USER_AGENT }, timeout: 10000 },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(data));
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });

const descargarHTMLBCV = async (): Promise<string> => {
  const url = 'https://www.bcv.org.ve/';
  try {
    const controller = new AbortController();
    const temporizador = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
      return await res.text();
    } finally { clearTimeout(temporizador); }
  } catch (error) {
    return await descargarHTMLConHttps(url);
  }
};

const extraerTasaDelHTML = (html: string): number => {
  const match = html.match(/<div[^>]*id="dolar"[^>]*>[\s\S]*?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/);
  if (match && match[1]) {
    return parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  }
  return 0;
};

// Acepta la tasa solo si es un número válido y no se aleja demasiado de la última conocida
const tasaPlausible = (tasa: number, referencia: number | null): boolean => {
  if (!isFinite(tasa) || tasa <= 0) return false;
  if (referencia && referencia > 0) return tasa >= referencia * 0.5 && tasa <= referencia * 2;
  return true;
};

const calcularTasa = async (): Promise<ResultadoTasa> => {
  const hoy = hoyISO();
  const historial = await leerHistorialTasas();
  const ultima = tasaVigenteEn(historial, '9999-12-31');
  const referencia = ultima ? ultima.tasa : null;

  // 1) Tasa manual guardada hoy
  const manual = await obtenerTasaManualGuardada();
  if (manual && manual.iso === hoy) {
    const resultado = { tasa: manual.tasa, fuente: 'manual', fechaTasa: hoy };
    cacheTasa = { resultado, vence: Date.now() + 10 * 60 * 1000 };
    return resultado;
  }

  // 2) Página del BCV
  try {
    const html = await descargarHTMLBCV();
    const tasa = extraerTasaDelHTML(html);
    if (tasaPlausible(tasa, referencia)) {
      // Se registra solo cuando cambia respecto a la última guardada
      if (!ultima || ultima.tasa.toFixed(4) !== tasa.toFixed(4)) {
        await registrarTasaAutomatica(tasa, 'Auto BCV');
      }
      const resultado = { tasa, fuente: 'BCV', fechaTasa: hoy };
      cacheTasa = { resultado, vence: Date.now() + 10 * 60 * 1000 };
      return resultado;
    }
  } catch (error) { console.error('No se pudo leer la tasa del BCV:', error); }

  // 3) Servicio de respaldo
  try {
    const resFallback = await fetch('https://allratestoday.com/api/open/central-bank/bcv?source=USD&target=VES');
    const data: any = await resFallback.json();
    const tasa = Number(data.rate);
    if (tasaPlausible(tasa, referencia)) {
      if (!ultima || ultima.tasa.toFixed(4) !== tasa.toFixed(4)) {
        await registrarTasaAutomatica(tasa, 'Auto respaldo');
      }
      const resultado = { tasa, fuente: 'respaldo', fechaTasa: hoy };
      cacheTasa = { resultado, vence: Date.now() + 10 * 60 * 1000 };
      return resultado;
    }
  } catch (error) { console.error('No se pudo usar el servicio de respaldo:', error); }

  // 4) Última tasa guardada (fines de semana, feriados o si todo lo anterior falla)
  if (ultima) {
    const resultado = { tasa: ultima.tasa, fuente: 'última guardada', fechaTasa: ultima.iso };
    cacheTasa = { resultado, vence: Date.now() + 60 * 1000 };
    return resultado;
  }

  return { tasa: 0, fuente: 'sin datos', fechaTasa: hoy };
};

const resolverTasa = async (): Promise<ResultadoTasa> => {
  if (cacheTasa && cacheTasa.vence > Date.now()) return cacheTasa.resultado;
  if (!calculoEnCurso) {
    calculoEnCurso = calcularTasa().finally(() => { calculoEnCurso = null; });
  }
  return calculoEnCurso;
};

const obtenerTasaBCV = async (): Promise<number> => (await resolverTasa()).tasa;

/* =====================================================================
   HISTORIAL
   ===================================================================== */

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

/* =====================================================================
   RUTAS
   ===================================================================== */

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

router.post('/cargar', async (req, res) => {
  try {
    const { codigo, proveedor, nombre, marca, estante, costo, venta, cantidad } = req.body;
    const sheet = await getSheet('Inventario');
    const rows = await sheet.getRows();
    const producto = rows.find((row: any) => row.get('CODIGO') === codigo);

    if (producto) {
      const nuevaExistencia = parseInt(producto.get('EXISTENCIA') || '0') + parseInt(cantidad);
      producto.set('EXISTENCIA', nuevaExistencia.toString());
      if (costo) producto.set('COSTO', costo);
      if (venta) producto.set('VENTA', venta);
      if (proveedor) producto.set('PROVEEDOR', proveedor);
      if (nombre) producto.set('NOMBRE', nombre);
      if (marca) producto.set('MARCA', marca);
      if (estante) producto.set('ESTANTE', estante);
      await producto.save();
      await guardarHistorial('Carga', codigo, cantidad, 'N/A', 0, 0, 0);
      res.json({ message: 'Stock actualizado', nuevaExistencia });
    } else {
      await sheet.addRow({
        CODIGO: codigo, PROVEEDOR: proveedor, NOMBRE: nombre, MARCA: marca, ESTANTE: estante, COSTO: costo, VENTA: venta, EXISTENCIA: cantidad
      });
      await guardarHistorial('Carga', codigo, cantidad, 'N/A', 0, 0, 0);
      res.json({ message: 'Producto nuevo cargado' });
    }
  } catch (error) { res.status(500).json({ error: 'Error al cargar' }); }
});

router.post('/vender', async (req, res) => {
  try {
    const { carrito, pagos } = req.body; 
    const sheet = await getSheet('Inventario');
    const rows = await sheet.getRows();
    
    for (const item of carrito) {
      const producto = rows.find((row: any) => row.get('CODIGO') === item.codigo);
      if (!producto) return res.status(404).json({ error: `Producto ${item.codigo} no encontrado` });
      const existenciaActual = parseInt(producto.get('EXISTENCIA') || '0');
      if (existenciaActual < parseInt(item.cantidad)) {
        return res.status(400).json({ error: `No hay stock suficiente de ${producto.get('NOMBRE')}` });
      }
    }

    const tasaBCV = await obtenerTasaBCV();
    if (!(tasaBCV > 0)) {
      return res.status(503).json({ error: 'No hay tasa BCV disponible. Ingrésala manualmente con el lápiz y vuelve a intentar.' });
    }

    let granTotalUSD = 0;
    let granTotalBS = 0;
    const pagoResumen = pagos.map((p: any) => `${p.metodo}: $${parseFloat(p.monto).toFixed(2).replace('.', ',')}`).join(' | ');

    for (let i = 0; i < carrito.length; i++) {
      const item = carrito[i];
      const producto = rows.find((row: any) => row.get('CODIGO') === item.codigo);
      const precioVenta = parseFloat(item.precio) || parseFloat(producto.get('VENTA') || '0');
      const cantidadVender = parseInt(item.cantidad);
      
      const totalUSD = precioVenta * cantidadVender;
      const totalBS = totalUSD * tasaBCV;
      
      granTotalUSD += totalUSD;
      granTotalBS += totalBS;

      const existenciaActual = parseInt(producto.get('EXISTENCIA') || '0');
      producto.set('EXISTENCIA', (existenciaActual - cantidadVender).toString());
      await producto.save();

      const pagoParaEstaFila = i === 0 ? pagoResumen : 'N/A';

      await guardarHistorial('Venta', item.codigo, item.cantidad, pagoParaEstaFila, tasaBCV, totalUSD, totalBS);
    }
    
    res.json({ message: 'Venta realizada con éxito', totalUSD: granTotalUSD, totalBS: granTotalBS, tasaBCV });
  } catch (error) { 
    console.error(error);
    res.status(500).json({ error: 'Error al procesar la venta' }); 
  }
});

router.get('/tasa', async (req, res) => {
  const r = await resolverTasa();
  res.json({ tasa: r.tasa, fuente: r.fuente, fechaTasa: r.fechaTasa });
});

router.post('/tasa-manual', async (req, res) => {
  const { nuevaTasa } = req.body;
  if (nuevaTasa) {
    try {
      const tasaNumerica = parseFloat(nuevaTasa.toString().replace(',', '.'));
      if (isNaN(tasaNumerica) || tasaNumerica <= 0) return res.status(400).json({ error: 'Tasa inválida' });

      const sheetConfig = await getSheet('Configuracion');
      const rows = await sheetConfig.getRows();
      const fecha = new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" });
      const tasaFormateada = tasaNumerica.toFixed(4).replace('.', ',');

      if (rows.length > 0) {
        rows[0].set('TasaManual', tasaFormateada);
        rows[0].set('Fecha', fecha);
        await rows[0].save();
      } else {
        await sheetConfig.addRow({ TasaManual: tasaFormateada, Fecha: fecha });
      }

      const sheetTasas = await getSheet('Tasas');
      await sheetTasas.addRow({ Fecha: fecha, Tasa: tasaFormateada, Usuario: 'Admin' });

      // Se borra la memoria para que la nueva tasa se use de inmediato
      cacheTasa = null;
      
      res.json({ message: 'Tasa guardada', tasa: tasaNumerica });
    } catch (error) {
      res.status(500).json({ error: 'Error al guardar en Sheets' });
    }
  } else { res.status(400).json({ error: 'Tasa inválida' }); }
});

router.get('/reporte', async (req, res) => {
  try {
    const fecha = req.query.fecha as string | undefined;
    const sheetHistorial = await getSheet('Historial');
    const rows = await sheetHistorial.getRows();
    
    // Fecha a consultar en formato AAAA-MM-DD
    const fechaISO = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : hoyISO();
    
    const ventasFiltradas = rows.filter((row: any) => {
      return (row.get('Tipo') || '') === 'Venta' && fechaAISO((row.get('Fecha') || '').toString()) === fechaISO;
    }).map((row: any) => ({
      Fecha: row.get('Fecha'),
      Codigo: row.get('Codigo'),
      Cantidad: row.get('Cantidad'),
      Pago: row.get('Pago'),
      TotalUSD: parseFloat((row.get('TotalUSD') || '0').toString().replace(',', '.')),
      TotalBS: parseFloat((row.get('TotalBS') || '0').toString().replace(',', '.'))
    }));

    // Tasa vigente ese día: la registrada ese día o, si no hay (fin de semana o feriado),
    // la más reciente anterior
    let tasaDelDia = 0;
    try {
      const historialTasas = await leerHistorialTasas();
      const registro = tasaVigenteEn(historialTasas, fechaISO);
      tasaDelDia = registro ? registro.tasa : await obtenerTasaBCV();
    } catch (e) {
      tasaDelDia = await obtenerTasaBCV();
    }

    const granTotalUSD = ventasFiltradas.reduce((acc: any, v: any) => acc + v.TotalUSD, 0);
    const granTotalBS = ventasFiltradas.reduce((acc: any, v: any) => acc + v.TotalBS, 0);

    const metodosMap: { [key: string]: { transacciones: number, usd: number, bs: number } } = {};

    ventasFiltradas.forEach((venta: any) => {
      if (venta.Pago && venta.Pago !== 'N/A' && venta.Pago.trim() !== '') {
        const pagosArray = venta.Pago.split(' | ');
        pagosArray.forEach((pagoStr: string) => {
          const [metodo, montoStr] = pagoStr.split(': $');
          if (metodo && montoStr) {
            const montoUSD = parseFloat(montoStr.replace(',', '.'));
            if (!metodosMap[metodo]) metodosMap[metodo] = { transacciones: 0, usd: 0, bs: 0 };
            
            metodosMap[metodo].transacciones += 1;
            metodosMap[metodo].usd += montoUSD;
            metodosMap[metodo].bs += (montoUSD * tasaDelDia);
          }
        });
      }
    });

    res.json({ ventas: ventasFiltradas, granTotalUSD, granTotalBS, desglosePagos: metodosMap, tasaDelDia });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
});

export default router;
