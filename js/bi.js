/**
 * BI Simplificado — C4.5
 * Relatórios executivos com gráficos avançados usando Chart.js
 */

import api from './api.js';
import { showToast } from './feedback.js';

const CHARTS = {};

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtN(v, dec = 0) {
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function sinal(v) {
  if (v > 0) return `<span style="color:#22c55e">▲ ${fmtN(v,1)}%</span>`;
  if (v < 0) return `<span style="color:#ef4444">▼ ${fmtN(Math.abs(v),1)}%</span>`;
  return `<span style="color:#94a3b8">— 0%</span>`;
}

function destroyChart(id) {
  if (CHARTS[id]) { CHARTS[id].destroy(); delete CHARTS[id]; }
}

function injectStyles() {
  if (document.getElementById('bi-styles')) return;
  const s = document.createElement('style');
  s.id = 'bi-styles';
  s.textContent = `
    .bi-wrap { padding: 0 0 32px; }
    .bi-toolbar { display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:20px; }
    .bi-toolbar select, .bi-toolbar input[type=date] {
      padding:6px 10px; border:1px solid var(--border,#e2e8f0);
      border-radius:6px; font-size:13px; background:#fff; color:inherit;
    }
    .bi-toolbar button {
      padding:7px 16px; background:var(--primary,#6366f1); color:#fff;
      border:none; border-radius:6px; font-size:13px; cursor:pointer; font-weight:500;
    }
    .bi-toolbar button:hover { opacity:.88; }
    .bi-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:14px; margin-bottom:24px; }
    .bi-kpi { background:#fff; border:1px solid var(--border,#e2e8f0); border-radius:10px; padding:16px 18px; }
    .bi-kpi__label { font-size:11px; font-weight:600; letter-spacing:.6px; text-transform:uppercase; color:#94a3b8; margin-bottom:6px; }
    .bi-kpi__value { font-size:22px; font-weight:700; color:var(--text,#1e293b); line-height:1.2; }
    .bi-kpi__delta { font-size:12px; margin-top:4px; }
    .bi-grid { display:grid; gap:20px; grid-template-columns:1fr 1fr; }
    .bi-grid--3 { grid-template-columns:1fr 1fr 1fr; }
    .bi-card { background:#fff; border:1px solid var(--border,#e2e8f0); border-radius:10px; padding:18px; }
    .bi-card--full { grid-column:1/-1; }
    .bi-card__title { font-size:13px; font-weight:600; color:#64748b; margin-bottom:14px; text-transform:uppercase; letter-spacing:.5px; }
    .bi-chart-box { position:relative; height:220px; }
    .bi-chart-box--tall { height:300px; }
    .bi-table { width:100%; border-collapse:collapse; font-size:13px; }
    .bi-table th { text-align:left; padding:7px 10px; font-size:11px; font-weight:600; letter-spacing:.4px; text-transform:uppercase; color:#94a3b8; border-bottom:1px solid #e2e8f0; }
    .bi-table td { padding:8px 10px; border-bottom:1px solid #f1f5f9; }
    .bi-table tr:last-child td { border-bottom:none; }
    .bi-table tr:hover td { background:#f8fafc; }
    .bi-funnel { display:flex; flex-direction:column; gap:10px; padding:8px 0; }
    .bi-funnel__step { display:flex; align-items:center; gap:12px; }
    .bi-funnel__label { width:90px; font-size:13px; font-weight:500; text-align:right; color:#64748b; }
    .bi-funnel__bar-wrap { flex:1; background:#f1f5f9; border-radius:6px; overflow:hidden; height:28px; }
    .bi-funnel__bar { height:100%; background:var(--primary,#6366f1); border-radius:6px; display:flex; align-items:center; justify-content:flex-end; padding-right:10px; transition:width .4s ease; min-width:40px; }
    .bi-funnel__bar span { font-size:12px; font-weight:600; color:#fff; }
    .bi-funnel__conv { font-size:12px; color:#94a3b8; width:70px; text-align:right; }
    .bi-badge { display:inline-block; padding:2px 8px; border-radius:99px; font-size:11px; font-weight:600; }
    .bi-badge--green { background:#dcfce7; color:#16a34a; }
    .bi-badge--red   { background:#fee2e2; color:#dc2626; }
    .bi-badge--gray  { background:#f1f5f9; color:#64748b; }
    .bi-ai-card { margin-bottom:24px; }
    .bi-ai-header { display:flex; align-items:center; gap:10px; margin-bottom:0; }
    .bi-ai-icon { font-size:18px; }
    .bi-ai-title { font-size:13px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:.5px; flex:1; margin:0; }
    .bi-btn-ia { padding:6px 14px; background:linear-gradient(135deg,#7c3aed,#6366f1); color:#fff; border:none; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:opacity .15s; }
    .bi-btn-ia:hover { opacity:.88; }
    .bi-btn-ia:disabled { opacity:.6; cursor:not-allowed; }
    .bi-ai-body { margin-top:14px; }
    .bi-ai-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; color:#7c3aed; margin:12px 0 4px; }
    .bi-ai-section-title:first-child { margin-top:0; }
    .bi-ai-section-text { font-size:13px; color:#334155; line-height:1.65; }
    .bi-ai-bullet { font-size:13px; color:#334155; line-height:1.65; padding-left:2px; }
    .bi-ai-footer { font-size:11px; color:#94a3b8; margin-top:12px; padding-top:10px; border-top:1px solid #f1f5f9; display:flex; align-items:center; gap:8px; }
    .bi-ai-badge { padding:2px 7px; border-radius:99px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; }
    .bi-ai-badge--new   { background:#ede9fe; color:#7c3aed; }
    .bi-ai-badge--cache { background:#f0fdf4; color:#16a34a; }
    .bi-ai-empty { color:#94a3b8; font-size:13px; text-align:center; padding:14px 0; }
    @media(max-width:768px) {
      .bi-grid, .bi-grid--3 { grid-template-columns:1fr; }
      .bi-kpis { grid-template-columns:1fr 1fr; }
    }
  `;
  document.head.appendChild(s);
}

// ── Paleta de cores ──────────────────────────────────────────────────────────

const CORES = ['#6366f1','#22c55e','#f59e0b','#ef4444','#14b8a6','#8b5cf6','#f97316','#ec4899','#06b6d4','#84cc16'];

// ── Render principal ─────────────────────────────────────────────────────────

export async function initBiModule() {
  injectStyles();
  const container = document.getElementById('biContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="bi-wrap">
      <div class="bi-toolbar">
        <label style="font-size:13px;font-weight:500">Período:</label>
        <select id="biPeriodo">
          <option value="mes_atual">Mês atual</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="90d">Últimos 90 dias</option>
          <option value="custom">Personalizado</option>
        </select>
        <span id="biCustomDates" style="display:none;gap:8px;align-items:center;display:none">
          <input type="date" id="biInicio">
          <span style="font-size:13px">até</span>
          <input type="date" id="biFim">
        </span>
        <select id="biMeses" title="Meses de tendência">
          <option value="6">6 meses</option>
          <option value="12" selected>12 meses</option>
          <option value="24">24 meses</option>
        </select>
        <button id="biAtualizar"><i class="fa-solid fa-rotate-right"></i> Atualizar</button>
      </div>
      <div class="bi-card bi-ai-card">
        <div class="bi-ai-header">
          <span class="bi-ai-icon">✨</span>
          <span class="bi-ai-title">Análise Executiva IA</span>
          <button id="biGerarIA" class="bi-btn-ia">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Gerar análise
          </button>
        </div>
        <div id="biInsightsBody" class="bi-ai-body">
          <div class="bi-ai-empty">Clique em "Gerar análise" para obter um diagnóstico inteligente do seu negócio.</div>
        </div>
      </div>
      <div id="biKpis" class="bi-kpis">
        <div class="bi-kpi"><div class="bi-kpi__label">Receita do mês</div><div class="bi-kpi__value">—</div></div>
        <div class="bi-kpi"><div class="bi-kpi__label">Nº de vendas</div><div class="bi-kpi__value">—</div></div>
        <div class="bi-kpi"><div class="bi-kpi__label">Ticket médio</div><div class="bi-kpi__value">—</div></div>
        <div class="bi-kpi"><div class="bi-kpi__label">Clientes únicos</div><div class="bi-kpi__value">—</div></div>
      </div>
      <div class="bi-grid bi-grid--3">
        <div class="bi-card bi-card--full">
          <div class="bi-card__title">Tendência de vendas</div>
          <div class="bi-chart-box bi-chart-box--tall"><canvas id="biChartTendencia"></canvas></div>
        </div>
        <div class="bi-card">
          <div class="bi-card__title">Mix de pagamentos</div>
          <div class="bi-chart-box"><canvas id="biChartPagamentos"></canvas></div>
        </div>
        <div class="bi-card">
          <div class="bi-card__title">Margem por categoria</div>
          <div class="bi-chart-box"><canvas id="biChartCategorias"></canvas></div>
        </div>
        <div class="bi-card">
          <div class="bi-card__title">Funil de conversão</div>
          <div id="biFunil" style="padding:8px 0"></div>
        </div>
        <div class="bi-card">
          <div class="bi-card__title">Top 10 produtos</div>
          <div style="overflow-y:auto;max-height:260px"><table class="bi-table" id="biTabelaProdutos">
            <thead><tr><th>#</th><th>Produto</th><th>Receita</th><th>Margem</th></tr></thead>
            <tbody></tbody>
          </table></div>
        </div>
        <div class="bi-card">
          <div class="bi-card__title">Top 10 clientes</div>
          <div style="overflow-y:auto;max-height:260px"><table class="bi-table" id="biTabelaClientes">
            <thead><tr><th>#</th><th>Cliente</th><th>Total gasto</th><th>Ticket médio</th></tr></thead>
            <tbody></tbody>
          </table></div>
        </div>
      </div>
    </div>
  `;

  bindBiEvents();
  await carregarBI();
}

function bindBiEvents() {
  document.getElementById('biPeriodo')?.addEventListener('change', e => {
    const custom = document.getElementById('biCustomDates');
    if (custom) custom.style.display = e.target.value === 'custom' ? 'flex' : 'none';
  });
  document.getElementById('biAtualizar')?.addEventListener('click', () => carregarBI());
  document.getElementById('biGerarIA')?.addEventListener('click', () => carregarInsightsIA());
}

function getFiltros() {
  const periodo = document.getElementById('biPeriodo')?.value || 'mes_atual';
  const meses   = Number(document.getElementById('biMeses')?.value || 12);
  const hoje    = new Date();
  let inicio, fim;

  if (periodo === 'custom') {
    inicio = document.getElementById('biInicio')?.value;
    fim    = document.getElementById('biFim')?.value;
  } else if (periodo === '30d') {
    fim    = hoje.toISOString().slice(0,10);
    const d = new Date(hoje); d.setDate(d.getDate()-30);
    inicio = d.toISOString().slice(0,10);
  } else if (periodo === '90d') {
    fim    = hoje.toISOString().slice(0,10);
    const d = new Date(hoje); d.setDate(d.getDate()-90);
    inicio = d.toISOString().slice(0,10);
  } else {
    // mes_atual
    inicio = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-01`;
    fim    = hoje.toISOString().slice(0,10);
  }

  return { inicio, fim, meses };
}

async function carregarBI() {
  const { inicio, fim, meses } = getFiltros();
  const q = (inicio && fim) ? `?inicio=${inicio}&fim=${fim}` : '';
  const btn = document.getElementById('biAtualizar');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Carregando...'; }

  try {
    const [comp, tendencia, topProd, topCli, mixPag, margemCat, funil] = await Promise.allSettled([
      api.get('/bi/comparativo'),
      api.get(`/bi/tendencia-vendas?meses=${meses}`),
      api.get(`/bi/top-produtos${q}&limit=10`),
      api.get(`/bi/top-clientes${q}&limit=10`),
      api.get(`/bi/mix-pagamentos${q}`),
      api.get(`/bi/margem-categorias${q}`),
      api.get(`/bi/funil${q}`)
    ]);

    if (comp.status === 'fulfilled' && comp.value?.sucesso) renderKpis(comp.value);
    if (tendencia.status === 'fulfilled' && tendencia.value?.sucesso) renderTendencia(tendencia.value.dados);
    if (mixPag.status === 'fulfilled' && mixPag.value?.sucesso) renderMixPagamentos(mixPag.value.metodos);
    if (margemCat.status === 'fulfilled' && margemCat.value?.sucesso) renderMargemCategorias(margemCat.value.categorias);
    if (funil.status === 'fulfilled' && funil.value?.sucesso) renderFunil(funil.value.etapas);
    if (topProd.status === 'fulfilled' && topProd.value?.sucesso) renderTopProdutos(topProd.value.produtos);
    if (topCli.status === 'fulfilled' && topCli.value?.sucesso) renderTopClientes(topCli.value.clientes);
  } catch (err) {
    showToast('Erro ao carregar BI: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Atualizar'; }
  }
}

// ── Renders ──────────────────────────────────────────────────────────────────

function renderKpis(data) {
  const atual = data.atual || {};
  const varVsAnt = data.variacoes?.vs_anterior || {};
  const ticket = atual.qtd_vendas > 0 ? atual.receita / atual.qtd_vendas : 0;

  const kpis = document.querySelectorAll('#biKpis .bi-kpi');
  if (!kpis.length) return;

  const dados = [
    { label:'Receita do mês',   value: fmt(atual.receita),        delta: sinal(varVsAnt.receita) },
    { label:'Nº de vendas',     value: fmtN(atual.qtd_vendas),    delta: sinal(varVsAnt.vendas) },
    { label:'Ticket médio',     value: fmt(ticket),               delta: '' },
    { label:'Clientes únicos',  value: fmtN(atual.clientes_unicos), delta: '' }
  ];

  kpis.forEach((el, i) => {
    if (!dados[i]) return;
    el.innerHTML = `
      <div class="bi-kpi__label">${esc(dados[i].label)}</div>
      <div class="bi-kpi__value">${dados[i].value}</div>
      ${dados[i].delta ? `<div class="bi-kpi__delta">${dados[i].delta} vs mês anterior</div>` : ''}
    `;
  });
}

function renderTendencia(dados) {
  destroyChart('tendencia');
  const ctx = document.getElementById('biChartTendencia');
  if (!ctx || !dados?.length) return;

  const labels = dados.map(d => {
    const [y, m] = d.mes.split('-');
    return `${m}/${y}`;
  });

  CHARTS.tendencia = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Receita',
          data: dados.map(d => d.receita),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,.1)',
          fill: true,
          tension: .35,
          pointRadius: 3
        },
        {
          label: 'Margem',
          data: dados.map(d => d.margem),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,.08)',
          fill: true,
          tension: .35,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position:'top' }, tooltip: { callbacks: { label: ctx => fmt(ctx.raw) } } },
      scales: { y: { ticks: { callback: v => fmt(v) } } }
    }
  });
}

