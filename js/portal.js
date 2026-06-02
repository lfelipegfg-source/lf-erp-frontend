/**
 * Portal do Cliente — LF ERP
 * Módulo standalone, sem dependência do api.js principal.
 */

const API_URL = window.LF_ERP_API_URL
  || localStorage.getItem('lf_erp_api_url')
  || 'https://lf-erp-backend.onrender.com';

const STORAGE_KEY = 'lf_erp_portal_token';

// ── Autenticação ─────────────────────────────────────────────────────────────

function getToken() {
  return sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY) || null;
}

function saveToken(token) {
  sessionStorage.setItem(STORAGE_KEY, token);
}

function clearToken() {
  sessionStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY);
}

function getPayload() {
  const token = getToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

// ── Request ──────────────────────────────────────────────────────────────────

async function portalRequest(path, options = {}) {
  const { method = 'GET', body } = options;
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erro || `HTTP ${res.status}`);
  return data;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCur(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(v) {
  if (!v) return '-';
  if (/^\d{4}-\d{2}-\d{2}/.test(String(v))) {
    const [ano, mes, dia] = String(v).slice(0, 10).split('-');
    return `${dia}/${mes}/${ano}`;
  }
  return new Date(v).toLocaleDateString('pt-BR');
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[c]));
}

function statusBadge(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'pago') return `<span class="badge badge-pago">Pago</span>`;
  if (s === 'atrasado' || s === 'parcial_atrasado') return `<span class="badge badge-atrasado">Atrasado</span>`;
  return `<span class="badge badge-aberto">Em aberto</span>`;
}

function setContent(html) {
  const el = document.getElementById('portalContent');
  if (el) el.innerHTML = html;
}

// ── UI: Login ────────────────────────────────────────────────────────────────

function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appScreen').style.display = 'none';
}

function showApp(payload) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'block';
  document.getElementById('portalClienteNome').textContent = `Olá, ${payload.nome}`;
  document.getElementById('portalEmpresaNome').textContent = payload.empresa_nome || '';
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

let currentTab = 'resumo';

function bindTabs() {
  document.querySelectorAll('.portal-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll('.portal-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      loadTab(currentTab);
    });
  });
}

async function loadTab(tab) {
  setContent('<div class="loading-spin"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</div>');
  try {
    if (tab === 'resumo')  await renderResumo();
    if (tab === 'titulos') await renderTitulos();
    if (tab === 'compras') await renderCompras();
  } catch (err) {
    if (err.message?.includes('403') || err.message?.includes('Token')) {
      clearToken();
      showLogin();
      return;
    }
    setContent(`<div class="empty-msg"><i class="fa-solid fa-circle-exclamation"></i><br>${esc(err.message || 'Erro ao carregar dados.')}</div>`);
  }
}

// ── Resumo ───────────────────────────────────────────────────────────────────

async function renderResumo() {
  const data = await portalRequest('/portal/resumo');

  const alertaAtrasado = Number(data.total_atrasado || 0) > 0
    ? `<div style="background:var(--danger-soft);border:1px solid #fca5a5;border-radius:12px;padding:14px 16px;margin-bottom:20px;color:var(--danger);font-size:13px;font-weight:600">
         <i class="fa-solid fa-triangle-exclamation"></i>
         Você possui títulos em atraso totalizando ${fmtCur(data.total_atrasado)}.
         Regularize para evitar juros.
       </div>`
    : '';

  setContent(`
    ${alertaAtrasado}
    <div class="kpi-row">
      <div class="kpi-box ${Number(data.total_aberto) > 0 ? 'kpi-box--danger' : ''}">
        <div class="kpi-box__label">Em aberto</div>
        <div class="kpi-box__value">${fmtCur(data.total_aberto)}</div>
      </div>
      <div class="kpi-box ${Number(data.total_atrasado) > 0 ? 'kpi-box--danger' : ''}">
        <div class="kpi-box__label">Atrasado</div>
        <div class="kpi-box__value">${fmtCur(data.total_atrasado)}</div>
      </div>
      <div class="kpi-box kpi-box--success">
        <div class="kpi-box__label">Já pago</div>
        <div class="kpi-box__value">${fmtCur(data.total_pago)}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-box__label">Compras</div>
        <div class="kpi-box__value">${Number(data.total_compras || 0)}</div>
      </div>
    </div>

    <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
      Acesse as abas <strong>Meus Títulos</strong> e <strong>Compras</strong> para detalhar.
    </p>
  `);
}

