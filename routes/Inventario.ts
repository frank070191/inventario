import express from 'express';
import { getSheet } from '../config/sheet.config.js';

const router = express.Router();

const obtenerTasaBCV = async () => {
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
    const data = await res.json();
    return data.promedio || 0; 
  } catch (error) {
    console.error('Error obteniendo tasa BCV:', error);
    return 0;
  }
};

// Modificamos para recibir un texto con el resumen de los pagos
const guardarHistorial = async (tipo: string, codigo: string, cantidad: string, pagoResumen: string, tasa: number, totalUSD: number, totalBS: number) => {
  try {
    const sheetHistorial = await getSheet('Historial');
    const fecha = new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" }); 
    await sheetHistorial.addRow({
      Fecha: fecha,
      Tipo: tipo,
      Codigo: codigo,
      Cantidad: cantidad,
      Pago: pagoResumen, // Aquí irá el resumen de todos los pagos
      Tasa: tasa,
      TotalUSD: totalUSD,
      TotalBS: totalBS
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
    const { codigo, cantidad, precioManual, pagos } = req.body; // Ahora recibimos 'pagos' como lista
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

    // Creamos un resumen en texto de los pagos recibidos
    // Ejemplo: "Biopago: $10.00 | PM Persona: $15.00"
    const pagoResumen = pagos.map((p: any) => `${p.metodo}: $${parseFloat(p.monto).toFixed(2)}`).join(' | ');

    producto.set('EXISTENCIA', (existenciaActual - cantidadVender).toString());
    await producto.save();
    
    await guardarHistorial('Venta', codigo, cantidad, pagoResumen, tasaBCV, totalUSD, totalBS);
    
    res.json({ message: 'Venta realizada con éxito', stockRestante: existenciaActual - cantidadVender, totalUSD, totalBS, tasaBCV });
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar la venta' });
  }
});

router.get('/tasa', async (req, res) => {
    const tasa = await obtenerTasaBCV();
    res.json({ tasa });
});

export default router;