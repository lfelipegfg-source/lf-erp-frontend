import api from './api.js';

const state = {
  logs:    [],
  loading: false,
  filtros: { tipo: '', entidade: '', busca: '', periodo: 'mesAtual' }
};

function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function toCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
}
function formatDateTime(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleString('pt-BR', { timeZone:'America/Fortaleza', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

const TIPO_LABEL = {
  baixa:             'Baixa total',
  baixa_parcial:     'Baixa parcial',
  criacao:           'Criação',
  edicao:            'Edição',
  cancelamento:      'Cancelamento',
  estorno:           'Estorno',
  pagamento:         'Pagamento',
  lancamento:        'Lançamento',
  lancamento_manual: 'Lançamento manual',
};
const ENTIDADE_LABEL = {
  contas_receber: 'Contas a Receber',
  contas_pagar:   'Contas a Pagar',
  lancamentos:    'Lançamentos',
  venda:          'Venda',
  compra:         'Compra',
};
const TIPO_COR = {
  baixa:         '#38a169',
  baixa_parcial: '#d69e2e',
  estorno:       '#e53e3e',
  cancelamento:  '#e53e3e',
  criacao:       '#3182ce',
  edicao:        '#805ad5',
  pagamento:     '#38a169',
  lancamento:    '#3182ce',
};

export async function initAuditoriaFinanceiraModule() {
  const container = document.getElementById('auditoriaFinanceiraContainer');
  if (!container) return;

  container.innerHTML = renderSkeleton();
  await carregarLogs();
}

function renderSkeleton() {
  return `<div class="module-skeleton" style="padding:24px">
    ${Array.from({length:8}).map(() => '<div class="skeleton-line" style="height:36px;margin-bottom:8px;border-radius:6px"></div>').join('')}
  </div>`;
}

async function carregarLogs() {
  const container = document.getElementById('auditoriaFinanceiraContainer');
  if (!container) return;

  state.loading = true;
  try {
    const params = { periodo: state.filtros.periodo };
    if (state.filtros.tipo)     params.tipo     = state.filtros.tipo;
    if (state.filtros.entidade) params.entidade = state.filtros.entidade;
    if (state.filtros.busca)    params.busca    = state.filtros.busca;

    const data = await api.request('/financeiro/auditoria', { method:'GET', query: params });
    state.logs = data.logs || [];

    container.innerHTML = renderUI(data);
    bind();
  } catch (err) {
    container.innerHTML = `<div class="module-feedback module-feedback--error" style="margin:16px">
      <i class="fa-solid fa-triangle-exclamation"></i> ${err.message || 'Erro ao carregar auditoria'}
    </div>`;
  } finally {
    state.loading = false;
  }
}

function renderUI(data) {
  const truncadoAviso = data.truncado
    ? `<div class="module-feedback module-feedback--warning" style="margin-bottom:12px;font-size:.82rem">
        <i class="fa-solid fa-triangle-exclamation"></i> Exibindo os 500 registros mais recentes. Use os filtros para refinar.
      </div>` : '';

  return `
    <div class="module-toolbar" style="gap:8px;flex-wrap:wrap;margin-bottom:16px">
      <select id="audFiltroTipo" class="filter-input" style="width:180px">
        <option value="">Todos os tipos</option>
        ${Object.entries(TIPO_LABEL).map(([k,v]) => `<option value="${k}" ${state.filtros.tipo===k?'selected':''}>${v}</option>`).join('')}
      </select>
      <select id="audFiltroEntidade" class="filter-input" style="width:180px">
        <option value="">Todas as entidades</option>
        ${Object.entries(ENTIDADE_LABEL).map(([k,v]) => `<option value="${k}" ${state.filtros.entidade===k?'selected':''}>${v}</option>`).join('')}
      </select>
      <select id="audFiltroPeriodo" class="filter-input" style="width:140px">
        <option value="hoje"     ${state.filtros.periodo==='hoje'     ?'selected':''}>Hoje</option>
        <option value="7dias"    ${state.filtros.periodo==='7dias'    ?'selected':''}>Últimos 7 dias</option>
        <option value="mesAtual" ${state.filtros.periodo==='mesAtual' ?'selected':''}>Este mês</option>
        <option value="30dias"   ${state.filtros.periodo==='30dias'   ?'selected':''}>30 dias</option>
        <option value="90dias"   ${state.filtros.periodo==='90dias'   ?'selected':''}>90 dias</option>
        <option value="anoAtual" ${state.filtros.periodo==='anoAtual' ?'selected':''}>Este ano</option>
      </select>
      <input id="audFiltroBusca" type="text" class="filter-input" placeholder="Buscar descrição…" value="${esc(state.filtros.busca)}" style="flex:1;min-width:160px">
      <button id="audBtnFiltrar" class="btn btn-primary btn-sm">
        <i class="fa-solid fa-magnifying-glass"></i> Filtrar
      </button>
    </div>
    ${truncadoAviso}
    <div class="module-count" style="margin-bottom:10px;font-size:.82rem;color:var(--text-muted)">
      ${state.logs.length} registro(s) encontrado(s)
    </div>
    <div style="overflow-x:auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>Data/Hora</th>
            <th>Tipo</th>
            <th>Entidade</th>
            <th>Descrição</th>
            <th style="text-align:right">Valor</th>
            <th>Operador</th>
          </tr>
        </thead>
        <tbody>
          ${state.logs.length ? state.logs.map(renderLinha).join('') :
            '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">Nenhum registro encontrado.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function renderLinha(log) {
  const cor  = TIPO_COR[log.tipo] || 'var(--text-muted)';
  const tipo = TIPO_LABEL[log.tipo] || log.tipo;
  const ent  = ENTIDADE_LABEL[log.entidade] || log.entidade || '-';
  const val  = Number(log.valor || 0);
  return `<tr>
    <td style="white-space:nowrap;font-size:.82rem">${formatDateTime(log.criado_em)}</td>
    <td><span style="background:${cor}22;color:${cor};font-size:.75rem;font-weight:700;border-radius:4px;padding:2px 8px;white-space:nowrap">${esc(tipo)}</span></td>
    <td style="font-size:.82rem">${esc(ent)}</td>
    <td style="font-size:.82rem;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(log.descricao)}">${esc(log.descricao || '-')}</td>
    <td style="text-align:right;font-size:.82rem;font-variant-numeric:tabular-nums">${val !== 0 ? toCurrency(val) : '-'}</td>
    <td style="font-size:.82rem">${esc(log.usuario_nome || 'Sistema')}</td>
  </tr>`;
}

function bind() {
  document.getElementById('audBtnFiltrar')?.addEventListener('click', aplicarFiltros);
  document.getElementById('audFiltroBusca')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') aplicarFiltros();
  });
}

function aplicarFiltros() {
  state.filtros.tipo     = document.getElementById('audFiltroTipo')?.value     || '';
  state.filtros.entidade = document.getElementById('audFiltroEntidade')?.value || '';
  state.filtros.periodo  = document.getElementById('audFiltroPeriodo')?.value  || 'mesAtual';
  state.filtros.busca    = document.getElementById('audFiltroBusca')?.value    || '';
  carregarLogs();
}
