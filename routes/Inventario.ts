import express from 'express';
import { getSheet } from '../config/sheet.config.js';

const router = express.Router();

// Create
router.post('/', async (req, res) => {
  try {
    const sheet = await getSheet('Inventario');
    const newRow = await sheet.addRow(req.body);
    res.status(201).json({ message: 'Created successfully', data: req.body, id: newRow.rowIndex });
  } catch (error) {
    console.error('Error creating Inventario:', error);
    res.status(500).json({ error: 'Failed to create Inventario' });
  }
});

// Read all
router.get('/', async (req, res) => {
  try {
    const sheet = await getSheet('Inventario');
    const rows = await sheet.getRows();
    const data = rows.map ((row: any) => {
      const item: any = {};
      item['CODIGO'] = row.get('CODIGO');
      item['CATEGORIA'] = row.get('CATEGORIA');
      item['NOMBRE'] = row.get('NOMBRE');
      item['MARCA'] = row.get('MARCA');
      item['COSTO'] = row.get('COSTO');
      item['VENTA'] = row.get('VENTA');
      item['EXISTENCIA'] = row.get('EXISTENCIA');
      return item;
    });
    res.json(data);
  } catch (error) {
    console.error('Error fetching Inventario:', error);
    res.status(500).json({ error: 'Failed to fetch Inventario' });
  }
});

// Read one
router.get('/:id', async (req, res) => {
  try {
    const sheet = await getSheet('Inventario');
    const rows = await sheet.getRows();
    const rowIndex = parseInt(req.params.id);
    if (rowIndex < 0 || rowIndex >= rows.length) {
      return res.status(404).json({ error: 'Inventario not found' });
    }
    const row = rows[rowIndex];
    const item: any = {};
    item['CODIGO'] = row.get('CODIGO');
    item['CATEGORIA'] = row.get('CATEGORIA');
    item['NOMBRE'] = row.get('NOMBRE');
    item['MARCA'] = row.get('MARCA');
    item['COSTO'] = row.get('COSTO');
    item['VENTA'] = row.get('VENTA');
    item['EXISTENCIA'] = row.get('EXISTENCIA');
    res.json(item);
  } catch (error) {
    console.error('Error fetching Inventario:', error);
    res.status(500).json({ error: 'Failed to fetch Inventario' });
  }
});

// Update
router.put('/:id', async (req, res) => {
  try {
    const sheet = await getSheet('Inventario');
    const rows = await sheet.getRows();
    const rowIndex = parseInt(req.params.id);
    if (rowIndex < 0 || rowIndex >= rows.length) {
      return res.status(404).json({ error: 'Inventario not found' });
    }
    const row = rows[rowIndex];
    row.set('CODIGO', req.body['CODIGO']);
    row.set('CATEGORIA', req.body['CATEGORIA']);
    row.set('NOMBRE', req.body['NOMBRE']);
    row.set('MARCA', req.body['MARCA']);
    row.set('COSTO', req.body['COSTO']);
    row.set('VENTA', req.body['VENTA']);
    row.set('EXISTENCIA', req.body['EXISTENCIA']);
    await row.save();
    res.json({ message: 'Updated successfully', data: req.body });
  } catch (error) {
    console.error('Error updating Inventario:', error);
    res.status(500).json({ error: 'Failed to update Inventario' });
  }
});

// Delete
router.delete('/:id', async (req, res) => {
  try {
    const sheet = await getSheet('Inventario');
    const rows = await sheet.getRows();
    const rowIndex = parseInt(req.params.id);
    if (rowIndex < 0 || rowIndex >= rows.length) {
      return res.status(404).json({ error: 'Inventario not found' });
    }
    await rows[rowIndex].delete();
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting Inventario:', error);
    res.status(500).json({ error: 'Failed to delete Inventario' });
  }
});

export default router;
