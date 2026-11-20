import express from 'express';
import { getSheet } from '../config/sheet.config.js';

const router = express.Router();

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
    console.error(error);
    res.status(500).json({ error: 'Error al leer el inventario' });
  }
});

// 2. CONSULTAR UN PRODUCTO POR CÓDIGO
router.get('/:codigo', async (req, res) => {
  try {
    const sheet = await getSheet('Inventario');
    const rows = await sheet.getRows();
    const producto = rows.find((row: any) => row.get('CODIGO') === req.params.codigo);
    
    if (producto) {
      res.json({
        Codigo: producto.get('CODIGO'),
        Nombre: producto.get('NOMBRE'),
        Venta: producto.get('VENTA'),
        Existencia: producto.get('EXISTENCIA')
      });
    } else {
      res.status(404).json({ error: 'Producto no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar' });
  }
});

// 3. CARGAR MERCANCÍA (Suma stock o crea uno nuevo)
router.post('/cargar', async (req, res) => {
  try {
    const { codigo, categoria, nombre, marca, costo, venta, cantidad } = req.body;
    const sheet = await getSheet('Inventario');
    const rows = await sheet.getRows();
    
    const producto = rows.find((row: any) => row.get('CODIGO') === codigo);

    if (producto) {
      const nuevaExistencia = parseInt(producto.get('EXISTENCIA') || '0') + parseInt(cantidad);
      producto.set('EXISTENCIA', nuevaExistencia.toString());
      await producto.save();
      res.json({ message: 'Stock actualizado correctamente', nuevaExistencia });
    } else {
      await sheet.addRow({
        CODIGO: codigo,
        CATEGORIA: categoria,
        NOMBRE: nombre,
        MARCA: marca,
        COSTO: costo,
        VENTA: venta,
        EXISTENCIA: cantidad
      });
      res.json({ message: 'Producto nuevo cargado correctamente' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cargar mercancía' });
  }
});

// 4. VENDER (Resta stock)
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
    
    res.json({ message: 'Venta realizada', stockRestante: existenciaActual - cantidadVender });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al procesar la venta' });
  }
});

export default router;