import { supabase } from './supabaseClient.js';

let productosCache = [];
let productoActualModal = null;
let varianteSeleccionada = null;

export const formatoMoneda = (num) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(num || 0));

export async function cargarProductos() {
  const { data, error } = await supabase
    .from('productos')
    .select('*, variantes_producto(*)')
    .order('popularidad', { ascending: false });

  if (error) {
    console.error('Error cargando productos:', error);
    return [];
  }
  productosCache = data || [];
  poblarSelectsFiltros();
  renderizarDestacados();
  aplicarFiltros();
  return productosCache;
}

export function obtenerProductosCache() {
  return productosCache;
}

function crearTarjetaHTML(prod) {
  const variantes = prod.variantes_producto || [];
  const stockTotal = variantes.reduce((acc, v) => acc + v.stock, 0);
  const varDefault = variantes.find((v) => v.stock > 0) || variantes[0];
  const descuento = prod.precio_anterior
    ? Math.round(((prod.precio_anterior - prod.precio) / prod.precio_anterior) * 100)
    : 0;

  return `
    <article class="product-card">
      <div class="product-img-box" onclick="window.abrirModalProducto('${prod.id}')">
        ${descuento > 0 ? `<span class="badge-offer">-${descuento}%</span>` : ''}
        <img src="${prod.imagenes[0]}" alt="${prod.nombre}" loading="lazy" />
        <button class="wish-btn" onclick="event.stopPropagation(); window.toggleDeseo('${prod.id}')" title="Agregar a Favoritos">♡</button>
      </div>
      <div class="product-body">
        <div>
          <span class="product-brand">${prod.marca} · ${prod.categoria}</span>
          <h3 class="product-title" onclick="window.abrirModalProducto('${prod.id}')">${prod.nombre}</h3>
          <div style="font-size:0.8rem; color:${stockTotal > 0 ? 'var(--success)' : 'var(--primary)'}; font-weight:700;">
            ${stockTotal > 0 ? `✔ En stock (${stockTotal} disp.)` : '✕ Agotado'}
          </div>
        </div>
        <div>
          <div class="price-row">
            <span class="price-current">${formatoMoneda(prod.precio)}</span>
            ${prod.precio_anterior ? `<span class="price-old">${formatoMoneda(prod.precio_anterior)}</span>` : ''}
          </div>
          <div style="display:flex; gap:0.4rem;">
            <button class="btn-outline" style="flex:1; font-size:0.84rem;" onclick="window.abrirModalProducto('${prod.id}')">Opciones</button>
            <button class="btn-primary" style="flex:1; font-size:0.84rem; justify-content:center;" ${stockTotal === 0 ? 'disabled' : ''}
              onclick="window.agregarAlCarrito('${prod.id}', '${varDefault?.id || ''}', 1)">
              + Carrito
            </button>
          </div>
        </div>
      </div>
    </article>
  `;
}

export function renderizarDestacados() {
  const cont = document.getElementById('featured-products');
  if (!cont) return;
  const destacados = productosCache.filter((p) => p.destacado);
  cont.innerHTML = destacados.length
    ? destacados.map(crearTarjetaHTML).join('')
    : '<p>No hay productos destacados.</p>';
}

function poblarSelectsFiltros() {
  const selCat = document.getElementById('filter-categoria');
  const selSub = document.getElementById('filter-subcategoria');
  const selMarca = document.getElementById('filter-marca');

  const categorias = [...new Set(productosCache.map((p) => p.categoria))];
  const subcategorias = [...new Set(productosCache.map((p) => p.subcategoria))];
  const marcas = [...new Set(productosCache.map((p) => p.marca))];

  selCat.innerHTML = '<option value="">Todas las categorías</option>' + categorias.map((c) => `<option value="${c}">${c}</option>`).join('');
  selSub.innerHTML = '<option value="">Todas las subcategorías</option>' + subcategorias.map((s) => `<option value="${s}">${s}</option>`).join('');
  selMarca.innerHTML = '<option value="">Todas las marcas</option>' + marcas.map((m) => `<option value="${m}">${m}</option>`).join('');
}

