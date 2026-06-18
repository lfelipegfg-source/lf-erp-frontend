import api from './api.js';
import { showToast } from './feedback.js';
import { todayFortaleza, escapeHtml, buildFriendlyError } from './utils.js';

const state = {
  contas: [],
  resumo: {
    total: 0,
    total_pago: 0,
    total_pendente: 0,
    total_atrasado: 0,
    qtd_pago: 0,
    qtd_pendente: 0,
    qtd_atrasado: 0
  },
  fornecedores: [],
  filtros: {
    status: '',
    fornecedor_id: '',
    busca: ''
  },
  pagina: 1,
  totalPaginas: 1,
  totalRegistros: 0,
  loading: false
};

function salvarFiltrosCP() {
  try { sessionStorage.setItem('lf_filtros_cp', JSON.stringify(state.filtros)); } catch {}
}
function carregarFiltrosCP() {
  try {
    const s = JSON.parse(sessionStorage.getItem('lf_filtros_cp') || 'null');
    if (s) Object.assign(state.filtros, s);
  } catch {}
}

function showMessage(message, type = 'info') {
  const feedback = document.getElementById('contasPagarFeedback');

  if (feedback) {
    feedback.className = 'module-feedback';

    if (type === 'success') {
      feedback.classList.add('module-feedback--success');
    } else if (type === 'error') {
      feedback.classList.add('module-feedback--error');
    } else {
      feedback.classList.add('module-feedback--info');
    }

    feedback.textContent = message || '';
  }

  showToast(message, type);
}

function setLoading(value) {
  state.loading = value;

  const btnAtualizar = document.getElementById('btnAtualizarContasPagar');
  const btnFiltrar = document.getElementById('btnFiltrarContasPagar');
  const btnLimpar = document.getElementById('btnLimparFiltrosContasPagar');

  if (btnAtualizar) btnAtualizar.disabled = value;
  if (btnFiltrar) btnFiltrar.disabled = value;
  if (btnLimpar) btnLimpar.disabled = value;

  if (btnAtualizar) {
    btnAtualizar.innerHTML = value
      ? '<i class="fa-solid fa-spinner fa-spin"></i> Atualizando...'
      : '<i class="fa-solid fa-rotate"></i> Atualizar';
  }
}


export async function initContasPagarModule() {
  try {
    state.loading = true;
    carregarFiltrosCP();
    renderSkeleton();

    await Promise.all([carregarFornecedores(), carregarContas()]);

    render();
  } catch (error) {
    console.error('Erro ao iniciar contas a pagar:', error);
    const message = buildFriendlyError(error);
    renderErro(message);
    showMessage(message, 'error');
  } finally {
    state.loading = false;
  }
}

async function carregarFornecedores() {
  const response = await api.getContasPagarFornecedores();
  state.fornecedores = Array.isArray(response) ? response : [];
}

async function carregarContas() {
  const filtrosGlobais = getFiltrosGlobais();

  const response = await api.getContasPagar({
    ...filtrosGlobais,
    ...state.filtros,
    page: state.pagina,
    limit: 50
  });

  state.contas = Array.isArray(response?.contas) ? response.contas : [];

  state.resumo = response?.resumo || {
    total: 0,
    total_pago: 0,
    total_pendente: 0,
    total_atrasado: 0,
    qtd_pago: 0,
    qtd_pendente: 0,
    qtd_atrasado: 0
  };

  if (response?.paginacao) {
    state.totalPaginas = response.paginacao.total_paginas || 1;
    state.totalRegistros = response.paginacao.total || 0;
  }
}

function getFiltrosGlobais() {
  return {
    data_inicial: document.getElementById('filtroDataInicial')?.value || '',
    data_final: document.getElementById('filtroDataFinal')?.value || '',
    busca: state.filtros.busca || document.getElementById('filtroBuscaGlobal')?.value?.trim() || ''
  };
}