function renderMixPagamentos(metodos) {
  destroyChart('pagamentos');
  const ctx = document.getElementById('biChartPagamentos');
  if (!ctx || !metodos?.length) return;

  CHARTS.pagamentos = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: metodos.map(m => m.metodo),
      datasets: [{ data: metodos.map(m => m.total), backgroundColor: CORES, borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position:'right', labels: { boxWidth:12, font:{ size:11 } } },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmt(ctx.raw)} (${metodos[ctx.dataIndex].pct}%)` } }
      }
    }
  });
}

function renderMargemCategorias(cats) {
  destroyChart('categorias');
  const ctx = document.getElementById('biChartCategorias');
  if (!ctx || !cats?.length) return;

  const top = cats.slice(0, 8);

  CHARTS.categorias = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(c => c.categoria),
      datasets: [
        { label:'Receita',  data: top.map(c => c.receita), backgroundColor:'rgba(99,102,241,.75)' },
        { label:'Margem',   data: top.map(c => c.margem),  backgroundColor:'rgba(34,197,94,.75)' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position:'top' }, tooltip: { callbacks: { label: ctx => fmt(ctx.raw) } } },
      scales: { y: { ticks: { callback: v => fmt(v) } } }
    }
  });
}

function renderFunil(etapas) {
  const el = document.getElementById('biFunil');
  if (!el || !etapas?.length) return;

  const maxQtd = Math.max(...etapas.map(e => e.qtd), 1);

  el.innerHTML = `<div class="bi-funnel">` + etapas.map((e, i) => {
    const pct = Math.round((e.qtd / maxQtd) * 100);
    const conv = i === 0 ? '—' : (etapas[i-1].qtd > 0 ? fmtN((e.qtd / etapas[i-1].qtd)*100, 1)+'%' : '0%');
    return `
      <div class="bi-funnel__step">
        <div class="bi-funnel__label">${esc(e.etapa)}</div>
        <div class="bi-funnel__bar-wrap">
          <div class="bi-funnel__bar" style="width:${pct}%">
            <span>${fmtN(e.qtd)}</span>
          </div>
        </div>
        <div class="bi-funnel__conv">${conv}</div>
      </div>
    `;
  }).join('') + `</div>`;
}

function renderTopProdutos(produtos) {
  const tbody = document.querySelector('#biTabelaProdutos tbody');
  if (!tbody || !produtos?.length) return;

  tbody.innerHTML = produtos.map((p, i) => {
    const mPct = p.receita > 0 ? ((p.margem / p.receita) * 100).toFixed(1) : 0;
    const badge = mPct >= 30 ? 'green' : mPct >= 10 ? 'gray' : 'red';
    return `<tr>
      <td style="color:#94a3b8;font-size:12px">${i+1}</td>
      <td>${esc(p.nome)}</td>
      <td>${fmt(p.receita)}</td>
      <td><span class="bi-badge bi-badge--${badge}">${fmtN(mPct,1)}%</span></td>
    </tr>`;
  }).join('');
}

function renderTopClientes(clientes) {
  const tbody = document.querySelector('#biTabelaClientes tbody');
  if (!tbody || !clientes?.length) return;

  tbody.innerHTML = clientes.map((c, i) => `<tr>
    <td style="color:#94a3b8;font-size:12px">${i+1}</td>
    <td>${esc(c.nome)}</td>
    <td>${fmt(c.total_gasto)}</td>
    <td>${fmt(c.ticket_medio)}</td>
  </tr>`).join('');
}

// ── Análise IA ───────────────────────────────────────────────────────────────

async function carregarInsightsIA() {
  const btn  = document.getElementById('biGerarIA');
  const body = document.getElementById('biInsightsBody');
  if (!body) return;

  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analisando...'; }
  body.innerHTML = '<div class="bi-ai-empty"><i class="fa-solid fa-spinner fa-spin"></i> Gerando análise com IA...</div>';

  try {
    const data = await api.get('/bi/insights-ia');
    if (!data?.sucesso) throw new Error(data?.erro || 'Erro desconhecido');
    renderInsights(data);
  } catch (err) {
    body.innerHTML = `<div class="bi-ai-empty" style="color:#ef4444"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(err.message)}</div>`;
    showToast('Erro ao gerar análise IA: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Atualizar'; }
  }
}

function renderInsights({ insights, gerado_em, cache }) {
  const body = document.getElementById('biInsightsBody');
  if (!body) return;

  const badge = cache
    ? '<span class="bi-ai-badge bi-ai-badge--cache">cache</span>'
    : '<span class="bi-ai-badge bi-ai-badge--new">novo</span>';

  body.innerHTML = `
    <div>${formatInsights(insights || '')}</div>
    <div class="bi-ai-footer">${badge} Gerado em ${esc(gerado_em)}</div>
  `;
}

function formatInsights(text) {
  return text.split('\n').map(line => {
    const t = line.trim();
    if (!t) return '';
    // Linha toda em maiúsculas com pelo menos uma letra = título de seção
    if (t === t.toUpperCase() && /[A-ZÁÉÍÓÚÀÂÊÎÔÇÃ]/.test(t) && t.length < 70) {
      return `<div class="bi-ai-section-title">${esc(t)}</div>`;
    }
    // Bullet (• ou -)
    if (/^[•\-]\s/.test(t)) {
      return `<div class="bi-ai-bullet">• ${esc(t.replace(/^[•\-]\s*/, ''))}</div>`;
    }
    return `<div class="bi-ai-section-text">${esc(t)}</div>`;
  }).join('');
}

export default { initBiModule };
