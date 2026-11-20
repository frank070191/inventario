import express from 'express';
import { getSheet } from '../config/sheet.config.js';

const router = express.Router();

// Función auxiliar para guardar en la pestaña Historial
const guardarHistorial = async (tipo: string, codigo: string, cantidad: string) => {
  try {
    const sheetHistorial = await getSheet('Historial');
    const fecha = new Date().toLocaleString();
    await sheetHistorial.addRow({
      Fecha: fecha,
      Tipo: tipo,
      Codigo: codigo,
      Cantidad: cantidad
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
      Categoria: row.get('CATEGORIA'),
      Nombre: row.get('NOMBRE'),
      Marca: row.get('MARCA'),
      Costo: row.get('COSTO'),
      Venta: row.get('VENTA'),
      Existencia: row.get('EXISTENCIA')
    }));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al leer el inventario' });
  }
});

// 2. CARGAR MERCANCÍA (Suma stock o actualiza precios si ya existe)
router.post('/cargar', async (req, res) => {
  try {
    const { codigo, categoria, nombre, marca, costo, venta, cantidad } = req.body;
    const sheet = await getSheet('Inventario');
    const rows = await sheet.getRows();
    
    const producto = rows.find((row: any) => row.get('CODIGO') === codigo);

    if (producto) {
      // Si el producto ya existe, sumamos la cantidad
      const nuevaExistencia = parseInt(producto.get('EXISTENCIA') || '0') + parseInt(cantidad);
      producto.set('EXISTENCIA', nuevaExistencia.toString());
      
      // Y actualizamos los precios si es que se enviaron nuevos
      if (costo) producto.set('COSTO', costo);
      if (venta) producto.set('VENTA', venta);
      // (Opcional) Actualizar otros campos si vienen en el formulario
      if (categoria) producto.set('CATEGORIA', categoria);
      if (nombre) producto.set('NOMBRE', nombre);
      if (marca) producto.set('MARCA', marca);

      await producto.save();
      await guardarHistorial('Carga', codigo, cantidad);
      res.json({ message: 'Stock y precios actualizados correctamente', nuevaExistencia });
    } else {
      // Si es nuevo, lo creamos
      await sheet.addRow({
        CODIGO: codigo, CATEGORIA: categoria, NOMBRE: nombre, MARCA: marca, COSTO: costo, VENTA: venta, EXISTENCIA: cantidad
      });
      await guardarHistorial('Carga', codigo, cantidad);
      res.json({ message: 'Producto nuevo cargado correctamente' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cargar mercancía' });
  }
});

// 3. VENDER
router.post('/vender', async (req, res) => {
  try {
    const { codigo, cantidad } = req.body;
    const sheet = await getSheet('Inventario');
    const rows = await sheet.getRows();
    
    const producto = rows.find((row: any) => row.get('CODIGO') === codigo);

    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    const existenciaActual = parseInt(producto.get('EXISTENCIA') || '0');
    const cantidadVender = parseInt(cantidad);

    if (existenciaActual < cantidadVender) {
      return res.status(400).json({ error: 'No hay suficiente stock' });
    }

    producto.set('EXISTENCIA', (existenciaActual - cantidadVender).toString());
    await producto.save();
    await guardarHistorial('Venta', codigo, cantidad);
    res.json({ message: 'Venta realizada', stockRestante: existenciaActual - cantidadVender });
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar la venta' });
  }
});

export default router;