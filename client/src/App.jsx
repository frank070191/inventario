import { useState, useEffect } from 'react';
import './App.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_URL = 'https://inventario-xp8l.onrender.com/api/inventario'; 
const METODOS_PAGO = ["T. Débito Bancamiga", "T. Crédito Banca", "PM Empresa", "PM Persona", "Biopago", "Transf Vzla", "Transf. Bancamiga", "T. Débito BNC", "T. Crédito BNC", "Cashea"];

const formatoMoneda = (numero) => {
  if (numero === null || numero === undefined || isNaN(parseFloat(numero))) return '0,00';
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(numero));
};

function App() {
  const [vista, setVista] = useState('consultar');
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mensaje, setMensaje] = useState('');
  
  const [tasa, setTasa] = useState(0);
  const [editandoTasa, setEditandoTasa] = useState(false);
  const [tasaManualInput, setTasaManualInput] = useState('');

  const [carga, setCarga] = useState({ codigo: '', proveedor: '', nombre: '', marca: '', estante: '', costo: '', venta: '', cantidad: '' });
  
  const [carrito, setCarrito] = useState([]);
  const [productoActual, setProductoActual] = useState({ codigo: '', cantidad: '', precio: '' });
  const [pagos, setPagos] = useState([{ metodo: METODOS_PAGO[0], monto: '' }]);

  const [reporte, setReporte] = useState(null);

  const consultar = async () => {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      setProductos(data);
    } catch (error) { setMensaje('Error al consultar.'); }
  };

  const obtenerTasa = async () => {
    try {
      const res = await fetch(`${API_URL}/tasa`);
      const data = await res.json();
      setTasa(data.tasa);
    } catch (error) { console.error('Error tasa'); }
  };

  const generarReporte = async () => {
    try {
      const res = await fetch(`${API_URL}/reporte-hoy`);
      const data = await res.json();
      setReporte(data);
    } catch (error) { setMensaje('Error al generar reporte'); }
  };

  const guardarTasaManual = async () => {
    try {
      const res = await fetch(`${API_URL}/tasa-manual`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nuevaTasa: tasaManualInput })
      });
      const data = await res.json();
      if (res.ok) {
        setTasa(data.tasa);
        setEditandoTasa(false);
        setMensaje(`Tasa actualizada a ${data.tasa.toFixed(4)} Bs/$`);
      } else { setMensaje(data.error); }
    } catch (error) { setMensaje('Error al guardar tasa'); }
  };

  useEffect(() => { consultar(); obtenerTasa(); }, []);
  useEffect(() => { if (vista === 'reporte') generarReporte(); }, [vista]);

  const handleCodigoCargaChange = (e) => {
    const codigo = e.target.value;
    const prod = productos.find(p => p.Codigo === codigo);
    if (prod) {
      setCarga({ ...carga, codigo, proveedor: prod.Proveedor || '', nombre: prod.Nombre || '', marca: prod.Marca || '', estante: prod.Estante || '', costo: prod.Costo || '', venta: prod.Venta || '', cantidad: '' });
    } else {
      setCarga({ codigo, proveedor: '', nombre: '', marca: '', estante: '', costo: '', venta: '', cantidad: '' });
    }
  };

  const cargarProducto = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/cargar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(carga) });
      const data = await res.json();
      setMensaje(data.message || data.error);
      setCarga({ codigo: '', proveedor: '', nombre: '', marca: '', estante: '', costo: '', venta: '', cantidad: '' });
      consultar(); 
    } catch (error) { setMensaje('Error al cargar.'); }
  };

  const handleCodigoVentaChange = (e) => {
    const codigo = e.target.value;
    const prod = productos.find(p => p.Codigo === codigo);
    if (prod) {
      setProductoActual({ codigo, cantidad: '', precio: prod.Venta ? prod.Venta.toString() : '' });
    } else {
      setProductoActual({ codigo, cantidad: '', precio: '' });
    }
  };

  const agregarAlCarrito = () => {
    if (!productoActual.codigo || !productoActual.cantidad || !productoActual.precio) return setMensaje('Completa los datos del producto.');
    
    const prodInfo = productos.find(p => p.Codigo === productoActual.codigo);
    if (!prodInfo) return setMensaje('Producto no existe.');

    if (parseInt(productoActual.cantidad) > parseInt(prodInfo.Existencia)) {
      return setMensaje(`Solo hay ${prodInfo.Existencia} unidades de ${prodInfo.Nombre}.`);
    }

    const existeIndex = carrito.findIndex(item => item.codigo === productoActual.codigo);
    if (existeIndex >= 0) {
      const nuevoCarrito = [...carrito];
      nuevoCarrito[existeIndex].cantidad = (parseInt(nuevoCarrito[existeIndex].cantidad) + parseInt(productoActual.cantidad)).toString();
      nuevoCarrito[existeIndex].precio = productoActual.precio;
      setCarrito(nuevoCarrito);
    } else {
      setCarrito([...carrito, { 
        codigo: productoActual.codigo, 
        nombre: prodInfo.Nombre, 
        cantidad: productoActual.cantidad, 
        precio: productoActual.precio 
      }]);
    }
    setProductoActual({ codigo: '', cantidad: '', precio: '' });
    setMensaje('');
  };

  const eliminarDelCarrito = (index) => {
    const nuevoCarrito = carrito.filter((_, i) => i !== index);
    setCarrito(nuevoCarrito);
  };

  const agregarPago = () => setPagos([...pagos, { metodo: METODOS_PAGO[0], monto: '' }]);
  const eliminarPago = (index) => { if (pagos.length > 1) setPagos(pagos.filter((_, i) => i !== index)); };
  const actualizarPago = (index, campo, valor) => { const nuevosPagos = [...pagos]; nuevosPagos[index][campo] = valor; setPagos(nuevosPagos); };

  const venderProducto = async (e) => {
    e.preventDefault();
    if (carrito.length === 0) return setMensaje('El carrito está vacío.');

    try {
      const pagosValidos = pagos.filter(p => p.monto && parseFloat(p.monto) > 0);
      if (pagosValidos.length === 0) return setMensaje('Debes ingresar al menos un monto de pago.');

      const body = { carrito, pagos: pagosValidos };
      const res = await fetch(`${API_URL}/vender`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      
      if (res.ok) {
        setMensaje(`${data.message} - Total: $${formatoMoneda(data.totalUSD)} / Bs. ${formatoMoneda(data.totalBS)}`);
        setCarrito([]);
        setPagos([{ metodo: METODOS_PAGO[0], monto: '' }]);
        consultar(); 
      } else {
        setMensaje(data.error);
      }
    } catch (error) { setMensaje('Error al vender.'); }
  };

  const descargarPDF = () => {
    if (!reporte) return;
    const doc = new jsPDF();
    doc.text('Reporte de Ventas del Día', 14, 15);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 22);
    doc.text(`Total ($): $${formatoMoneda(reporte.granTotalUSD)}`, 14, 29);
    doc.text(`Total (Bs): Bs. ${formatoMoneda(reporte.granTotalBS)}`, 14, 36);

    const pagosData = Object.entries(reporte.desglosePagos).map(([metodo, datos]) => [
      metodo, datos.transacciones.toString(), `$${formatoMoneda(datos.usd)}`, `Bs. ${formatoMoneda(datos.bs)}`
    ]);

    autoTable(doc, { startY: 45, head: [['Método de Pago', 'Transacciones', 'Monto ($)', 'Monto (Bs)']], body: pagosData, theme: 'grid' });

    const ventasData = reporte.ventas.map(v => [
      v.Fecha.split(', ')[1], v.Codigo, v.Cantidad, `$${formatoMoneda(v.TotalUSD)}`
    ]);

    autoTable(doc, { startY: doc.lastAutoTable.finalY + 10, head: [['Hora', 'Código', 'Cantidad', 'Total $']], body: ventasData, theme: 'grid' });

    doc.save(`Reporte_Ventas_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const totalVentaActual = carrito.reduce((acc, item) => acc + (parseFloat(item.precio) * parseInt(item.cantidad)), 0);
  const totalPagado = pagos.reduce((acc, pago) => acc + (parseFloat(pago.monto) || 0), 0);
  const restante = totalVentaActual - totalPagado;

  const productosFiltrados = productos.filter(p => p.Nombre && p.Nombre.toLowerCase().includes(busqueda.toLowerCase()));

  const styleBtnBase = { padding: '12px 24px', fontSize: '16px', fontWeight: 'bold', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1, minWidth: '45%', marginBottom: '5px' };
  const styleBtnBlue = { ...styleBtnBase, backgroundColor: '#007bff', boxShadow: '0 6px 0 #0056b3' };
  const styleBtnGreen = { ...styleBtnBase, backgroundColor: '#28a745', boxShadow: '0 6px 0 #1e7e34' };
  const styleBtnRed = { ...styleBtnBase, backgroundColor: '#dc3545', boxShadow: '0 6px 0 #a71d2a' };
  const styleBtnPurple = { ...styleBtnBase, backgroundColor: '#6f42c1', boxShadow: '0 6px 0 #4e2a8e' };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '0 auto', padding: '10px' }}>
      <h1 style={{ textAlign: 'center', color: '#2c3e50', textTransform: 'uppercase' }}>Sistema de Inventario</h1>
      
      <div style={{ textAlign: 'center', marginBottom: '20px', fontWeight: 'bold', color: '#2c3e50', fontSize: '14px' }}>
        Tasa BCV: <span style={{ color: '#28a745' }}>{tasa ? `${tasa.toFixed(4)} Bs/$` : '...'}</span>
        {!editandoTasa ? (
          <button onClick={() => setEditandoTasa(true)} style={{ marginLeft: '10px', padding: '5px', fontSize: '12px', cursor: 'pointer', borderRadius: '5px', border: '1px solid #ccc' }}>✏️</button>
        ) : (
          <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '5px' }}>
            <input type="text" value={tasaManualInput} onChange={e => setTasaManualInput(e.target.value)} style={{ padding: '5px', width: '100px', borderRadius: '5px', border: '1px solid #ccc' }} />
            <button onClick={guardarTasaManual} style={{ padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' }}>OK</button>
            <button onClick={() => setEditandoTasa(false)} style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px' }}>X</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button onClick={() => setVista('consultar')} style={styleBtnBlue}>Consultar</button>
        <button onClick={() => setVista('cargar')} style={styleBtnGreen}>Cargar</button>
        <button onClick={() => setVista('vender')} style={styleBtnRed}>Vender</button>
        <button onClick={() => setVista('reporte')} style={styleBtnPurple}>Reporte</button>
      </div>

      {mensaje && <div style={{ backgroundColor: '#d1ecf1', color: '#0c5460', padding: '15px', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', marginBottom: '20px' }}>{mensaje}</div>}

      {vista === 'consultar' && (
        <div>
          <input type="text" placeholder="🔍 Buscar producto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }}/>
          <div style={{ backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
              <thead style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                <tr><th style={{ textAlign: 'left', padding: '10px' }}>Código</th><th style={{ textAlign: 'left', padding: '10px' }}>Nombre</th><th style={{ textAlign: 'left', padding: '10px' }}>Marca</th><th style={{ textAlign: 'center', padding: '10px' }}>Estante</th><th style={{ textAlign: 'right', padding: '10px' }}>Precio</th><th style={{ textAlign: 'center', padding: '10px' }}>Stock</th></tr>
              </thead>
              <tbody>
                {productosFiltrados.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ textAlign: 'left', fontSize: '12px', padding: '10px' }}>{p.Codigo}</td>
                    <td style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '12px', padding: '10px' }}>{p.Nombre}</td>
                    <td style={{ textAlign: 'left', fontSize: '12px', padding: '10px' }}>{p.Marca}</td>
                    <td style={{ textAlign: 'center', fontSize: '12px', padding: '10px' }}>{p.Estante}</td>
                    <td style={{ textAlign: 'right', color: '#28a745', fontWeight: 'bold', fontSize: '12px', padding: '10px' }}>${formatoMoneda(p.Venta)}</td>
                    <td style={{ textAlign: 'center', fontSize: '12px', padding: '10px' }}>{p.Existencia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {vista === 'cargar' && (
        <form onSubmit={cargarProducto} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h2 style={{textAlign: 'center', color: '#2c3e50'}}>Ingresar Mercancía</h2>
          <input placeholder="Código" value={carga.codigo} onChange={handleCodigoCargaChange} required style={{padding: '10px', borderRadius: '5px', border: '1px solid #ccc'}} />
          <input placeholder="Proveedor" value={carga.proveedor} onChange={e => setCarga({...carga, proveedor: e.target.value})} style={{padding: '10px', borderRadius: '5px', border: '1px solid #ccc'}} />
          <input placeholder="Nombre" value={carga.nombre} onChange={e => setCarga({...carga, nombre: e.target.value})} required style={{padding: '10px', borderRadius: '5px', border: '1px solid #ccc'}} />
          <input placeholder="Marca" value={carga.marca} onChange={e => setCarga({...carga, marca: e.target.value})} style={{padding: '10px', borderRadius: '5px', border: '1px solid #ccc'}} />
          <input placeholder="Estante" value={carga.estante} onChange={e => setCarga({...carga, estante: e.target.value})} style={{padding: '10px', borderRadius: '5px', border: '1px solid #ccc'}} />
          <div style={{display: 'flex', gap: '10px'}}>
            <input placeholder="Costo ($)" type="number" value={carga.costo} onChange={e => setCarga({...carga, costo: e.target.value})} style={{width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc'}} />
            <input placeholder="Venta ($)" type="number" value={carga.venta} onChange={e => setCarga({...carga, venta: e.target.value})} style={{width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc'}} />
          </div>
          <input placeholder="Cantidad a SUMAR" type="number" value={carga.cantidad} onChange={e => setCarga({...carga, cantidad: e.target.value})} required style={{padding: '10px', borderRadius: '5px', border: '1px solid #ccc'}} />
          <button type="submit" style={styleBtnGreen}>Guardar</button>
        </form>
      )}

      {vista === 'vender' && (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{textAlign: 'center', color: '#2c3e50', marginTop: 0}}>Registrar Venta</h2>
          
          <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Añadir Producto</h4>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              <input placeholder="Código" value={productoActual.codigo} onChange={handleCodigoVentaChange} style={{flex: 2, padding: '8px', minWidth: '100px'}} />
              <input placeholder="Cant." type="number" value={productoActual.cantidad} onChange={e => setProductoActual({...productoActual, cantidad: e.target.value})} style={{flex: 1, padding: '8px', minWidth: '60px'}} />
              <input placeholder="Precio $" type="number" value={productoActual.precio} onChange={e => setProductoActual({...productoActual, precio: e.target.value})} style={{flex: 1, padding: '8px', minWidth: '80px', border: productoActual.precio ? '2px solid #28a745' : '2px solid #dc3545'}} />
              <button onClick={agregarAlCarrito} style={{ padding: '8px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
            </div>
            {productoActual.codigo && (
               <p style={{margin: '5px 0 0 0', fontSize: '12px', color: '#666'}}>
                 <strong>{productos.find(p => p.Codigo === productoActual.codigo)?.Nombre}</strong> 
                 {productos.find(p => p.Codigo === productoActual.codigo)?.Venta && ` (Precio ref: $${productos.find(p => p.Codigo === productoActual.codigo)?.Venta})`}
               </p>
            )}
          </div>

          <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                <tr><th style={{textAlign: 'left', padding: '8px'}}>Producto</th><th style={{textAlign: 'center', padding: '8px'}}>Cant</th><th style={{textAlign: 'right', padding: '8px'}}>Precio</th><th style={{textAlign: 'right', padding: '8px'}}>Subtotal</th><th></th></tr>
              </thead>
              <tbody>
                {carrito.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{padding: '8px'}}>{item.nombre}</td>
                    <td style={{textAlign: 'center', padding: '8px'}}>{item.cantidad}</td>
                    <td style={{textAlign: 'right', padding: '8px'}}>${formatoMoneda(item.precio)}</td>
                    <td style={{textAlign: 'right', padding: '8px', fontWeight: 'bold'}}>${formatoMoneda(item.precio * item.cantidad)}</td>
                    <td style={{textAlign: 'center', padding: '8px'}}><button type="button" onClick={() => eliminarDelCarrito(i)} style={{backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer'}}>X</button></td>
                  </tr>
                ))}
                {carrito.length === 0 && <tr><td colSpan="5" style={{textAlign: 'center', padding: '10px'}}>Carrito vacío</td></tr>}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
            <h4 style={{ margin: '0 0 10px 0', textAlign: 'center', color: '#2c3e50' }}>Pagos</h4>
            {pagos.map((pago, index) => (
              <div key={index} style={{ display: 'flex', gap: '5px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={pago.metodo} onChange={e => actualizarPago(index, 'metodo', e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '5px', border: '1px solid #ccc', minWidth: '150px' }}>
                  {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input type="number" placeholder="$ Monto" value={pago.monto} onChange={e => actualizarPago(index, 'monto', e.target.value)} style={{ width: '100px', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }} />
                {pagos.length > 1 && (
                  <button type="button" onClick={() => eliminarPago(index)} style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px', borderRadius: '5px' }}>X</button>
                )}
              </div>
            ))}
            <button type="button" onClick={agregarPago} style={{ backgroundColor: '#007bff', color: 'white', border: 'none', padding: '8px', borderRadius: '5px', fontSize: '12px', width: '100%' }}>
              + Agregar otro pago
            </button>
          </div>

          {totalVentaActual > 0 && (
            <div style={{ textAlign: 'center', marginTop: '20px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '8px' }}>
              <p style={{ margin: '5px 0', fontWeight: 'bold', color: '#2c3e50', fontSize: '18px' }}>
                Total: ${formatoMoneda(totalVentaActual)} <br/>
                <span style={{ color: '#28a745', fontSize: '16px' }}>Bs. {formatoMoneda(totalVentaActual * tasa)}</span>
              </p>
              <hr style={{ border: '0.5px solid #ccc', margin: '10px 0' }} />
              <p style={{ margin: '5px 0', fontWeight: 'bold', color: restante > 0 ? '#dc3545' : '#28a745', fontSize: '16px' }}>
                {restante > 0 ? `Falta por cobrar: $${formatoMoneda(restante)}` : `Vuelto: $${formatoMoneda(Math.abs(restante))}`}
              </p>
            </div>
          )}

          <button onClick={venderProducto} style={{...styleBtnRed, width: '100%', marginTop: '15px'}}>Procesar Venta</button>
        </div>
      )}

      {vista === 'reporte' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{color: '#2c3e50', margin: 0}}>Reporte de Ventas de Hoy</h2>
            {reporte && <button onClick={descargarPDF} style={{ padding: '10px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>📄 Descargar PDF</button>}
          </div>
          {!reporte ? ( <p style={{textAlign: 'center'}}>Cargando reporte...</p> ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ backgroundColor: '#e9ecef', padding: '15px', borderRadius: '8px', borderLeft: '5px solid #28a745', textAlign: 'center', flex: 1, minWidth: '150px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Total ($)</p>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#28a745' }}>${formatoMoneda(reporte.granTotalUSD)}</p>
                </div>
                <div style={{ backgroundColor: '#e9ecef', padding: '15px', borderRadius: '8px', borderLeft: '5px solid #28a745', textAlign: 'center', flex: 1, minWidth: '150px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Total (Bs)</p>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#28a745' }}>Bs. {formatoMoneda(reporte.granTotalBS)}</p>
                </div>
              </div>
              <div style={{ backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', overflowX: 'auto', marginBottom: '20px' }}>
                <h3 style={{ padding: '10px', margin: 0, backgroundColor: '#f8f9fa', fontSize: '16px' }}>Pagos Recibidos</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '350px' }}>
                  <thead style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Método</th>
                      <th style={{ textAlign: 'center', padding: '10px' }}>Transacciones</th>
                      <th style={{ textAlign: 'right', padding: '10px' }}>Monto ($)</th>
                      <th style={{ textAlign: 'right', padding: '10px' }}>Monto (Bs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(reporte.desglosePagos).map(([metodo, datos], i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ textAlign: 'left', fontSize: '12px', padding: '10px' }}>{metodo}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', padding: '10px', backgroundColor: '#f1f1f1' }}>{datos.transacciones}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '12px', padding: '10px' }}>${formatoMoneda(datos.usd)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '12px', color: '#28a745', padding: '10px' }}>Bs. {formatoMoneda(datos.bs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
                <h3 style={{ padding: '10px', margin: 0, backgroundColor: '#f8f9fa', fontSize: '16px' }}>Detalle de Ventas</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '400px' }}>
                  <thead style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                    <tr><th style={{ textAlign: 'left', padding: '10px' }}>Hora</th><th style={{ textAlign: 'left', padding: '10px' }}>Código</th><th style={{ textAlign: 'center', padding: '10px' }}>Cant</th><th style={{ textAlign: 'right', padding: '10px' }}>Total $</th></tr>
                  </thead>
                  <tbody>
                    {reporte.ventas.map((v, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ textAlign: 'left', fontSize: '11px', padding: '10px' }}>{v.Fecha.split(', ')[1]}</td>
                        <td style={{ textAlign: 'left', fontSize: '11px', padding: '10px' }}>{v.Codigo}</td>
                        <td style={{ textAlign: 'center', fontSize: '11px', padding: '10px' }}>{v.Cantidad}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '11px', padding: '10px' }}>${formatoMoneda(v.TotalUSD)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;