// ── Títulos ──────────────────────────────────────────────────────────────────

async function renderTitulos() {
  const data = await portalRequest('/portal/titulos');
  const titulos = data.titulos || [];

  if (!titulos.length) {
    setContent('<div class="empty-msg"><i class="fa-solid fa-check-circle" style="color:var(--success)"></i><br>Nenhum título encontrado.</div>');
    return;
  }

  const rows = titulos.map((t) => `
    <tr>
      <td>${fmtDate(t.data_vencimento)}</td>
      <td>${t.parcela ? `${t.parcela}/${t.total_parcelas}` : '-'}</td>
      <td>${statusBadge(t.status)}</td>
      <td style="text-align:right"><strong>${fmtCur(t.valor)}</strong></td>
      <td>${t.data_pagamento ? fmtDate(t.data_pagamento) : '-'}</td>
    </tr>
  `).join('');

  setContent(`
    <div class="portal-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Vencimento</th>
            <th>Parcela</th>
            <th>Status</th>
            <th style="text-align:right">Valor</th>
            <th>Pagamento</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `);
}

// ── Compras ──────────────────────────────────────────────────────────────────

async function renderCompras() {
  const data = await portalRequest('/portal/vendas');
  const vendas = data.vendas || [];

  if (!vendas.length) {
    setContent('<div class="empty-msg"><i class="fa-solid fa-bag-shopping"></i><br>Nenhuma compra encontrada.</div>');
    return;
  }

  const rows = vendas.map((v) => `
    <tr>
      <td>${fmtDate(v.data)}</td>
      <td>${esc(v.pagamento || '-')}</td>
      <td>${Number(v.total_itens)}</td>
      <td style="text-align:right"><strong>${fmtCur(v.total)}</strong></td>
      <td>${statusBadge(v.status_pagamento)}</td>
    </tr>
  `).join('');

  setContent(`
    <div class="portal-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Pagamento</th>
            <th>Itens</th>
            <th style="text-align:right">Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `);
}

// ── Init ─────────────────────────────────────────────────────────────────────

function init() {
  // Verifica sessão existente
  const payload = getPayload();
  if (payload && payload.tipo === 'cliente' && payload.exp * 1000 > Date.now()) {
    showApp(payload);
    bindTabs();
    loadTab('resumo');
  } else {
    clearToken();
    showLogin();
  }

  // Login
  document.getElementById('loginBtn').addEventListener('click', handleLogin);
  document.getElementById('loginSenha').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('loginDoc').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('loginSenha').focus();
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearToken();
    showLogin();
    document.getElementById('loginDoc').value = '';
    document.getElementById('loginSenha').value = '';
    document.getElementById('loginError').style.display = 'none';
  });
}

async function handleLogin() {
  const doc   = document.getElementById('loginDoc').value.trim();
  const senha = document.getElementById('loginSenha').value;
  const btn   = document.getElementById('loginBtn');
  const err   = document.getElementById('loginError');

  err.style.display = 'none';

  if (!doc || !senha) {
    err.textContent = 'Informe CPF/CNPJ e senha.';
    err.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Entrando...';

  try {
    const result = await portalRequest('/portal/login', {
      method: 'POST',
      body: { cpf_cnpj: doc, senha }
    });

    saveToken(result.token);
    const payload = getPayload();
    showApp(payload);
    bindTabs();
    loadTab('resumo');
  } catch (e) {
    err.textContent = e.message || 'Erro ao entrar. Verifique seus dados.';
    err.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

document.addEventListener('DOMContentLoaded', init);
