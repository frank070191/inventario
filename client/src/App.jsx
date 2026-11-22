import { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'https://inventario-xp8l.onrender.com/api/inventario';
const METODOS_PAGO = ["T. Débito Bancamiga", "T. Crédito Banca", "PM Empresa", "PM Persona", "Biopago", "Transf Vzla", "Transf. Bancamiga", "T. Débito BNC", "T. Crédito BNC", "Cashea"];

function App() {
  const [vista, setVista] = useState('consultar');
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [tasa, setTasa] = useState(0);

  const [carga, setCarga] = useState({ codigo: '', proveedor: '', nombre: '', marca: '', estante: '', costo: '', venta: '', cantidad: '' });
  
  // Estados de venta actualizados
  const [venta, setVenta] = useState({ codigo: '', cantidad: '', precioManual: '' });
  const [infoVenta, setInfoVenta] = useState(null);
  // Lista de pagos (inicia con uno solo)
  const [pagos, setPagos] = useState([{ metodo: METODOS_PAGO[0], monto: '' }]);

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

  useEffect(() => { consultar(); obtenerTasa(); }, []);

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

  // --- LÓGICA PARA PAGOS MÚLTIPLES ---
  const agregarPago = () => {
    setPagos([...pagos, { metodo: METODOS_PAGO[0], monto: '' }]);
  };

  const eliminarPago = (index) => {
    if (pagos.length > 1) {
      const nuevosPagos = pagos.filter((_, i) => i !== index);
      setPagos(nuevosPagos);
    }
  };

  const actualizarPago = (index, campo, valor) => {
    const nuevosPagos = [...pagos];
    nuevosPagos[index][campo] = valor;
    setPagos(nuevosPagos);
  };

  const venderProducto = async (e) => {
    e.preventDefault();
    try {
      // Validar que al menos se haya ingresado un monto válido
      const pagosValidos = pagos.filter(p => p.monto && parseFloat(p.monto) > 0);
      if (pagosValidos.length === 0) {
        return setMensaje('Debes ingresar al menos un monto de pago.');
      }

      const body = { ...venta, pagos: pagosValidos };
      const res = await fetch(`${API_URL}/vender`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      
      setMensaje(`${data.message || data.error} - Total: $${data.totalUSD?.toFixed(2)} / Bs. ${data.totalBS?.toFixed(2)}`);
      
      // Limpiar formulario
      setVenta({ codigo: '', cantidad: '', precioManual: '' });
      setPagos([{ metodo: METODOS_PAGO[0], monto: '' }]);
      setInfoVenta(null);
      consultar(); 
    } catch (error) { setMensaje('Error al vender.'); }
  };

  const productosFiltrados = productos.filter(p => p.Nombre && p.Nombre.toLowerCase().includes(busqueda.toLowerCase()));

  // Calcular el total actual de la venta para mostrarlo
  const precioVentaActual = parseFloat(venta.precioManual) || parseFloat(infoVenta?.Venta || 0);
  const totalVentaActual = precioVentaActual * (parseInt(venta.cantidad) || 0);

  return (
    <div className="container">
      <h1>Sistema de Inventario</h1>
      
      <div style={{ textAlign: 'center', marginBottom: '20px', fontWeight: 'bold', color: '#2c3e50' }}>
        Tasa BCV del día: <span style={{ color: '#28a745' }}>{tasa ? `${tasa.toFixed(2)} Bs/$` : 'Cargando...'}</span>
      </div>

      <div className="menu-botones">
        <button onClick={() => setVista('consultar')} className="btn-3d btn-blue">Consultar</button>
        <button onClick={() => setVista('cargar')} className="btn-3d btn-green">Cargar</button>
        <button onClick={() => setVista('vender')} className="btn-3d btn-red">Vender</button>
      </div>

      {mensaje && <div className="mensaje-alerta">{mensaje}</div>}

      {vista === 'consultar' && (
        <div>
          <input type="text" placeholder="🔍 Buscar producto por nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '8px', border: '1px solid #ccc' }}/>
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Código</th>
                  <th style={{ textAlign: 'left' }}>Nombre</th>
                  <th style={{ textAlign: 'left' }}>Marca</th>
                  <th style={{ textAlign: 'center' }}>Estante</th>
                  <th className="texto-derecha">Precio Venta</th>
                  <th className="texto-centro">Existencia</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.map((p, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'left' }}>{p.Codigo}</td>
                    <td style={{ textAlign: 'left', fontWeight: 'bold' }}>{p.Nombre}</td>
                    <td style={{ textAlign: 'left' }}>{p.Marca}</td>
                    <td style={{ textAlign: 'center' }}>{p.Estante}</td>
                    <td className="texto-derecha" style={{color: '#28a745', fontWeight: 'bold'}}>${p.Venta}</td>
                    <td className="texto-centro">{p.Existencia}</td>
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
          <button type="submit" className="btn-3d btn-green" style={{marginTop: '10px'}}>Guardar / Actualizar</button>
        </form>
      )}

      {vista === 'vender' && (
        <form onSubmit={venderProducto} className="formulario">
          <h2 style={{textAlign: 'center', color: '#2c3e50'}}>Registrar Venta</h2>
          <input placeholder="Código del Producto" value={venta.codigo} onChange={handleCodigoVentaChange} required />
          
          {infoVenta && (
            <div className="caja-info">
              <p><strong>Producto:</strong> {infoVenta.Nombre}</p>
              <p><strong>Stock actual:</strong> {infoVenta.Existencia} unidades</p>
            </div>
          )}

          <label style={{fontSize: '12px', color: '#666'}}>Precio de Venta Unitario (USD):</label>
          <input type="number" placeholder={`Por defecto: $${infoVenta?.Venta || '0'}`} value={venta.precioManual} onChange={e => setVenta({...venta, precioManual: e.target.value})} />

          <input placeholder="Cantidad a Vender" type="number" value={venta.cantidad} onChange={e => setVenta({...venta, cantidad: e.target.value})} required />
          
          {/* SECCIÓN DE PAGOS MÚLTIPLES */}
          <div style={{ marginTop: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
            <h4 style={{ margin: '0 0 10px 0', textAlign: 'center', color: '#2c3e50' }}>Métodos de Pago Recibidos</h4>
            {pagos.map((pago, index) => (
              <div key={index} style={{ display: 'flex', gap: '5px', marginBottom: '10px', alignItems: 'center' }}>
                <select value={pago.metodo} onChange={e => actualizarPago(index, 'metodo', e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}>
                  {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input 
                  type="number" placeholder="$ Monto" value={pago.monto} 
                  onChange={e => actualizarPago(index, 'monto', e.target.value)} 
                  style={{ width: '100px', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
                />
                {pagos.length > 1 && (
                  <button type="button" onClick={() => eliminarPago(index)} style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px', borderRadius: '5px', cursor: 'pointer' }}>X</button>
                )}
              </div>
            ))}
            <button type="button" onClick={agregarPago} style={{ backgroundColor: '#007bff', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>
              + Agregar otro método de pago
            </button>
          </div>

          {totalVentaActual > 0 && (
            <div style={{ textAlign: 'center', fontWeight: 'bold', marginTop: '10px', color: '#2c3e50' }}>
              Total de Venta: ${totalVentaActual.toFixed(2)} <br/>
              <span style={{ color: '#28a745' }}>Bs. {(totalVentaActual * tasa).toFixed(2)}</span>
            </div>
          )}

          <button type="submit" className="btn-3d btn-red" style={{marginTop: '10px'}}>Vender</button>
        </form>
      )}
    </div>
  );
}

export default App;