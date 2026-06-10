import api from './api.js';
import { showToast } from './feedback.js';
import { escapeHtml, buildFriendlyError } from './utils.js';

const state = {
  resumo: {
    entradas: 0,
    saidas: 0,
    saldo: 0
  },
  movimentos: [],
  resumoFormasPagamento: [],
  filtros: {
    busca: '',
    tipo: '',
    origem: ''
  },
  loading: false,
  cashflowFuturo: null,
  diasProjecao: 30,
  pagina: 1,
  itensPorPagina: 50
};

function showMessage(message, type = 'info') {
  const feedback = document.getElementById('fluxoCaixaFeedback');

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

  const btnAtualizar = document.getElementById('btnAtualizarFluxoCaixa');
  const btnFiltrar = document.getElementById('btnFiltrarFluxoCaixa');
  const btnLimpar = document.getElementById('btnLimparFluxoCaixa');

  if (btnAtualizar) btnAtualizar.disabled = value;
  if (btnFiltrar) btnFiltrar.disabled = value;
  if (btnLimpar) btnLimpar.disabled = value;

  if (btnAtualizar) {
    btnAtualizar.innerHTML = value
      ? '<i class="fa-solid fa-spinner fa-spin"></i> Atualizando...'
      : '<i class="fa-solid fa-rotate"></i> Atualizar';
  }
}


export async function initFluxoCaixaModule() {
  try {
    state.loading = true;
    renderSkeleton();

    await Promise.all([
      carregarFluxoCaixa(),
      carregarCashflowFuturo(state.diasProjecao)
    ]);

    render();
    renderCashflowFuturo();
  } catch (error) {
    console.error('Erro ao iniciar fluxo de caixa:', error);
    const message = buildFriendlyError(error);
    renderErro(message);
    showMessage(message, 'error');
  } finally {
    state.loading = false;
  }
}

async function carregarFluxoCaixa() {
  const filtrosGlobais = getFiltrosGlobais();

  const response = await api.getFluxoCaixa({
    ...filtrosGlobais
  });

  state.resumo = {
    entradas: Number(response?.entradas || 0),
    saidas: Number(response?.saidas || 0),
    saldo: Number(response?.saldo || 0)
  };

  state.movimentos = Array.isArray(response?.movimentos) ? response.movimentos : [];
  state.resumoFormasPagamento = Array.isArray(response?.resumo_formas_pagamento)
    ? response.resumo_formas_pagamento
    : [];
}

function getFiltrosGlobais() {
  return {
    data_inicial: document.getElementById('filtroDataInicial')?.value || '',
    data_final: document.getElementById('filtroDataFinal')?.value || '',
    busca: document.getElementById('filtroBuscaGlobal')?.value?.trim() || ''
  };
}

function getMovimentosPaginados(filtrados) {
  const inicio = (state.pagina - 1) * state.itensPorPagina;
  return filtrados.slice(inicio, inicio + state.itensPorPagina);
}

function getTotalPaginasFluxo(filtrados) {
  return Math.ceil(filtrados.length / state.itensPorPagina) || 1;
}

function getMovimentosFiltrados() {
  const busca = String(state.filtros.busca || '')
    .trim()
    .toLowerCase();
  const tipo = String(state.filtros.tipo || '')
    .trim()
    .toLowerCase();
  const origem = String(state.filtros.origem || '')
    .trim()
    .toLowerCase();

  return state.movimentos.filter((movimento) => {
    const texto = [
      movimento.id,
      movimento.origem,
      movimento.tipo,
      movimento.descricao,
      movimento.valor,
      movimento.data_movimento,
      movimento.referencia_id,
      movimento.observacao
    ]
      .join(' ')
      .toLowerCase();

    const matchBusca = !busca || texto.includes(busca);
    const matchTipo = !tipo || String(movimento.tipo || '').toLowerCase() === tipo;
    const matchOrigem = !origem || String(movimento.origem || '').toLowerCase() === origem;

    return matchBusca && matchTipo && matchOrigem;
  });
}

function renderSkeleton() {
  const container = document.getElementById('fluxoCaixaContainer');
  if (!container) return;

  container.innerHTML = `
    <section class="module-card">
      <div class="module-feedback module-feedback--info">
        Carregando fluxo de caixa...
      </div>
    </section>
  `;
}

