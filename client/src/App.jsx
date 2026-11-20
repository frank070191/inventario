import { useState, useEffect } from 'react';
import './App.css'; // <-- Importamos los nuevos estilos

const API_URL = 'https://inventario-xp8l.onrender.com/api/inventario'; // Tu URL real

function App() {
  const [vista, setVista] = useState('consultar');
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mensaje, setMensaje] = useState('');

  const [carga, setCarga] = useState({ codigo: '', categoria: '', nombre: '', marca: '', costo: '', venta: '', cantidad: '' });
  const [venta, setVenta] = useState({ codigo: '', cantidad: '' });
  const [infoVenta, setInfoVenta] = useState(null);

  const consultar = async () => {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      setProductos(data);
    } catch (error) {
      setMensaje('Error al consultar.');
    }
  };

  useEffect(() => { consultar(); }, []);

  const handleCodigoCargaChange = (e) => {
    const codigo = e.target.value;
    const prod = productos.find(p => p.Codigo === codigo);

    if (prod) {
      setCarga({
        ...carga, codigo: codigo, categoria: prod.Categoria || '', nombre: prod.Nombre || '',
        marca: prod.Marca || '', costo: prod.Costo || '', venta: prod.Venta || '', cantidad: '' 
      });
    } else {
      setCarga({ codigo, categoria: '', nombre: '', marca: '', costo: '', venta: '', cantidad: '' });
    }
  };

  const cargarProducto = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/cargar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(carga)
      });
      const data = await res.json();
      setMensaje(data.message || data.error);
      setCarga({ codigo: '', categoria: '', nombre: '', marca: '', costo: '', venta: '', cantidad: '' });
      consultar(); 
    } catch (error) { setMensaje('Error al cargar.'); }
  };

  const handleCodigoVentaChange = (e) => {
    const codigo = e.target.value;
    setVenta({ ...venta, codigo: codigo });
    const prod = productos.find(p => p.Codigo === codigo);
    setInfoVenta(prod || null);
  };

  const venderProducto = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/vender`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(venta)
      });
      const data = await res.json();
      setMensaje(data.message || data.error);
      setVenta({ codigo: '', cantidad: '' });
      setInfoVenta(null);
      consultar(); 
    } catch (error) { setMensaje('Error al vender.'); }
  };

  const productosFiltrados = productos.filter(p => 
    p.Nombre && p.Nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="container">
      <h1>Sistema de Inventario</h1>
      
      <div className="menu-botones">
        <button onClick={() => setVista('consultar')} className="btn-3d btn-blue">Consultar</button>
        <button onClick={() => setVista('cargar')} className="btn-3d btn-green">Cargar</button>
        <button onClick={() => setVista('vender')} className="btn-3d btn-red">Vender</button>
      </div>

      {mensaje && <div className="mensaje-alerta">{mensaje}</div>}

      {vista === 'consultar' && (
        <div>
          <input 
            type="text" placeholder="🔍 Buscar producto por nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} 
            style={{ width: '100%', padding: '12px', marginBottom: '20px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #ccc', fontSize: '16px' }}
          />
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th className="texto-centro">Código</th>
                  <th>Nombre</th>
                  <th className="texto-derecha">Precio Venta</th>
                  <th className="texto-centro">Existencia</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.map((p, i) => (
                  <tr key={i}>
                    <td className="texto-centro">{p.Codigo}</td>
                    <td style={{fontWeight: 'bold', color: '#2c3e50'}}>{p.Nombre}</td>
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
          <h2 style={{textAlign: 'center', margin: '0 0 10px 0', color: '#2c3e50'}}>Ingresar Mercancía</h2>
          <input placeholder="Código" value={carga.codigo} onChange={handleCodigoCargaChange} required />
          <input placeholder="Categoría" value={carga.categoria} onChange={e => setCarga({...carga, categoria: e.target.value})} />
          <input placeholder="Nombre" value={carga.nombre} onChange={e => setCarga({...carga, nombre: e.target.value})} required />
          <input placeholder="Marca" value={carga.marca} onChange={e => setCarga({...carga, marca: e.target.value})} />
          <div style={{display: 'flex', gap: '10px'}}>
            <input placeholder="Costo" type="number" value={carga.costo} onChange={e => setCarga({...carga, costo: e.target.value})} style={{width: '100%'}} />
            <input placeholder="Precio Venta" type="number" value={carga.venta} onChange={e => setCarga({...carga, venta: e.target.value})} style={{width: '100%'}} />
          </div>
          <input placeholder="Cantidad a SUMAR" type="number" value={carga.cantidad} onChange={e => setCarga({...carga, cantidad: e.target.value})} required />
          <button type="submit" className="btn-3d btn-green" style={{marginTop: '10px'}}>Guardar / Actualizar</button>
        </form>
      )}

      {vista === 'vender' && (
        <form onSubmit={venderProducto} className="formulario">
          <h2 style={{textAlign: 'center', margin: '0 0 10px 0', color: '#2c3e50'}}>Registrar Venta</h2>
          <input placeholder="Código del Producto" value={venta.codigo} onChange={handleCodigoVentaChange} required />
          
          {infoVenta && (
            <div className="caja-info">
              <p><strong>Producto:</strong> {infoVenta.Nombre}</p>
              <p><strong>Precio:</strong> ${infoVenta.Venta}</p>
              <p><strong>Stock actual:</strong> {infoVenta.Existencia} unidades</p>
            </div>
          )}

          <input placeholder="Cantidad a Vender" type="number" value={venta.cantidad} onChange={e => setVenta({...venta, cantidad: e.target.value})} required />
          <button type="submit" className="btn-3d btn-red" style={{marginTop: '10px'}}>Vender</button>
        </form>
      )}
    </div>
  );
}

export default App;