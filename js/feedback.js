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