function render() {
  const container = document.getElementById('fluxoCaixaContainer');
  if (!container) return;

  const movimentosFiltrados = getMovimentosFiltrados();
  const totalPaginasFluxo = getTotalPaginasFluxo(movimentosFiltrados);
  const movimentosPaginados = getMovimentosPaginados(movimentosFiltrados);

  if (!movimentosFiltrados.length) {
    setTimeout(() => {
      showMessage('Nenhuma movimentação encontrada para o período selecionado.', 'info');
    }, 100);
  }

  container.innerHTML = `
    <section class="module-card fluxo-module-card">
      <div id="fluxoCaixaFeedback" class="module-feedback"></div>

      <div class="module-card__header">
        <div>
          <h3>Fluxo de Caixa</h3>
          <p>Entradas, saídas e saldo real com base em pagamentos e recebimentos baixados</p>
        </div>

        <div class="module-card__actions">
          <button class="btn btn-light" id="btnAtualizarFluxoCaixa" type="button">
            <i class="fa-solid fa-rotate"></i>
            Atualizar
          </button>
        </div>
      </div>

      <div class="fluxo-explain-card">
        <div>
          <strong>Caixa real</strong>
          <span>Esta tela considera somente valores efetivamente recebidos ou pagos. Títulos pendentes ficam em Contas a Receber e Contas a Pagar.</span>
        </div>
      </div>

      <div class="fluxo-kpi-grid">
        <article class="fluxo-kpi-card fluxo-kpi-card--entrada">
          <div class="fluxo-kpi-card__icon">
            <i class="fa-solid fa-arrow-trend-up"></i>
          </div>

          <div>
            <span>Entradas realizadas</span>
            <strong>${formatCurrency(state.resumo.entradas)}</strong>
            <small>Recebimentos e receitas pagas</small>
          </div>
        </article>

        <article class="fluxo-kpi-card fluxo-kpi-card--saida">
          <div class="fluxo-kpi-card__icon">
            <i class="fa-solid fa-arrow-trend-down"></i>
          </div>

          <div>
            <span>Saídas realizadas</span>
            <strong>${formatCurrency(state.resumo.saidas)}</strong>
            <small>Pagamentos, despesas e investimentos</small>
          </div>
        </article>

        <article class="fluxo-kpi-card ${state.resumo.saldo >= 0 ? 'fluxo-kpi-card--saldo-positivo' : 'fluxo-kpi-card--saldo-negativo'}">
          <div class="fluxo-kpi-card__icon">
            <i class="fa-solid fa-scale-balanced"></i>
          </div>

          <div>
            <span>Saldo do caixa</span>
            <strong>${formatCurrency(state.resumo.saldo)}</strong>
            <small>${getSaldoDescricao(state.resumo.saldo)}</small>
          </div>
        </article>
      </div>

      <div class="fluxo-toolbar-grid">
        <div class="module-toolbar__search fluxo-search-box">
          <i class="fa-solid fa-search"></i>
          <input
            type="text"
            id="fluxoBusca"
            placeholder="Buscar descrição, origem, referência ou observação..."
            value="${escapeHtml(state.filtros.busca)}"
          />
        </div>

        <div class="fluxo-filter-box">
          <select id="fluxoTipo" class="input">
            <option value="">Entradas e saídas</option>
            <option value="entrada" ${state.filtros.tipo === 'entrada' ? 'selected' : ''}>Somente entradas</option>
            <option value="saida" ${state.filtros.tipo === 'saida' ? 'selected' : ''}>Somente saídas</option>
          </select>
        </div>

        <div class="fluxo-filter-box">
          <select id="fluxoOrigem" class="input">
            <option value="">Todas as origens</option>
            <option value="conta_receber" ${state.filtros.origem === 'conta_receber' ? 'selected' : ''}>Contas a Receber</option>
            <option value="conta_pagar" ${state.filtros.origem === 'conta_pagar' ? 'selected' : ''}>Contas a Pagar</option>
            <option value="lancamento_financeiro" ${state.filtros.origem === 'lancamento_financeiro' ? 'selected' : ''}>Lançamentos</option>
            <option value="investimento" ${state.filtros.origem === 'investimento' ? 'selected' : ''}>Investimentos</option>
          </select>
        </div>

        <div class="fluxo-action-box">
          <button class="btn btn-primary" id="btnFiltrarFluxoCaixa" type="button">
            <i class="fa-solid fa-filter"></i>
            Filtrar
          </button>

          <button class="btn btn-light" id="btnLimparFluxoCaixa" type="button">
            <i class="fa-solid fa-eraser"></i>
            Limpar
          </button>
        </div>
      </div>

      ${renderResumoFormasPagamento()}

      <div class="fluxo-content-grid">
        <section class="fluxo-panel fluxo-panel--large">
          <div class="fluxo-panel__header">
            <div>
              <h4>Movimentações realizadas</h4>
              <p>Histórico financeiro efetivamente movimentado no caixa</p>
            </div>

            <span>${movimentosFiltrados.length} movimento(s)</span>
          </div>

          <div class="fluxo-movimentos-list">
            ${renderMovimentos(movimentosPaginados)}
          </div>

          ${totalPaginasFluxo > 1 ? `
          <div class="lf-pagination">
            <button class="lf-pagination__btn" type="button" data-action="fluxo-pagina" data-page="prev" ${state.pagina <= 1 ? 'disabled' : ''} aria-label="Página anterior">
              <i class="fa-solid fa-chevron-left"></i>
            </button>
            <span class="lf-pagination__info">Página ${state.pagina} de ${totalPaginasFluxo} <small>(${movimentosFiltrados.length} movimento(s))</small></span>
            <button class="lf-pagination__btn" type="button" data-action="fluxo-pagina" data-page="next" ${state.pagina >= totalPaginasFluxo ? 'disabled' : ''} aria-label="Próxima página">
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>` : ''}
        </section>

        <aside class="fluxo-panel">
          <div class="fluxo-panel__header">
            <div>
              <h4>Resumo por origem</h4>
              <p>Composição do caixa no período</p>
            </div>
          </div>

          <div class="fluxo-origin-list">
            ${renderResumoOrigens()}
          </div>
        </aside>
      </div>
    </section>
  `;

  bindEventos();
  injectFluxoCaixaStyles();
}