function renderSkeleton() {
  const container = document.getElementById('contasPagarContainer');
  if (!container) return;

  const skRow = (cols) => `
    <div class="skeleton-row">
      ${cols.map((w, i) => `<span class="skeleton ${i === cols.length - 1 ? 'skeleton-badge' : 'skeleton-text'}" style="flex:${w}"></span>`).join('')}
    </div>`;

  container.innerHTML = `
    <section class="module-card">
      <div class="module-card__header">
        <div>
          <span class="skeleton skeleton-h3" style="width:200px"></span>
          <span class="skeleton skeleton-text" style="width:260px;margin-top:8px"></span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px">
        ${Array.from({length:3},()=>`
          <div class="mini-stat" style="display:flex;flex-direction:column;gap:8px">
            <span class="skeleton skeleton-text" style="width:50%"></span>
            <span class="skeleton skeleton-value"></span>
          </div>`).join('')}
      </div>
      <div style="padding:4px 0">
        ${[
          [3,1,1,1],
          [3,1,1,1],
          [3,1,1,1],
          [3,1,1,1],
          [3,1,1,1],
          [3,1,1,1]
        ].map(skRow).join('')}
      </div>
    </section>`;
}

function render() {
  const container = document.getElementById('contasPagarContainer');
  if (!container) return;

  container.innerHTML = `
    <section class="module-card cp-module-card">
      <div id="contasPagarFeedback" class="module-feedback"></div>

      <div class="module-card__header">
        <div>
          <h3>Contas a Pagar</h3>
          <p>Controle de despesas pendentes, atrasadas e pagas</p>
        </div>

        <div class="module-card__actions">
          <button class="btn btn-light" id="btnAtualizarContasPagar" type="button">
            <i class="fa-solid fa-rotate"></i>
            Atualizar
          </button>
        </div>
      </div>

      <div class="cp-explain-card">
        <div>
          <strong>Importante</strong>
          <span>Esta tela mostra títulos a pagar. Valores pagos só saem do Fluxo de Caixa após baixa/pagamento.</span>
        </div>
      </div>

      <div class="cp-toolbar-grid">
        <div class="module-toolbar__search cp-search-box">
          <i class="fa-solid fa-search"></i>
          <input
            type="text"
            id="cpBusca"
            placeholder="Buscar fornecedor, descrição, observação ou nº da compra..."
            value="${escapeHtml(state.filtros.busca || '')}"
          />
        </div>

        <div class="cp-filter-box">
          <select id="cpStatus" class="input">
            <option value="">Todos os status</option>
            <option value="pendente" ${state.filtros.status === 'pendente' ? 'selected' : ''}>Pendentes</option>
            <option value="atrasado" ${state.filtros.status === 'atrasado' ? 'selected' : ''}>Atrasadas</option>
            <option value="pago" ${state.filtros.status === 'pago' ? 'selected' : ''}>Pagas</option>
          </select>
        </div>

        <div class="cp-filter-box cp-filter-box--fornecedor">
          <select id="cpFornecedor" class="input">
            <option value="">Todos os fornecedores</option>
            ${state.fornecedores
              .map(
                (fornecedor) => `
              <option value="${fornecedor.id}" ${String(state.filtros.fornecedor_id) === String(fornecedor.id) ? 'selected' : ''}>
                ${escapeHtml(fornecedor.nome)}
              </option>
            `
              )
              .join('')}
          </select>
        </div>

        <div class="cp-action-box">
          <button class="btn btn-primary" id="btnFiltrarContasPagar" type="button">
            <i class="fa-solid fa-filter"></i>
            Filtrar
          </button>

          <button class="btn btn-light" id="btnLimparFiltrosContasPagar" type="button">
            <i class="fa-solid fa-eraser"></i>
            Limpar
          </button>
        </div>
      </div>

      <div class="cp-stats-grid">
        <article class="mini-stat cp-stat-card cp-stat-card--total">
          <span>Total de títulos</span>
          <strong>${formatCurrency(state.resumo.total)}</strong>
          <small>${state.totalRegistros || state.contas.length} registro(s)</small>
        </article>

        <article class="mini-stat cp-stat-card cp-stat-card--pendente">
          <span>Pendentes</span>
          <strong>${formatCurrency(state.resumo.total_pendente)}</strong>
          <small>${Number(state.resumo.qtd_pendente || 0)} título(s)</small>
        </article>

        <article class="mini-stat cp-stat-card cp-stat-card--atrasado">
          <span>Atrasadas</span>
          <strong>${formatCurrency(state.resumo.total_atrasado)}</strong>
          <small>${Number(state.resumo.qtd_atrasado || 0)} título(s)</small>
        </article>

        <article class="mini-stat cp-stat-card cp-stat-card--pago">
          <span>Pagas</span>
          <strong>${formatCurrency(state.resumo.total_pago)}</strong>
          <small>${Number(state.resumo.qtd_pago || 0)} título(s)</small>
        </article>
      </div>

      <div class="table-wrapper">
        <table class="data-table cp-table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Fornecedor</th>
              <th>Origem</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th class="text-right">Valor</th>
              <th class="text-right">Ações</th>
            </tr>
          </thead>

          <tbody>
            ${renderLinhas()}
          </tbody>
        </table>
      </div>

      ${state.totalPaginas > 1 ? `
      <div class="lf-pagination">
        <button class="lf-pagination__btn" type="button" data-action="cp-pagina" data-page="prev" ${state.pagina <= 1 ? 'disabled' : ''} aria-label="Página anterior">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <span class="lf-pagination__info">Página ${state.pagina} de ${state.totalPaginas} <small>(${state.totalRegistros} registro(s))</small></span>
        <button class="lf-pagination__btn" type="button" data-action="cp-pagina" data-page="next" ${state.pagina >= state.totalPaginas ? 'disabled' : ''} aria-label="Próxima página">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>` : ''}
    </section>
  `;

  bindEventos();
  injectContasPagarStyles();
}

