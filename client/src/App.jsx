import { useState } from 'react';

// ⚠️ CAMBIA ESTO POR LA URL DE TU BACKEND EN RENDER
const API_URL = 'https://inventario-xp8l.onrender.com/api/inventario';

function App() {
  const [vista, setVista] = useState('consultar');
  const [productos, setProductos] = useState([]);
  const [mensaje, setMensaje] = useState('');

  // --- FORMULARIO DE CARGA ---
  const [carga, setCarga] = useState({ codigo: '', categoria: '', nombre: '', marca: '', costo: '', venta: '', cantidad: '' });

  // --- FORMULARIO DE VENTA ---
  const [venta, setVenta] = useState({ codigo: '', cantidad: '' });

  // 1. CONSULTAR INVENTARIO
  const consultar = async () => {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      setProductos(data);
      setMensaje('');
    } catch (error) {
      setMensaje('Error al consultar. Verifica que el backend esté despierto.');
    }
  };

  // 2. CARGAR MERCANCÍA
  const cargarProducto = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/cargar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(carga)
      });
      const data = await res.json();
      setMensaje(data.message || data.error);
      setCarga({ codigo: '', categoria: '', nombre: '', marca: '', costo: '', venta: '', cantidad: '' });
    } catch (error) {
      setMensaje('Error al cargar el producto.');
    }
  };

  // 3. VENDER
  const venderProducto = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/vender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(venta)
      });
      const data = await res.json();
      setMensaje(data.message || data.error);
      setVenta({ codigo: '', cantidad: '' });
    } catch (error) {
      setMensaje('Error al procesar la venta.');
    }
  };

  return (
    <div style={{ fontFamily: 'Arial', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center' }}>Sistema de Inventario</h1>
      
      {/* MENÚ DE NAVEGACIÓN */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => setVista('consultar')} style={{ padding: '10px', cursor: 'pointer' }}>Consultar</button>
        <button onClick={() => setVista('cargar')} style={{ padding: '10px', cursor: 'pointer' }}>Cargar Mercancía</button>
        <button onClick={() => setVista('vender')} style={{ padding: '10px', cursor: 'pointer' }}>Vender</button>
      </div>

      {mensaje && <p style={{ color: 'blue', fontWeight: 'bold' }}>{mensaje}</p>}

      {/* VISTA CONSULTAR */}
      {vista === 'consultar' && (
        <div>
          <h2>Inventario Actual</h2>
          <button onClick={consultar} style={{ marginBottom: '10px', padding: '5px 10px' }}>Actualizar Datos</button>
          <table border="1" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: '#eee' }}>
              <tr>
                <th>Código</th><th>Nombre</th><th>Venta</th><th>Existencia</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p, i) => (
                <tr key={i}>
                  <td>{p.Codigo}</td><td>{p.Nombre}</td><td>{p.Venta}</td><td>{p.Existencia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VISTA CARGAR */}
      {vista === 'cargar' && (
        <form onSubmit={cargarProducto} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px' }}>
          <h2>Ingresar Mercancía</h2>
          <input placeholder="Código" value={carga.codigo} onChange={e => setCarga({...carga, codigo: e.target.value})} required />
          <input placeholder="Categoría" value={carga.categoria} onChange={e => setCarga({...carga, categoria: e.target.value})} />
          <input placeholder="Nombre" value={carga.nombre} onChange={e => setCarga({...carga, nombre: e.target.value})} required />
          <input placeholder="Marca" value={carga.marca} onChange={e => setCarga({...carga, marca: e.target.value})} />
          <input placeholder="Costo" type="number" value={carga.costo} onChange={e => setCarga({...carga, costo: e.target.value})} />
          <input placeholder="Precio Venta" type="number" value={carga.venta} onChange={e => setCarga({...carga, venta: e.target.value})} />
          <input placeholder="Cantidad" type="number" value={carga.cantidad} onChange={e => setCarga({...carga, cantidad: e.target.value})} required />
          <button type="submit" style={{ padding: '10px', backgroundColor: 'green', color: 'white' }}>Guardar Producto</button>
        </form>
      )}

      {/* VISTA VENDER */}
      {vista === 'vender' && (
        <form onSubmit={venderProducto} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px' }}>
          <h2>Registrar Venta</h2>
          <input placeholder="Código del Producto" value={venta.codigo} onChange={e => setVenta({...venta, codigo: e.target.value})} required />
          <input placeholder="Cantidad a Vender" type="number" value={venta.cantidad} onChange={e => setVenta({...venta, cantidad: e.target.value})} required />
          <button type="submit" style={{ padding: '10px', backgroundColor: 'red', color: 'white' }}>Vender</button>
        </form>
      )}

    </div>
  );
}

export default App;