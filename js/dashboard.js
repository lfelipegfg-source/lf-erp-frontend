import api from './api.js';
import { showToast } from './feedback.js';

let lastDashboardContext = {
  filters: {},
  state: {}
};

function showMessage(message, type = 'info') {
  if (typeof showToast === 'function') {
    showToast(message, type);
  }
}

function buildFriendlyError(error) {
  const message = error?.message || '';

  if (message.includes('Failed to fetch')) {
    return 'Não foi possível conectar ao servidor.';
  }

  if (error?.status === 403) {
    return 'Acesso negado ou plano limitado.';
  }

  return message || 'Erro ao carregar dashboard.';
}

function toCurrency(value) {
  const numericValue = Number(value) || 0;
  return numericValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function getPeriodLabel(filters = {}) {
  const labels = {
    hoje: 'Hoje',
    ontem: 'Ontem',
    '7dias': 'Últimos 7 dias',
    '30dias': 'Últimos 30 dias',
    mesAtual: 'Mês atual',
    mesAnterior: 'Mês anterior',
    personalizado: 'Personalizado'
  };

  return labels[filters.periodo] || 'Período';
}

function safeText(value, fallback = '-') {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function normalizeDashboardPayload(data = {}) {
  return {
    faturamento: Number(data.faturamento ?? data.total_vendas ?? 0),
    vendas: Number(data.vendas ?? data.total_vendas_qtd ?? 0),
    contasReceber: Number(data.contas_receber ?? data.a_receber ?? 0),
    contasPagar: Number(data.contas_pagar ?? data.a_pagar ?? 0),
    estoque: Number(data.estoque ?? data.total_estoque ?? 0),
    clientes: Number(data.clientes ?? data.total_clientes ?? 0),
    totalProdutos: Number(data.total_produtos ?? 0),
    totalCompras: Number(data.total_compras ?? 0),
    totalComprasValor: Number(data.total_compras_valor ?? 0),
    topProdutos: Array.isArray(data.top_produtos) ? data.top_produtos : [],
    alertas: Array.isArray(data.alertas) ? data.alertas : [],
    recomendacoes: Array.isArray(data.recomendacoes) ? data.recomendacoes : [],

    estoqueInvestido: Number(data.estoque_investido ?? 0),
    lucroPotencial: Number(data.lucro_potencial ?? 0),
    margemMedia: Number(data.margem_media ?? 0),
    produtosPromocao: Number(data.produtos_promocao ?? 0),
    produtosPrejuizo: Number(data.produtos_prejuizo ?? 0),

    classeA: Number(data.classe_a ?? 0),
    classeB: Number(data.classe_b ?? 0),
    classeC: Number(data.classe_c ?? 0)
  };
}

function normalizeResumoFinanceiro(data = {}) {
  return {
    contasReceberPago: Number(data?.contas_receber?.pago || 0),
    contasReceberPendente: Number(data?.contas_receber?.pendente || 0),
    contasReceberAtrasado: Number(data?.contas_receber?.atrasado || 0),

    contasPagarPago: Number(data?.contas_pagar?.pago || 0),
    contasPagarPendente: Number(data?.contas_pagar?.pendente || 0),
    contasPagarAtrasado: Number(data?.contas_pagar?.atrasado || 0),

    receitasLancadas: Number(data?.lancamentos?.receitas || 0),
    despesasLancadas: Number(data?.lancamentos?.despesas || 0),
    receitasPagas: Number(data?.lancamentos?.receitas_pagas || 0),
    despesasPagas: Number(data?.lancamentos?.despesas_pagas || 0),

    fluxoEntradas: Number(data?.fluxo?.entradas || 0),
    fluxoSaidas: Number(data?.fluxo?.saidas || 0),
    fluxoSaldo: Number(data?.fluxo?.saldo || 0)
  };
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setHtml(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = value;
}

function renderKpis(payload, financeiro, filters = {}) {
  setText('kpiFaturamento', toCurrency(payload.faturamento));
  setText('kpiVendas', String(payload.vendas));
  setText('kpiReceber', toCurrency(financeiro.contasReceberPendente));
  setText('kpiPagar', toCurrency(financeiro.contasPagarPendente));
  setText('kpiEstoque', String(payload.estoque));
  setText('kpiClientes', String(payload.clientes));

  setText('kpiFaturamentoMeta', `Período: ${getPeriodLabel(filters)}`);
  setText(
    'kpiVendasInfo',
    payload.vendas > 0 ? 'Vendas reais do período' : 'Sem vendas no período'
  );
  setText(
    'kpiReceberInfo',
    financeiro.contasReceberAtrasado > 0
      ? `Atrasado: ${toCurrency(financeiro.contasReceberAtrasado)}`
      : 'Sem atrasos em contas a receber'
  );
  setText(
    'kpiPagarInfo',
    financeiro.contasPagarAtrasado > 0
      ? `Atrasado: ${toCurrency(financeiro.contasPagarAtrasado)}`
      : 'Sem atrasos em contas a pagar'
  );
  setText('kpiEstoqueInfo', `${payload.totalProdutos} produto(s) cadastrados`);
  setText('kpiClientesInfo', `${payload.clientes} cliente(s) na base`);
}

function renderResumoExecutivo(payload, financeiro, state = {}, empresaStatus = null) {
  const empresaNome =
    state?.empresa?.nome ||
    state?.user?.empresa ||
    empresaStatus?.empresa?.nome ||
    'Empresa Logada';

  const planoNome = empresaStatus?.plano?.nome || 'Não identificado';
  const assinaturaStatus = empresaStatus?.assinatura?.status || 'Não identificado';
  const diasTrial = empresaStatus?.assinatura?.dias_restantes_trial;

  const usos = empresaStatus?.uso || {};

  function usoLinha(label, uso) {
    if (!uso) return '';

    const usado = Number(uso.usado || 0);
    const limite = Number(uso.limite || 0);
    const percentual = Number(uso.percentual || 0);

    let statusClass = 'info';
    if (uso.bloqueado) statusClass = 'danger';
    else if (uso.alerta) statusClass = 'warning';

    return `
      <div class="dashboard-list__item">
        <strong>${label}</strong>
        <span class="alert-list__item ${statusClass}" style="padding:6px 10px;">
          ${limite > 0 ? `${usado} / ${limite}` : `${usado} / ilimitado`} ${limite > 0 ? `(${percentual}%)` : ''}
        </span>
      </div>
    `;
  }

  setHtml(
    'dashboardResumo',
    `
      <div class="dashboard-grid-executive">
        <div class="dashboard-list__item">
          <strong>Empresa</strong>
          <span>${safeText(empresaNome)}</span>
        </div>

        <div class="dashboard-list__item">
          <strong>Plano atual</strong>
          <span>${safeText(planoNome)}</span>
        </div>

        <div class="dashboard-list__item">
          <strong>Status da assinatura</strong>
          <span>${safeText(assinaturaStatus)}</span>
        </div>

        <div class="dashboard-list__item">
          <strong>Trial</strong>
          <span>${
            diasTrial === null || diasTrial === undefined
              ? 'Sem trial definido'
              : diasTrial < 0
                ? 'Expirado'
                : `${diasTrial} dia(s) restante(s)`
          }</span>
        </div>

        ${usoLinha('Usuários', usos.usuarios)}
        ${usoLinha('Produtos', usos.produtos)}
        ${usoLinha('Clientes', usos.clientes)}
        ${usoLinha('Fornecedores', usos.fornecedores)}
        ${usoLinha('Vendas no mês', usos.vendas_mes)}

        <div class="dashboard-list__item">
          <strong>Fluxo de entradas</strong>
          <span>${toCurrency(financeiro.fluxoEntradas)}</span>
        </div>

        <div class="dashboard-list__item">
          <strong>Fluxo de saídas</strong>
          <span>${toCurrency(financeiro.fluxoSaidas)}</span>
        </div>

        <div class="dashboard-list__item">
          <strong>Saldo do fluxo</strong>
          <span>${toCurrency(financeiro.fluxoSaldo)}</span>
        </div>

        <div class="dashboard-list__item">
  <strong>Estoque investido</strong>
  <span>${toCurrency(payload.estoqueInvestido)}</span>
</div>

<div class="dashboard-list__item">
  <strong>Lucro potencial</strong>
  <span class="${payload.lucroPotencial >= 0 ? 'text-success' : 'text-danger'}">
    ${toCurrency(payload.lucroPotencial)}
  </span>
</div>

<div class="dashboard-list__item">
  <strong>Margem média</strong>
  <span>
    ${Number(payload.margemMedia || 0).toFixed(2)}%
  </span>
</div>

<div class="dashboard-list__item">
  <strong>Produtos em promoção</strong>
  <span>${payload.produtosPromocao}</span>
</div>

<div class="dashboard-list__item">
  <strong>Produtos em prejuízo</strong>
  <span class="${payload.produtosPrejuizo > 0 ? 'text-danger' : ''}">
    ${payload.produtosPrejuizo}
  </span>
</div>

<div class="dashboard-list__item">
  <strong>Produtos Classe A</strong>
  <span class="badge badge--success">
    ${payload.classeA}
  </span>
</div>

<div class="dashboard-list__item">
  <strong>Produtos Classe B</strong>
  <span class="badge badge--warning">
    ${payload.classeB}
  </span>
</div>

<div class="dashboard-list__item">
  <strong>Produtos Classe C</strong>
  <span class="badge badge--danger">
    ${payload.classeC}
  </span>
</div>
      </div>

        <div class="dashboard-abc-card">
  <div class="dashboard-abc-card__header">
    <strong>Curva ABC</strong>
    <span>Distribuição estratégica dos produtos</span>
  </div>

  <div class="dashboard-abc-bars">
    <div class="dashboard-abc-bar dashboard-abc-bar--a" style="width:${Math.max(8, payload.classeA * 12)}%">
      A ${payload.classeA}
    </div>

    <div class="dashboard-abc-bar dashboard-abc-bar--b" style="width:${Math.max(8, payload.classeB * 12)}%">
      B ${payload.classeB}
    </div>

    <div class="dashboard-abc-bar dashboard-abc-bar--c" style="width:${Math.max(8, payload.classeC * 12)}%">
      C ${payload.classeC}
    </div>
  </div>
</div>

        <div class="dashboard-note dashboard-note--premium">
        ${
          empresaStatus?.empresa?.bloqueada
            ? `Empresa bloqueada: ${safeText(empresaStatus?.empresa?.motivo_bloqueio, 'sem motivo informado')}`
            : diasTrial !== null && diasTrial !== undefined && diasTrial <= 3
              ? 'Atenção: período de teste próximo do fim.'
              : 'Plano e limites monitorados automaticamente.'
        }
      </div>
    `
  );
}

function renderTopProdutos(payload) {
  if (!payload.topProdutos.length) {
    setHtml(
      'dashboardTopProdutos',
      `<div class="empty-state">Nenhum produto vendido encontrado no período.</div>`
    );
    return;
  }

  const maiorQuantidade = Math.max(
    ...payload.topProdutos.map((item) => Number(item.quantidade || item.qtd || 0))
  );

  setHtml(
    'dashboardTopProdutos',
    `
      <div class="top-products-premium">
        ${payload.topProdutos
          .slice(0, 5)
          .map((item, index) => {
            const quantidade = Number(item.quantidade || item.qtd || 0);

            const percentual = maiorQuantidade > 0 ? (quantidade / maiorQuantidade) * 100 : 0;

            const classe = index === 0 ? 'A' : index <= 2 ? 'B' : 'C';

            return `
              <div class="top-product-card">
                <div class="top-product-card__header">
                  <div>
                    <div class="top-product-card__title">
                      ${safeText(item.nome || item.produto, 'Produto')}
                    </div>

                    <div class="top-product-card__meta">
                      ${quantidade} venda(s)
                    </div>
                  </div>

                  <div class="badge ${
                    classe === 'A'
                      ? 'badge--success'
                      : classe === 'B'
                        ? 'badge--warning'
                        : 'badge--danger'
                  }">
                    ${classe}
                  </div>
                </div>

                <div class="top-product-progress">
                  <div
                    class="top-product-progress__fill"
                    style="width:${percentual}%"
                  ></div>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `
  );
}

function buildAlertas(payload, financeiro) {
  const alertas = [];

  if (Array.isArray(payload.recomendacoes) && payload.recomendacoes.length) {
    alertas.push(...payload.recomendacoes);
  }

  if (financeiro.contasReceberAtrasado > 0) {
    alertas.push({
      tipo: 'danger',
      texto: `Contas a receber atrasadas: ${toCurrency(financeiro.contasReceberAtrasado)}`
    });
  }

  if (financeiro.contasPagarAtrasado > 0) {
    alertas.push({
      tipo: 'warning',
      texto: `Contas a pagar atrasadas: ${toCurrency(financeiro.contasPagarAtrasado)}`
    });
  }

  if (financeiro.fluxoSaldo < 0) {
    alertas.push({
      tipo: 'danger',
      texto: `Fluxo de caixa negativo no período: ${toCurrency(financeiro.fluxoSaldo)}`
    });
  }

  if (payload.estoque <= 0) {
    alertas.push({
      tipo: 'warning',
      texto: 'Estoque zerado ou não informado no período.'
    });
  }

  if (payload.vendas <= 0) {
    alertas.push({
      tipo: 'info',
      texto: 'Nenhuma venda registrada no período aplicado.'
    });
  }

  if (payload.produtosPrejuizo > 0) {
    alertas.push({
      tipo: 'danger',
      texto: `${payload.produtosPrejuizo} produto(s) operando com prejuízo`
    });
  }

  if (payload.produtosPromocao > 0) {
    alertas.push({
      tipo: 'info',
      texto: `${payload.produtosPromocao} produto(s) em promoção ativa`
    });
  }

  if (payload.classeC > payload.classeA && payload.totalProdutos > 0) {
    alertas.push({
      tipo: 'warning',
      texto: 'Quantidade elevada de produtos Classe C'
    });
  }

  if (payload.margemMedia < 15 && payload.totalProdutos > 0) {
    alertas.push({
      tipo: 'warning',
      texto: `Margem média baixa: ${Number(payload.margemMedia).toFixed(2)}%`
    });
  }

  if (!alertas.length && payload.alertas.length) {
    return payload.alertas;
  }

  if (!alertas.length) {
    alertas.push({
      tipo: 'info',
      texto: 'Nenhum alerta crítico encontrado no período.'
    });
  }

  return alertas;
}

function normalizeAlertType(type) {
  if (type === 'warning' || type === 'danger' || type === 'info') return type;
  return 'info';
}

function renderAlertas(payload, financeiro) {
  const alertas = buildAlertas(payload, financeiro);

  setHtml(
    'dashboardAlertas',
    `
      <div class="alert-list">
        ${alertas
          .slice(0, 5)
          .map(
            (alerta) => `
              <div class="alert-list__item ${normalizeAlertType(alerta.tipo)}">
                ${safeText(alerta.texto || alerta.mensagem, 'Alerta')}
              </div>
            `
          )
          .join('')}
      </div>
    `
  );
}

function renderErrorState(message = 'Não foi possível carregar o dashboard.') {
  setText('kpiFaturamento', 'R$ 0,00');
  setText('kpiVendas', '0');
  setText('kpiReceber', 'R$ 0,00');
  setText('kpiPagar', 'R$ 0,00');
  setText('kpiEstoque', '0');
  setText('kpiClientes', '0');

  setText('kpiFaturamentoMeta', 'Sem dados');
  setText('kpiVendasInfo', 'Sem dados');
  setText('kpiReceberInfo', 'Sem dados');
  setText('kpiPagarInfo', 'Sem dados');
  setText('kpiEstoqueInfo', 'Sem dados');
  setText('kpiClientesInfo', 'Sem dados');

  setHtml('dashboardResumo', `<div class="empty-state">${message}</div>`);
  setHtml('dashboardTopProdutos', `<div class="empty-state">Sem ranking disponível.</div>`);
  setHtml('dashboardAlertas', `<div class="empty-state">Sem alertas disponíveis.</div>`);
}

export async function loadDashboard({ filters = {}, state = {} } = {}) {
  try {
    lastDashboardContext = {
      filters: { ...filters },
      state: { ...state }
    };

    const params = {
      data_inicial: filters.dataInicial || '',
      data_final: filters.dataFinal || '',
      busca: filters.busca || ''
    };

    const [rawDashboard, rawResumoFinanceiro, rawEmpresaStatus] = await Promise.all([
      api.getDashboard(params),
      api.getRelatorioFinanceiroResumo(params),
      api.getEmpresaStatus()
    ]);

    const payload = normalizeDashboardPayload(rawDashboard);
    const financeiro = normalizeResumoFinanceiro(rawResumoFinanceiro);

    renderKpis(payload, financeiro, filters);
    renderResumoExecutivo(payload, financeiro, state, rawEmpresaStatus);
    renderTopProdutos(payload);
    renderAlertas(payload, financeiro);

    return {
      dashboard: payload,
      financeiro,
      empresaStatus: rawEmpresaStatus
    };
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);

    const message = buildFriendlyError(error);

    renderErrorState(message);
    showMessage(message, 'error');

    return null;
  }
}

export function resetDashboard(message) {
  renderErrorState(message);
}

const dashboard = {
  loadDashboard,
  resetDashboard
};

window.LfErpDashboard = dashboard;

export default dashboard;

window.refreshDashboard = async function () {
  try {
    showMessage('Atualizando dashboard...', 'info');

    if (typeof loadDashboard === 'function') {
      await loadDashboard(lastDashboardContext);
    }
  } catch (error) {
    console.error('Erro ao atualizar dashboard:', error);

    const message = buildFriendlyError(error);
    showMessage(message, 'error');
  }
};
