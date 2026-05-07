export function showToast(message, type = 'info', duration = 3500) {
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
    <span>${escapeHtml(message)}</span>
    <button type="button" aria-label="Fechar">&times;</button>
  `;

  const close = () => {
    toast.classList.add('toast--hide');
    setTimeout(() => toast.remove(), 250);
  };

  toast.querySelector('button')?.addEventListener('click', close);

  container.appendChild(toast);

  setTimeout(close, duration);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
