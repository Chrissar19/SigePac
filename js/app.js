/* =============================================
   SigePac — Gestión de Pares Evaluadores
   Universidad de Nariño
   js/app.js
   ============================================= */

'use strict';

/* ===========================================
   CONSTANTES
   =========================================== */

/** Etapas del proceso de evaluación */
const ETAPAS = [
  'Invitación enviada',
  'Aceptó — esperando resultado',
  'Resultado recibido',
  'Cuenta de cobro recibida',
  'Pago estampillas',
  'Enviado a tesorería',
  'Completado'
];

/**
 * Los 12 documentos requeridos para enviar a tesorería.
 * Orden oficial del proceso de pago.
 */
const DOCS = [
  { nombre: 'Orden de pago',                              nota: '' },
  { nombre: 'Certificado de disponibilidad presupuestal (CDP)', nota: '' },
  { nombre: 'RP Res',                                     nota: 'Lo envía Presupuesto y Registro' },
  { nombre: 'PAC',                                        nota: '' },
  { nombre: 'Resolución',                                 nota: '' },
  { nombre: 'Cumplido',                                   nota: '' },
  { nombre: 'Recibo de pago de estampilla',               nota: '' },
  { nombre: 'Cuenta de cobro',                            nota: 'Solo tras calificación del concepto' },
  { nombre: 'Certificación juramentada',                  nota: 'Solo tras calificación del concepto' },
  { nombre: 'Copia de la cédula',                         nota: 'La envía el par' },
  { nombre: 'Certificado de cuenta bancaria',             nota: 'Lo envía el par' },
  { nombre: 'RUT actualizado',                            nota: 'Lo envía el par' },
];

/** Clases CSS de badge según etapa */
const ETAPA_BADGES = [
  'badge-inv',  // 0 - Invitación enviada
  'badge-acep', // 1 - Aceptó
  'badge-cal',  // 2 - Resultado recibido
  'badge-pago', // 3 - Cuenta de cobro
  'badge-est',  // 4 - Pago estampillas
  'badge-comp', // 5 - Enviado a tesorería
  'badge-comp'  // 6 - Completado
];

/** Claves de almacenamiento en localStorage */
const STORAGE_KEYS = {
  pares:     'pares_unar',
  conceptos: 'conceptos_unar',
  procesos:  'procesos_unar'
};

/** IDs de las pestañas en orden */
const TABS = ['tablero', 'pares', 'conceptos', 'correos', 'nuevo'];

/** IDs de procesos con checklist desplegado (estado de UI, no persiste) */
const checklistsAbiertos = new Set();

/* ===========================================
   ESTADO DE EDICIÓN (UI, no persiste)
   =========================================== */

let editandoPar            = null; // ID del par en edición, o null
let editandoConcepto       = null; // ID del concepto en edición, o null
let parIdParaAsignar       = null; // ID del par seleccionado en el modal
let conceptoIdSeleccionado = null; // ID del concepto elegido en el modal
let prIdParaResultado      = null; // ID del proceso cuyo resultado se está registrando

/* ===========================================
   ESTADO DE LA APLICACIÓN
   =========================================== */

let pares     = cargarDatos(STORAGE_KEYS.pares);
let conceptos = cargarDatos(STORAGE_KEYS.conceptos);
let procesos  = cargarDatos(STORAGE_KEYS.procesos);

/* ===========================================
   PERSISTENCIA
   =========================================== */

/** Carga un array desde localStorage de forma segura */
function cargarDatos(clave) {
  try {
    return JSON.parse(localStorage.getItem(clave) || '[]');
  } catch {
    console.warn(`Error al cargar datos de "${clave}". Se usará array vacío.`);
    return [];
  }
}

/** Guarda el estado completo en localStorage */
function save() {
  localStorage.setItem(STORAGE_KEYS.pares,     JSON.stringify(pares));
  localStorage.setItem(STORAGE_KEYS.conceptos, JSON.stringify(conceptos));
  localStorage.setItem(STORAGE_KEYS.procesos,  JSON.stringify(procesos));
}

/* ===========================================
   UTILIDADES
   =========================================== */

/** Genera un ID único basado en timestamp y aleatoriedad */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Retorna el array de documentos del proceso, inicializándolo si no existe.
 * Garantiza compatibilidad con procesos guardados antes de agregar esta función.
 */
function getDocs(pr) {
  if (!Array.isArray(pr.docs) || pr.docs.length !== DOCS.length) {
    pr.docs = new Array(DOCS.length).fill(false);
  }
  return pr.docs;
}

/**
 * Retorna el array de fechas por etapa, inicializándolo si no existe.
 * Backfill de fechaInicio en la etapa 0 para procesos anteriores.
 */
function getFechas(pr) {
  if (!Array.isArray(pr.fechas) || pr.fechas.length !== ETAPAS.length) {
    pr.fechas = new Array(ETAPAS.length).fill(null);
    if (pr.fechaInicio) pr.fechas[0] = pr.fechaInicio;
  }
  return pr.fechas;
}

/** Escapa caracteres HTML para prevenir XSS en contenido dinámico */
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ===========================================
   NAVEGACIÓN POR PESTAÑAS
   =========================================== */

/**
 * Muestra la pestaña indicada y oculta las demás.
 * @param {string} t - ID de la pestaña (tablero | pares | conceptos | correos | nuevo)
 */