export function aplicarFiltros() {
  const cat = document.getElementById('filter-categoria').value;
  const sub = document.getElementById('filter-subcategoria').value;
  const marca = document.getElementById('filter-marca').value;
  const precioMax = Number(document.getElementById('filter-precio-max').value);
  const soloStock = document.getElementById('filter-solo-stock').checked;
  const orden = document.getElementById('sort-select').value;

  document.getElementById('precio-max-label').textContent = formatoMoneda(precioMax);

  let filtrados = productosCache.filter((p) => {
    const stock = (p.variantes_producto || []).reduce((a, v) => a + v.stock, 0);
    if (cat && p.categoria !== cat) return false;
    if (sub && p.subcategoria !== sub) return false;
    if (marca && p.marca !== marca) return false;
    if (Number(p.precio) > precioMax) return false;
    if (soloStock && stock <= 0) return false;
    return true;
  });

  if (orden === 'precio-asc') filtrados.sort((a, b) => a.precio - b.precio);
  if (orden === 'precio-desc') filtrados.sort((a, b) => b.precio - a.precio);
  if (orden === 'novedad') filtrados.sort((a, b) => (b.es_nuevo ? 1 : 0) - (a.es_nuevo ? 1 : 0));
  if (orden === 'popularidad') filtrados.sort((a, b) => b.popularidad - a.popularidad);

  document.getElementById('catalog-count').textContent = `Mostrando ${filtrados.length} producto(s)`;
  const grid = document.getElementById('catalog-products');
  grid.innerHTML = filtrados.length
    ? filtrados.map(crearTarjetaHTML).join('')
    : '<div class="card-box" style="grid-column:1/-1; text-align:center;">No se encontraron refacciones con esos filtros.</div>';
}

export function filtrarPorCategoria(cat) {
  document.getElementById('filter-categoria').value = cat;
  aplicarFiltros();
  window.navegarA('catalogo');
}

export function inicializarBuscador() {
  const input = document.getElementById('global-search');
  const box = document.getElementById('autocomplete-results');

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      box.classList.remove('active');
      return;
    }
    const matches = productosCache
      .filter((p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.marca.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q)
      )
      .slice(0, 6);

    if (!matches.length) {
      box.innerHTML = '<div style="padding:0.8rem; font-size:0.88rem; color:var(--text-muted);">Sin coincidencias...</div>';
    } else {
      box.innerHTML = matches
        .map(
          (p) => `
        <div class="autocomplete-item" onclick="window.abrirModalProducto('${p.id}'); document.getElementById('autocomplete-results').classList.remove('active');">
          <img src="${p.imagenes[0]}" alt="${p.nombre}" />
          <div>
            <strong style="font-size:0.88rem; display:block;">${p.nombre}</strong>
            <span style="font-size:0.78rem; color:var(--text-muted);">${p.marca} · ${formatoMoneda(p.precio)}</span>
          </div>
        </div>`
        )
        .join('');
    }
    box.classList.add('active');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) box.classList.remove('active');
  });
}

