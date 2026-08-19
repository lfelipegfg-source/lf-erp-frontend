import { escapeHtml } from './utils.js';

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

export function confirmarAcao(mensagem, labelConfirmar = 'Confirmar', tipo = 'danger') {
  return new Promise((resolve) => {
    const cor = tipo === 'danger' ? 'var(--danger)' : tipo === 'warning' ? 'var(--warning)' : 'var(--primary)';

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
      <div style="background:var(--surface);border-radius:16px;padding:24px;max-width:380px;width:100%;box-shadow:0 24px 50px rgba(0,0,0,.2)">
        <p style="font-size:14px;margin:0 0 20px;color:var(--text)">${escapeHtml(mensagem)}</p>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button class="_cf-cancelar" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--surface-3);font-size:13px;cursor:pointer">Cancelar</button>
          <button class="_cf-confirmar" style="padding:8px 16px;border-radius:8px;border:none;background:${cor};color:#fff;font-size:13px;font-weight:600;cursor:pointer">${escapeHtml(labelConfirmar)}</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    let resolvido = false;

    function fechar(resultado) {
      if (resolvido) return;
      resolvido = true;
      document.removeEventListener('keydown', onKeydown);
      overlay.remove();
      resolve(resultado);
    }

    function onKeydown(e) {
      if (e.key === 'Escape') fechar(false);
    }

    document.addEventListener('keydown', onKeydown);

    overlay.querySelector('._cf-cancelar').addEventListener('click', () => fechar(false));
    overlay.querySelector('._cf-confirmar').addEventListener('click', () => fechar(true));

    // Clicar no backdrop fecha como cancelar
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(false); });

    // Foca o Cancelar por default — Enter não confirma acidentalmente
    overlay.querySelector('._cf-cancelar').focus();
  });
}

const _INPUT_TIPOS_PERMITIDOS = ['text', 'number', 'email', 'password', 'date', 'tel', 'url'];

export function pedirInput(label, placeholder = '', tipo = 'text') {
  if (!_INPUT_TIPOS_PERMITIDOS.includes(tipo)) tipo = 'text';
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
      <div style="background:var(--surface);border-radius:16px;padding:24px;max-width:380px;width:100%;box-shadow:0 24px 50px rgba(0,0,0,.2)">
        <p style="font-size:14px;margin:0 0 12px;color:var(--text)">${escapeHtml(label)}</p>
        <input class="_pi-input" type="${escapeHtml(tipo)}" placeholder="${escapeHtml(placeholder)}"
          style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;box-sizing:border-box" />
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
          <button class="_pi-cancelar" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--surface-3);font-size:13px;cursor:pointer">Cancelar</button>
          <button class="_pi-confirmar" style="padding:8px 16px;border-radius:8px;border:none;background:var(--primary);color:#fff;font-size:13px;font-weight:600;cursor:pointer">OK</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const input = overlay.querySelector('._pi-input');
    let resolvido = false;

    function fechar(valor) {
      if (resolvido) return;
      resolvido = true;
      document.removeEventListener('keydown', onKeydown);
      overlay.remove();
      resolve(valor);
    }

    function onKeydown(e) {
      if (e.key === 'Escape') fechar(null);
      if (e.key === 'Enter') fechar(input.value?.trim() || null);
    }

    document.addEventListener('keydown', onKeydown);
    overlay.querySelector('._pi-cancelar').addEventListener('click', () => fechar(null));
    overlay.querySelector('._pi-confirmar').addEventListener('click', () => fechar(input.value?.trim() || null));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(null); });

    setTimeout(() => input.focus(), 50);
  });
}
