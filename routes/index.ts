import { Router } from 'express';

import InventarioRouter from './Inventario.js';
const router = Router();

// Health check route
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Import and use generated CRUD routes
// These will be automatically added by the CLI generator
// Example: router.use('/users', usersRouter);

  router.use('/Inventario', InventarioRouter);

// Default route
router.get('/', (req, res) => {
  res.json({
    message: 'Spreadsheet API is running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      docs: '/api-docs'
    }
  });
});

export default router;