function renderResumoFormasPagamento() {
  if (!state.resumoFormasPagamento.length) {
    return '';
  }

  return `
    <div class="fluxo-formas-grid">
      ${state.resumoFormasPagamento
        .map(
          (item) => `
        <article class="fluxo-forma-card">
          <div>
           <span class="forma-badge ${getFormaClasse(item.forma_pagamento)}">
              ${getFormaIcone(item.forma_pagamento)} ${escapeHtml(item.forma_pagamento || 'Não informado')}
           </span>
            <strong>${formatCurrency(item.saldo)}</strong>
          </div>

          <small>
            Entradas: ${formatCurrency(item.entradas)} · Saídas: ${formatCurrency(item.saidas)}
          </small>
        </article>
      `
        )
        .join('')}
    </div>
  `;
}

function getFormaClasse(forma) {
  const f = String(forma || '').toLowerCase();

  if (f.includes('dinheiro')) return 'forma-dinheiro';
  if (f.includes('pix')) return 'forma-pix';
  if (f.includes('cart')) return 'forma-cartao';
  if (f.includes('boleto')) return 'forma-boleto';
  if (f.includes('promiss')) return 'forma-promissoria';

  return 'forma-outros';
}

function getFormaIcone(forma) {
  const f = String(forma || '').toLowerCase();

  if (f.includes('dinheiro')) return '💰';
  if (f.includes('pix')) return '📱';
  if (f.includes('cart')) return '💳';
  if (f.includes('boleto')) return '🧾';
  if (f.includes('promiss')) return '📄';

  return '❓';
}