function renderLinhas() {
  if (!state.contas.length) {
    return `
      <tr>
        <td colspan="7">
          <div class="empty-table-state">
            <i class="fa-solid fa-file-invoice" style="font-size:2rem;opacity:.22;margin-bottom:4px"></i>
            <strong>Nenhuma conta encontrada</strong>
            <span>Use os filtros acima ou gere contas a pagar por compras parceladas.</span>
          </div>
        </td>
      </tr>
    `;
  }

  return state.contas
    .map((conta) => {
      const status = normalizarStatus(conta.status);
      const statusLabel = getStatusLabel(status);

      return `
      <tr>
        <td>
          <div class="table-primary">
            <strong>#${escapeHtml(conta.id)}</strong>
            <small>Parcela ${Number(conta.parcela || 1)}/${Number(conta.total_parcelas || 1)}</small>
          </div>
        </td>

        <td>
          <div class="table-primary">
            <strong>${escapeHtml(conta.fornecedor_nome || 'Fornecedor não informado')}</strong>
            <small>Fornecedor</small>
          </div>
        </td>

        <td>
          <div class="table-primary">
            <strong>${conta.compra_id ? `Compra #${escapeHtml(conta.compra_id)}` : 'Manual'}</strong>
            <small>${escapeHtml(conta.descricao || conta.forma_pagamento || 'Conta a pagar')}</small>
          </div>
        </td>

        <td>
          <div class="table-primary">
            <strong>${formatDate(conta.data_vencimento)}</strong>
            <small>${status === 'pago' ? `Pago em ${formatDate(conta.data_pagamento)}` : getVencimentoInfo(conta.data_vencimento)}</small>
          </div>
        </td>

        <td>
          <span class="${getStatusBadgeClass(status)}">
            ${statusLabel}
          </span>
        </td>

        <td class="text-right">
          <strong>${formatCurrency(conta.valor)}</strong>
        </td>

        <td class="text-right">
          <div class="table-actions">
            <button class="btn-inline" type="button" data-action="detalhe-cp" data-id="${conta.id}">
              <i class="fa-solid fa-eye"></i>
              Detalhes
            </button>

            ${
              conta.compra_id
                ? `
                  <button class="btn-inline" type="button" data-action="origem-compra-cp" data-id="${conta.id}">
                    <i class="fa-solid fa-receipt"></i>
                    Compra
                  </button>
                `
                : ''
            }

            ${
              status !== 'pago'
                ? `
                  <button class="btn-inline btn-inline--success" type="button" data-action="pagar-cp" data-id="${conta.id}">
                    <i class="fa-solid fa-check"></i>
                    Pagar
                  </button>
                `
                : ''
            }
          </div>
        </td>
      </tr>
    `;
    })
    .join('');
}

function bindEventos() {
  const btnAtualizar = document.getElementById('btnAtualizarContasPagar');
  const btnFiltrar = document.getElementById('btnFiltrarContasPagar');
  const btnLimpar = document.getElementById('btnLimparFiltrosContasPagar');
  const busca = document.getElementById('cpBusca');
  const status = document.getElementById('cpStatus');
  const fornecedor = document.getElementById('cpFornecedor');

  btnAtualizar?.addEventListener('click', async () => {
    await recarregar();
  });

  btnFiltrar?.addEventListener('click', async () => {
    state.filtros.busca = busca?.value?.trim() || '';
    state.filtros.status = status?.value || '';
    state.filtros.fornecedor_id = fornecedor?.value || '';
    state.pagina = 1;
    salvarFiltrosCP();
    await recarregar();
  });

  btnLimpar?.addEventListener('click', async () => {
    state.filtros = { status: '', fornecedor_id: '', busca: '' };
    state.pagina = 1;
    salvarFiltrosCP();
    await recarregar();
  });

  busca?.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      state.filtros.busca = busca.value.trim();
      state.filtros.status = status?.value || '';
      state.filtros.fornecedor_id = fornecedor?.value || '';
      state.pagina = 1;
      salvarFiltrosCP();
      await recarregar();
    }
  });

  document.querySelectorAll("[data-action='cp-pagina']").forEach((btn) => {
    btn.addEventListener('click', async () => {
      const page = btn.dataset.page;
      if (page === 'prev' && state.pagina > 1) state.pagina--;
      else if (page === 'next' && state.pagina < state.totalPaginas) state.pagina++;
      await recarregar();
    });
  });

  document.querySelectorAll("[data-action='pagar-cp']").forEach((button) => {
    button.addEventListener('click', async () => {
      await pagarConta(button.dataset.id);
    });
  });

  document.querySelectorAll("[data-action='detalhe-cp']").forEach((button) => {
    button.addEventListener('click', async () => {
      await abrirDetalheConta(button.dataset.id);
    });
  });

  document.querySelectorAll("[data-action='origem-compra-cp']").forEach((button) => {
    button.addEventListener('click', async () => {
      await abrirOrigemCompra(button.dataset.id);
    });
  });
}

async function recarregar() {
  setLoading(true);
  showMessage('Atualizando contas a pagar...', 'info');

  try {
    renderSkeleton();

    await Promise.all([carregarFornecedores(), carregarContas()]);

    render();
  } catch (error) {
    console.error('Erro ao recarregar contas a pagar:', error);
    const message = buildFriendlyError(error);
    renderErro(message);
    showMessage(message, 'error');
  } finally {
    setLoading(false);
  }
}

async function pagarConta(id) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px';

    const hoje = todayFortaleza();
    overlay.innerHTML = `
      <div style="background:var(--surface);border-radius:16px;padding:24px;max-width:380px;width:100%;box-shadow:0 24px 50px rgba(0,0,0,.2)">
        <h3 style="margin:0 0 16px;font-size:16px;font-weight:700">Confirmar pagamento</h3>
        <div style="margin-bottom:16px">
          <label style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:5px">Valor pago (R$)</label>
          <input id="_pagarValorInput" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="Deixe em branco para pagar total" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;box-sizing:border-box" />
        </div>
        <div style="margin-bottom:16px">
          <label style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:5px">Data do pagamento</label>
          <input id="_pagarDataInput" type="date" value="${hoje}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;box-sizing:border-box" />
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button id="_pagarCancelarBtn" class="btn-cancel">Cancelar</button>
          <button id="_pagarConfirmarBtn" class="btn-confirm btn-confirm--success">Confirmar pagamento</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    overlay.querySelector('#_pagarCancelarBtn').onclick = () => { document.body.removeChild(overlay); resolve(null); };
    overlay.querySelector('#_pagarConfirmarBtn').onclick = async () => {
      const data = overlay.querySelector('#_pagarDataInput').value;
      const valorStr = overlay.querySelector('#_pagarValorInput').value;
      const valor_pago = valorStr ? Number(valorStr) : undefined;
      document.body.removeChild(overlay);
      try {
        await api.pagarContaPagar(id, { data_pagamento: data || undefined, valor_pago });
        await recarregar();
      } catch (error) {
        console.error('Erro ao pagar conta:', error);
        showMessage(buildFriendlyError(error), 'error');
      }
      resolve();
    };
  });
}

