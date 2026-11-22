import { supabase } from './supabaseClient.js';
import { sincronizarCarritoUsuario } from './carrito.js';
import { obtenerProductosCache, formatoMoneda } from './catalogo.js';

let currentUser = null;

export async function inicializarCuenta() {
  // Pestañas del dashboard
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.dash-panel').forEach((p) => (p.style.display = 'none'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).style.display = 'block';
    });
  });

  // Login
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-pass').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert('Error al iniciar sesión: ' + error.message);
  });

  // Registro
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre_completo = document.getElementById('reg-nombre').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-pass').value;

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      alert('Error en registro: ' + error.message);
      return;
    }
    if (data.user) {
      await supabase.from('perfiles').upsert({ id: data.user.id, nombre_completo });
      alert('✅ Cuenta creada correctamente.');
    }
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  // Guardar Perfil
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    await supabase.from('perfiles').upsert({
      id: currentUser.id,
      nombre_completo: document.getElementById('prof-nombre').value.trim(),
      telefono: document.getElementById('prof-telefono').value.trim(),
      direccion: document.getElementById('prof-direccion').value.trim(),
      ciudad: document.getElementById('prof-ciudad').value.trim(),
      codigo_postal: document.getElementById('prof-cp').value.trim()
    });
    alert('✔ Datos personales actualizados.');
  });

  // Guardar Preferencias
  document.getElementById('prefs-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    await supabase.from('perfiles').upsert({
      id: currentUser.id,
      pref_email: document.getElementById('pref-email').checked,
      pref_whatsapp: document.getElementById('pref-whatsapp').checked
    });
    alert('✔ Preferencias de comunicación guardadas.');
  });

  // Rastreo para invitados por número de pedido
  document.getElementById('guest-track-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const num = document.getElementById('track-order-input').value.trim().toUpperCase();
    const { data } = await supabase
      .from('pedidos')
      .select('*, detalle_pedidos(*)')
      .eq('numero_pedido', num)
      .single();

    const resBox = document.getElementById('guest-track-result');
    if (!data) {
      resBox.innerHTML = '<p style="color:var(--primary); font-size:0.9rem;">No se encontró ningún pedido con ese folio.</p>';
      return;
    }
    resBox.innerHTML = renderizarTarjetaPedido(data);
  });

  // Escuchar cambios de sesión en tiempo real
  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    await actualizarEstadoUsuario();
  });

  const { data } = await supabase.auth.getSession();
  currentUser = data?.session?.user || null;
  await actualizarEstadoUsuario();
}

async function actualizarEstadoUsuario() {
  const authSec = document.getElementById('auth-section');
  const dashSec = document.getElementById('user-dashboard');
  const navBtn = document.getElementById('nav-cuenta-btn');
  const chkBanner = document.getElementById('checkout-user-banner');

  if (!currentUser) {
    authSec.style.display = 'grid';
    dashSec.style.display = 'none';
    navBtn.textContent = 'Mi Cuenta';
    return;
  }

  authSec.style.display = 'none';
  dashSec.style.display = 'block';
  navBtn.textContent = '👤 Mi Panel';
  document.getElementById('dash-user-email').textContent = currentUser.email;

  await sincronizarCarritoUsuario(currentUser);

  // Cargar perfil
  const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', currentUser.id).single();
  if (perfil) {
    document.getElementById('dash-user-name').textContent = `Hola, ${perfil.nombre_completo || 'Motociclista'}`;
    document.getElementById('prof-nombre').value = perfil.nombre_completo || '';
    document.getElementById('prof-telefono').value = perfil.telefono || '';
    document.getElementById('prof-direccion').value = perfil.direccion || '';
    document.getElementById('prof-ciudad').value = perfil.ciudad || 'Villahermosa';
    document.getElementById('prof-cp').value = perfil.codigo_postal || '';
    document.getElementById('pref-email').checked = perfil.pref_email ?? true;
    document.getElementById('pref-whatsapp').checked = perfil.pref_whatsapp ?? true;

    // Autocompletar checkout
    document.getElementById('chk-nombre').value = perfil.nombre_completo || '';
    document.getElementById('chk-email').value = currentUser.email;
    document.getElementById('chk-telefono').value = perfil.telefono || '';
    document.getElementById('chk-direccion').value = perfil.direccion || '';
    document.getElementById('chk-cp').value = perfil.codigo_postal || '';
    chkBanner.innerHTML = `<span>Sesión iniciada como <strong>${currentUser.email}</strong>. Tus datos de envío están listos.</span>`;
  }

  await cargarPedidosUsuario();
  await cargarDeseosUsuario();
}

