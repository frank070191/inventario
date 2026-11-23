import { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'https://inventario-xp8l.onrender.com/api/inventario'; // Asegúrate de que sea tu URL
const METODOS_PAGO = ["T. Débito Bancamiga", "T. Crédito Banca", "PM Empresa", "PM Persona", "Biopago", "Transf Vzla", "Transf. Bancamiga", "T. Débito BNC", "T. Crédito BNC", "Cashea"];

function App() {
  const [vista, setVista] = useState('consultar');
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mensaje, setMensaje] = useState('');
  
  const [tasa, setTasa] = useState(0);
  const [editandoTasa, setEditandoTasa] = useState(false);
  const [tasaManualInput, setTasaManualInput] = useState('');

  const [carga, setCarga] = useState({ codigo: '', proveedor: '', nombre: '', marca: '', estante: '', costo: '', venta: '', cantidad: '' });
  const [venta, setVenta] = useState({ codigo: '', cantidad: '', precioManual: '' });
  const [infoVenta, setInfoVenta] = useState(null);
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
      setTasaManualInput(data.tasa.toString());
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
        setMensaje(`Tasa actualizada a ${data.tasa} Bs/$`);
      }
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
    setVenta({ ...venta, codigo: codigo, precioManual: '' });
    const prod = productos.find(p => p.Codigo === codigo);
    setInfoVenta(prod || null);
  };

  const agregarPago = () => setPagos([...pagos, { metodo: METODOS_PAGO[0], monto: '' }]);
  const eliminarPago = (index) => { if (pagos.length > 1) setPagos(pagos.filter((_, i) => i !== index)); };
  const actualizarPago = (index, campo, valor) => { const nuevosPagos = [...pagos]; nuevosPagos[index][campo] = valor; setPagos(nuevosPagos); };

  const venderProducto = async (e) => {
    e.preventDefault();
    try {
      const pagosValidos = pagos.filter(p => p.monto && parseFloat(p.monto) > 0);
      if (pagosValidos.length === 0) return setMensaje('Debes ingresar al menos un monto de pago.');

      const body = { ...venta, pagos: pagosValidos };
      const res = await fetch(`${API_URL}/vender`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      
      setMensaje(`${data.message || data.error} - Total: $${data.totalUSD?.toFixed(2)} / Bs. ${data.totalBS?.toFixed(2)}`);
      
      setVenta({ codigo: '', cantidad: '', precioManual: '' });
      setPagos([{ metodo: METODOS_PAGO[0], monto: '' }]);
      setInfoVenta(null);
      consultar(); 
    } catch (error) { setMensaje('Error al vender.'); }
  };

  const productosFiltrados = productos.filter(p => p.Nombre && p.Nombre.toLowerCase().includes(busqueda.toLowerCase()));

  const precioVentaActual = parseFloat(venta.precioManual) || parseFloat(infoVenta?.Venta || 0);
  const totalVentaActual = precioVentaActual * (parseInt(venta.cantidad) || 0);
  const totalPagado = pagos.reduce((acc, pago) => acc + (parseFloat(pago.monto) || 0), 0);
  const restante = totalVentaActual - totalPagado;

  // Estilos inline para forzar el diseño 3D y responsive
  const styleBtnBase = { padding: '12px 24px', fontSize: '16px', fontWeight: 'bold', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1, minWidth: '45%', marginBottom: '5px' };
  const styleBtnBlue = { ...styleBtnBase, backgroundColor: '#007bff', boxShadow: '0 6px 0 #0056b3' };
  const styleBtnGreen = { ...styleBtnBase, backgroundColor: '#28a745', boxShadow: '0 6px 0 #1e7e34' };
  const styleBtnRed = { ...styleBtnBase, backgroundColor: '#dc3545', boxShadow: '0 6px 0 #a71d2a' };
  const styleBtnPurple = { ...styleBtnBase, backgroundColor: '#6f42c1', boxShadow: '0 6px 0 #4e2a8e' };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '0 auto', padding: '10px' }}>
      <h1 style={{ textAlign: 'center', color: '#2c3e50', textTransform: 'uppercase' }}>Sistema de Inventario</h1>
      
      <div style={{ textAlign: 'center', marginBottom: '20px', fontWeight: 'bold', color: '#2c3e50', fontSize: '14px' }}>
        Tasa BCV: <span style={{ color: '#28a745' }}>{tasa ? `${tasa.toFixed(2)} Bs/$` : '...'}</span>
        {!editandoTasa ? (
          <button onClick={() => setEditandoTasa(true)} style={{ marginLeft: '10px', padding: '5px', fontSize: '12px', cursor: 'pointer', borderRadius: '5px', border: '1px solid #ccc' }}>✏️</button>
        ) : (
          <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '5px' }}>
            <input type="number" value={tasaManualInput} onChange={e => setTasaManualInput(e.target.value)} style={{ padding: '5px', width: '80px', borderRadius: '5px', border: '1px solid #ccc' }} />
            <button onClick={guardarTasaManual} style={{ padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' }}>OK</button>
            <button onClick={() => setEditandoTasa(false)} style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px' }}>X</button>
          </div>
        )}
      </div>

      {/* MENÚ CON ESTILOS INLINE FORZADOS */}
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
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Código</th>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Nombre</th>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Marca</th>
                  <th style={{ textAlign: 'center', padding: '10px' }}>Estante</th>
                  <th style={{ textAlign: 'right', padding: '10px' }}>Precio</th>
                  <th style={{ textAlign: 'center', padding: '10px' }}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ textAlign: 'left', fontSize: '12px', padding: '10px' }}>{p.Codigo}</td>
                    <td style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '12px', padding: '10px' }}>{p.Nombre}</td>
                    <td style={{ textAlign: 'left', fontSize: '12px', padding: '10px' }}>{p.Marca}</td>
                    <td style={{ textAlign: 'center', fontSize: '12px', padding: '10px' }}>{p.Estante}</td>
                    <td style={{ textAlign: 'right', color: '#28a745', fontWeight: 'bold', fontSize: '12px', padding: '10px' }}>${p.Venta}</td>
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
        <form onSubmit={venderProducto} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h2 style={{textAlign: 'center', color: '#2c3e50'}}>Registrar Venta</h2>
          <input placeholder="Código del Producto" value={venta.codigo} onChange={handleCodigoVentaChange} required style={{padding: '10px', borderRadius: '5px', border: '1px solid #ccc'}} />
          
          {infoVenta && (
            <div style={{ backgroundColor: '#e9ecef', padding: '10px', borderRadius: '5px', borderLeft: '5px solid #007bff' }}>
              <p style={{fontSize: '14px', margin: '5px 0'}}><strong>Producto:</strong> {infoVenta.Nombre}</p>
              <p style={{fontSize: '14px', margin: '5px 0'}}><strong>Stock:</strong> {infoVenta.Existencia} unds</p>
            </div>
          )}

          <label style={{fontSize: '12px', color: '#666'}}>Precio Unitario (USD):</label>
          <input type="number" placeholder={`Por defecto: $${infoVenta?.Venta || '0'}`} value={venta.precioManual} onChange={e => setVenta({...venta, precioManual: e.target.value})} style={{padding: '10px', borderRadius: '5px', border: '1px solid #ccc'}} />

          <input placeholder="Cantidad a Vender" type="number" value={venta.cantidad} onChange={e => setVenta({...venta, cantidad: e.target.value})} required style={{padding: '10px', borderRadius: '5px', border: '1px solid #ccc'}} />
          
          <div style={{ marginTop: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
            <h4 style={{ margin: '0 0 10px 0', textAlign: 'center', color: '#2c3e50' }}>Pagos</h4>
            {pagos.map((pago, index) => (
              <div key={index} style={{ display: 'flex', gap: '5px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={pago.metodo} onChange={e => actualizarPago(index, 'metodo', e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '5px', border: '1px solid #ccc', minWidth: '150px' }}>
                  {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input type="number" placeholder="$ Monto" value={pago.monto} onChange={e => actualizarPago(index, 'monto', e.target.value)} style={{ width: '80px', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }} />
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
            <div style={{ textAlign: 'center', marginTop: '10px', padding: '10px', backgroundColor: '#e9ecef', borderRadius: '8px' }}>
              <p style={{ margin: '5px 0', fontWeight: 'bold', color: '#2c3e50', fontSize: '14px' }}>
                Total: ${totalVentaActual.toFixed(2)} <br/>
                <span style={{ color: '#28a745' }}>Bs. {(totalVentaActual * tasa).toFixed(2)}</span>
              </p>
              <hr style={{ border: '0.5px solid #ccc', margin: '5px 0' }} />
              <p style={{ margin: '5px 0', fontWeight: 'bold', color: restante > 0 ? '#dc3545' : '#28a745', fontSize: '14px' }}>
                {restante > 0 ? `Falta: $${restante.toFixed(2)}` : `Vuelto: $${Math.abs(restante).toFixed(2)}`}
              </p>
            </div>
          )}

          <button type="submit" style={styleBtnRed}>Vender</button>
        </form>
      )}

      {vista === 'reporte' && (
        <div>
          <h2 style={{textAlign: 'center', color: '#2c3e50'}}>Reporte de Ventas de Hoy</h2>
          {!reporte ? (
            <p style={{textAlign: 'center'}}>Cargando reporte...</p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ backgroundColor: '#e9ecef', padding: '15px', borderRadius: '8px', borderLeft: '5px solid #28a745', textAlign: 'center', flex: 1, minWidth: '150px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Total ($)</p>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#28a745' }}>${reporte.granTotalUSD.toFixed(2)}</p>
                </div>
                <div style={{ backgroundColor: '#e9ecef', padding: '15px', borderRadius: '8px', borderLeft: '5px solid #28a745', textAlign: 'center', flex: 1, minWidth: '150px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Total (Bs)</p>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#28a745' }}>Bs. {reporte.granTotalBS.toFixed(2)}</p>
                </div>
              </div>

              <div style={{ backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', overflowX: 'auto', marginBottom: '20px' }}>
                <h3 style={{ padding: '10px', margin: 0, backgroundColor: '#f8f9fa', fontSize: '16px' }}>Pagos Recibidos</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '300px' }}>
                  <thead style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Método</th>
                      <th style={{ textAlign: 'right', padding: '10px' }}>Monto ($)</th>
                      <th style={{ textAlign: 'right', padding: '10px' }}>Monto (Bs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(reporte.desglosePagos).map(([metodo, montos], i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ textAlign: 'left', fontSize: '12px', padding: '10px' }}>{metodo}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '12px', padding: '10px' }}>${montos.usd.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '12px', color: '#28a745', padding: '10px' }}>Bs. {montos.bs.toFixed(2)}</td>
                      </tr>
                    ))}
                    {Object.keys(reporte.desglosePagos).length === 0 && (
                      <tr><td colSpan="3" style={{textAlign: 'center', padding: '10px'}}>No hay ventas registradas hoy.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
                <h3 style={{ padding: '10px', margin: 0, backgroundColor: '#f8f9fa', fontSize: '16px' }}>Detalle de Ventas</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '400px' }}>
                  <thead style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Hora</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Código</th>
                      <th style={{ textAlign: 'center', padding: '10px' }}>Cant</th>
                      <th style={{ textAlign: 'right', padding: '10px' }}>Total $</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporte.ventas.map((v, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ textAlign: 'left', fontSize: '11px', padding: '10px' }}>{v.Fecha.split(', ')[1]}</td>
                        <td style={{ textAlign: 'left', fontSize: '11px', padding: '10px' }}>{v.Codigo}</td>
                        <td style={{ textAlign: 'center', fontSize: '11px', padding: '10px' }}>{v.Cantidad}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '11px', padding: '10px' }}>${v.TotalUSD.toFixed(2)}</td>
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