function showTab(t) {
  TABS.forEach(id => {
    const panel = document.getElementById('tab-' + id);
    const btn   = document.querySelector(`.tab[data-tab="${id}"]`);
    if (panel) panel.classList.toggle('hidden', id !== t);
    if (btn)   btn.setAttribute('aria-selected', id === t ? 'true' : 'false');
    if (btn)   btn.classList.toggle('active', id === t);
  });

  // Renderizar el contenido de la pestaña activa
  const acciones = {
    tablero:   renderTablero,
    pares:     () => { renderPares(); poblarFiltros(); },
    conceptos: renderConceptos,
    correos:   poblarCorreoSelects,
  };

  if (acciones[t]) acciones[t]();
}

/* ===========================================
   MÓDULO: PARES EVALUADORES
   =========================================== */

/** Valida y guarda (o actualiza) un par evaluador */
function guardarPar() {
  const nombre = document.getElementById('n-nombre').value.trim();
  const email  = document.getElementById('n-email').value.trim();

  if (!nombre) { showMsg('El nombre del par es obligatorio.', 'danger'); return; }
  if (!email || !email.includes('@')) { showMsg('Ingresa un correo electrónico válido.', 'danger'); return; }

  if (editandoPar) {
    // ── Modo edición ──
    const duplicado = pares.find(p =>
      p.email.toLowerCase() === email.toLowerCase() && p.id !== editandoPar
    );
    if (duplicado) { showMsg(`Ya existe otro par con el correo "${email}".`, 'danger'); return; }

    const par = pares.find(p => p.id === editandoPar);
    if (par) {
      par.nombre  = nombre;
      par.email   = email;
      par.area    = document.getElementById('n-area').value.trim();
      par.nivel   = document.getElementById('n-nivel').value;
      par.scienti = document.getElementById('n-scienti').value.trim();
      par.notas   = document.getElementById('n-notas').value.trim();
    }
    save();
    cancelarEdicionPar();
    showTab('pares');
  } else {
    // ── Modo creación ──
    const duplicado = pares.find(p => p.email.toLowerCase() === email.toLowerCase());
    if (duplicado) { showMsg(`Ya existe un par con el correo "${email}".`, 'danger'); return; }

    pares.push({
      id:       uid(),
      nombre,
      email,
      area:     document.getElementById('n-area').value.trim(),
      nivel:    document.getElementById('n-nivel').value,
      scienti:  document.getElementById('n-scienti').value.trim(),
      notas:    document.getElementById('n-notas').value.trim(),
      fechaReg: new Date().toLocaleDateString('es-CO')
    });
    save();
    limpiarFormPar();
    showMsg('Par registrado correctamente.', 'success');
  }
}

/** Limpia el formulario de par y restablece el modo creación */
function limpiarFormPar() {
  ['n-nombre', 'n-email', 'n-area', 'n-scienti', 'n-notas']
    .forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('n-nivel').value = 'Doctor(a)';
}

/** Pre-rellena el formulario con datos del par y activa el modo edición */
function editarPar(id) {
  const par = pares.find(p => p.id === id);
  if (!par) return;

  editandoPar = id;

  document.getElementById('n-nombre').value  = par.nombre;
  document.getElementById('n-email').value   = par.email;
  document.getElementById('n-area').value    = par.area    || '';
  document.getElementById('n-nivel').value   = par.nivel   || 'Doctor(a)';
  document.getElementById('n-scienti').value = par.scienti || '';
  document.getElementById('n-notas').value   = par.notas   || '';

  document.getElementById('form-par-titulo').textContent = 'Editar par evaluador';
  document.getElementById('btn-guardar-par').innerHTML =
    '<i class="ti ti-device-floppy" aria-hidden="true"></i> Actualizar par';
  document.getElementById('btn-limpiar-par').classList.add('hidden');
  document.getElementById('btn-cancelar-par').classList.remove('hidden');

  showTab('nuevo');
  document.getElementById('n-nombre').focus();
}

/** Cancela la edición de un par y restablece el formulario */
function cancelarEdicionPar() {
  editandoPar = null;
  limpiarFormPar();
  document.getElementById('form-par-titulo').textContent = 'Registrar nuevo par evaluador';
  document.getElementById('btn-guardar-par').innerHTML =
    '<i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar par';
  document.getElementById('btn-limpiar-par').classList.remove('hidden');
  document.getElementById('btn-cancelar-par').classList.add('hidden');
}

/** Muestra un mensaje temporal de alerta en el formulario de nuevo par */
function showMsg(txt, tipo) {
  const el = document.getElementById('form-msg');
  el.className = `alert alert-${tipo}`;
  el.textContent = txt;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 3500);
}

/** Actualiza el selector de áreas en el filtro de pares */
function poblarFiltros() {
  const areas = [...new Set(pares.map(p => p.area).filter(Boolean))].sort();
  const sel   = document.getElementById('filter-area');
  const cur   = sel.value;

  sel.innerHTML = '<option value="">Todas las áreas</option>' +
    areas.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');

  if (areas.includes(cur)) sel.value = cur;
}

