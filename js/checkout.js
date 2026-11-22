import { supabase } from './supabaseClient.js';
import { obtenerResumenCarrito, limpiarCarrito } from './carrito.js';
import { formatoMoneda, cargarProductos } from './catalogo.js';

export function actualizarVistaCheckout() {
  const res = obtenerResumenCarrito();
  const list = document.getElementById('checkout-summary-items');

  list.innerHTML = res.items.length
    ? res.items
        .map(
          (i) => `
        <div style="display:flex; justify-content:space-between; font-size:0.86rem; margin-bottom:0.45rem;">
          <span>${i.cantidad}x ${i.nombre_producto} <small style="color:var(--text-muted);">(${i.variante_texto})</small></span>
          <strong>${formatoMoneda(i.precio_unitario * i.cantidad)}</strong>
        </div>`
        )
        .join('')
    : '<p style="font-size:0.88rem; color:var(--text-muted);">No hay productos en el carrito.</p>';

  document.getElementById('chk-subtotal').textContent = formatoMoneda(res.baseSinIva);
  document.getElementById('chk-iva').textContent = formatoMoneda(res.iva);
  document.getElementById('chk-descuento').textContent = `-${formatoMoneda(res.descuento)}`;
  document.getElementById('chk-envio').textContent = formatoMoneda(res.envio);
  document.getElementById('chk-total').textContent = formatoMoneda(res.total);
}

export function inicializarCheckout() {
  const form = document.getElementById('checkout-form');
  const envioSel = document.getElementById('chk-envio-tipo');

  envioSel.addEventListener('change', () => {
    const val = envioSel.value;
    let extraEnvio = 149;
    if (val.includes('$60')) extraEnvio = 60;
    if (val.includes('$0')) extraEnvio = 0;
    const res = obtenerResumenCarrito();
    const nuevoTotal = Math.max(res.subtotalConIva - res.descuento + extraEnvio, 0);
    document.getElementById('chk-envio').textContent = formatoMoneda(extraEnvio);
    document.getElementById('chk-total').textContent = formatoMoneda(nuevoTotal);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = obtenerResumenCarrito();
    if (!res.items.length) {
      alert('Tu carrito está vacío.');
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user || null;

    const metodoEnvioElegido = envioSel.value;
    let costoEnvioFinal = 149;
    if (metodoEnvioElegido.includes('$60')) costoEnvioFinal = 60;
    if (metodoEnvioElegido.includes('$0')) costoEnvioFinal = 0;

    const totalFinal = Math.max(res.subtotalConIva - res.descuento + costoEnvioFinal, 0);
    const metodoPago = document.querySelector('input[name="metodo_pago"]:checked').value;
    const numeroPedido = `YOH-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const numeroGuia = `GUIA-MX-${Math.floor(100000 + Math.random() * 900000)}`;

    const payloadPedido = {
      numero_pedido: numeroPedido,
      usuario_id: user ? user.id : null,
      cliente_nombre: document.getElementById('chk-nombre').value.trim(),
      cliente_email: document.getElementById('chk-email').value.trim(),
      cliente_telefono: document.getElementById('chk-telefono').value.trim(),
      direccion_envio: document.getElementById('chk-direccion').value.trim(),
      codigo_postal: document.getElementById('chk-cp').value.trim(),
      metodo_envio: metodoEnvioElegido,
      costo_envio: costoEnvioFinal,
      codigo_cupon: res.cupon,
      descuento: res.descuento,
      subtotal: res.baseSinIva,
      iva: res.iva,
      total: totalFinal,
      metodo_pago: metodoPago,
      estado_pedido: 'Confirmado',
      numero_guia: numeroGuia
    };

    const { data: pedidoCreado, error } = await supabase
      .from('pedidos')
      .insert([payloadPedido])
      .select()
      .single();

    if (error) {
      alert('Error al procesar el pedido: ' + error.message);
      return;
    }

    // Guardar detalle y descontar stock real en Supabase
    const detalles = res.items.map((item) => ({
      pedido_id: pedidoCreado.id,
      producto_id: item.producto_id,
      variante_id: item.variante_id,
      nombre_producto: item.nombre_producto,
      variante_texto: item.variante_texto,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario
    }));
    await supabase.from('detalle_pedidos').insert(detalles);

    for (const item of res.items) {
      if (item.variante_id) {
        await supabase.rpc('descontar_stock_variante', {
          p_variante_id: item.variante_id,
          p_cantidad: item.cantidad
        });
      }
    }

    await limpiarCarrito();
    await cargarProductos();

    const confBox = document.getElementById('checkout-confirmation');
    confBox.style.display = 'block';
    confBox.innerHTML = `
      <h3 style="color:var(--success); margin-bottom:0.5rem;">✅ ¡Pedido Confirmado Exitosamente!</h3>
      <p style="font-size:0.95rem; margin-bottom:0.5rem;">Gracias por tu compra, <strong>${payloadPedido.cliente_nombre}</strong>. Tu inventario ya fue apartado.</p>
      <p style="font-size:0.9rem;">• <strong>Número de Pedido:</strong> ${numeroPedido}<br>
      • <strong>Código de Rastreo:</strong> ${numeroGuia}<br>
      • <strong>Método de Pago:</strong> ${metodoPago}<br>
      • <strong>Total Pagado:</strong> ${formatoMoneda(totalFinal)}</p>
      <button class="btn-secondary" style="margin-top:0.8rem;" onclick="window.navegarA('cuenta')">Ver Tracking de Envío</button>
    `;
    form.style.display = 'none';
  });
}