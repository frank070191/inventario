import express from 'express';
import { getSheet } from '../config/sheet.config.js';

const router = express.Router();

// Variable en memoria para guardar la tasa (por defecto busca la del BCV)
let tasaManualGlobal: number | null = null;

// Obtener tasa BCV (automática)
const obtenerTasaBCV = async () => {
  // Si el usuario ya ingresó una tasa manual, usamos esa
  if (tasaManualGlobal && tasaManualGlobal > 0) {
    return tasaManualGlobal;
  }

  try {
    const res = await fetch('https://www.bcv.org.ve/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      }
    });
    
    if (!res.ok) throw new Error('Error al conectar con el BCV');
    
    const html = await res.text();
    const match = html.match(/<div[^>]*id="dolar"[^>]*>[\s\S]*?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/);
    
    if (match && match[1]) {
      const tasaStr = match[1].replace(/\./g, '').replace(',', '.');
      const tasa = parseFloat(tasaStr);
      if (tasa > 100 && tasa < 2000) {
        console.log(`✅ Tasa BCV automática obtenida: ${tasa}`);
        return tasa;
      }
    }
    throw new Error('No se pudo extraer el valor');
    
  } catch (error) {
    console.error('⚠️ Error obteniendo tasa del BCV directo. Usando respaldo...');
    try {
      const resFallback = await fetch('https://allratestoday.com/api/open/central-bank/bcv?source=USD&target=VES');
      const data = await resFallback.json();
      return data.rate || 0;
    } catch (fallbackError) {
      return 0;
    }
  }
};

const guardarHistorial = async (tipo: string, codigo: string, cantidad: string, pagoResumen: string, tasa: number, totalUSD: number, totalBS: number) => {
  try {
    const sheetHistorial = await getSheet('Historial');
    const fecha = new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" }); 
    await sheetHistorial.addRow({
      Fecha: fecha, Tipo: tipo, Codigo: codigo, Cantidad: cantidad, Pago: pagoResumen, Tasa: tasa, TotalUSD: totalUSD, TotalBS: totalBS
    });
  } catch (error: any) {
    console.error('Error al guardar en historial:', error);
  }
};

router.get('/', async (req, res) => {
  try {
    const sheet = await getSheet('Inventario');
    const rows = await sheet.getRows();
    const data = rows.map((row: any) => ({
      Codigo: row.get('CODIGO'), Proveedor: row.get('PROVEEDOR') || '', Nombre: row.get('NOMBRE'),
      Marca: row.get('MARCA') || '', Estante: row.get('ESTANTE') || '', Costo: row.get('COSTO'),
      Venta: row.get('VENTA'), Existencia: row.get('EXISTENCIA')
    }));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al leer el inventario' });
  }
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
      res.json({ message: 'Stock actualizado correctamente', nuevaExistencia });
    } else {
      await sheet.addRow({
        CODIGO: codigo, PROVEEDOR: proveedor, NOMBRE: nombre, MARCA: marca, ESTANTE: estante, COSTO: costo, VENTA: venta, EXISTENCIA: cantidad
      });
      await guardarHistorial('Carga', codigo, cantidad, 'N/A', 0, 0, 0);
      res.json({ message: 'Producto nuevo cargado correctamente' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar mercancía' });
  }
});

router.post('/vender', async (req, res) => {
  try {
    const { codigo, cantidad, precioManual, pagos } = req.body; 
    const sheet = await getSheet('Inventario');
    const rows = await sheet.getRows();
    const producto = rows.find((row: any) => row.get('CODIGO') === codigo);

    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    const existenciaActual = parseInt(producto.get('EXISTENCIA') || '0');
    const cantidadVender = parseInt(cantidad);

    if (existenciaActual < cantidadVender) {
      return res.status(400).json({ error: 'No hay suficiente stock' });
    }

    const precioVenta = parseFloat(precioManual) || parseFloat(producto.get('VENTA') || '0');
    const totalUSD = precioVenta * cantidadVender;
    const tasaBCV = await obtenerTasaBCV();
    const totalBS = totalUSD * tasaBCV;

    const pagoResumen = pagos.map((p: any) => `${p.metodo}: $${parseFloat(p.monto).toFixed(2)}`).join(' | ');

    producto.set('EXISTENCIA', (existenciaActual - cantidadVender).toString());
    await producto.save();
    
    await guardarHistorial('Venta', codigo, cantidad, pagoResumen, tasaBCV, totalUSD, totalBS);
    
    res.json({ message: 'Venta realizada con éxito', stockRestante: existenciaActual - cantidadVender, totalUSD, totalBS, tasaBCV });
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar la venta' });
  }
});

// 4. OBTENER TASA DEL DÍA
router.get('/tasa', async (req, res) => {
    const tasa = await obtenerTasaBCV();
    res.json({ tasa });
});

// 5. NUEVA RUTA: ACTUALIZAR TASA MANUAL
router.post('/tasa-manual', (req, res) => {
  const { nuevaTasa } = req.body;
  if (nuevaTasa && !isNaN(nuevaTasa) && nuevaTasa > 0) {
    tasaManualGlobal = parseFloat(nuevaTasa);
    console.log(`⚠️ Tasa actualizada manualmente a: ${tasaManualGlobal}`);
    res.json({ message: 'Tasa actualizada manualmente', tasa: tasaManualGlobal });
  } else {
    res.status(400).json({ error: 'Tasa inválida' });
  }
});

export default router;