async function abrirDetalheConta(id) {
  try {
    const conta = await api.getContaPagarDetalhe(id);
    renderDetalheConta(conta);
  } catch (error) {
    console.error('Erro ao abrir detalhe da conta:', error);
    const message = buildFriendlyError(error);
    showMessage(message, 'error');
  }
}

function renderDetalheConta(conta) {
  const modalExistente = document.getElementById('cpDetalheModal');
  if (modalExistente) modalExistente.remove();

  const status = normalizarStatus(conta.status);

  const modal = document.createElement('div');
  modal.id = 'cpDetalheModal';
  modal.className = 'modal-overlay cp-detail-overlay';

  modal.innerHTML = `
    <div class="modal-card cp-detail-card">
      <div class="cp-detail-header">
        <div>
          <span class="cp-detail-eyebrow">Conta #${escapeHtml(conta.id || '-')}</span>
          <h3>Detalhe da conta a pagar</h3>
          <p>${escapeHtml(conta.fornecedor_nome || 'Fornecedor não informado')}</p>
        </div>

        <button class="icon-button" type="button" id="fecharCpDetalhe" aria-label="Fechar">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="cp-detail-body">
        <section class="cp-detail-summary">
          <article class="cp-detail-summary__main">
            <span>Valor do título</span>
            <strong>${formatCurrency(conta.valor)}</strong>
            <small>${getStatusLabel(status)}</small>
          </article>

          <article>
            <span>Vencimento</span>
            <strong>${formatDate(conta.data_vencimento)}</strong>
          </article>

          <article>
            <span>Pagamento</span>
            <strong>${formatDate(conta.data_pagamento)}</strong>
          </article>

          <article>
            <span>Parcela</span>
            <strong>${Number(conta.parcela || 1)}/${Number(conta.total_parcelas || 1)}</strong>
          </article>
        </section>

        <section class="cp-detail-section">
          <div class="cp-detail-section__header">
            <div>
              <h4>Informações financeiras</h4>
              <p>Regra: só sai no Fluxo de Caixa após baixa como pago.</p>
            </div>
            <span class="${getStatusBadgeClass(status)}">${getStatusLabel(status)}</span>
          </div>

          <div class="cp-detail-grid">
            <div>
              <span>Origem</span>
              <strong>${conta.compra_id ? `Compra #${escapeHtml(conta.compra_id)}` : 'Manual'}</strong>
            </div>

            <div>
              <span>Descrição</span>
              <strong>${escapeHtml(conta.descricao || '-')}</strong>
            </div>

            <div>
              <span>Status financeiro</span>
              <strong>${getStatusLabel(status)}</strong>
            </div>

            <div>
              <span>Valor</span>
              <strong>${formatCurrency(conta.valor)}</strong>
            </div>
          </div>
        </section>

        <section class="cp-detail-note">
          <span>Observação</span>
          <p>${escapeHtml(conta.observacao || 'Nenhuma observação registrada.')}</p>
        </section>
      </div>

      <div class="cp-detail-footer">
        ${
          status !== 'pago'
            ? `
              <button class="btn btn-primary" type="button" id="pagarCpDetalhe" data-id="${conta.id}">
                <i class="fa-solid fa-check"></i>
                Marcar como pago
              </button>
            `
            : ''
        }

        <button class="btn btn-light" type="button" id="fecharCpDetalheFooter">
          Fechar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('fecharCpDetalhe')?.addEventListener('click', () => modal.remove());
  document.getElementById('fecharCpDetalheFooter')?.addEventListener('click', () => modal.remove());

  document.getElementById('pagarCpDetalhe')?.addEventListener('click', async (event) => {
    const contaId = event.currentTarget.dataset.id;
    modal.remove();
    await pagarConta(contaId);
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.remove();
  });
}