// MODAL DE PRODUCTO INDIVIDUAL + ZOOM + RESEÑAS
export async function abrirModalProducto(productoId) {
  const prod = productosCache.find((p) => p.id === productoId);
  if (!prod) return;
  productoActualModal = prod;

  const mainImg = document.getElementById('modal-main-img');
  mainImg.src = prod.imagenes[0];
  document.getElementById('modal-brand').textContent = `${prod.marca} · ${prod.subcategoria}`;
  document.getElementById('modal-sku').textContent = `SKU: ${prod.sku}`;
  document.getElementById('modal-title').textContent = prod.nombre;
  document.getElementById('modal-desc').textContent = prod.descripcion;
  document.getElementById('modal-qty').value = 1;

  // Miniaturas
  const thumbs = document.getElementById('modal-thumbs');
  thumbs.innerHTML = prod.imagenes
    .map((img) => `<img src="${img}" style="width:54px; height:54px; object-fit:cover; border-radius:6px; border:1px solid var(--border); cursor:pointer;" onclick="document.getElementById('modal-main-img').src='${img}'" />`)
    .join('');

  // Especificaciones técnicas
  const specsTable = document.getElementById('modal-specs');
  const specs = prod.especificaciones || {};
  specsTable.innerHTML = Object.entries(specs)
    .map(([k, v]) => `<tr style="border-bottom:1px solid var(--border);"><td style="padding:0.45rem; font-weight:700; width:40%;">${k}</td><td style="padding:0.45rem;">${v}</td></tr>`)
    .join('');

  // Variantes
  const variantes = prod.variantes_producto || [];
  document.getElementById('modal-variant-label').textContent = variantes[0] ? `Selecciona ${variantes[0].tipo_variante}:` : 'Opción:';
  const varCont = document.getElementById('modal-variants');

  const seleccionarVariante = (v) => {
    varianteSeleccionada = v;
    const precioFinal = Number(prod.precio) + Number(v.precio_extra || 0);
    document.getElementById('modal-price').textContent = formatoMoneda(precioFinal);
    document.getElementById('modal-old-price').textContent = prod.precio_anterior ? formatoMoneda(prod.precio_anterior) : '';
    document.getElementById('modal-stock-badge').innerHTML =
      v.stock > 0
        ? `<span style="color:var(--success);">✔ Disponible en inventario: ${v.stock} unidades</span>`
        : `<span style="color:var(--primary);">✕ Variante agotada temporalmente</span>`;
    document.getElementById('btn-modal-add').disabled = v.stock <= 0;

    varCont.querySelectorAll('.variant-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.vid === v.id);
    });
  };

  varCont.innerHTML = variantes
    .map((v) => `<button type="button" class="variant-pill" data-vid="${v.id}" ${v.stock <= 0 ? 'disabled' : ''}>${v.valor}</button>`)
    .join('');

  varCont.querySelectorAll('.variant-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const found = variantes.find((x) => x.id === btn.dataset.vid);
      if (found) seleccionarVariante(found);
    });
  });

  if (variantes.length) {
    seleccionarVariante(variantes.find((v) => v.stock > 0) || variantes[0]);
  }

  // Botón agregar y favoritos desde modal
  document.getElementById('btn-modal-add').onclick = () => {
    const qty = Math.max(1, Number(document.getElementById('modal-qty').value));
    if (varianteSeleccionada) {
      window.agregarAlCarrito(prod.id, varianteSeleccionada.id, qty);
      document.getElementById('product-modal').classList.remove('active');
    }
  };
  document.getElementById('btn-modal-wish').onclick = () => window.toggleDeseo(prod.id);

  // Productos relacionados
  const rel = productosCache.filter((p) => p.categoria === prod.categoria && p.id !== prod.id).slice(0, 3);
  document.getElementById('modal-related').innerHTML = rel.length
    ? rel.map(crearTarjetaHTML).join('')
    : '<p style="font-size:0.88rem; color:var(--text-muted);">No hay otros productos en esta categoría aún.</p>';

  // Cargar reseñas
  await cargarResenasProducto(prod.id);
  document.getElementById('product-modal').classList.add('active');
}

async function cargarResenasProducto(productoId) {
  const list = document.getElementById('modal-reviews-list');
  const { data } = await supabase
    .from('resenas')
    .select('*')
    .eq('producto_id', productoId)
    .order('creado_en', { ascending: false });

  if (!data || !data.length) {
    list.innerHTML = '<p style="font-size:0.88rem; color:var(--text-muted);">Aún no hay reseñas. ¡Sé el primero en opinar!</p>';
    return;
  }
  list.innerHTML = data
    .map(
      (r) => `
      <div style="border-bottom:1px solid var(--border); padding:0.6rem 0;">
        <div style="display:flex; justify-content:space-between; font-size:0.85rem;">
          <strong>${r.nombre_usuario}</strong>
          <span style="color:var(--accent);">${'★'.repeat(r.calificacion)}${'☆'.repeat(5 - r.calificacion)}</span>
        </div>
        <p style="font-size:0.88rem; margin-top:0.2rem;">${r.comentario}</p>
      </div>`
    )
    .join('');
}

export function inicializarModalProducto() {
  document.getElementById('close-product-modal').addEventListener('click', () => {
    document.getElementById('product-modal').classList.remove('active');
  });

  // Efecto Lupa Zoom en imagen principal
  const zoomBox = document.getElementById('zoom-container');
  const zoomImg = document.getElementById('modal-main-img');
  zoomBox.addEventListener('mousemove', (e) => {
    const rect = zoomBox.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    zoomImg.style.transformOrigin = `${x}% ${y}%`;
    zoomImg.style.transform = 'scale(1.85)';
  });
  zoomBox.addEventListener('mouseleave', () => {
    zoomImg.style.transform = 'scale(1)';
  });

  // Formulario nueva reseña
  document.getElementById('review-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!productoActualModal) return;
    const nombre_usuario = document.getElementById('rev-nombre').value.trim();
    const calificacion = Number(document.getElementById('rev-calificacion').value);
    const comentario = document.getElementById('rev-comentario').value.trim();

    const { error } = await supabase.from('resenas').insert([
      { producto_id: productoActualModal.id, nombre_usuario, calificacion, comentario }
    ]);
    if (!error) {
      e.target.reset();
      await cargarResenasProducto(productoActualModal.id);
    }
  });
}