function renderMovimentos(movimentos) {
  if (!movimentos.length) {
    return `
      <div class="empty-table-state">
        <i class="fa-solid fa-chart-line" style="font-size:2rem;opacity:.22;margin-bottom:4px"></i>
        <strong>Nenhum movimento encontrado</strong>
        <span>O fluxo mostra apenas valores recebidos ou pagos no período filtrado.</span>
      </div>
    `;
  }

  return movimentos
    .map((movimento) => {
      const tipo = String(movimento.tipo || '').toLowerCase();
      const isEntrada = tipo === 'entrada';

      return `
      <article class="fluxo-movimento-item ${isEntrada ? 'fluxo-movimento-item--entrada' : 'fluxo-movimento-item--saida'}">
        <div class="fluxo-movimento-item__icon">
          <i class="fa-solid ${isEntrada ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
        </div>

        <div class="fluxo-movimento-item__main">
          <strong>${escapeHtml(movimento.descricao || 'Movimento financeiro')}</strong>
          <span>
            ${formatOrigem(movimento.origem)}
            ${movimento.forma_pagamento ? ` • ${formatFormaPagamento(movimento.forma_pagamento)}` : ''}
          </span>
          ${movimento.observacao ? `<small>${escapeHtml(movimento.observacao)}</small>` : ''}
        </div>

        <div class="fluxo-movimento-item__side">
          <strong>${isEntrada ? '+' : '-'} ${formatCurrency(movimento.valor)}</strong>
          <span>${formatDate(movimento.data_movimento)}</span>
        </div>
      </article>
    `;
    })
    .join('');
}

function formatFormaPagamento(value) {
  const v = String(value || '').toLowerCase();

  const map = {
    dinheiro: 'Dinheiro',
    pix: 'Pix',
    cartao: 'Cartão',
    cartão: 'Cartão',
    credito: 'Cartão',
    debito: 'Cartão',
    boleto: 'Boleto',
    promissoria: 'Promissória'
  };

  return map[v] || value;
}

function renderResumoOrigens() {
  const resumo = state.movimentos.reduce((acc, movimento) => {
    const origem = movimento.origem || 'outros';
    const tipo = String(movimento.tipo || '').toLowerCase();
    const valor = Number(movimento.valor || 0);

    if (!acc[origem]) {
      acc[origem] = {
        origem,
        entradas: 0,
        saidas: 0,
        total: 0
      };
    }

    if (tipo === 'entrada') {
      acc[origem].entradas += valor;
      acc[origem].total += valor;
    } else {
      acc[origem].saidas += valor;
      acc[origem].total -= valor;
    }

    return acc;
  }, {});

  const itens = Object.values(resumo);

  if (!itens.length) {
    return `
      <div class="empty-detail-state">
        Nenhuma origem encontrada.
      </div>
    `;
  }

  return itens
    .map(
      (item) => `
    <article class="fluxo-origin-item">
      <div>
        <strong>${formatOrigem(item.origem)}</strong>
        <span>Entradas: ${formatCurrency(item.entradas)}</span>
        <span>Saídas: ${formatCurrency(item.saidas)}</span>
      </div>

      <strong class="${item.total >= 0 ? 'text-success' : 'text-danger'}">
        ${formatCurrency(item.total)}
      </strong>
    </article>
  `
    )
    .join('');
}

// ── Cashflow Futuro ───────────────────────────────────────────────────────────

async function carregarCashflowFuturo(dias = 30) {
  try {
    const empresa = document.getElementById('filtroEmpresa')?.value
      || window.LfErpApi?.getEmpresaNome?.() || '';
    const data = await api.request('/financeiro/cashflow-futuro', {
      method: 'GET',
      query: { dias, empresa }
    });
    state.cashflowFuturo = data;
  } catch {
    state.cashflowFuturo = null;
  }
}