function renderizarTarjetaPedido(p) {
  const estados = ['Confirmado', 'Preparando', 'En Ruta', 'Entregado'];
  const idxActual = Math.max(0, estados.indexOf(p.estado_pedido));

  return `
    <div style="border:1px solid var(--border); border-radius:10px; padding:1rem; margin-bottom:1rem; background:#f8fafc;">
      <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.6rem;">
        <strong>Pedido: ${p.numero_pedido}</strong>
        <span style="font-size:0.85rem; color:var(--text-muted);">Guía: <strong>${p.numero_guia || 'Pendiente'}</strong> · Total: <strong>${formatoMoneda(p.total)}</strong></span>
      </div>
      <div class="tracking-steps">
        ${estados
          .map(
            (st, i) => `
          <div class="tracking-step ${i <= idxActual ? 'done' : ''}">
            ${i <= idxActual ? '✅' : '⚪'} ${st}
          </div>`
          )
          .join('')}
      </div>
      <div style="font-size:0.84rem; color:var(--dark-700); margin-top:0.5rem;">
        ${(p.detalle_pedidos || []).map((d) => `• ${d.cantidad}x ${d.nombre_producto} (${d.variante_texto})`).join('<br>')}
      </div>
    </div>
  `;
}

export async function cargarPedidosUsuario() {
  if (!currentUser) return;
  const { data } = await supabase
    .from('pedidos')
    .select('*, detalle_pedidos(*)')
    .eq('usuario_id', currentUser.id)
    .order('creado_en', { ascending: false });

  const cont = document.getElementById('tab-pedidos');
  cont.innerHTML =
    data && data.length
      ? data.map(renderizarTarjetaPedido).join('')
      : '<p style="color:var(--text-muted);">Aún no tienes pedidos registrados en tu cuenta.</p>';
}

export async function toggleDeseo(productoId) {
  if (!currentUser) {
    alert('Inicia sesión en "Mi Cuenta" para guardar productos en tu Lista de Deseos.');
    window.navegarA('cuenta');
    return;
  }
  const { data: existe } = await supabase
    .from('lista_deseos')
    .select('id')
    .eq('usuario_id', currentUser.id)
    .eq('producto_id', productoId)
    .single();

  if (existe) {
    await supabase.from('lista_deseos').delete().eq('id', existe.id);
    alert('Eliminado de tu Lista de Deseos.');
  } else {
    await supabase.from('lista_deseos').insert([{ usuario_id: currentUser.id, producto_id: productoId }]);
    alert('❤️ Guardado en tu Lista de Deseos.');
  }
  await cargarDeseosUsuario();
}

async function cargarDeseosUsuario() {
  if (!currentUser) return;
  const { data } = await supabase.from('lista_deseos').select('producto_id').eq('usuario_id', currentUser.id);
  const productos = obtenerProductosCache();
  const cont = document.getElementById('tab-deseos');

  if (!data || !data.length) {
    cont.innerHTML = '<p style="color:var(--text-muted);">Tu lista de deseos está vacía.</p>';
    return;
  }

  cont.innerHTML = data
    .map((item) => {
      const p = productos.find((x) => x.id === item.producto_id);
      if (!p) return '';
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.7rem 0; border-bottom:1px solid var(--border);">
          <div style="display:flex; align-items:center; gap:0.8rem;">
            <img src="${p.imagenes[0]}" style="width:52px; height:52px; object-fit:cover; border-radius:6px;" />
            <div><strong>${p.nombre}</strong><br><span style="font-size:0.85rem; color:var(--primary);">${formatoMoneda(p.precio)}</span></div>
          </div>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn-primary" onclick="window.abrirModalProducto('${p.id}')">Ver</button>
            <button class="btn-outline" onclick="window.toggleDeseo('${p.id}')">Quitar</button>
          </div>
        </div>`;
    })
    .join('');
}