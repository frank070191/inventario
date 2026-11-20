import { useState, useEffect } from 'react';

const API_URL = 'https://inventario-xp8l.onrender.com/api/inventario'; // Asegúrate de que esta sea tu URL real

function App() {
  const [vista, setVista] = useState('consultar');
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mensaje, setMensaje] = useState('');

  const [carga, setCarga] = useState({ codigo: '', categoria: '', nombre: '', marca: '', costo: '', venta: '', cantidad: '' });
  const [venta, setVenta] = useState({ codigo: '', cantidad: '' });

  // Para mostrar info en la ventana de ventas
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

  // --- LÓGICA DE AUTOCOMPLETADO EN CARGA ---
  const handleCodigoCargaChange = (e) => {
    const codigo = e.target.value;
    const prod = productos.find(p => p.Codigo === codigo);

    if (prod) {
      setCarga({
        ...carga,
        codigo: codigo,
        categoria: prod.Categoria || '',
        nombre: prod.Nombre || '',
        marca: prod.Marca || '',
        costo: prod.Costo || '',
        venta: prod.Venta || '',
        cantidad: '' // Dejamos cantidad en blanco para que ingresen la nueva
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
      consultar(); // Refrescar tabla
    } catch (error) { setMensaje('Error al cargar.'); }
  };

  // --- LÓGICA DE AUTOCOMPLETADO EN VENTA ---
  const handleCodigoVentaChange = (e) => {
    const codigo = e.target.value;
    setVenta({ ...venta, codigo: codigo });
    
    const prod = productos.find(p => p.Codigo === codigo);
    if (prod) {
      setInfoVenta(prod);
    } else {
      setInfoVenta(null);
    }
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
          <input type="text" placeholder="Buscar por nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box' }}/>
          <table border="1" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: '#eee' }}>
              <tr><th>Código</th><th>Nombre</th><th>Costo</th><th>Venta</th><th>Existencia</th></tr>
            </thead>
            <tbody>
              {productosFiltrados.map((p, i) => (
                <tr key={i}><td>{p.Codigo}</td><td>{p.Nombre}</td><td>{p.Costo}</td><td>{p.Venta}</td><td>{p.Existencia}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {vista === 'cargar' && (
        <form onSubmit={cargarProducto} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px', margin: '0 auto' }}>
          <h2>Ingresar / Actualizar Mercancía</h2>
          <label style={{fontSize: '12px', color: '#666'}}>Escribe el código para autocompletar o crear uno nuevo:</label>
          <input placeholder="Código" value={carga.codigo} onChange={handleCodigoCargaChange} required style={{padding: '8px', border: '2px solid #28a745'}}/>
          
          <input placeholder="Categoría" value={carga.categoria} onChange={e => setCarga({...carga, categoria: e.target.value})} style={{padding: '8px'}}/>
          <input placeholder="Nombre" value={carga.nombre} onChange={e => setCarga({...carga, nombre: e.target.value})} required style={{padding: '8px'}}/>
          <input placeholder="Marca" value={carga.marca} onChange={e => setCarga({...carga, marca: e.target.value})} style={{padding: '8px'}}/>
          <label style={{fontSize: '12px', color: '#666'}}>Si es un producto existente, puedes cambiar los precios aquí:</label>
          <input placeholder="Costo" type="number" value={carga.costo} onChange={e => setCarga({...carga, costo: e.target.value})} style={{padding: '8px'}}/>
          <input placeholder="Precio Venta" type="number" value={carga.venta} onChange={e => setCarga({...carga, venta: e.target.value})} style={{padding: '8px'}}/>
          <input placeholder="Cantidad a SUMAR" type="number" value={carga.cantidad} onChange={e => setCarga({...carga, cantidad: e.target.value})} required style={{padding: '8px', border: '2px solid #007bff'}}/>
          
          <button type="submit" style={{ padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' }}>Guardar / Actualizar</button>
        </form>
      )}

      {vista === 'vender' && (
        <form onSubmit={venderProducto} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px', margin: '0 auto' }}>
          <h2>Registrar Venta</h2>
          <label style={{fontSize: '12px', color: '#666'}}>Escribe el código del producto:</label>
          <input placeholder="Código del Producto" value={venta.codigo} onChange={handleCodigoVentaChange} required style={{padding: '8px', border: '2px solid #dc3545'}}/>
          
          {/* Cuadro de información automática de la venta */}
          {infoVenta && (
            <div style={{ backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }}>
              <p style={{ margin: 0 }}><strong>Producto:</strong> {infoVenta.Nombre}</p>
              <p style={{ margin: 0 }}><strong>Precio:</strong> ${infoVenta.Venta}</p>
              <p style={{ margin: 0 }}><strong>Stock actual:</strong> {infoVenta.Existencia} unidades</p>
            </div>
          )}

          <input placeholder="Cantidad a Vender" type="number" value={venta.cantidad} onChange={e => setVenta({...venta, cantidad: e.target.value})} required style={{padding: '8px'}}/>
          <button type="submit" style={{ padding: '10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px' }}>Registrar Venta</button>
        </form>
      )}
    </div>
  );
}

export default App;