/** Renderiza la lista de pares con búsqueda y filtro aplicados */
function renderPares() {
  const q  = (document.getElementById('search-par').value || '').toLowerCase();
  const af = document.getElementById('filter-area').value;

  const lista = pares.filter(p => {
    const coincide = !q || (p.nombre + p.area + p.email + p.inst).toLowerCase().includes(q);
    const deArea   = !af || p.area === af;
    return coincide && deArea;
  });

  const cont = document.getElementById('pares-list');

  if (!lista.length) {
    cont.innerHTML = `
      <div class="empty">
        <i class="ti ti-users-off" aria-hidden="true"></i>
        No hay pares registrados aún.
      </div>`;
    return;
  }

  cont.innerHTML = lista.map(p => {
    const activos = procesos.filter(pr => pr.parId === p.id && pr.etapa < 6).length;

    const estadoBadge = activos
      ? `<span class="badge badge-acep">${activos} en proceso</span>`
      : `<span class="badge badge-disponible">Disponible</span>`;

    return `
    <div class="card">
      <div class="row">
        <div class="flex-1">
          <div class="par-name">
            ${esc(p.nombre)}
            ${p.area ? `<span class="tag-area">${esc(p.area)}</span>` : ''}
          </div>
          <div class="par-meta">
            ${esc(p.nivel)} · <a href="mailto:${esc(p.email)}">${esc(p.email)}</a>
          </div>
          ${p.scienti ? `
          <div class="par-meta" style="margin-top:2px;">
            <a href="${esc(p.scienti)}" target="_blank" rel="noopener noreferrer">
              <i class="ti ti-external-link" aria-hidden="true"></i> CvLAC / SCIENTI
            </a>
          </div>` : ''}
        </div>
        <div>${estadoBadge}</div>
      </div>
      ${p.notas ? `<div class="nota-box">${esc(p.notas)}</div>` : ''}
      <div class="actions">
        <button class="btn btn-sm" onclick="abrirModalAsignar('${p.id}')">
          <i class="ti ti-file-plus" aria-hidden="true"></i> Asignar a concepto
        </button>
        <button class="btn btn-sm" onclick="editarPar('${p.id}')">
          <i class="ti ti-pencil" aria-hidden="true"></i> Editar
        </button>
        <button class="btn btn-sm btn-danger" onclick="eliminarPar('${p.id}')">
          <i class="ti ti-trash" aria-hidden="true"></i> Eliminar
        </button>
      </div>
    </div>`;
  }).join('');
}

/** Elimina un par y sus procesos asociados */
function eliminarPar(id) {
  const par = pares.find(p => p.id === id);
  if (!par) return;
  if (!confirm(`¿Eliminar a "${par.nombre}"? Se eliminarán también sus procesos activos.`)) return;

  pares    = pares.filter(p => p.id !== id);
  procesos = procesos.filter(pr => pr.parId !== id);
  save();
  renderPares();
  renderTablero();
}

/** Abre el modal para asignar el par a un concepto */
function abrirModalAsignar(parId) {
  if (!conceptos.length) {
    alert('Primero registra un trabajo en la pestaña Conceptos.');
    return;
  }

  parIdParaAsignar       = parId;
  conceptoIdSeleccionado = null;

  const par   = pares.find(p => p.id === parId);
  const items = conceptos.map(c => {
    const yaAsignado = procesos.some(
      pr => pr.parId === parId && pr.conceptoId === c.id && pr.etapa < 6
    );
    return `
    <label class="concepto-option ${yaAsignado ? 'concepto-option--usado' : ''}">
      <input
        type="radio"
        name="concepto-sel"
        value="${c.id}"
        ${yaAsignado ? 'disabled' : ''}
        onchange="conceptoIdSeleccionado = '${c.id}'"
      >
      <div>
        <div class="concepto-option-titulo">${esc(c.titulo)}</div>
        <div class="par-meta">${esc(c.autor) || '—'} · ${esc(c.area) || '—'} · ${esc(c.tipo)}</div>
        ${yaAsignado
          ? '<span class="badge badge-acep" style="margin-top:4px;display:inline-block;">Ya asignado</span>'
          : ''}
      </div>
    </label>`;
  }).join('');

  document.getElementById('modal-par-nombre').textContent =
    par ? `Par: ${par.nombre}` : '';
  document.getElementById('modal-body').innerHTML = items;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

/** Cierra el modal (solo si se hace clic en el fondo oscuro o en botón cerrar) */
function cerrarModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('modal-overlay').classList.add('hidden');
  parIdParaAsignar       = null;
  conceptoIdSeleccionado = null;
}

/** Confirma la asignación y crea el proceso */
function confirmarAsignar() {
  if (!conceptoIdSeleccionado) {
    alert('Selecciona un trabajo de la lista.');
    return;
  }

  const c = conceptos.find(x => x.id === conceptoIdSeleccionado);
  if (!c) return;

  const hoy = new Date().toLocaleDateString('es-CO');
  procesos.push({
    id:          uid(),
    parId:       parIdParaAsignar,
    conceptoId:  c.id,
    etapa:       0,
    fechaInicio: hoy,
    notas:       '',
    docs:        new Array(DOCS.length).fill(false),
    fechas:      [hoy, ...new Array(ETAPAS.length - 1).fill(null)],
    resultado:   { tipo: null, nota: null }
  });

  save();
  cerrarModal();
  renderPares();
  renderTablero();
}

/* ===========================================
   MÓDULO: CONCEPTOS (TRABAJOS)
   =========================================== */

