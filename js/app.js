import { supabase } from './supabaseClient.js';
import {
  cargarProductos,
  aplicarFiltros,
  filtrarPorCategoria,
  inicializarBuscador,
  abrirModalProducto,
  inicializarModalProducto
} from './catalogo.js';
import { inicializarCarrito, agregarAlCarrito } from './carrito.js';
import { inicializarCheckout, actualizarVistaCheckout } from './checkout.js';
import { inicializarCuenta, toggleDeseo, cargarPedidosUsuario } from './cuenta.js';

// Exponer funciones globales para eventos inline
window.abrirModalProducto = abrirModalProducto;
window.agregarAlCarrito = agregarAlCarrito;
window.toggleDeseo = toggleDeseo;

window.navegarA = (vista) => {
  document.querySelectorAll('.view-section').forEach((sec) => sec.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === vista);
  });
  const target = document.getElementById(`view-${vista}`);
  if (target) target.classList.add('active');

  if (vista === 'checkout') {
    document.getElementById('checkout-form').style.display = 'grid';
    document.getElementById('checkout-confirmation').style.display = 'none';
    actualizarVistaCheckout();
  }
  if (vista === 'cuenta') {
    cargarPedidosUsuario();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

document.addEventListener('DOMContentLoaded', async () => {
  // Navegación
  document.querySelectorAll('[data-view]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      window.navegarA(el.dataset.view);
    });
  });

  // Categorías en Inicio
  document.querySelectorAll('.cat-card').forEach((card) => {
    card.addEventListener('click', () => filtrarPorCategoria(card.dataset.cat));
  });

  // Eventos de filtros en Catálogo
  ['filter-categoria', 'filter-subcategoria', 'filter-marca', 'filter-precio-max', 'filter-solo-stock', 'sort-select'].forEach((id) => {
    document.getElementById(id).addEventListener('input', aplicarFiltros);
    document.getElementById(id).addEventListener('change', aplicarFiltros);
  });

  document.getElementById('btn-reset-filtros').addEventListener('click', () => {
    document.getElementById('filter-categoria').value = '';
    document.getElementById('filter-subcategoria').value = '';
    document.getElementById('filter-marca').value = '';
    document.getElementById('filter-precio-max').value = 5000;
    document.getElementById('filter-solo-stock').checked = false;
    aplicarFiltros();
  });

  // Vista Parrilla vs Lista
  const grid = document.getElementById('catalog-products');
  document.getElementById('btn-view-grid').addEventListener('click', () => grid.classList.remove('list-view'));
  document.getElementById('btn-view-list').addEventListener('click', () => grid.classList.add('list-view'));

  // Newsletter
  document.getElementById('newsletter-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('newsletter-email').value.trim();
    const { error } = await supabase.from('newsletter').insert([{ email }]);
    if (error && error.code === '23505') {
      alert('Este correo ya está suscrito al boletín.');
    } else if (!error) {
      alert('🎉 ¡Suscripción confirmada! Usa el cupón MOTOYOH10 en tu compra.');
      e.target.reset();
    }
  });

  // Formulario de Contacto
  document.getElementById('contact-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      nombre: document.getElementById('cnt-nombre').value.trim(),
      email: document.getElementById('cnt-email').value.trim(),
      asunto: document.getElementById('cnt-asunto').value.trim(),
      mensaje: document.getElementById('cnt-mensaje').value.trim()
    };
    const { error } = await supabase.from('mensajes_contacto').insert([payload]);
    if (!error) {
      alert('✅ Mensaje enviado al taller MotoMaster YOH. Te responderemos a la brevedad.');
      e.target.reset();
    }
  });

  // Documentos Legales
  const TEXTOS_LEGALES = {
    privacidad: {
      titulo: 'Aviso de Privacidad Integral (LFPDPPP)',
      cuerpo: '<p><strong>MotoMaster YOH</strong>, con domicilio en Jalpa de Méndez, Tabasco, Tabasco, es responsable del tratamiento de sus datos personales (nombre, correo, teléfono y dirección de envío) recabados exclusivamente para procesar pedidos, emitir facturas CFDI y coordinar entregas.</p><p style="margin-top:0.6rem;">Usted puede ejercer sus derechos ARCO (Acceso, Rectificación, Cancelación u Oposición) desde su panel de usuario o enviando un mensaje en Atención al Cliente.</p>'
    },
    envios: {
      titulo: 'Políticas de Envío y Devolución',
      cuerpo: '<p>• <strong>Envíos Locales (Tabasco CP 86xxx):</strong> Entrega el mismo día o recolección gratuita en taller (Click & Collect).<br>• <strong>Envíos Nacionales:</strong> 2 a 5 días hábiles vía paquetería asegurada (gratis en compras mayores a $1,500 MXN).<br>• <strong>Devoluciones:</strong> Dispones de 15 días naturales para cambios o reembolsos en productos sin uso y en su empaque original.</p>'
    },
    terminos: {
      titulo: 'Términos y Condiciones de Uso',
      cuerpo: '<p>Todos los precios publicados en la tienda virtual incluyen el 16% de IVA. Las transacciones con tarjeta se procesan mediante pasarelas certificadas PCI-DSS y protocolo SSL, sin almacenar datos bancarios en nuestros servidores.</p>'
    }
  };

  document.querySelectorAll('.open-legal').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const doc = TEXTOS_LEGALES[btn.dataset.doc];
      if (doc) {
        document.getElementById('legal-title').textContent = doc.titulo;
        document.getElementById('legal-body').innerHTML = doc.cuerpo;
        document.getElementById('legal-modal').classList.add('active');
      }
    });
  });
  document.getElementById('close-legal-modal').addEventListener('click', () => {
    document.getElementById('legal-modal').classList.remove('active');
  });

  // Chatbot MotoMaster YOH
  const chatWin = document.getElementById('chatbot-window');
  document.getElementById('chatbot-toggle').addEventListener('click', () => chatWin.classList.toggle('active'));
  document.getElementById('chatbot-close').addEventListener('click', () => chatWin.classList.remove('active'));

  document.getElementById('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const txt = input.value.trim();
    if (!txt) return;

    const msgs = document.getElementById('chat-messages');
    msgs.innerHTML += `<div class="msg-user">${txt}</div>`;
    input.value = '';

    const low = txt.toLowerCase();
    let resp = 'Con gusto te ayudamos. Puedes revisar el catálogo o dejarnos tus datos en Atención al Cliente para cotizar cualquier pieza.';
    if (low.includes('envio') || low.includes('envío') || low.includes('tabasco')) {
      resp = '🚚 En Tabasco (CP 86xxx) el envío local cuesta $60 o es GRATIS recogiendo en taller. A nivel nacional cuesta $149 (gratis desde $1,500).';
    } else if (low.includes('cupon') || low.includes('cupón') || low.includes('descuento')) {
      resp = '🎟️ Usa el código MOTOYOH10 en el carrito para 10% de descuento, o REPARTIDOR15 para 15%.';
    } else if (low.includes('pago') || low.includes('tarjeta') || low.includes('oxxo')) {
      resp = '💳 Aceptamos Tarjetas con SSL/3D Secure, transferencia SPEI inmediata, Mercado Pago y efectivo en OXXO.';
    } else if (low.includes('taller') || low.includes('cita') || low.includes('horario')) {
      resp = '🔧 Atendemos de Lunes a Sábado de 8:30 AM a 6:30 PM en Jalpa de Méndez, Tabasco, Tabasco.';
    }

    setTimeout(() => {
      msgs.innerHTML += `<div class="msg-bot">${resp}</div>`;
      msgs.scrollTop = msgs.scrollHeight;
    }, 350);
  });

  // Inicializar módulos
  await cargarProductos();
  inicializarBuscador();
  inicializarModalProducto();
  inicializarCarrito();
  inicializarCheckout();
  await inicializarCuenta();
});