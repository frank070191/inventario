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
  const [menuAbierto, setMenuAbierto] = useState(true);
  
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
  const [fechaReporte, setFechaReporte] = useState(new Date().toISOString().split('T')[0]);
  const [tipoReporte, setTipoReporte] = useState('monetario');

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

  const generarReporte = async (fecha) => {
    try {
      const res = await fetch(`${API_URL}/reporte?fecha=${fecha}`);
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
  
  useEffect(() => { 
    if (vista === 'reporte') generarReporte(fechaReporte); 
  }, [vista]);

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

  let totalPagosUSD = 0;
  let totalPagosBS = 0;
  if (reporte && reporte.desglosePagos) {
    Object.values(reporte.desglosePagos).forEach((datos) => {
      totalPagosUSD += datos.usd;
      totalPagosBS += datos.bs;
    });
  }

  const ventasConDetalles = reporte && reporte.ventas ? reporte.ventas.map(venta => {
    const prodInfo = productos.find(p => p.Codigo === venta.Codigo);
    return {
      ...venta,
      Nombre: prodInfo ? prodInfo.Nombre : 'Desconocido',
      Proveedor: prodInfo ? prodInfo.Proveedor : 'Desconocido'
    };
  }) : [];

  const descargarPDF = () => {
    if (!reporte) return;
    const doc = new jsPDF();
    doc.text('Reporte de Ventas', 14, 15);
    doc.text(`Fecha: ${fechaReporte.split('-').reverse().join('/')}`, 14, 22);

    if (tipoReporte === 'monetario') {
      doc.text(`Tasa del Día: ${formatoMoneda(reporte.tasaDelDia)} Bs/$`, 14, 29);
      doc.text(`Total ($): $${formatoMoneda(totalPagosUSD)}`, 14, 36);
      doc.text(`Total (Bs): Bs. ${formatoMoneda(totalPagosBS)}`, 14, 43);

      const pagosData = Object.entries(reporte.desglosePagos).map(([metodo, datos]) => [
        metodo, datos.transacciones.toString(), `$${formatoMoneda(datos.usd)}`, `Bs. ${formatoMoneda(datos.bs)}`
      ]);
      autoTable(doc, { startY: 50, head: [['Método', 'Transacciones', 'Monto ($)', 'Monto (Bs)']], body: pagosData, theme: 'grid' });
    } else {
      const productosData = ventasConDetalles.map(v => [ v.Codigo, v.Nombre, v.Proveedor, v.Cantidad ]);
      autoTable(doc, { startY: 29, head: [['Código', 'Nombre', 'Proveedor', 'Cantidad']], body: productosData, theme: 'grid' });
    }

    doc.save(`Reporte_${tipoReporte}_${fechaReporte}.pdf`);
  };

  const totalVentaActual = carrito.reduce((acc, item) => acc + (parseFloat(item.precio) * parseInt(item.cantidad)), 0);
  const totalPagado = pagos.reduce((acc, pago) => acc + (parseFloat(pago.monto) || 0), 0);
  const restante = totalVentaActual - totalPagado;

  const productosFiltrados = productos.filter(p => p.Nombre && p.Nombre.toLowerCase().includes(busqueda.toLowerCase()));

  // Producto que se está escribiendo en la pantalla de venta (para mostrar nombre y precio de referencia)
  const prodVentaActual = productoActual.codigo ? productos.find(p => p.Codigo === productoActual.codigo) : null;

  return (
    <div className="app-container">
      
      {/* BARRA LATERAL */}
      <div className={`sidebar ${menuAbierto ? '' : 'cerrado'}`}>
        <div className="sidebar-header">
          {menuAbierto && <h2>Menú</h2>}
          <button className="toggle-btn" onClick={() => setMenuAbierto(!menuAbierto)}>
            {menuAbierto ? '◀' : '▶'}
          </button>
        </div>
        <div className="menu-items">
          <button onClick={() => setVista('consultar')} className={`menu-btn ${vista === 'consultar' ? 'activo' : ''}`}>
            <span style={{ fontSize: '20px' }}>🔍</span> <span>Consultar</span>
          </button>
          <button onClick={() => setVista('cargar')} className={`menu-btn ${vista === 'cargar' ? 'activo' : ''}`}>
            <span style={{ fontSize: '20px' }}>📦</span> <span>Cargar</span>
          </button>
          <button onClick={() => setVista('vender')} className={`menu-btn ${vista === 'vender' ? 'activo' : ''}`}>
            <span style={{ fontSize: '20px' }}>🛒</span> <span>Vender</span>
          </button>
          <button onClick={() => setVista('reporte')} className={`menu-btn ${vista === 'reporte' ? 'activo' : ''}`}>
            <span style={{ fontSize: '20px' }}>📊</span> <span>Reportes</span>
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="main-content">
        <h1>Sistema de Inventario</h1>
        
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

        {mensaje && <div className="mensaje-alerta">{mensaje}</div>}

        {vista === 'consultar' && (
          <div>
            <input type="text" placeholder="🔍 Buscar producto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }}/>
            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr><th style={{ textAlign: 'left', padding: '10px' }}>Código</th><th style={{ textAlign: 'left', padding: '10px' }}>Nombre</th><th style={{ textAlign: 'left', padding: '10px' }}>Marca</th><th style={{ textAlign: 'center', padding: '10px' }}>Estante</th><th style={{ textAlign: 'right', padding: '10px' }}>Precio</th><th style={{ textAlign: 'center', padding: '10px' }}>Stock</th></tr>
                </thead>
                <tbody>
                  {productosFiltrados.map((p, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: 'left', fontSize: '12px' }}>{p.Codigo}</td>
                      <td style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '12px' }}>{p.Nombre}</td>
                      <td style={{ textAlign: 'left', fontSize: '12px' }}>{p.Marca}</td>
                      <td className="texto-centro" style={{ fontSize: '12px' }}>{p.Estante}</td>
                      <td className="texto-derecha" style={{ color: '#28a745', fontWeight: 'bold', fontSize: '12px' }}>${formatoMoneda(p.Venta)}</td>
                      <td className="texto-centro" style={{ fontSize: '12px' }}>{p.Existencia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {vista === 'cargar' && (
          <form onSubmit={cargarProducto} className="formulario">
            <h2 style={{textAlign: 'center', color: '#2c3e50'}}>Ingresar Mercancía</h2>
            <input placeholder="Código" value={carga.codigo} onChange={handleCodigoCargaChange} required />
            <input placeholder="Proveedor" value={carga.proveedor} onChange={e => setCarga({...carga, proveedor: e.target.value})} />
            <input placeholder="Nombre" value={carga.nombre} onChange={e => setCarga({...carga, nombre: e.target.value})} required />
            <input placeholder="Marca" value={carga.marca} onChange={e => setCarga({...carga, marca: e.target.value})} />
            <input placeholder="Estante" value={carga.estante} onChange={e => setCarga({...carga, estante: e.target.value})} />
            <div style={{display: 'flex', gap: '10px'}}>
              <input placeholder="Costo ($)" type="number" value={carga.costo} onChange={e => setCarga({...carga, costo: e.target.value})} style={{width: '100%'}} />
              <input placeholder="Venta ($)" type="number" value={carga.venta} onChange={e => setCarga({...carga, venta: e.target.value})} style={{width: '100%'}} />
            </div>
            <input placeholder="Cantidad a SUMAR" type="number" value={carga.cantidad} onChange={e => setCarga({...carga, cantidad: e.target.value})} required />
            <button type="submit" className="btn-accion" style={{backgroundColor: '#28a745'}}>Guardar</button>
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

              {/* INFO DEL PRODUCTO (nombre, precio de referencia y stock) */}
              {productoActual.codigo && (
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#666' }}>
                  {prodVentaActual ? (
                    <>
                      <strong style={{ color: '#2c3e50' }}>{prodVentaActual.Nombre}</strong>
                      {prodVentaActual.Venta ? ` (Precio ref: $${formatoMoneda(prodVentaActual.Venta)})` : ''}
                      {` — Stock: ${prodVentaActual.Existencia}`}
                    </>
                  ) : (
                    <span style={{ color: '#dc3545' }}>Código no encontrado</span>
                  )}
                </p>
              )}
            </div>

            <div className="tabla-contenedor" style={{marginBottom: '20px'}}>
              <table style={{minWidth: 'auto'}}>
                <thead>
                  <tr><th style={{textAlign: 'left'}}>Producto</th><th style={{textAlign: 'center'}}>Cant</th><th style={{textAlign: 'right'}}>Precio</th><th style={{textAlign: 'right'}}>Subtotal</th><th></th></tr>
                </thead>
                <tbody>
                  {carrito.map((item, i) => (
                    <tr key={i}>
                      <td style={{fontSize: '12px'}}>{item.nombre}</td>
                      <td className="texto-centro" style={{fontSize: '12px'}}>{item.cantidad}</td>
                      <td className="texto-derecha" style={{fontSize: '12px'}}>${formatoMoneda(item.precio)}</td>
                      <td className="texto-derecha" style={{fontWeight: 'bold', fontSize: '12px'}}>${formatoMoneda(item.precio * item.cantidad)}</td>
                      <td style={{textAlign: 'center'}}><button type="button" onClick={() => eliminarDelCarrito(i)} style={{backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer'}}>X</button></td>
                    </tr>
                  ))}
                  {carrito.length === 0 && <tr><td colSpan="5" className="texto-centro">Carrito vacío</td></tr>}
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

            <button onClick={venderProducto} className="btn-accion" style={{backgroundColor: '#dc3545', width: '100%', marginTop: '15px'}}>Procesar Venta</button>
          </div>
        )}

        {vista === 'reporte' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <h2 style={{color: '#2c3e50', margin: 0}}>Reportes</h2>
              
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input 
                  type="date" 
                  value={fechaReporte} 
                  onChange={e => {
                    setFechaReporte(e.target.value);
                    generarReporte(e.target.value);
                  }} 
                  style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
                />
                {reporte && <button onClick={descargarPDF} className="btn-accion" style={{backgroundColor: '#dc3545'}}>📄 PDF</button>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center' }}>
              <button onClick={() => setTipoReporte('monetario')} style={{ padding: '10px 20px', borderRadius: '5px', border: 'none', backgroundColor: tipoReporte === 'monetario' ? '#2c3e50' : '#ccc', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Reporte Monetario</button>
              <button onClick={() => setTipoReporte('productos')} style={{ padding: '10px 20px', borderRadius: '5px', border: 'none', backgroundColor: tipoReporte === 'productos' ? '#2c3e50' : '#ccc', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Reporte de Productos</button>
            </div>
            
            {!reporte ? ( <p style={{textAlign: 'center'}}>Cargando reporte...</p> ) : (
              <>
                {tipoReporte === 'monetario' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ backgroundColor: '#e9ecef', padding: '15px', borderRadius: '8px', borderLeft: '5px solid #28a745', textAlign: 'center', flex: 1, minWidth: '150px' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Tasa del Día</p>
                        <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#2c3e50' }}>{formatoMoneda(reporte.tasaDelDia)} Bs/$</p>
                      </div>
                      <div style={{ backgroundColor: '#e9ecef', padding: '15px', borderRadius: '8px', borderLeft: '5px solid #28a745', textAlign: 'center', flex: 1, minWidth: '150px' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Total Pagado ($)</p>
                        <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#28a745' }}>${formatoMoneda(totalPagosUSD)}</p>
                      </div>
                      <div style={{ backgroundColor: '#e9ecef', padding: '15px', borderRadius: '8px', borderLeft: '5px solid #28a745', textAlign: 'center', flex: 1, minWidth: '150px' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Total Pagado (Bs)</p>
                        <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#28a745' }}>Bs. {formatoMoneda(totalPagosBS)}</p>
                      </div>
                    </div>
                    <div className="tabla-contenedor">
                      <h3 style={{ padding: '10px', margin: 0, backgroundColor: '#f8f9fa', fontSize: '16px' }}>Pagos Recibidos</h3>
                      <table>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left' }}>Método</th>
                            <th style={{ textAlign: 'center' }}>Transacciones</th>
                            <th style={{ textAlign: 'right' }}>Monto ($)</th>
                            <th style={{ textAlign: 'right' }}>Monto (Bs)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(reporte.desglosePagos).map(([metodo, datos], i) => (
                            <tr key={i}>
                              <td style={{ textAlign: 'left', fontSize: '12px' }}>{metodo}</td>
                              <td className="texto-centro" style={{ fontWeight: 'bold', backgroundColor: '#f1f1f1', fontSize: '12px' }}>{datos.transacciones}</td>
                              <td className="texto-derecha" style={{ fontWeight: 'bold', fontSize: '12px' }}>${formatoMoneda(datos.usd)}</td>
                              <td className="texto-derecha" style={{ fontWeight: 'bold', color: '#28a745', fontSize: '12px' }}>Bs. {formatoMoneda(datos.bs)}</td>
                            </tr>
                          ))}
                          {Object.keys(reporte.desglosePagos).length === 0 && (
                            <tr><td colSpan="4" className="texto-centro">No hay pagos en esta fecha.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="tabla-contenedor">
                    <h3 style={{ padding: '10px', margin: 0, backgroundColor: '#f8f9fa', fontSize: '16px' }}>Productos Vendidos</h3>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Código</th>
                          <th style={{ textAlign: 'left' }}>Nombre</th>
                          <th style={{ textAlign: 'left' }}>Proveedor</th>
                          <th style={{ textAlign: 'center' }}>Cantidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ventasConDetalles.map((v, i) => (
                          <tr key={i}>
                            <td style={{ textAlign: 'left', fontSize: '12px' }}>{v.Codigo}</td>
                            <td style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '12px' }}>{v.Nombre}</td>
                            <td style={{ textAlign: 'left', fontSize: '12px' }}>{v.Proveedor}</td>
                            <td className="texto-centro" style={{ fontWeight: 'bold', fontSize: '12px' }}>{v.Cantidad}</td>
                          </tr>
                        ))}
                        {ventasConDetalles.length === 0 && (
                          <tr><td colSpan="4" className="texto-centro">No hay ventas de productos en esta fecha.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;