/** Muestra el formulario para registrar un nuevo concepto */
function showNuevoConcepto() {
  document.getElementById('nuevo-concepto-form').classList.remove('hidden');
  document.getElementById('nc-titulo').focus();
}

/** Valida y guarda (o actualiza) un concepto/trabajo */
function guardarConcepto() {
  const titulo = document.getElementById('nc-titulo').value.trim();
  if (!titulo) { alert('El título del trabajo es obligatorio.'); return; }

  if (editandoConcepto) {
    // ── Modo edición ──
    const c = conceptos.find(x => x.id === editandoConcepto);
    if (c) {
      c.titulo = titulo;
      c.autor  = document.getElementById('nc-autor').value.trim();
      c.cat    = document.getElementById('nc-cat').value.trim();
      c.tipo   = document.getElementById('nc-tipo').value;
      c.area   = document.getElementById('nc-area').value.trim();
    }
  } else {
    // ── Modo creación ──
    conceptos.push({
      id:    uid(),
      titulo,
      autor: document.getElementById('nc-autor').value.trim(),
      cat:   document.getElementById('nc-cat').value.trim(),
      tipo:  document.getElementById('nc-tipo').value,
      area:  document.getElementById('nc-area').value.trim(),
      fecha: new Date().toLocaleDateString('es-CO')
    });
  }

  save();
  cancelarEdicionConcepto();
  renderConceptos();
}

/** Pre-rellena el formulario de concepto y activa el modo edición */
function editarConcepto(id) {
  const c = conceptos.find(x => x.id === id);
  if (!c) return;

  editandoConcepto = id;

  document.getElementById('nc-titulo').value = c.titulo;
  document.getElementById('nc-autor').value  = c.autor || '';
  document.getElementById('nc-cat').value    = c.cat   || '';
  document.getElementById('nc-tipo').value   = c.tipo  || 'Ascenso';
  document.getElementById('nc-area').value   = c.area  || '';

  document.getElementById('nc-form-titulo').textContent = 'Editar trabajo';
  document.getElementById('btn-guardar-concepto').innerHTML =
    '<i class="ti ti-device-floppy" aria-hidden="true"></i> Actualizar';

  document.getElementById('nuevo-concepto-form').classList.remove('hidden');
  document.getElementById('nc-titulo').focus();
}