function renderCashflowFuturo() {
  let section = document.getElementById('cashflowFuturoSection');
  if (!section) {
    section = document.createElement('section');
    section.id = 'cashflowFuturoSection';
    section.className = 'module-card';
    section.style.marginTop = '20px';
    const container = document.getElementById('fluxoCaixaContainer');
    container?.appendChild(section);
  }

  const cf = state.cashflowFuturo;
  const dias = state.diasProjecao;
  const cur = formatCurrency;
  const dt  = formatDate;

  if (!cf) {
    section.innerHTML = `<div class="module-feedback module-feedback--error">Não foi possível carregar a projeção futura.</div>`;
    return;
  }

  const linhas = (cf.projecao || []).map((p) => {
    const saldoColor = p.saldo_acumulado >= 0 ? 'var(--success,#38a169)' : 'var(--danger,#e53e3e)';
    return `<tr>
      <td>${dt(p.data)}</td>
      <td class="text-right" style="color:var(--success,#38a169)">${p.entrada > 0 ? cur(p.entrada) : '-'}</td>
      <td class="text-right" style="color:var(--danger,#e53e3e)">${p.saida > 0 ? cur(p.saida) : '-'}</td>
      <td class="text-right"><strong style="color:${saldoColor}">${cur(p.saldo_acumulado)}</strong></td>
    </tr>`;
  }).join('');

  const saldoFinalColor = cf.saldo_projetado >= 0 ? 'var(--success,#38a169)' : 'var(--danger,#e53e3e)';

  section.innerHTML = `
    <div class="module-card__header">
      <div>
        <h3>Projeção de Caixa</h3>
        <p>Entradas e saídas previstas nos próximos ${dias} dias com base em títulos em aberto</p>
      </div>
      <div class="module-card__actions">
        <div style="display:flex;gap:6px">
          ${[30,60,90].map((d) => `
            <button type="button" class="btn ${d === dias ? 'btn-primary' : 'btn-light'} btn-sm"
              id="cfFuturo${d}d">${d} dias</button>`).join('')}
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:20px">
      <div style="border:1px solid var(--border);border-radius:14px;padding:14px">
        <div style="font-size:.8rem;color:var(--text-muted)">A receber</div>
        <div style="font-weight:800;color:var(--success,#38a169)">${cur(cf.total_entradas)}</div>
      </div>
      <div style="border:1px solid var(--border);border-radius:14px;padding:14px">
        <div style="font-size:.8rem;color:var(--text-muted)">A pagar</div>
        <div style="font-weight:800;color:var(--danger,#e53e3e)">${cur(cf.total_saidas)}</div>
      </div>
      <div style="border:1px solid var(--border);border-radius:14px;padding:14px">
        <div style="font-size:.8rem;color:var(--text-muted)">Saldo projetado</div>
        <div style="font-weight:800;color:${saldoFinalColor}">${cur(cf.saldo_projetado)}</div>
      </div>
    </div>

    ${linhas
      ? `<div class="table-wrapper">
         <table class="data-table">
           <thead><tr>
             <th>Data</th>
             <th class="text-right">Entradas</th>
             <th class="text-right">Saídas</th>
             <th class="text-right">Saldo acumulado</th>
           </tr></thead>
           <tbody>${linhas}</tbody>
         </table></div>`
      : `<div class="empty-state">Nenhum título vencendo nos próximos ${dias} dias.</div>`}`;

  // Bind seletores de dias
  [30, 60, 90].forEach((d) => {
    document.getElementById(`cfFuturo${d}d`)?.addEventListener('click', async () => {
      state.diasProjecao = d;
      section.innerHTML = `<div class="module-feedback module-feedback--info">Carregando projeção de ${d} dias...</div>`;
      await carregarCashflowFuturo(d);
      renderCashflowFuturo();
    });
  });
}

function bindEventos() {
  const btnAtualizar = document.getElementById('btnAtualizarFluxoCaixa');
  const btnFiltrar = document.getElementById('btnFiltrarFluxoCaixa');
  const btnLimpar = document.getElementById('btnLimparFluxoCaixa');

  const busca = document.getElementById('fluxoBusca');
  const tipo = document.getElementById('fluxoTipo');
  const origem = document.getElementById('fluxoOrigem');

  btnAtualizar?.addEventListener('click', async () => {
    await recarregar();
  });

  btnFiltrar?.addEventListener('click', () => {
    showMessage('Filtros aplicados.', 'info');
    state.filtros.busca = busca?.value?.trim() || '';
    state.filtros.tipo = tipo?.value || '';
    state.filtros.origem = origem?.value || '';
    state.pagina = 1;

    render();
  });

  btnLimpar?.addEventListener('click', () => {
    showMessage('Filtros limpos.', 'info');
    state.filtros = {
      busca: '',
      tipo: '',
      origem: ''
    };
    state.pagina = 1;

    render();
  });

  busca?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      state.filtros.busca = busca.value.trim();
      state.filtros.tipo = tipo?.value || '';
      state.filtros.origem = origem?.value || '';
      state.pagina = 1;

      render();
    }
  });

  document.querySelectorAll("[data-action='fluxo-pagina']").forEach((btn) => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      const filtrados = getMovimentosFiltrados();
      const total = getTotalPaginasFluxo(filtrados);
      if (page === 'prev' && state.pagina > 1) state.pagina--;
      else if (page === 'next' && state.pagina < total) state.pagina++;
      render();
    });
  });
}

