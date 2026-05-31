export function showToast(message, type = 'info', duration = 4000) {
  if (!message) return;

  let container = document.getElementById('toastContainer');

  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <div class="toast__content">
      <strong>${escapeHtml(getTituloToast(type))}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
    <button type="button" class="toast__close" aria-label="Fechar">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  const close = () => {
    toast.classList.add('toast--hide');
    setTimeout(() => toast.remove(), 250);
  };

  toast.querySelector('.toast__close')?.addEventListener('click', close);

  container.appendChild(toast);

  setTimeout(close, duration);
}

function getTituloToast(type) {
  switch (type) {
    case 'success': return 'Sucesso';
    case 'error':   return 'Erro';
    case 'warning': return 'Atenção';
    default:        return 'Informação';
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}


export function confirmarAcao(mensagem, labelConfirmar = 'Confirmar', tipo = 'danger') {
  return new Promise((resolve) => {
    const cor = tipo === 'danger' ? 'var(--danger)' : tipo === 'warning' ? 'var(--warning)' : 'var(--primary)';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
      <div style="background:var(--surface);border-radius:16px;padding:24px;max-width:380px;width:100%;box-shadow:0 24px 50px rgba(0,0,0,.2)">
        <p style="font-size:14px;margin:0 0 20px;color:var(--text)">${escapeHtml(mensagem)}</p>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button id="_cfCancelar" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--surface-3);font-size:13px;cursor:pointer">Cancelar</button>
          <button id="_cfConfirmar" style="padding:8px 16px;border-radius:8px;border:none;background:${cor};color:#fff;font-size:13px;font-weight:600;cursor:pointer">${escapeHtml(labelConfirmar)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#_cfCancelar').onclick = () => { document.body.removeChild(overlay); resolve(false); };
    overlay.querySelector('#_cfConfirmar').onclick = () => { document.body.removeChild(overlay); resolve(true); };
  });
}
