import express from 'express';
import { getSheet } from '../config/sheet.config.js';

const router = express.Router();

// Obtener tasa BCV directamente del portal oficial (con fallback a AllRatesToday)
const obtenerTasaBCV = async () => {
  try {
    // 1. Intentamos leer directamente la página del BCV
    const res = await fetch('https://www.bcv.org.ve/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!res.ok) throw new Error('Error al conectar con el BCV');
    
    const html = await res.text();
    
    // 2. Buscamos el valor del dólar dentro del HTML
    const match = html.match(/id="dolar"[\s\S]*?<strong>\s*([\d.,]+)\s*<\/strong>/);
    
    if (match && match[1]) {
      // 3. Limpiamos el formato venezolano (ej. 919,8227 -> 919.8227)
      const tasaStr = match[1].replace(/\./g, '').replace(',', '.');
      const tasa = parseFloat(tasaStr);
      console.log(`✅ Tasa BCV oficial obtenida: ${tasa}`);
      return tasa;
    }
    throw new Error('No se pudo encontrar el valor en el HTML del BCV');
    
  } catch (error) {
    console.error('⚠️ Error obteniendo tasa del BCV directo:', error);
    
    // 4. Respaldo: Si el BCV falla, usamos AllRatesToday
    try {
      console.log('Intentando con API de respaldo (AllRatesToday)...');
      const resFallback = await fetch('https://allratestoday.com/api/open/central-bank/bcv?source=USD&target=VES');
      const data = await resFallback.json();
      return data.rate || 0;
    } catch (fallbackError) {
      console.error('❌ Error en API de respaldo:', fallbackError);
      return 0;
    }
  }
};

// Guardar en la hoja Historial con el resumen de pagos
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
      Tasa: tasa,
      TotalUSD: totalUSD,
      TotalBS: totalBS
    });
  } catch (error: any) {
    console.error('Error al guardar en historial:', error);
  }
};

// 1. CONSULTAR TODO EL INVENTARIO
router.get('/', async (req, res) => {
  try {
    const sheet = await getSheet('Inventario');
    const rows = await sheet.getRows();
    const data = rows.map((row: any) => ({
      Codigo: row.get('CODIGO'),
      Proveedor: row.get('PROVEEDOR') || '',
      Nombre: row.get('NOMBRE'),
      Marca: row.get('MARCA') || '',
      Estante: row.get('ESTANTE') || '',
      Costo: row.get('COSTO'),
      Venta: row.get('VENTA'),
      Existencia: row.get('EXISTENCIA')
    }));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al leer el inventario' });
  }
});

// 2. CARGAR MERCANCÍA
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

// 3. VENDER
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
    
    // Obtenemos la tasa vigente
    const tasaBCV = await obtenerTasaBCV();
    const totalBS = totalUSD * tasaBCV;

    // Creamos el resumen de pagos
    const pagoResumen = pagos.map((p: any) => `${p.metodo}: $${parseFloat(p.monto).toFixed(2)}`).join(' | ');

    producto.set('EXISTENCIA', (existenciaActual - cantidadVender).toString());
    await producto.save();
    
    await guardarHistorial('Venta', codigo, cantidad, pagoResumen, tasaBCV, totalUSD, totalBS);
    
    res.json({ 
      message: 'Venta realizada con éxito', 
      stockRestante: existenciaActual - cantidadVender, 
      totalUSD, 
      totalBS, 
      tasaBCV 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al procesar la venta' });
  }
});

// 4. OBTENER TASA DEL DÍA
router.get('/tasa', async (req, res) => {
    const tasa = await obtenerTasaBCV();
    res.json({ tasa });
});

export default router;