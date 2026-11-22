import { supabase } from './supabaseClient.js';
import { obtenerProductosCache, formatoMoneda } from './catalogo.js';

let carrito = JSON.parse(localStorage.getItem('motoyoh_cart') || '[]');
let costoEnvio = 149;
let metodoEnvio = 'Estándar Nacional ($149)';
let cuponAplicado = null;
let porcentajeDescuento = 0;
let usuarioActual = null;

const CUPONES_VALIDOS = {
  MOTOYOH10: 0.10,
  REPARTIDOR15: 0.15
};

export function inicializarCarrito() {
  const drawer = document.getElementById('cart-drawer');
  document.getElementById('btn-open-cart').addEventListener('click', () => drawer.classList.add('active'));
  document.getElementById('btn-close-cart').addEventListener('click', () => drawer.classList.remove('active'));

  document.getElementById('btn-calc-envio').addEventListener('click', () => {
    const cp = document.getElementById('cart-cp').value.trim();
    const msg = document.getElementById('cart-shipping-msg');
    if (cp.length !== 5 || isNaN(cp)) {
      msg.textContent = '⚠️ Ingresa un Código Postal válido de 5 dígitos.';
      return;
    }
    if (cp.startsWith('86')) {
      costoEnvio = 60;
      metodoEnvio = 'Local Tabasco ($60)';
      msg.innerHTML = '✔ <strong>Tabasco detectado:</strong> Envío local exprés $60 (o $0 recogiendo en taller).';
    } else {
      costoEnvio = 149;
      metodoEnvio = 'Estándar Nacional ($149)';
      msg.innerHTML = '✔ Envío nacional asegurado por paquetería ($149 MXN).';
    }
    renderizarCarrito();
  });

  document.getElementById('btn-apply-coupon').addEventListener('click', () => {
    const code = document.getElementById('cart-coupon').value.trim().toUpperCase();
    if (CUPONES_VALIDOS[code]) {
      cuponAplicado = code;
      porcentajeDescuento = CUPONES_VALIDOS[code];
      alert(`🎉 Cupón ${code} aplicado (${porcentajeDescuento * 100}% de descuento).`);
    } else {
      cuponAplicado = null;
      porcentajeDescuento = 0;
      alert('Cupón no válido. Prueba con MOTOYOH10');
    }
    renderizarCarrito();
  });

  document.getElementById('btn-go-checkout').addEventListener('click', () => {
    if (!carrito.length) {
      alert('Tu carrito está vacío.');
      return;
    }
    drawer.classList.remove('active');
    window.navegarA('checkout');
  });

  renderizarCarrito();
}

export async function sincronizarCarritoUsuario(user) {
  usuarioActual = user;
  if (!user) return;
  const { data } = await supabase
    .from('carrito_guardado')
    .select('*')
    .eq('usuario_id', user.id);

  if (data && data.length) {
    carrito = data.map((row) => ({
      producto_id: row.producto_id,
      variante_id: row.variante_id,
      cantidad: row.cantidad
    }));
    guardarLocal();
    renderizarCarrito();
  }
}

async function persistirCarrito() {
  guardarLocal();
  if (usuarioActual) {
    await supabase.from('carrito_guardado').delete().eq('usuario_id', usuarioActual.id);
    if (carrito.length) {
      const rows = carrito.map((item) => ({
        usuario_id: usuarioActual.id,
        producto_id: item.producto_id,
        variante_id: item.variante_id,
        cantidad: item.cantidad
      }));
      await supabase.from('carrito_guardado').insert(rows);
    }
  }
}

function guardarLocal() {
  localStorage.setItem('motoyoh_cart', JSON.stringify(carrito));
}

export async function agregarAlCarrito(productoId, varianteId, cantidad = 1) {
  const productos = obtenerProductosCache();
  const prod = productos.find((p) => p.id === productoId);
  if (!prod) return;
  const variante = (prod.variantes_producto || []).find((v) => v.id === varianteId) || prod.variantes_producto?.[0];
  if (!variante || variante.stock <= 0) {
    alert('Esta opción no tiene stock disponible.');
    return;
  }

  const existente = carrito.find((i) => i.variante_id === variante.id);
  if (existente) {
    existente.cantidad = Math.min(existente.cantidad + cantidad, variante.stock);
  } else {
    carrito.push({
      producto_id: prod.id,
      variante_id: variante.id,
      cantidad: Math.min(cantidad, variante.stock)
    });
  }

  await persistirCarrito();
  renderizarCarrito();
  document.getElementById('cart-drawer').classList.add('active');
}