async function abrirOrigemCompra(id) {
  try {
    const origem = await api.getOrigemCompraContaPagar(id);
    renderOrigemCompra(origem);
  } catch (error) {
    console.error('Erro ao abrir origem da compra:', error);
    const message = buildFriendlyError(error);
    showMessage(message, 'error');
  }
}

function renderOrigemCompra(data) {
  const modalExistente = document.getElementById('cpOrigemCompraModal');
  if (modalExistente) modalExistente.remove();

  const compra = data?.compra || {};
  const conta = data?.conta || {};
  const itens = Array.isArray(data?.itens) ? data.itens : [];
  const parcelas = Array.isArray(data?.parcelas) ? data.parcelas : [];

  const modal = document.createElement('div');
  modal.id = 'cpOrigemCompraModal';
  modal.className = 'modal-overlay cp-origin-overlay';

  modal.innerHTML = `
    <div class="modal-card cp-origin-card">
      <div class="cp-detail-header">
        <div>
          <span class="cp-detail-eyebrow">Compra #${escapeHtml(compra.id || '-')}</span>
          <h3>Origem da conta a pagar</h3>
          <p>${escapeHtml(compra.fornecedor_nome_origem || conta.fornecedor_nome || 'Fornecedor não informado')}</p>
        </div>

        <button class="icon-button" type="button" id="fecharCpOrigem" aria-label="Fechar">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="cp-detail-body">
        <section class="cp-detail-summary">
          <article class="cp-detail-summary__main">
            <span>Total da compra</span>
            <strong>${formatCurrency(compra.total)}</strong>
            <small>${formatDate(compra.data)}</small>
          </article>

          <article>
            <span>Pagamento</span>
            <strong>${escapeHtml(compra.pagamento || compra.forma_pagamento || '-')}</strong>
          </article>

          <article>
            <span>Parcelas</span>
            <strong>${Number(compra.parcelas || 1)}x</strong>
          </article>

          <article>
            <span>Status</span>
            <strong>${escapeHtml(capitalize(compra.status || 'finalizada'))}</strong>
          </article>
        </section>

        <section class="cp-detail-section">
          <div class="cp-detail-section__header">
            <div>
              <h4>Itens comprados</h4>
              <p>Produtos que deram origem à conta</p>
            </div>
            <span>${itens.length} item(ns)</span>
          </div>

          <div class="cp-detail-list">
            ${
              itens.length
                ? itens
                    .map(
                      (item) => `
                  <div class="cp-detail-row">
                    <div>
                      <strong>${escapeHtml(item.produto_nome || 'Produto')}</strong>
                      <small>Qtd. ${Number(item.quantidade || 0)}</small>
                    </div>

                    <div>
                      <span>Custo unit.</span>
                      <strong>${formatCurrency(item.custo_unitario || 0)}</strong>
                    </div>

                    <div>
                      <span>Subtotal</span>
                      <strong>${formatCurrency(item.subtotal || 0)}</strong>
                    </div>
                  </div>
                `
                    )
                    .join('')
                : `<div class="empty-detail-state">Nenhum item vinculado.</div>`
            }
          </div>
        </section>

        <section class="cp-detail-section">
          <div class="cp-detail-section__header">
            <div>
              <h4>Parcelas geradas</h4>
              <p>Títulos financeiros vinculados à compra</p>
            </div>
            <span>${parcelas.length} parcela(s)</span>
          </div>

          <div class="cp-detail-list">
            ${
              parcelas.length
                ? parcelas
                    .map(
                      (parcela) => `
                  <div class="cp-detail-row">
                    <div>
                      <strong>Parcela ${Number(parcela.parcela || 1)}/${Number(parcela.total_parcelas || 1)}</strong>
                      <small>Vencimento: ${formatDate(parcela.data_vencimento)}</small>
                    </div>

                    <div>
                      <span>Status</span>
                      <strong>${getStatusLabel(normalizarStatus(parcela.status))}</strong>
                    </div>

                    <div>
                      <span>Valor</span>
                      <strong>${formatCurrency(parcela.valor || 0)}</strong>
                    </div>
                  </div>
                `
                    )
                    .join('')
                : `<div class="empty-detail-state">Nenhuma parcela vinculada.</div>`
            }
          </div>
        </section>
      </div>

      <div class="cp-detail-footer">
        <button class="btn btn-light" type="button" id="fecharCpOrigemFooter">
          Fechar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('fecharCpOrigem')?.addEventListener('click', () => modal.remove());
  document.getElementById('fecharCpOrigemFooter')?.addEventListener('click', () => modal.remove());

  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.remove();
  });
}

function renderErro(message) {
  const container = document.getElementById('contasPagarContainer');
  if (!container) return;

  container.innerHTML = `
    <section class="module-card">
      <div class="module-feedback module-feedback--error">
        ${escapeHtml(message)}
      </div>
    </section>
  `;
}

function normalizarStatus(status) {
  return String(status || 'pendente')
    .trim()
    .toLowerCase();
}

function getStatusLabel(status) {
  const normalized = normalizarStatus(status);

  if (normalized === 'pago') return 'Pago';
  if (normalized === 'atrasado') return 'Atrasado';
  if (normalized === 'pendente') return 'Pendente';
  if (normalized === 'parcial') return 'Parcial';
  if (normalized === 'parcial_atrasado') return 'Parcial em atraso';

  return capitalize(normalized);
}

function getStatusBadgeClass(status) {
  const normalized = normalizarStatus(status);

  if (normalized === 'pago') return 'badge badge--success';
  if (normalized === 'atrasado') return 'badge badge--danger';
  if (normalized === 'pendente') return 'badge badge--warning';
  if (normalized === 'parcial') return 'badge badge--info';
  if (normalized === 'parcial_atrasado') return 'badge badge--warning';

  return 'badge badge--info';
}

function getVencimentoInfo(dataVencimento) {
  if (!dataVencimento) return 'Sem vencimento';

  const hoje = new Date(`${todayFortaleza()}T00:00:00`);

  const vencimento = new Date(`${dataVencimento}T00:00:00`);

  if (Number.isNaN(vencimento.getTime())) {
    return 'Vencimento informado';
  }

  const diffMs = vencimento.getTime() - hoje.getTime();
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias < 0) return `${Math.abs(diffDias)} dia(s) em atraso`;
  if (diffDias === 0) return 'Vence hoje';
  if (diffDias === 1) return 'Vence amanhã';

  return `Vence em ${diffDias} dia(s)`;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatDate(value) {
  if (!value) return '-';

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('pt-BR');
}


function capitalize(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function injectContasPagarStyles() {
  if (document.getElementById('contasPagarProfessionalStyles')) return;

  const style = document.createElement('style');
  style.id = 'contasPagarProfessionalStyles';
  style.textContent = `
    .cp-module-card {
      position: relative;
    }

    .cp-explain-card {
      border: 1px solid rgba(37, 99, 235, 0.14);
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(8, 145, 178, 0.06));
      border-radius: 18px;
      padding: 14px 16px;
      margin-bottom: 18px;
    }

    .cp-explain-card strong {
      display: block;
      color: var(--primary-hover);
      font-weight: 800;
      margin-bottom: 4px;
    }

    .cp-explain-card span {
      color: var(--text-soft);
      font-weight: 600;
      line-height: 1.45;
    }

    .cp-stat-card {
      min-width: 170px;
      position: relative;
      overflow: hidden;
    }

    .cp-stat-card small {
      color: var(--text-muted);
      font-weight: 700;
      font-size: 0.78rem;
    }

    .cp-stat-card--pendente {
      border-color: rgba(217, 119, 6, 0.2);
    }

    .cp-stat-card--atrasado {
      border-color: rgba(220, 38, 38, 0.2);
    }

    .cp-stat-card--pago {
      border-color: rgba(22, 163, 74, 0.2);
    }

    .badge--warning {
      background: var(--warning-soft);
      color: #a16207;
      border-color: rgba(217, 119, 6, 0.16);
    }

    .badge--info {
      background: var(--info-soft);
      color: #0e7490;
      border-color: rgba(8, 145, 178, 0.16);
    }

    .btn-inline--success {
      color: var(--success);
      border-color: rgba(22, 163, 74, 0.2);
    }

    .btn-inline--success:hover {
      background: var(--success-soft);
      color: #15803d;
    }

    .empty-table-state {
      min-height: 120px;
      display: grid;
      place-items: center;
      text-align: center;
      color: var(--text-muted);
      gap: 4px;
    }

    .empty-table-state strong {
      display: block;
      color: var(--text);
      font-weight: 800;
    }

    .empty-table-state span {
      display: block;
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    .table-primary {
      display: grid;
      gap: 3px;
    }

    .table-primary small {
      color: var(--text-muted);
      font-size: 0.78rem;
      font-weight: 600;
    }

    .cp-detail-overlay,
    .cp-origin-overlay {
      padding: 18px;
      align-items: center;
    }

    .cp-detail-card,
    .cp-origin-card {
      width: min(100%, 820px);
      max-height: calc(100vh - 36px);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      border-radius: 26px;
      padding: 0;
    }

    .cp-detail-header {
      padding: 20px 22px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      background:
        radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 32%),
        var(--surface);
    }

    .cp-detail-eyebrow {
      display: inline-flex;
      width: fit-content;
      padding: 5px 10px;
      margin-bottom: 8px;
      border-radius: 999px;
      background: var(--primary-soft);
      color: var(--primary-hover);
      font-size: 0.74rem;
      font-weight: 800;
    }

    .cp-detail-header h3 {
      font-size: 1.28rem;
      font-weight: 800;
      letter-spacing: -0.04em;
      color: var(--text);
      margin-bottom: 4px;
    }

    .cp-detail-header p {
      color: var(--text-muted);
      font-size: 0.9rem;
      font-weight: 600;
    }

    .cp-detail-body {
      padding: 18px 22px;
      display: grid;
      gap: 14px;
      overflow-y: auto;
    }

    .cp-detail-summary {
      display: grid;
      grid-template-columns: 1.25fr repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .cp-detail-summary article,
    .cp-detail-note {
      border: 1px solid var(--border);
      background: var(--surface-2);
      border-radius: 18px;
      padding: 14px 16px;
      min-width: 0;
    }

    .cp-detail-summary article span,
    .cp-detail-note span,
    .cp-detail-grid span {
      display: block;
      color: var(--text-muted);
      font-size: 0.76rem;
      font-weight: 800;
      margin-bottom: 6px;
    }

    .cp-detail-summary article strong,
    .cp-detail-grid strong {
      display: block;
      color: var(--text);
      font-size: 0.98rem;
      font-weight: 800;
      line-height: 1.25;
      word-break: break-word;
    }

    .cp-detail-summary__main strong {
      font-size: 1.35rem !important;
      letter-spacing: -0.04em;
    }

    .cp-detail-summary article small {
      display: block;
      margin-top: 6px;
      color: var(--text-muted);
      font-weight: 700;
    }

    .cp-detail-note {
      padding: 12px 16px;
    }

    .cp-detail-note p {
      color: var(--text);
      font-weight: 700;
      line-height: 1.45;
    }

    .cp-detail-section {
      border: 1px solid var(--border);
      border-radius: 20px;
      background: var(--surface);
      overflow: hidden;
    }

    .cp-detail-section__header {
      padding: 13px 16px;
      background: var(--surface-2);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    }

    .cp-detail-section__header h4 {
      color: var(--text);
      font-size: 0.98rem;
      font-weight: 800;
      margin-bottom: 3px;
    }

    .cp-detail-section__header p {
      color: var(--text-muted);
      font-size: 0.82rem;
      font-weight: 600;
    }

    .cp-detail-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      padding: 14px 16px;
    }

    .cp-detail-grid > div {
      border: 1px solid var(--border);
      background: var(--surface-2);
      border-radius: 16px;
      padding: 12px;
    }

    .cp-detail-list {
      display: grid;
    }

    .cp-detail-row {
      display: grid;
      grid-template-columns: 1.4fr 0.8fr 0.8fr;
      gap: 14px;
      align-items: center;
      padding: 13px 16px;
      border-bottom: 1px solid var(--border);
    }

    .cp-detail-row:last-child {
      border-bottom: none;
    }

    .cp-detail-row strong {
      color: var(--text);
      font-size: 0.92rem;
      font-weight: 800;
    }

    .cp-detail-row small,
    .cp-detail-row span {
      display: block;
      color: var(--text-muted);
      font-size: 0.76rem;
      font-weight: 700;
      margin-bottom: 3px;
    }

    .empty-detail-state {
      padding: 18px 16px;
      color: var(--text-muted);
      font-weight: 700;
    }

    .cp-detail-footer {
      padding: 14px 22px 18px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      background: var(--surface);
    }

    @media (max-width: 980px) {
      .cp-toolbar-grid {
        grid-template-columns: 1fr;
      }

      .cp-action-box {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }

      .cp-detail-summary,
      .cp-detail-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .cp-detail-row {
        grid-template-columns: 1fr;
        gap: 8px;
      }
    }

    @media (max-width: 560px) {
      .cp-detail-overlay,
      .cp-origin-overlay {
        padding: 10px;
        align-items: flex-start;
      }

      .cp-detail-card,
      .cp-origin-card {
        max-height: calc(100vh - 20px);
        border-radius: 20px;
      }

      .cp-detail-summary,
      .cp-detail-grid {
        grid-template-columns: 1fr;
      }

      .cp-detail-body {
        padding: 14px;
      }

      .cp-action-box {
        grid-template-columns: 1fr;
      }
    }

    .lf-pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 16px 0 4px;
    }
    .lf-pagination__btn {
      width: 36px;
      height: 36px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text);
    }
    .lf-pagination__btn:hover:not(:disabled) { background: var(--surface-2); }
    .lf-pagination__btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .lf-pagination__info { font-size: 0.88rem; font-weight: 700; color: var(--text-muted); }
    .lf-pagination__info small { font-weight: 600; font-size: 0.8rem; }
  `;

  document.head.appendChild(style);
}
