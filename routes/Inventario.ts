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

      // Solo guardamos el pago en la PRIMERA fila, el resto es N/A
      const pagoParaEstaFila = i === 0 ? pagoResumen : 'N/A';

      await guardarHistorial('Venta', item.codigo, item.cantidad, pagoParaEstaFila, tasaBCV, totalUSD, totalBS);
    }
    
    res.json({ message: 'Venta realizada con éxito', totalUSD: granTotalUSD, totalBS: granTotalBS, tasaBCV });
  } catch (error) { 
    console.error(error);
    res.status(500).json({ error: 'Error al procesar la venta' }); 
  }
});

router.get('/tasa', async (req, res) => { res.json({ tasa: await obtenerTasaBCV() }); });

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
    
    const fechaBuscar = fecha ? fecha.split('-').reverse().join('/') : new Date().toLocaleDateString("es-VE", { timeZone: "America/Caracas" });
    
    // Filtramos ventas del día
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

    const granTotalUSD = ventasFiltradas.reduce((acc: any, v: any) => acc + v.TotalUSD, 0);
    const granTotalBS = ventasFiltradas.reduce((acc: any, v: any) => acc + v.TotalBS, 0);

    const metodosMap: { [key: string]: { transacciones: number, usd: number, bs: number } } = {};
    const tasaHoy = await obtenerTasaBCV();

    ventasFiltradas.forEach((venta: any) => {
      // 🚨 FILTRO CLAVE: Si el pago es 'N/A', lo ignoramos para no duplicar
      if (venta.Pago && venta.Pago !== 'N/A' && venta.Pago.trim() !== '') {
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
      }
    });

    res.json({ ventas: ventasFiltradas, granTotalUSD, granTotalBS, desglosePagos: metodosMap });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
});

export default router;