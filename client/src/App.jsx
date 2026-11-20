import { useState, useEffect } from 'react';

const API_URL = 'https://inventario-xp8l.onrender.com/api/inventario';

function App() {
  const [vista, setVista] = useState('consultar');
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mensaje, setMensaje] = useState('');

  const [carga, setCarga] = useState({ codigo: '', categoria: '', nombre: '', marca: '', costo: '', venta: '', cantidad: '' });
  const [venta, setVenta] = useState({ codigo: '', cantidad: '' });

  const consultar = async () => {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      setProductos(data);
      setMensaje('');
    } catch (error) {
      setMensaje('Error al consultar.');
    }
  };

  useEffect(() => { consultar(); }, []);

  // ✨ MAGIA: Autocompletar al escribir el código en Carga
  const handleCodigoChange = (e) => {
    const codigoIngresado = e.target.value;
    // Buscamos si el producto ya existe en la lista
    const productoExistente = productos.find(p => p.Codigo === codigoIngresado);

    if (productoExistente) {
      // Si existe, llenamos los campos
      setCarga({
        ...carga,
        codigo: codigoIngresado,
        categoria: productoExistente.Categoria || '',
        nombre: productoExistente.Nombre || '',
        marca: productoExistente.Marca || '',
        costo: productoExistente.Costo || '',
        venta: productoExistente.Venta || '',
        // La cantidad la dejamos en blanco para que escribas cuánto vas a SUMAR
        cantidad: '' 
      });
    } else {
      // Si no existe, solo actualizamos el código y limpiamos los demás
      setCarga({ codigo: codigoIngresado, categoria: '', nombre: '', marca: '', costo: '', venta: '', cantidad: '' });
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

  const venderProducto = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/vender`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(venta)
      });
      const data = await res.json();
      setMensaje(data.message || data.error);
      setVenta({ codigo: '', cantidad: '' });
      consultar(); 
    } catch (error) { setMensaje('Error al vender.'); }
  };

  const productosFiltrados = productos.filter(p => 
    p.Nombre && p.Nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={{ fontFamily: 'Arial', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center' }}>Sistema de Inventario</h1>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center' }}>
        <button onClick={() => setVista('consultar')} style={{ padding: '10px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}>Consultar</button>
        <button onClick={() => setVista('cargar')} style={{ padding: '10px', cursor: 'pointer', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' }}>Cargar Mercancía</button>
        <button onClick={() => setVista('vender')} style={{ padding: '10px', cursor: 'pointer', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px' }}>Vender</button>
      </div>

      {mensaje && <p style={{ color: 'blue', fontWeight: 'bold', textAlign: 'center' }}>{mensaje}</p>}

      {vista === 'consultar' && (
        <div>
          <h2>Inventario Actual</h2>
          <input 
            type="text" placeholder="Buscar por nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} 
            style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box' }}
          />
          <table border="1" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: '#eee' }}>
              <tr><th>Código</th><th>Nombre</th><th>Venta</th><th>Existencia</th></tr>
            </thead>
            <tbody>
              {productosFiltrados.map((p, i) => (
                <tr key={i}><td>{p.Codigo}</td><td>{p.Nombre}</td><td>{p.Venta}</td><td>{p.Existencia}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {vista === 'cargar' && (
        <form onSubmit={cargarProducto} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px', margin: '0 auto' }}>
          <h2>Ingresar Mercancía</h2>
          {/* Aquí aplicamos la función handleCodigoChange */}
          <input placeholder="Código (Escribe para autocompletar)" value={carga.codigo} onChange={handleCodigoChange} required style={{padding: '8px', border: '2px solid #28a745'}}/>
          
          <input placeholder="Categoría" value={carga.categoria} onChange={e => setCarga({...carga, categoria: e.target.value})} style={{padding: '8px'}}/>
          <input placeholder="Nombre" value={carga.nombre} onChange={e => setCarga({...carga, nombre: e.target.value})} required style={{padding: '8px'}}/>
          <input placeholder="Marca" value={carga.marca} onChange={e => setCarga({...carga, marca: e.target.value})} style={{padding: '8px'}}/>
          <input placeholder="Costo" type="number" value={carga.costo} onChange={e => setCarga({...carga, costo: e.target.value})} style={{padding: '8px'}}/>
          <input placeholder="Precio Venta" type="number" value={carga.venta} onChange={e => setCarga({...carga, venta: e.target.value})} style={{padding: '8px'}}/>
          <input placeholder="Cantidad a SUMAR" type="number" value={carga.cantidad} onChange={e => setCarga({...carga, cantidad: e.target.value})} required style={{padding: '8px', border: '2px solid #007bff'}}/>
          
          <button type="submit" style={{ padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' }}>Guardar / Actualizar</button>
        </form>
      )}

      {vista === 'vender' && (
        <form onSubmit={venderProducto} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px', margin: '0 auto' }}>
          <h2>Registrar Venta</h2>
          <input placeholder="Código del Producto" value={venta.codigo} onChange={e => setVenta({...venta, codigo: e.target.value})} required style={{padding: '8px'}}/>
          <input placeholder="Cantidad a Vender" type="number" value={venta.cantidad} onChange={e => setVenta({...venta, cantidad: e.target.value})} required style={{padding: '8px'}}/>
          <button type="submit" style={{ padding: '10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px' }}>Vender</button>
        </form>
      )}
    </div>
  );
}

export default App;