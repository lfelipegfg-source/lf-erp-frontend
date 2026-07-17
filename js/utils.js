export function todayFortaleza() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' });
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildFriendlyError(error) {
  const message = error?.message || '';
  const codigo = error?.payload?.codigo || '';
  const status = error?.status;

  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Não foi possível conectar ao servidor. Verifique sua conexão.';
  }
  if (codigo === 'TOKEN_EXPIRADO' || codigo === 'TOKEN_INVALIDO') {
    return 'Sua sessão expirou. Faça login novamente.';
  }
  if (codigo === 'SEM_TOKEN') {
    return 'Acesso negado. Faça login para continuar.';
  }
  if (codigo === 'EMPRESA_NAO_IDENTIFICADA') {
    return 'Empresa não identificada na sessão. Faça login novamente.';
  }
  if (codigo === 'SEM_PERMISSAO') {
    return 'Você não tem permissão para realizar esta ação.';
  }
  if (status === 403) {
    return 'Acesso negado. Verifique suas permissões ou faça login novamente.';
  }
  if (status === 404) {
    return 'Registro não encontrado.';
  }
  if (status === 429) {
    return message || 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  if (status >= 500) {
    return 'Erro no servidor. Tente novamente em instantes.';
  }
  return message || 'Não foi possível concluir a operação.';
}

export function calcPeriodoLocal(preset) {
  const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Fortaleza' }));
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const today = fmt(nowBR);
  let ini = today, fim = today;
  if (preset === '7dias') { const s = new Date(nowBR); s.setDate(s.getDate()-6); ini = fmt(s); }
  else if (preset === '30dias') { const s = new Date(nowBR); s.setDate(s.getDate()-29); ini = fmt(s); }
  else if (preset === 'mesAtual') { ini = `${nowBR.getFullYear()}-${pad(nowBR.getMonth()+1)}-01`; }
  else if (preset === 'mesAnterior') {
    const m = nowBR.getMonth(), y = nowBR.getFullYear();
    const pm = m === 0 ? 11 : m-1, py = m === 0 ? y-1 : y;
    ini = `${py}-${pad(pm+1)}-01`;
    fim = fmt(new Date(y, m, 0));
  }
  return { dataInicial: ini, dataFinal: fim };
}

export function maskPhone(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15);
}
