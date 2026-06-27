import api from './api.js';
import { showToast, confirmarAcao } from './feedback.js';
import { escapeHtml, buildFriendlyError } from './utils.js';

const state = {
  itens:   [],
  editId:  null,
  loading: false,
  saving:  false,
  filtros: { tipo: '', status: '', busca: '' },
  pagina: 1,
  totalPaginas: 1,
  totalRegistros: 0,
  resumoGlobal: null
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const esc = escapeHtml;

function toCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(d) {
  if (!d) return '-';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

function toInputDate(d) {
  if (!d) return '';
  return String(d).slice(0, 10);
}


function getFiltrosGlobais() {
  return {
    data_inicial: document.getElementById('filtroDataInicial')?.value || '',
    data_final:   document.getElementById('filtroDataFinal')?.value  || ''
  };
}

function setLoading(v) {
  state.loading = v;
  const btn = document.getElementById('lfBtnAtualizar');
  if (btn) {
    btn.disabled = v;
    btn.innerHTML = v
      ? '<i class="fa-solid fa-spinner fa-spin"></i> Atualizando...'
      : '<i class="fa-solid fa-rotate"></i> Atualizar';
  }
}

function showMsg(msg, type = 'info') {
  const el = document.getElementById('lfFeedback');
  if (el) {
    el.className = `module-feedback${type === 'error' ? ' module-feedback--error' : type === 'success' ? ' module-feedback--success' : ' module-feedback--info'}`;
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
  }
  showToast(msg, type);
}

// ─── Resumo ───────────────────────────────────────────────────────────────────

function calcResumo() {
  if (state.resumoGlobal) return { ...state.resumoGlobal, parcial: false };
  // Fallback: a API não retornou o resumo agregado (data.resumo ausente/falhou).
  // state.itens contém apenas a página atual (limit: 50) — somar aqui NÃO é o total
  // do período, é só uma estimativa da página carregada. Sinalizamos isso como "parcial"
  // para a UI deixar claro ao usuário que o valor pode não refletir o total real.
  let receitas = 0, despesas = 0;
  for (const i of state.itens) {
    if (i.tipo === 'receita') receitas += Number(i.valor || 0);
    else                      despesas += Number(i.valor || 0);
  }
  return { receitas, despesas, saldo: receitas - despesas, parcial: true };
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function badgeTipo(tipo) {
  const isReceita = String(tipo).toLowerCase() === 'receita';
  return `<span class="badge ${isReceita ? 'badge--success' : 'badge--danger'}">${isReceita ? 'Receita' : 'Despesa'}</span>`;
}

function badgeStatus(status) {
  const s = String(status || 'pendente').toLowerCase();
  const map = {
    pago:             ['badge--success', 'Pago'],
    parcial:          ['badge--warning', 'Parcial'],
    parcial_atrasado: ['badge--danger',  'Parcial em atraso'],
    atrasado:         ['badge--danger',  'Atrasado'],
    estornado:        ['badge--neutral', 'Estornado'],
  };
  const [cls, label] = map[s] ?? ['badge--warning', 'Pendente'];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ─── Render ───────────────────────────────────────────────────────────────────

export async function initLancamentosModule() {
  try {
    renderSkeleton();
    await carregarLancamentos();
    render();
  } catch (error) {
    console.error('Erro ao iniciar lançamentos:', error);
    renderErro(buildFriendlyError(error));
  }
}

async function carregarLancamentos() {
  const data = await api.getLancamentosFinanceiros({
    ...getFiltrosGlobais(),
    ...state.filtros,
    page: state.pagina,
    limit: 50
  });
  if (data?.itens) {
    state.itens = Array.isArray(data.itens) ? data.itens : [];
    state.resumoGlobal = data.resumo || null;
    if (data.paginacao) {
      state.totalPaginas = data.paginacao.total_paginas || 1;
      state.totalRegistros = data.paginacao.total || 0;
    }
  } else {
    state.itens = Array.isArray(data) ? data : [];
  }
}

function renderSkeleton() {
  const c = document.getElementById('lancamentosContainer');
  if (!c) return;

  const skRow = () => `
    <div class="skeleton-row">
      <span class="skeleton skeleton-badge" style="width:70px"></span>
      <span class="skeleton skeleton-text" style="flex:3"></span>
      <span class="skeleton skeleton-text" style="flex:2"></span>
      <span class="skeleton skeleton-text" style="flex:1"></span>
      <span class="skeleton skeleton-badge"></span>
      <span class="skeleton skeleton-text" style="flex:1"></span>
    </div>`;

  c.innerHTML = `
    <div class="module-card">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px">
        ${Array.from({length:3},()=>`
          <div class="mini-stat" style="display:flex;flex-direction:column;gap:8px">
            <span class="skeleton skeleton-text" style="width:50%"></span>
            <span class="skeleton skeleton-value"></span>
          </div>`).join('')}
      </div>
      <div style="padding:4px 0">
        ${Array.from({length:6}, skRow).join('')}
      </div>
    </div>`;
}

function renderErro(msg) {
  const c = document.getElementById('lancamentosContainer');
  if (c) c.innerHTML = `<div class="module-card"><div class="module-feedback module-feedback--error">${esc(msg)}</div></div>`;
}

function render() {
  const c = document.getElementById('lancamentosContainer');
  if (!c) return;

  const r = calcResumo();
  const itensFiltrados = filtrarItens();

  c.innerHTML = `
    <div class="module-card">

      <div id="lfFeedback" class="module-feedback hidden"></div>

      <!-- Resumo -->
      ${r.parcial ? `
        <div class="module-feedback module-feedback--error" style="margin-bottom:10px">
          <i class="fa-solid fa-triangle-exclamation"></i>
          Resumo indisponível: não foi possível obter os totais do servidor. Os valores abaixo são uma
          estimativa baseada apenas nos ${state.itens.length} lançamento(s) desta página, não no total do período.
        </div>
      ` : ''}
      <div class="lf-stats-grid">
        <article class="mini-stat lf-stat--receita">
          <span>Receitas${r.parcial ? ' (parcial)' : ''}</span>
          <strong>${toCurrency(r.receitas)}</strong>
          <small>${state.itens.filter(i => i.tipo === 'receita').length} lançamento(s)</small>
        </article>
        <article class="mini-stat lf-stat--despesa">
          <span>Despesas${r.parcial ? ' (parcial)' : ''}</span>
          <strong>${toCurrency(r.despesas)}</strong>
          <small>${state.itens.filter(i => i.tipo === 'despesa').length} lançamento(s)</small>
        </article>
        <article class="mini-stat lf-stat--saldo ${r.saldo >= 0 ? 'lf-stat--positivo' : 'lf-stat--negativo'}">
          <span>Saldo${r.parcial ? ' (parcial)' : ''}</span>
          <strong>${toCurrency(r.saldo)}</strong>
          <small>${r.saldo >= 0 ? 'Superávit' : 'Déficit'}</small>
        </article>
      </div>

      <!-- Toolbar -->
      <div class="module-toolbar lf-toolbar">
        <div class="module-toolbar__search">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="lfBusca" placeholder="Buscar descrição, categoria..." value="${esc(state.filtros.busca)}"/>
        </div>
        <select id="lfTipo" class="input">
          <option value="">Todos os tipos</option>
          <option value="receita"  ${state.filtros.tipo === 'receita'  ? 'selected' : ''}>Receitas</option>
          <option value="despesa"  ${state.filtros.tipo === 'despesa'  ? 'selected' : ''}>Despesas</option>
        </select>
        <select id="lfStatus" class="input">
          <option value="">Todos os status</option>
          <option value="pendente" ${state.filtros.status === 'pendente' ? 'selected' : ''}>Pendentes</option>
          <option value="pago"     ${state.filtros.status === 'pago'     ? 'selected' : ''}>Pagos</option>
        </select>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary" id="lfBtnFiltrar" type="button">
            <i class="fa-solid fa-filter"></i> Filtrar
          </button>
          <button class="btn btn-light" id="lfBtnLimpar" type="button">
            <i class="fa-solid fa-eraser"></i>
          </button>
          <button class="btn btn-light" id="lfBtnAtualizar" type="button">
            <i class="fa-solid fa-rotate"></i> Atualizar
          </button>
          <button class="btn btn-primary" id="lfBtnNovo" type="button">
            <i class="fa-solid fa-plus"></i> Novo Lançamento
          </button>
        </div>
      </div>

      <!-- Tabela -->
      ${renderTabela(itensFiltrados)}

      ${state.totalPaginas > 1 ? `
      <div class="lf-pagination">
        <button class="lf-pagination__btn" type="button" data-action="lf-pagina" data-page="prev" ${state.pagina <= 1 ? 'disabled' : ''} aria-label="Página anterior">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <span class="lf-pagination__info">Página ${state.pagina} de ${state.totalPaginas} <small>(${state.totalRegistros} registro(s))</small></span>
        <button class="lf-pagination__btn" type="button" data-action="lf-pagina" data-page="next" ${state.pagina >= state.totalPaginas ? 'disabled' : ''} aria-label="Próxima página">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>` : ''}

    </div>

    <!-- Modal -->
    ${renderModal()}
  `;

  bindEventos();
}

function filtrarItens() {
  const { tipo, status, busca } = state.filtros;
  return state.itens.filter(i => {
    if (tipo   && i.tipo   !== tipo)   return false;
    if (status && i.status !== status) return false;
    if (busca) {
      const b = busca.toLowerCase();
      if (
        !String(i.descricao || '').toLowerCase().includes(b) &&
        !String(i.categoria || '').toLowerCase().includes(b)
      ) return false;
    }
    return true;
  });
}

function renderTabela(itens) {
  if (!itens.length) {
    return `<div class="empty-state" style="padding:40px">
      <i class="fa-solid fa-file-invoice-dollar"></i>
      <strong>Nenhum lançamento encontrado</strong>
      <p>Tente ajustar os filtros de período ou tipo.</p>
    </div>`;
  }

  return `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Vencimento</th>
            <th>Status</th>
            <th class="text-right">Valor</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${itens.map(renderLinha).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderLinha(item) {
  const pendente = item.status !== 'pago';
  return `
    <tr>
      <td>${badgeTipo(item.tipo)}</td>
      <td>${esc(item.descricao)}</td>
      <td><span style="color:var(--text-muted);font-size:.85rem">${esc(item.categoria || '-')}</span></td>
      <td>${formatDate(item.vencimento)}</td>
      <td>${badgeStatus(item.status)}</td>
      <td class="text-right"><strong>${toCurrency(item.valor)}</strong></td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${pendente ? `<button class="btn btn-light" style="padding:4px 10px;font-size:12px" data-action="pagar" data-id="${item.id}" title="Marcar como pago">
            <i class="fa-solid fa-check"></i>
          </button>` : ''}
          <button class="btn btn-light" style="padding:4px 10px;font-size:12px" data-action="editar" data-id="${item.id}" title="Editar">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-light" style="padding:4px 10px;font-size:12px;color:var(--danger)" data-action="excluir" data-id="${item.id}" title="Excluir">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
}

function renderModal() {
  return `
    <div class="modal-overlay hidden" id="lfModal">
      <div class="modal-card" style="max-width:520px;width:100%">
        <div class="modal-card__header">
          <h3 id="lfModalTitulo">Novo Lançamento</h3>
          <button class="modal-close" id="lfBtnFecharModal" type="button">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="lfForm" class="form-grid" autocomplete="off">
          <div class="form-field">
            <label>Tipo <span style="color:var(--danger)">*</span></label>
            <select id="lfTipoInput" class="input" required>
              <option value="receita">Receita</option>
              <option value="despesa">Despesa</option>
            </select>
          </div>

          <div class="form-field">
            <label>Descrição <span style="color:var(--danger)">*</span></label>
            <input id="lfDescricao" class="input" placeholder="Ex: Aluguel, Venda avulsa..." required maxlength="200"/>
          </div>

          <div class="form-field">
            <label>Categoria <span style="color:var(--danger)">*</span></label>
            <input id="lfCategoria" class="input" placeholder="Ex: Despesa fixa, Receita operacional..." required maxlength="100"/>
          </div>

          <div class="form-field">
            <label>Valor (R$) <span style="color:var(--danger)">*</span></label>
            <input id="lfValor" class="input" type="number" min="0.01" step="0.01" placeholder="0,00" required/>
          </div>

          <div class="form-field">
            <label>Vencimento</label>
            <input id="lfVencimento" class="input" type="date"/>
          </div>

          <div class="form-field">
            <label>Forma de pagamento</label>
            <select id="lfFormaPagamento" class="input">
              <option value="">Selecionar...</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="cartao_debito">Cartão Débito</option>
              <option value="cartao_credito">Cartão Crédito</option>
              <option value="transferencia">Transferência</option>
              <option value="boleto">Boleto</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>

          <div class="form-field form-field--span-2">
            <label>Observação</label>
            <textarea id="lfObservacao" class="input" rows="2" placeholder="Observações opcionais..." maxlength="500"></textarea>
          </div>

          <div class="form-field form-field--span-2" style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
            <button type="button" class="btn btn-light" id="lfBtnCancelarForm">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="lfBtnSalvar">
              <i class="fa-solid fa-floppy-disk"></i> Salvar
            </button>
          </div>
        </form>
      </div>
    </div>`;
}

// ─── Eventos ──────────────────────────────────────────────────────────────────

function bindEventos() {
  // Abrir modal para novo lançamento
  document.getElementById('lfBtnNovo').onclick = () => abrirModal(null);

  // Fechar modal
  document.getElementById('lfBtnFecharModal').onclick = fecharModal;
  document.getElementById('lfBtnCancelarForm').onclick = fecharModal;
  document.getElementById('lfModal').onclick = (e) => { if (e.target.id === 'lfModal') fecharModal(); };

  // Atualizar
  document.getElementById('lfBtnAtualizar').onclick = async () => {
    setLoading(true);
    try {
      await carregarLancamentos();
      render();
    } catch (error) {
      showMsg(buildFriendlyError(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar
  document.getElementById('lfBtnFiltrar').onclick = async () => {
    state.filtros.tipo   = document.getElementById('lfTipo').value;
    state.filtros.status = document.getElementById('lfStatus').value;
    state.filtros.busca  = document.getElementById('lfBusca').value.trim();
    state.pagina = 1;
    await carregarLancamentos();
    render();
  };

  // Limpar filtros
  document.getElementById('lfBtnLimpar').onclick = async () => {
    state.filtros = { tipo: '', status: '', busca: '' };
    state.pagina = 1;
    await carregarLancamentos();
    render();
  };

  // Submit do form (criar / editar)
  document.getElementById('lfForm').onsubmit = async (e) => {
    e.preventDefault();
    await salvar();
  };

  // Ações da tabela (pagar, editar, excluir)
  const lfContainer = document.getElementById('lancamentosContainer');
  (lfContainer || document).querySelectorAll('[data-action]').forEach((btn) => {
    btn.onclick = () => {
      const id = Number(btn.dataset.id);
      if (btn.dataset.action === 'pagar')   pagar(id);
      if (btn.dataset.action === 'editar')  editar(id);
      if (btn.dataset.action === 'excluir') excluir(id);
      if (btn.dataset.action === 'lf-pagina') {
        if (state.loading) return;
        const page = btn.dataset.page;
        if (page === 'prev' && state.pagina > 1) state.pagina--;
        else if (page === 'next' && state.pagina < state.totalPaginas) state.pagina++;
        carregarLancamentos().then(() => render());
      }
    };
  });
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function abrirModal(item) {
  state.editId = item ? item.id : null;

  document.getElementById('lfModalTitulo').textContent = item ? 'Editar Lançamento' : 'Novo Lançamento';
  document.getElementById('lfTipoInput').value      = item?.tipo           || 'receita';
  document.getElementById('lfDescricao').value      = item?.descricao      || '';
  document.getElementById('lfCategoria').value      = item?.categoria      || '';
  document.getElementById('lfValor').value          = item?.valor          || '';
  document.getElementById('lfVencimento').value     = toInputDate(item?.vencimento);
  document.getElementById('lfFormaPagamento').value = item?.forma_pagamento || '';
  document.getElementById('lfObservacao').value     = item?.observacao      || '';

  document.getElementById('lfModal').classList.remove('hidden');
  document.getElementById('lfDescricao').focus();
}

function fecharModal() {
  document.getElementById('lfModal').classList.add('hidden');
  state.editId = null;
}

// ─── Operações ────────────────────────────────────────────────────────────────

async function salvar() {
  if (state.saving) return;
  state.saving = true;
  const btn = document.getElementById('lfBtnSalvar');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

  const payload = {
    tipo:            document.getElementById('lfTipoInput').value,
    descricao:       document.getElementById('lfDescricao').value.trim(),
    categoria:       document.getElementById('lfCategoria').value.trim(),
    valor:           document.getElementById('lfValor').value,
    vencimento:      document.getElementById('lfVencimento').value || null,
    forma_pagamento: document.getElementById('lfFormaPagamento').value,
    observacao:      document.getElementById('lfObservacao').value.trim()
  };

  try {
    if (state.editId) {
      await api.updateLancamentoFinanceiro(state.editId, payload);
      showMsg('Lançamento atualizado com sucesso.', 'success');
    } else {
      await api.createLancamentoFinanceiro(payload);
      showMsg('Lançamento criado com sucesso.', 'success');
    }

    fecharModal();
    await carregarLancamentos();
    render();
  } catch (error) {
    console.error('Erro ao salvar lançamento:', error);
    showMsg(buildFriendlyError(error), 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar';
  } finally {
    state.saving = false;
  }
}

function editar(id) {
  const item = state.itens.find(i => i.id === id);
  if (item) abrirModal(item);
}

async function pagar(id) {
  const ok = await confirmarAcao('Confirmar pagamento deste lançamento?', 'Confirmar pagamento', 'primary');
  if (!ok) return;

  try {
    await api.pagarLancamentoFinanceiro(id);
    showMsg('Lançamento marcado como pago.', 'success');
    await carregarLancamentos();
    render();
  } catch (error) {
    console.error('Erro ao pagar lançamento:', error);
    showMsg(buildFriendlyError(error), 'error');
  }
}

async function excluir(id) {
  const ok = await confirmarAcao('Excluir este lançamento? Esta ação não pode ser desfeita.', 'Excluir', 'danger');
  if (!ok) return;

  try {
    await api.deleteLancamentoFinanceiro(id);
    showMsg('Lançamento excluído.', 'success');
    await carregarLancamentos();
    render();
  } catch (error) {
    console.error('Erro ao excluir lançamento:', error);
    showMsg(buildFriendlyError(error), 'error');
  }
}