/** Cancela la edición y oculta el formulario de concepto */
function cancelarEdicionConcepto() {
  editandoConcepto = null;
  ['nc-titulo', 'nc-autor', 'nc-cat', 'nc-area'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('nc-form-titulo').textContent = 'Registrar nuevo trabajo';
  document.getElementById('btn-guardar-concepto').innerHTML =
    '<i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar';
  document.getElementById('nuevo-concepto-form').classList.add('hidden');
}

/** Elimina un concepto y sus procesos asociados */
function eliminarConcepto(id) {
  const c = conceptos.find(x => x.id === id);
  if (!c) return;
  if (!confirm(`¿Eliminar "${c.titulo}"? Se eliminarán también los procesos asociados.`)) return;

  conceptos = conceptos.filter(x => x.id !== id);
  procesos  = procesos.filter(pr => pr.conceptoId !== id);
  save();
  renderConceptos();
  renderTablero();
}

/** Renderiza la lista de conceptos/trabajos */
function renderConceptos() {
  const cont = document.getElementById('conceptos-list');

  if (!conceptos.length) {
    cont.innerHTML = `
      <div class="empty">
        <i class="ti ti-file-off" aria-hidden="true"></i>
        No hay trabajos registrados.
      </div>`;
    return;
  }

  cont.innerHTML = conceptos.map(c => {
    const ps = procesos.filter(pr => pr.conceptoId === c.id);

    const filasPares = ps.map(pr => {
      const par        = pares.find(p => p.id === pr.parId);
      const docs       = getDocs(pr);
      const fechas     = getFechas(pr);
      const recibidos  = docs.filter(Boolean).length;
      const completos  = recibidos === DOCS.length;
      const abierto    = checklistsAbiertos.has(pr.id);
      const fechaEtapa = fechas[pr.etapa];

      const itemsDocs = DOCS.map((d, i) => `
        <label class="doc-item ${docs[i] ? 'doc-item--ok' : ''}">
          <input
            type="checkbox"
            ${docs[i] ? 'checked' : ''}
            onchange="toggleDoc('${pr.id}', ${i})"
            aria-label="${esc(d.nombre)}"
          >
          <span class="doc-nombre">${esc(d.nombre)}</span>
          ${d.nota ? `<span class="doc-nota">${esc(d.nota)}</span>` : ''}
        </label>`).join('');

      return `
      <div class="proceso-par-row ${pr.etapa === 6 ? 'proceso-par-row--ok' : ''}">
        <div class="flex-1">${esc(par ? par.nombre : '(par eliminado)')}</div>
        <div>
          <div class="etapa-label" style="margin:0;">${esc(ETAPAS[pr.etapa])}</div>
          ${fechaEtapa ? `<div class="etapa-fecha">${esc(fechaEtapa)}</div>` : ''}
        </div>
        <span class="badge ${ETAPA_BADGES[pr.etapa]}">${pr.etapa + 1}/${ETAPAS.length}</span>
        <button
          class="btn btn-sm ${completos ? 'btn-docs-ok' : ''}"
          onclick="toggleChecklist('${pr.id}')"
          title="Ver documentos"
          aria-expanded="${abierto}"
        >
          <i class="ti ti-checklist" aria-hidden="true"></i>
          ${recibidos}/${DOCS.length}
        </button>
        ${(() => {
          const res = getResultado(pr);
          if (res) return `
            <span class="badge ${res.badge}" style="cursor:pointer;" onclick="abrirModalResultado('${pr.id}')" title="Editar resultado">
              ${esc(res.texto)}
            </span>`;
          return `<button class="btn btn-sm" onclick="abrirModalResultado('${pr.id}')" title="Registrar resultado">
            <i class="ti ti-clipboard-check" aria-hidden="true"></i>
          </button>`;
        })()}
        ${pr.etapa < 6
          ? `<button class="btn btn-sm" onclick="avanzarEtapa('${pr.id}')">Avanzar ▶</button>`
          : '<span class="badge badge-comp">✓ Completo</span>'
        }
        <button class="btn btn-sm btn-danger" onclick="eliminarProceso('${pr.id}')" title="Eliminar proceso">
          <i class="ti ti-x" aria-hidden="true"></i>
        </button>
      </div>
      <div id="cl-${pr.id}" class="checklist ${abierto ? '' : 'hidden'}">
        <div class="checklist-header">
          <i class="ti ti-folders" aria-hidden="true"></i>
          Documentos para tesorería —
          <strong>${recibidos} de ${DOCS.length}</strong> recibidos
          ${completos ? '<span class="badge badge-acep" style="margin-left:6px;">✓ Completo</span>' : ''}
        </div>
        <div class="checklist-grid">${itemsDocs}</div>
      </div>`;
    }).join('');

    const todosCompletos = ps.length > 0 && ps.every(pr => pr.etapa === 6);

    return `
    <div class="card ${todosCompletos ? 'card--completado' : ''}">
      <div class="proceso-header">
        <div>
          <div style="font-weight:500;">${esc(c.titulo)}</div>
          <div class="par-meta">
            ${esc(c.autor) || '—'} ·
            ${c.area ? `<span class="tag-area">${esc(c.area)}</span>` : '—'} ·
            ${esc(c.tipo)}
          </div>
          ${c.cat ? `<div class="par-meta">Categoría: ${esc(c.cat)}</div>` : ''}
        </div>
        <div style="text-align:right;font-size:12px;color:var(--color-text-secondary);">
          ${ps.length} par(es) asignado(s)
        </div>
      </div>
      ${ps.length ? `
        <div class="divider"></div>
        <div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:6px;">Pares asignados:</div>
        ${filasPares}
      ` : ''}
      <div class="actions">
        <button class="btn btn-sm" onclick="editarConcepto('${c.id}')">
          <i class="ti ti-pencil" aria-hidden="true"></i> Editar
        </button>
        <button class="btn btn-sm btn-danger" onclick="eliminarConcepto('${c.id}')">
          <i class="ti ti-trash" aria-hidden="true"></i> Eliminar
        </button>
      </div>
    </div>`;
  }).join('');
}

/** Avanza el proceso de un par en una etapa y registra la fecha */
function avanzarEtapa(prId) {
  const pr = procesos.find(p => p.id === prId);
  if (!pr || pr.etapa >= 6) return;

  pr.etapa++;
  getFechas(pr)[pr.etapa] = new Date().toLocaleDateString('es-CO');
  save();
  renderConceptos();
  renderTablero();
}

/** Elimina un proceso individual (desvincula par de concepto) */
function eliminarProceso(prId) {
  if (!confirm('¿Eliminar este proceso de evaluación?')) return;
  procesos = procesos.filter(p => p.id !== prId);
  checklistsAbiertos.delete(prId);
  save();
  renderConceptos();
  renderTablero();
}

/** Marca o desmarca un documento del checklist */
function toggleDoc(prId, docIdx) {
  const pr = procesos.find(p => p.id === prId);
  if (!pr) return;
  getDocs(pr);
  pr.docs[docIdx] = !pr.docs[docIdx];
  save();
  renderConceptos();
}

/** Despliega o colapsa el checklist de documentos de un proceso */
function toggleChecklist(prId) {
  if (checklistsAbiertos.has(prId)) {
    checklistsAbiertos.delete(prId);
  } else {
    checklistsAbiertos.add(prId);
  }
  renderConceptos();
}

/* ===========================================
   MÓDULO: TABLERO
   =========================================== */

/** Renderiza el tablero con estadísticas y procesos activos */
function renderTablero() {
  const total     = pares.length;
  const activos   = procesos.filter(p => p.etapa < 6).length;
  const completos = procesos.filter(p => p.etapa === 6).length;

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card">
      <div class="stat-num">${total}</div>
      <div class="stat-lbl">Pares registrados</div>
    </div>
    <div class="stat-card">
      <div class="stat-num" style="color:#dfa013;">${activos}</div>
      <div class="stat-lbl">En proceso activo</div>
    </div>
    <div class="stat-card">
      <div class="stat-num" style="color:#265531;">${completos}</div>
      <div class="stat-lbl">Completados</div>
    </div>`;

  const actPs = procesos.filter(p => p.etapa < 6);
  const cont  = document.getElementById('tablero-list');

  if (!actPs.length) {
    cont.innerHTML = '<div class="empty">No hay pares en proceso activo.</div>';
    return;
  }

  cont.innerHTML = actPs.map(pr => {
    const par    = pares.find(p => p.id === pr.parId);
    const con    = conceptos.find(c => c.id === pr.conceptoId);
    const fechas = getFechas(pr);

    const dots = ETAPAS.map((_, i) => {
      const clase = i < pr.etapa ? 'done' : i === pr.etapa ? 'active' : '';
      return `<div class="etapa-dot ${clase}" title="${ETAPAS[i]}${fechas[i] ? ' · ' + fechas[i] : ''}"></div>`;
    }).join('');

    return `
    <div class="card">
      <div class="row">
        <div class="flex-1">
          <div class="par-name">${esc(par ? par.nombre : '(par eliminado)')}</div>
          <div class="par-meta">${esc(con ? con.titulo : '(trabajo eliminado)')}</div>
        </div>
        <span class="badge ${ETAPA_BADGES[pr.etapa]}">${esc(ETAPAS[pr.etapa])}</span>
      </div>
      <div style="margin-top:8px;">
        <div class="etapa-label">
          Progreso — etapa ${pr.etapa + 1} de ${ETAPAS.length}
          ${fechas[pr.etapa] ? `<span class="etapa-fecha" style="margin-left:6px;">${esc(fechas[pr.etapa])}</span>` : ''}
        </div>
        <div class="etapa-bar" role="progressbar" aria-valuenow="${pr.etapa + 1}" aria-valuemax="${ETAPAS.length}">${dots}</div>
      </div>
      <div class="actions">
        <button class="btn btn-sm" onclick="avanzarEtapa('${pr.id}')">
          Avanzar etapa ▶
        </button>
        <button class="btn btn-sm" onclick="showTab('correos')">
          <i class="ti ti-mail" aria-hidden="true"></i> Generar correo
        </button>
      </div>
    </div>`;
  }).join('');

  // ── Historial de completados ──────────────────────────
  renderHistorial();
}

/** Renderiza la sección de procesos completados en el tablero */
function renderHistorial() {
  const seccion = document.getElementById('historial-section');
  if (!seccion) return;

  const completados = procesos.filter(p => p.etapa === 6);

  if (!completados.length) {
    seccion.innerHTML = '';
    return;
  }

  const filas = completados.map(pr => {
    const par    = pares.find(p => p.id === pr.parId);
    const con    = conceptos.find(c => c.id === pr.conceptoId);
    const fechas = getFechas(pr);
    const inicio = fechas[0] || pr.fechaInicio || '—';
    const fin    = fechas[6] || '—';

    const timeline = ETAPAS.map((etapa, i) => `
      <div class="hist-etapa">
        <div class="hist-dot ${fechas[i] ? 'hist-dot--ok' : ''}"></div>
        <span class="hist-etapa-nombre">${esc(etapa)}</span>
        <span class="hist-etapa-fecha">${fechas[i] ? esc(fechas[i]) : '—'}</span>
      </div>`).join('');

    return `
    <div class="card card--completado">
      <div class="row">
        <div class="flex-1">
          <div class="par-name">${esc(par ? par.nombre : '(par eliminado)')}</div>
          <div class="par-meta">${esc(con ? con.titulo : '(trabajo eliminado)')}</div>
          <div class="par-meta" style="margin-top:3px;">
            Inicio: <strong>${esc(inicio)}</strong> &nbsp;→&nbsp; Completado: <strong>${esc(fin)}</strong>
          </div>
        </div>
        <span class="badge badge-comp">✓ Completado</span>
      </div>
      <details style="margin-top:8px;">
        <summary class="hist-summary">
          <i class="ti ti-timeline" aria-hidden="true"></i> Ver línea de tiempo
        </summary>
        <div class="hist-timeline">${timeline}</div>
      </details>
    </div>`;
  }).join('');

  seccion.innerHTML = `
    <div class="historial-header">
      <h2 style="margin:0; font-size:16px;">Historial de completados</h2>
      <span class="badge badge-comp">${completados.length}</span>
    </div>
    <div style="margin-top:0.75rem;">${filas}</div>`;
}

/* ===========================================
   MÓDULO: RESULTADO DE EVALUACIÓN
   =========================================== */

/** Retorna el texto legible del resultado y la clase de badge */
function getResultado(pr) {
  const r = pr.resultado;
  if (!r || !r.tipo) return null;
  const textos = {
    aceptado:     r.nota ? `Aceptado — ${r.nota}` : 'Aceptado',
    rechazado:    'Rechazado',
    correcciones: 'Enviado a correcciones',
  };
  const badges = {
    aceptado:     'badge-acep',
    rechazado:    'badge-rechaz',
    correcciones: 'badge-cal',
  };
  return { texto: textos[r.tipo] || r.tipo, badge: badges[r.tipo] || '' };
}

/** Abre el modal para registrar el resultado de un proceso */
function abrirModalResultado(prId) {
  const pr  = procesos.find(p => p.id === prId);
  const con = pr ? conceptos.find(c => c.id === pr.conceptoId) : null;
  const par = pr ? pares.find(p => p.id === pr.parId) : null;
  if (!pr) return;

  prIdParaResultado = prId;

  // Pre-rellenar si ya hay resultado
  const r = pr.resultado || {};
  document.getElementById('res-tipo').value = r.tipo || '';
  document.getElementById('res-nota').value = r.nota || '';

  // Subtítulo con contexto
  document.getElementById('modal-res-subtitulo').textContent =
    `${par ? par.nombre : ''} — ${con ? con.titulo : ''}`;

  // Mostrar campo nota solo para productividad académica
  const esProductividad = con && con.tipo === 'Productividad académica';
  document.getElementById('res-nota-div').classList.toggle('hidden', !esProductividad);

  document.getElementById('modal-resultado-overlay').classList.remove('hidden');
}

/** Muestra/oculta el campo de nota según tipo y concepto */
function toggleNotaResultado() {
  const pr  = procesos.find(p => p.id === prIdParaResultado);
  const con = pr ? conceptos.find(c => c.id === pr.conceptoId) : null;
  const esProductividad = con && con.tipo === 'Productividad académica';
  const esAceptado = document.getElementById('res-tipo').value === 'aceptado';
  document.getElementById('res-nota-div').classList.toggle('hidden', !(esProductividad && esAceptado));
}

/** Cierra el modal de resultado */
function cerrarModalResultado(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('modal-resultado-overlay').classList.add('hidden');
  prIdParaResultado = null;
}

/** Guarda el resultado del proceso */
function guardarResultado() {
  const tipo = document.getElementById('res-tipo').value;
  if (!tipo) { alert('Selecciona un resultado.'); return; }

  const pr  = procesos.find(p => p.id === prIdParaResultado);
  const con = pr ? conceptos.find(c => c.id === pr.conceptoId) : null;
  if (!pr) return;

  const nota = (con && con.tipo === 'Productividad académica' && tipo === 'aceptado')
    ? document.getElementById('res-nota').value.trim()
    : null;

  pr.resultado = { tipo, nota };
  save();
  cerrarModalResultado();
  renderConceptos();
}

/* ===========================================
   MÓDULO: CORREOS
   =========================================== */

/** Puebla los selectores de par y concepto en la pestaña Correos */
function poblarCorreoSelects() {
  const selectorPar = document.getElementById('correo-par');
  selectorPar.innerHTML = '<option value="">— Seleccionar par —</option>' +
    pares.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('');

  const selectorConcepto = document.getElementById('correo-concepto');
  selectorConcepto.innerHTML = '<option value="">— Seleccionar trabajo —</option>' +
    conceptos.map(c => `<option value="${c.id}">${esc(c.titulo)}</option>`).join('');

  generarCorreo();
}

/** Genera la vista previa del correo según la plantilla seleccionada */
function generarCorreo() {
  const tipo  = document.getElementById('plantilla-sel').value;
  const parId = document.getElementById('correo-par').value;
  const conId = document.getElementById('correo-concepto').value;

  document.getElementById('correo-extra').classList.toggle('hidden', tipo !== 'inv');

  const par  = pares.find(p => p.id === parId);
  const con  = conceptos.find(c => c.id === conId);
  const prev = document.getElementById('correo-preview');

  if (!par || !con) {
    prev.textContent = 'Selecciona un par y un trabajo para generar el correo.';
    return;
  }

  const catInput = document.getElementById('correo-cat');
  const cat = con.cat || (catInput ? catInput.value.trim() : '') || '___';

  if (tipo === 'inv') {
    prev.textContent =
`Doctor(a)
${par.nombre}

Cordial saludo.

Conocedores de su calidad académica e investigativa, solicito muy respetuosamente su colaboración con la evaluación del trabajo titulado:

${con.titulo.toUpperCase()}

Presentado por el docente ${con.autor} con fines de ascenso a la categoría ${cat} en el escalafón docente tiempo completo de la Universidad de Nariño.

La Universidad de Nariño reconoce 1/3 del S.M.L.V, por la evaluación. Una vez recibidos los soportes, Usted cuenta con veinte (20) días calendario para emitir el concepto.

En caso de aceptar realizar el proceso de evaluación, comedidamente solicito tener en cuenta los documentos relacionados a continuación, con el fin de tramitar los recursos para el respectivo pago:

- Cédula de ciudadanía
- Certificado de Cuenta Bancaria
- RUT actualizado (actividad económica, responsabilidad y con fecha)

Quedo atenta a su respuesta e inquietudes.`;
  } else {
    prev.textContent =
`Cordial saludo,

Muchas gracias.

Estimado(a) ${par.nombre}, agradecemos su disposición para realizar la evaluación, confirmo el recibido.

Además, con fines de gestionar su correspondiente pago, favor diligenciar el formato de cuenta de cobro adjunto, la certificación juramentada y adjuntarlos en formato PDF.

Quedo pendiente,`;
  }
}

/** Copia el correo generado al portapapeles */
function copiarCorreo() {
  const txt = document.getElementById('correo-preview').textContent;
  const btn = document.querySelector('.copy-row .btn');

  if (!txt || txt.startsWith('Selecciona')) {
    alert('Primero genera un correo seleccionando un par y un trabajo.');
    return;
  }

  navigator.clipboard.writeText(txt).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="ti ti-check" aria-hidden="true"></i> Copiado';
    setTimeout(() => { btn.innerHTML = orig; }, 2500);
  }).catch(() => {
    alert('No se pudo copiar automáticamente. Selecciona el texto manualmente con Ctrl+A.');
  });
}

/* ===========================================
   MÓDULO: EXPORTACIÓN A EXCEL
   =========================================== */

/** Calcula el ancho óptimo de cada columna según el contenido */
function autoWidth(datos) {
  if (!datos.length) return [];
  return Object.keys(datos[0]).map(key => ({
    wch: Math.min(
      60,
      Math.max(key.length, ...datos.map(row => String(row[key] ?? '').length)) + 2
    )
  }));
}

/** Exporta todos los datos a un archivo Excel con 3 hojas */
function exportarExcel() {
  if (!window.XLSX) {
    alert('La librería de Excel no está disponible. Verifica tu conexión e intenta de nuevo.');
    return;
  }

  const wb = XLSX.utils.book_new();

  // ── Hoja 1: Pares y evaluaciones (vista principal) ───
  // Una fila por proceso. Pares sin procesos aparecen igual con columnas vacías.
  const filasMain = [];

  pares.forEach(p => {
    const procesosDelPar = procesos.filter(pr => pr.parId === p.id);
    const activos = procesosDelPar.filter(pr => pr.etapa < 6).length;

    if (!procesosDelPar.length) {
      filasMain.push({
        'Evaluador':          p.nombre    || '',
        'Correo':             p.email     || '',
        'Notas':              p.notas     || '',
        'Fecha de registro':  p.fechaReg  || '',
        'Procesos activos':   0,
        'Trabajo evaluado':   '',
        'Tipo':               '',
        'Categoría':          '',
        'Etapa actual':       '',
        'Resultado':          '',
        'Nota':               '',
      });
    } else {
      procesosDelPar.forEach(pr => {
        const con = conceptos.find(c => c.id === pr.conceptoId);
        const res = pr.resultado || {};
        const resTexto = res.tipo === 'aceptado'    ? 'Aceptado'
                       : res.tipo === 'rechazado'   ? 'Rechazado'
                       : res.tipo === 'correcciones'? 'Enviado a correcciones'
                       : '';
        filasMain.push({
          'Evaluador':         p.nombre                   || '',
          'Correo':            p.email                    || '',
          'Notas':             p.notas                    || '',
          'Fecha de registro': p.fechaReg                 || '',
          'Procesos activos':  activos,
          'Trabajo evaluado':  con ? con.titulo           : '(eliminado)',
          'Tipo':              con ? con.tipo              : '',
          'Categoría':         con ? con.cat               : '',
          'Etapa actual':      ETAPAS[pr.etapa]           || '',
          'Resultado':         resTexto,
          'Nota':              res.nota                   || '',
        });
      });
    }
  });

  const wsMain = XLSX.utils.json_to_sheet(filasMain.length ? filasMain : [{}]);
  wsMain['!cols'] = autoWidth(filasMain.length ? filasMain : [{}]);
  XLSX.utils.book_append_sheet(wb, wsMain, 'Pares y evaluaciones');

  // ── Hoja 2: Trabajos (conceptos) ─────────────────────
  const datosConceptos = conceptos.map(c => {
    const ps = procesos.filter(pr => pr.conceptoId === c.id);
    return {
      'Título del trabajo':   c.titulo || '',
      'Docente autor':        c.autor  || '',
      'Categoría de ascenso': c.cat    || '',
      'Tipo':                 c.tipo   || '',
      'Área temática':        c.area   || '',
      'Fecha de registro':    c.fecha  || '',
      'Pares asignados':      ps.length,
      'Estado': ps.length === 0
        ? 'Sin asignar'
        : ps.every(pr => pr.etapa === 6) ? 'Completado' : 'En proceso',
    };
  });

  const wsConceptos = XLSX.utils.json_to_sheet(datosConceptos.length ? datosConceptos : [{}]);
  wsConceptos['!cols'] = autoWidth(datosConceptos.length ? datosConceptos : [{}]);
  XLSX.utils.book_append_sheet(wb, wsConceptos, 'Trabajos');

  // ── Hoja 3: Seguimiento detallado (etapas + documentos)
  const datosProcesos = procesos.map(pr => {
    const par    = pares.find(p => p.id === pr.parId);
    const con    = conceptos.find(c => c.id === pr.conceptoId);
    const fechas = getFechas(pr);
    const docs   = getDocs(pr);
    const fila   = {
      'Evaluador':        par ? par.nombre : '(eliminado)',
      'Trabajo evaluado': con ? con.titulo : '(eliminado)',
      'Etapa actual':     ETAPAS[pr.etapa],
      'Documentos':       `${docs.filter(Boolean).length}/${DOCS.length}`,
    };
    ETAPAS.forEach((etapa, i) => { fila[`Fecha — ${etapa}`] = fechas[i] || ''; });
    DOCS.forEach((doc, i)    => { fila[`Doc: ${doc.nombre}`] = docs[i] ? 'Sí' : 'No'; });
    return fila;
  });

  const wsProcesos = XLSX.utils.json_to_sheet(datosProcesos.length ? datosProcesos : [{}]);
  wsProcesos['!cols'] = autoWidth(datosProcesos.length ? datosProcesos : [{}]);
  XLSX.utils.book_append_sheet(wb, wsProcesos, 'Seguimiento detallado');

  // ── Descargar ─────────────────────────────────────────
  const fecha = new Date().toLocaleDateString('es-CO').replace(/\//g, '-');
  XLSX.writeFile(wb, `SigePac_${fecha}.xlsx`);
}

/* ===========================================
   INICIALIZACIÓN
   =========================================== */

document.addEventListener('DOMContentLoaded', () => {
  renderTablero();
});