window.cambiarCantidadCarrito = async (varianteId, delta) => {
  const idx = carrito.findIndex((i) => i.variante_id === varianteId);
  if (idx === -1) return;
  carrito[idx].cantidad += delta;
  if (carrito[idx].cantidad <= 0) {
    carrito.splice(idx, 1);
  }
  await persistirCarrito();
  renderizarCarrito();
};

export function renderizarCarrito() {
  const productos = obtenerProductosCache();
  const container = document.getElementById('cart-items-list');
  const totalUnidades = carrito.reduce((acc, i) => acc + i.cantidad, 0);
  document.getElementById('cart-badge').textContent = totalUnidades;

  if (!carrito.length) {
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:2rem;">Tu carrito está vacío.</p>';
  } else {
    container.innerHTML = carrito
      .map((item) => {
        const prod = productos.find((p) => p.id === item.producto_id);
        if (!prod) return '';
        const varObj = (prod.variantes_producto || []).find((v) => v.id === item.variante_id);
        const unitPrice = Number(prod.precio) + Number(varObj?.precio_extra || 0);
        return `
          <div class="cart-item">
            <img src="${prod.imagenes[0]}" alt="${prod.nombre}" />
            <div style="flex:1;">
              <strong style="font-size:0.88rem; display:block;">${prod.nombre}</strong>
              <span style="font-size:0.78rem; color:var(--text-muted);">${varObj ? `${varObj.tipo_variante}: ${varObj.valor}` : ''}</span>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.4rem;">
                <span style="font-weight:700;">${formatoMoneda(unitPrice * item.cantidad)}</span>
                <div class="qty-controls">
                  <button onclick="window.cambiarCantidadCarrito('${item.variante_id}', -1)">-</button>
                  <span style="padding:0 0.55rem; font-size:0.85rem;">${item.cantidad}</span>
                  <button onclick="window.cambiarCantidadCarrito('${item.variante_id}', 1)">+</button>
                </div>
              </div>
            </div>
          </div>`;
      })
      .join('');
  }

  const resumen = obtenerResumenCarrito();
  document.getElementById('cart-subtotal').textContent = formatoMoneda(resumen.subtotalConIva);
  document.getElementById('cart-discount').textContent = `-${formatoMoneda(resumen.descuento)}`;
  document.getElementById('cart-shipping').textContent = formatoMoneda(resumen.envio);
  document.getElementById('cart-total').textContent = formatoMoneda(resumen.total);
}

export function obtenerResumenCarrito() {
  const productos = obtenerProductosCache();
  let subtotalConIva = 0;
  const itemsDetallados = [];

  carrito.forEach((item) => {
    const prod = productos.find((p) => p.id === item.producto_id);
    if (!prod) return;
    const varObj = (prod.variantes_producto || []).find((v) => v.id === item.variante_id);
    const precioUnitario = Number(prod.precio) + Number(varObj?.precio_extra || 0);
    subtotalConIva += precioUnitario * item.cantidad;
    itemsDetallados.push({
      producto_id: prod.id,
      variante_id: varObj?.id || null,
      nombre_producto: prod.nombre,
      variante_texto: varObj ? `${varObj.tipo_variante}: ${varObj.valor}` : 'Estándar',
      cantidad: item.cantidad,
      precio_unitario: precioUnitario
    });
  });

  const descuento = subtotalConIva * porcentajeDescuento;
  const envio = subtotalConIva >= 1500 && subtotalConIva > 0 ? 0 : (subtotalConIva > 0 ? costoEnvio : 0);
  const total = Math.max(subtotalConIva - descuento + envio, 0);
  const baseSinIva = (subtotalConIva - descuento) / 1.16;
  const iva = (subtotalConIva - descuento) - baseSinIva;

  return {
    items: itemsDetallados,
    subtotalConIva,
    baseSinIva,
    iva,
    descuento,
    cupon: cuponAplicado,
    envio,
    metodoEnvio,
    total
  };
}

export async function limpiarCarrito() {
  carrito = [];
  cuponAplicado = null;
  porcentajeDescuento = 0;
  await persistirCarrito();
  renderizarCarrito();
}