async function recarregar() {
  setLoading(true);
  showMessage('Atualizando fluxo de caixa...', 'info');

  try {
    renderSkeleton();
    await Promise.all([
      carregarFluxoCaixa(),
      carregarCashflowFuturo(state.diasProjecao)
    ]);
    render();
    renderCashflowFuturo();
  } catch (error) {
    console.error('Erro ao atualizar fluxo de caixa:', error);
    const message = buildFriendlyError(error);
    renderErro(message);
    showMessage(message, 'error');
  } finally {
    setLoading(false);
  }
}

function renderErro(message) {
  const container = document.getElementById('fluxoCaixaContainer');
  if (!container) return;

  container.innerHTML = `
    <section class="module-card">
      <div class="module-feedback module-feedback--error">
        ${escapeHtml(message)}
      </div>
    </section>
  `;
}

function getSaldoDescricao(saldo) {
  const valor = Number(saldo || 0);

  if (valor > 0) {
    return 'Operação positiva no período (mais entradas que saídas)';
  }

  if (valor < 0) {
    return 'Atenção: saídas maiores que entradas no período';
  }

  return 'Equilíbrio financeiro no período';
}

function formatOrigem(origem) {
  const value = String(origem || '').toLowerCase();

  const map = {
    conta_receber: 'Contas a Receber',
    conta_pagar: 'Contas a Pagar',
    lancamento_financeiro: 'Lançamentos',
    investimento: 'Investimentos',
    venda_direta: 'Venda Direta',
    compra_direta: 'Compra Direta'
  };

  return map[value] || 'Outros';
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

function injectFluxoCaixaStyles() {
  if (document.getElementById('fluxoCaixaProfessionalStyles')) return;

  const style = document.createElement('style');
  style.id = 'fluxoCaixaProfessionalStyles';
  style.textContent = `
    .fluxo-module-card {
      position: relative;
    }

    .fluxo-explain-card {
      border: 1px solid rgba(37, 99, 235, 0.14);
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(8, 145, 178, 0.06));
      border-radius: 18px;
      padding: 14px 16px;
      margin-bottom: 18px;
    }

    .fluxo-explain-card strong {
      display: block;
      color: var(--primary-hover);
      font-weight: 800;
      margin-bottom: 4px;
    }

    .fluxo-explain-card span {
      color: var(--text-soft);
      font-weight: 600;
      line-height: 1.45;
    }

    .fluxo-kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 18px;
    }

    .fluxo-kpi-card {
      border: 1px solid var(--border);
      background: var(--surface);
      border-radius: 22px;
      padding: 18px;
      display: flex;
      gap: 14px;
      align-items: flex-start;
      box-shadow: var(--shadow-xs);
    }

    .fluxo-kpi-card__icon {
      width: 48px;
      height: 48px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      background: var(--surface-2);
      color: var(--primary);
    }

    .fluxo-kpi-card span {
      display: block;
      color: var(--text-muted);
      font-size: 0.84rem;
      font-weight: 800;
      margin-bottom: 6px;
    }

    .fluxo-kpi-card strong {
      display: block;
      color: var(--text);
      font-size: 1.45rem;
      font-weight: 800;
      letter-spacing: -0.04em;
      margin-bottom: 4px;
    }

    .fluxo-kpi-card small {
      color: var(--text-muted);
      font-weight: 600;
      line-height: 1.35;
    }

    .fluxo-kpi-card--entrada {
      border-color: rgba(22, 163, 74, 0.22);
    }

    .fluxo-kpi-card--saida {
      border-color: rgba(220, 38, 38, 0.22);
    }

    .fluxo-kpi-card--saldo-positivo {
      border-color: rgba(37, 99, 235, 0.22);
    }

    .fluxo-kpi-card--saldo-negativo {
      border-color: rgba(220, 38, 38, 0.22);
    }

    .fluxo-toolbar-grid {
      display: grid;
      grid-template-columns: minmax(280px, 1fr) 210px 230px auto;
      gap: 14px;
      align-items: center;
      margin-bottom: 18px;
    }

    .fluxo-search-box {
      position: relative;
      min-width: 0;
    }

    .fluxo-search-box i {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-light);
      pointer-events: none;
    }

    .fluxo-search-box input,
    .fluxo-filter-box select {
      width: 100%;
      min-height: 52px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--surface);
      color: var(--text);
      padding: 0 14px;
    }

    .fluxo-search-box input {
      padding-left: 46px;
    }

    .fluxo-search-box input:focus,
    .fluxo-filter-box select:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
    }

    .fluxo-action-box {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .fluxo-content-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.7fr);
      gap: 18px;
    }

    .fluxo-panel {
      border: 1px solid var(--border);
      background: var(--surface);
      border-radius: 22px;
      overflow: hidden;
      min-width: 0;
    }

    .fluxo-panel__header {
      padding: 16px 18px;
      border-bottom: 1px solid var(--border);
      background: var(--surface-2);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .fluxo-panel__header h4 {
      color: var(--text);
      font-size: 1rem;
      font-weight: 800;
      margin-bottom: 3px;
    }

    .fluxo-panel__header p {
      color: var(--text-muted);
      font-size: 0.84rem;
      font-weight: 600;
    }

    .fluxo-panel__header > span {
      flex-shrink: 0;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-muted);
      border-radius: 999px;
      padding: 7px 10px;
      font-size: 0.78rem;
      font-weight: 800;
    }

    .fluxo-movimentos-list {
      display: grid;
      max-height: 560px;
      overflow-y: auto;
    }

    .fluxo-movimento-item {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
    }

    .fluxo-movimento-item:last-child {
      border-bottom: none;
    }

    .fluxo-movimento-item__icon {
      width: 40px;
      height: 40px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background: var(--surface-2);
      color: var(--primary);
    }

    .fluxo-movimento-item--entrada .fluxo-movimento-item__icon {
      background: var(--success-soft);
      color: var(--success);
    }

    .fluxo-movimento-item--saida .fluxo-movimento-item__icon {
      background: var(--danger-soft);
      color: var(--danger);
    }

    .fluxo-movimento-item__main {
      min-width: 0;
      display: grid;
      gap: 3px;
    }

    .fluxo-movimento-item__main strong {
      color: var(--text);
      font-weight: 800;
      font-size: 0.94rem;
    }

    .fluxo-movimento-item__main span,
    .fluxo-movimento-item__main small {
      color: var(--text-muted);
      font-size: 0.78rem;
      font-weight: 600;
    }

    .fluxo-movimento-item__side {
      text-align: right;
      display: grid;
      gap: 3px;
      white-space: nowrap;
    }

    .fluxo-movimento-item__side strong {
      font-size: 0.96rem;
      font-weight: 800;
    }

    .fluxo-movimento-item--entrada .fluxo-movimento-item__side strong {
      color: var(--success);
    }

    .fluxo-movimento-item--saida .fluxo-movimento-item__side strong {
      color: var(--danger);
    }

    .fluxo-movimento-item__side span {
      color: var(--text-muted);
      font-size: 0.78rem;
      font-weight: 700;
    }

    .fluxo-origin-list {
      display: grid;
    }

    .fluxo-origin-item {
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: center;
    }

    .fluxo-origin-item:last-child {
      border-bottom: none;
    }

    .fluxo-origin-item div {
      display: grid;
      gap: 4px;
    }

    .fluxo-origin-item strong {
      color: var(--text);
      font-weight: 800;
    }

    .fluxo-origin-item span {
      color: var(--text-muted);
      font-size: 0.78rem;
      font-weight: 600;
    }

    @media (max-width: 1180px) {
      .fluxo-toolbar-grid,
      .fluxo-content-grid {
        grid-template-columns: 1fr;
      }

      .fluxo-kpi-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .fluxo-action-box {
        display: grid;
        grid-template-columns: 1fr;
      }

      .fluxo-movimento-item {
        grid-template-columns: 40px minmax(0, 1fr);
      }

      .fluxo-movimento-item__side {
        grid-column: 1 / -1;
        text-align: left;
        padding-left: 54px;
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
