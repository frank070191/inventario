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
      // Leemos el dato (ej. "919,8227") y lo convertimos a número (919.8227)
      return parseFloat(val.toString().replace(',', '.'));
    }
    return null;
  } catch (error) {
    return null;
  }
};

const obtenerTasaBCV = async () => {
  const tasaGuardada = await obtenerTasaManualGuardada();
  if (tasaGuardada && tasaGuardada > 0) return tasaGuardada;

  try {
    const res = await fetch('https://www.bcv.org.ve/', {
      headers: { 'User-Agent': 'Mozilla/5.0...' }
    });
    const html = await res.text();
    const match = html.match(/<div[^>]*id="dolar"[^>]*>[\s\S]*?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/);
    if (match && match[1]) {
      const tasaStr = match[1].replace(/\./g, '').replace(',', '.');
      const tasa = parseFloat(tasaStr);
      if (tasa > 100 && tasa < 2000) return tasa;
    }
    throw new Error('No se pudo extraer');
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
      Fecha: fecha, 
      Tipo: tipo, 
      Codigo: codigo, 
      Cantidad: cantidad, 
      Pago: pagoResumen, 
      // CONVERTIMOS EL PUNTO A COMA ANTES DE GUARDAR
      Tasa: tasa.toFixed(4).toString().replace('.', ','), 
      TotalUSD: totalUSD.toFixed(2).toString().replace('.', ','),
      TotalBS: totalBS.toFixed(2).toString().replace('.', ',')
    });
  } catch (error: any) { console.error('Error historial:', error); }
};

router.get('/', async (req, res) => { /* Lo mismo de antes */
  try {
    const sheet = await getSheet('Inventario');
    const rows = await sheet.getRows();
    const data = rows.map((row: any) => ({
      Codigo: row.get('CODIGO'), Proveedor: row.get('PROVEEDOR') || '', Nombre: row.get('NOMBRE'),
      Marca: row.get('MARCA') || '', Estante: row.get('ESTANTE') || '', Costo: row.get('COSTO'),
      Venta: row.get('VENTA'), Existencia: row.get('EXISTENCIA')
    }));
    res.json(data);
  } catch (error) { res.status(500).json({ error: 'Error al leer inventario' }); }
});

router.post('/cargar', async (req, res) => { /* Lo mismo de antes */
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

router.post('/vender', async (req, res) => { /* Lo mismo de antes */
  try {
    const { codigo, cantidad, precioManual, pagos } = req.body; 
    const sheet = await getSheet('Inventario');
    const rows = await sheet.getRows();
    const producto = rows.find((row: any) => row.get('CODIGO') === codigo);

    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    const existenciaActual = parseInt(producto.get('EXISTENCIA') || '0');
    const cantidadVender = parseInt(cantidad);

    if (existenciaActual < cantidadVender) return res.status(400).json({ error: 'No hay stock' });

    const precioVenta = parseFloat(precioManual) || parseFloat(producto.get('VENTA') || '0');
    const totalUSD = precioVenta * cantidadVender;
    const tasaBCV = await obtenerTasaBCV();
    const totalBS = totalUSD * tasaBCV;
    const pagoResumen = pagos.map((p: any) => `${p.metodo}: $${parseFloat(p.monto).toFixed(2).replace('.', ',')}`).join(' | ');

    producto.set('EXISTENCIA', (existenciaActual - cantidadVender).toString());
    await producto.save();
    await guardarHistorial('Venta', codigo, cantidad, pagoResumen, tasaBCV, totalUSD, totalBS);
    
    res.json({ message: 'Venta realizada', stockRestante: existenciaActual - cantidadVender, totalUSD, totalBS, tasaBCV });
  } catch (error) { res.status(500).json({ error: 'Error al vender' }); }
});

router.get('/tasa', async (req, res) => { res.json({ tasa: await obtenerTasaBCV() }); });

router.post('/tasa-manual', async (req, res) => {
  const { nuevaTasa } = req.body;
  if (nuevaTasa) {
    try {
      // El frontend puede enviar "919,8227" o "919.8227". Lo estandarizamos a número.
      const tasaNumerica = parseFloat(nuevaTasa.toString().replace(',', '.'));
      
      if (isNaN(tasaNumerica) || tasaNumerica <= 0) {
        return res.status(400).json({ error: 'Tasa inválida' });
      }

      const sheetConfig = await getSheet('Configuracion');
      const rows = await sheetConfig.getRows();
      const fecha = new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" });
      
      // GUARDAMOS CON COMA PARA QUE GOOGLE SHEETS LO LEA BIEN
      const tasaFormateada = tasaNumerica.toFixed(4).replace('.', ',');

      if (rows.length > 0) {
        // Si ya existe una fila, la actualizamos (No borra la hoja, solo el dato)
        rows[0].set('TasaManual', tasaFormateada);
        rows[0].set('Fecha', fecha);
        await rows[0].save();
      } else {
        await sheetConfig.addRow({ TasaManual: tasaFormateada, Fecha: fecha });
      }
      
      res.json({ message: 'Tasa guardada', tasa: tasaNumerica });
    } catch (error) {
      res.status(500).json({ error: 'Error al guardar en Sheets' });
    }
  } else { res.status(400).json({ error: 'Tasa inválida' }); }
});

router.get('/reporte-hoy', async (req, res) => {
  try {
    const sheetHistorial = await getSheet('Historial');
    const rows = await sheetHistorial.getRows();
    const hoy = new Date().toLocaleDateString("es-VE", { timeZone: "America/Caracas" });
    
    const ventasHoy = rows.filter((row: any) => {
      return (row.get('Tipo') || '') === 'Venta' && (row.get('Fecha') || '').startsWith(hoy);
    }).map((row: any) => ({
      Fecha: row.get('Fecha'),
      Codigo: row.get('Codigo'),
      Cantidad: row.get('Cantidad'),
      Pago: row.get('Pago'),
      // Al leer, convertimos la coma de vuelta a punto para que JS haga los cálculos
      TotalUSD: parseFloat((row.get('TotalUSD') || '0').toString().replace(',', '.')),
      TotalBS: parseFloat((row.get('TotalBS') || '0').toString().replace(',', '.'))
    }));

    const granTotalUSD = ventasHoy.reduce((acc: any, v: any) => acc + v.TotalUSD, 0);
    const granTotalBS = ventasHoy.reduce((acc: any, v: any) => acc + v.TotalBS, 0);

    const metodosMap: { [key: string]: { usd: number, bs: number } } = {};
    const tasaHoy = await obtenerTasaBCV();

    ventasHoy.forEach((venta: any) => {
      const pagosArray = venta.Pago.split(' | ');
      pagosArray.forEach((pagoStr: string) => {
        const [metodo, montoStr] = pagoStr.split(': $');
        if (metodo && montoStr) {
          const montoUSD = parseFloat(montoStr.replace(',', '.'));
          if (!metodosMap[metodo]) metodosMap[metodo] = { usd: 0, bs: 0 };
          metodosMap[metodo].usd += montoUSD;
          metodosMap[metodo].bs += (montoUSD * tasaHoy);
        }
      });
    });

    res.json({
      ventas: ventasHoy,
      granTotalUSD,
      granTotalBS,
      desglosePagos: metodosMap
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
});

export default router;