import api from './api.js';

const state = {
  resumo: null,
  receber: [],
  pagar: [],
  fluxo: [],
  lucratividade: [],
  grade: [],
  dre: null,
  aba: 'resumo'
};

export async function initRelatoriosFinanceirosModule() {
  try {
    renderLoading();
    await carregarDados();
    render();
  } catch (error) {
    console.error('Erro ao iniciar relatórios financeiros:', error);
    renderErro('Não foi possível carregar os relatórios financeiros.');
  }
}

async function carregarDados() {
  const filtros = getFiltrosGlobais();

  const [resumoResult, receberResult, pagarResult, fluxoResult, lucratividadeResult, gradeResult, dreResult] =
    await Promise.allSettled([
      api.getRelatorioFinanceiroResumo(filtros),
      api.getRelatorioFinanceiroContasReceber(filtros),
      api.getRelatorioFinanceiroContasPagar(filtros),
      api.getRelatorioFinanceiroFluxoCaixa(filtros),
      api.getRelatorioFinanceiroLucratividade(filtros),
      api.getRelatorioVendasPorGrade(filtros),
      api.getRelatorioDRE(filtros)
    ]);

  state.resumo = resumoResult.status === 'fulfilled' ? resumoResult.value : null;

  state.receber =
    receberResult.status === 'fulfilled' && Array.isArray(receberResult.value)
      ? receberResult.value
      : [];

  state.pagar =
    pagarResult.status === 'fulfilled' && Array.isArray(pagarResult.value) ? pagarResult.value : [];

  const fluxoData = fluxoResult.status === 'fulfilled' ? fluxoResult.value : null;

  state.fluxo = Array.isArray(fluxoData)
    ? fluxoData
    : Array.isArray(fluxoData?.movimentos)
      ? fluxoData.movimentos
      : [];

  state.lucratividade =
    lucratividadeResult.status === 'fulfilled' && Array.isArray(lucratividadeResult.value)
      ? lucratividadeResult.value
      : [];

  state.grade =
    gradeResult.status === 'fulfilled' && Array.isArray(gradeResult.value)
      ? gradeResult.value
      : [];

  state.dre = dreResult.status === 'fulfilled' ? dreResult.value : null;
}

function getFiltrosGlobais() {
  return {
    data_inicial: document.getElementById('filtroDataInicial')?.value || '',
    data_final: document.getElementById('filtroDataFinal')?.value || '',
    busca: document.getElementById('filtroBuscaGlobal')?.value?.trim() || ''
  };
}

function renderLoading() {
  const c = document.getElementById('relatoriosContainer');
  if (!c) return;

  c.innerHTML = `
    <div class="module-card">
      <div class="module-feedback module-feedback--info">
        Carregando relatórios financeiros...
      </div>
    </div>
  `;
}

function render() {
  const c = document.getElementById('relatoriosContainer');
  if (!c) return;

  c.innerHTML = `
    <div class="module-card">
      <div id="relatoriosFeedback" class="module-feedback"></div>

      <div class="module-card__header">
        <div>
          <h3>Relatórios Financeiros</h3>
          <p>Resumo gerencial e detalhamento financeiro do período</p>
        </div>

        <div class="module-card__actions">
          <button class="btn btn-light" id="btnAtualizarRelatoriosFinanceiros">
            Atualizar
          </button>
        </div>
      </div>

      <div class="module-toolbar">
        <div class="module-toolbar__stats">
          <div class="mini-stat">
            <span>Contas a receber</span>
            <strong>${state.receber.length}</strong>
          </div>
          <div class="mini-stat">
            <span>Contas a pagar</span>
            <strong>${state.pagar.length}</strong>
          </div>
          <div class="mini-stat">
            <span>Movimentos fluxo</span>
            <strong>${state.fluxo.length}</strong>
          </div>
          <div class="mini-stat">
            <span>Lucratividade</span>
            <strong>${state.lucratividade.length}</strong>
          </div>
          <div class="mini-stat">
            <span>Variações vendidas</span>
            <strong>${state.grade.length}</strong>
          </div>
        </div>
      </div>

      <div class="module-toolbar">
        <div class="table-actions">
          <button class="btn-inline ${state.aba === 'resumo' ? 'btn-inline--active' : ''}" data-aba="resumo">
            Resumo
          </button>
          <button class="btn-inline ${state.aba === 'receber' ? 'btn-inline--active' : ''}" data-aba="receber">
            Contas a Receber
          </button>
          <button class="btn-inline ${state.aba === 'pagar' ? 'btn-inline--active' : ''}" data-aba="pagar">
            Contas a Pagar
          </button>
          <button class="btn-inline ${state.aba === 'fluxo' ? 'btn-inline--active' : ''}" data-aba="fluxo">
            Fluxo de Caixa
          </button>
          <button class="btn-inline ${state.aba === 'lucratividade' ? 'btn-inline--active' : ''}" data-aba="lucratividade">
            Lucratividade
          </button>
          <button class="btn-inline ${state.aba === 'grade' ? 'btn-inline--active' : ''}" data-aba="grade">
            Por Variação
          </button>
          <button class="btn-inline ${state.aba === 'dre' ? 'btn-inline--active' : ''}" data-aba="dre">
            DRE
          </button>
        </div>
      </div>

      ${renderConteudoAba()}
    </div>
  `;

  bindEventos();
}

function renderConteudoAba() {
  if (state.aba === 'resumo') return renderResumo();
  if (state.aba === 'receber') return renderTabelaReceber();
  if (state.aba === 'pagar') return renderTabelaPagar();
  if (state.aba === 'fluxo') return renderTabelaFluxo();
  if (state.aba === 'grade') return renderTabelaGrade();
  if (state.aba === 'dre') return renderDRE();
  return renderTabelaLucratividade();
}

function renderDRE() {
  const d = state.dre;

  if (!d) {
    return `<div class="module-feedback module-feedback--info">Nenhum dado de DRE encontrado no período.</div>`;
  }

  function pct(v) { return `${Number(v || 0).toFixed(1)}%`; }
  function val(v)  { return formatCurrency(v); }

  function dreRow(label, value, bold = false, cls = '', indent = false) {
    const style = indent ? 'padding-left:28px' : '';
    return `
      <tr class="${cls}">
        <td style="${style}">${bold ? `<strong>${escapeHtml(label)}</strong>` : escapeHtml(label)}</td>
        <td class="text-right" style="${style}">${bold ? `<strong>${val(value)}</strong>` : val(value)}</td>
      </tr>
    `;
  }

  function dreRowPct(label, value, pctVal, cls = '') {
    return `
      <tr class="${cls}">
        <td><strong>${escapeHtml(label)}</strong></td>
        <td class="text-right">
          <strong>${val(value)}</strong>
          <span class="badge ${Number(pctVal) >= 0 ? 'badge--success' : 'badge--danger'}" style="margin-left:8px;font-size:11px">
            ${pct(pctVal)}
          </span>
        </td>
      </tr>
    `;
  }

  const mensal = Array.isArray(d.mensal) ? d.mensal : [];

  const mensalRows = mensal.map((m) => `
    <tr>
      <td><strong>${escapeHtml(m.label)}</strong></td>
      <td class="text-right">${val(m.receita)}</td>
      <td class="text-right">${val(m.cmv)}</td>
      <td class="text-right ${Number(m.lucro_bruto) < 0 ? 'text-danger' : 'text-success'}">
        <strong>${val(m.lucro_bruto)}</strong>
        <small style="display:block;color:var(--text-muted)">${pct(m.margem_bruta)}</small>
      </td>
      <td class="text-right">${val(m.despesas)}</td>
      <td class="text-right ${Number(m.resultado) < 0 ? 'text-danger' : 'text-success'}">
        <strong>${val(m.resultado)}</strong>
        <small style="display:block;color:var(--text-muted)">${pct(m.margem_oper)}</small>
      </td>
    </tr>
  `).join('');

  return `
    <div class="kpi-grid" style="margin-top:8px;margin-bottom:20px">
      <div class="kpi-card">
        <div class="kpi-card__icon"><i class="fa-solid fa-arrow-trend-up"></i></div>
        <div class="kpi-card__content">
          <span>Receita Bruta</span>
          <strong>${val(d.receita_bruta)}</strong>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card__icon"><i class="fa-solid fa-box-open"></i></div>
        <div class="kpi-card__content">
          <span>CMV</span>
          <strong>${val(d.cmv)}</strong>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card__icon"><i class="fa-solid fa-scale-balanced"></i></div>
        <div class="kpi-card__content">
          <span>Lucro Bruto</span>
          <strong class="${Number(d.lucro_bruto) >= 0 ? 'text-success' : 'text-danger'}">${val(d.lucro_bruto)}</strong>
          <small>Margem: ${pct(d.margem_bruta)}</small>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card__icon"><i class="fa-solid fa-chart-line"></i></div>
        <div class="kpi-card__content">
          <span>Resultado Operacional</span>
          <strong class="${Number(d.resultado_operacional) >= 0 ? 'text-success' : 'text-danger'}">${val(d.resultado_operacional)}</strong>
          <small>Margem: ${pct(d.margem_operacional)}</small>
        </div>
      </div>
    </div>

    <div class="dashboard-grid" style="margin-bottom:24px">
      <div class="panel-card panel-card--large">
        <div class="panel-card__header"><div><h3>DRE — Demonstrativo de Resultado</h3><p>Apuração do período selecionado</p></div></div>
        <div class="panel-card__body" style="padding:0">
          <table class="data-table" style="margin:0">
            <tbody>
              ${dreRow('(+) Receita Bruta de Vendas', d.receita_bruta, true)}
              ${dreRow('(-) Custo das Mercadorias Vendidas (CMV)', d.cmv, false, '', true)}
              ${dreRowPct('(=) Lucro Bruto', d.lucro_bruto, d.margem_bruta, Number(d.lucro_bruto) < 0 ? 'text-danger' : '')}
              ${dreRow('(-) Despesas Operacionais', d.despesas_operacionais, false, '', true)}
              ${dreRowPct('(=) Resultado Operacional', d.resultado_operacional, d.margem_operacional, Number(d.resultado_operacional) < 0 ? 'text-danger' : '')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-card__header"><div><h3>Leitura rápida</h3><p>Interpretação gerencial</p></div></div>
        <div class="panel-card__body">
          <div class="alert-list">
            <div class="alert-list__item ${Number(d.margem_bruta) >= 30 ? 'info' : Number(d.margem_bruta) >= 10 ? 'warning' : 'danger'}">
              Margem bruta de <strong>${pct(d.margem_bruta)}</strong>${Number(d.margem_bruta) >= 30 ? ' — saudável.' : Number(d.margem_bruta) >= 10 ? ' — atenção ao CMV.' : ' — CMV elevado, revisar preços.'}
            </div>
            <div class="alert-list__item ${Number(d.resultado_operacional) >= 0 ? 'info' : 'danger'}">
              Resultado operacional ${Number(d.resultado_operacional) >= 0 ? 'positivo' : 'negativo'} de <strong>${val(d.resultado_operacional)}</strong>.
            </div>
            ${Number(d.despesas_operacionais) > Number(d.lucro_bruto) * 0.8 ? `
              <div class="alert-list__item warning">
                Despesas operacionais consomem mais de 80% do lucro bruto.
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>

    ${mensal.length > 1 ? `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mês</th>
              <th class="text-right">Receita</th>
              <th class="text-right">CMV</th>
              <th class="text-right">Lucro Bruto</th>
              <th class="text-right">Despesas</th>
              <th class="text-right">Resultado</th>
            </tr>
          </thead>
          <tbody>${mensalRows}</tbody>
          <tfoot>
            <tr style="border-top:2px solid var(--border);font-weight:800">
              <td><strong>Total</strong></td>
              <td class="text-right"><strong>${val(d.receita_bruta)}</strong></td>
              <td class="text-right"><strong>${val(d.cmv)}</strong></td>
              <td class="text-right"><strong>${val(d.lucro_bruto)}</strong></td>
              <td class="text-right"><strong>${val(d.despesas_operacionais)}</strong></td>
              <td class="text-right"><strong class="${Number(d.resultado_operacional) >= 0 ? 'text-success' : 'text-danger'}">${val(d.resultado_operacional)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    ` : ''}
  `;
}

function renderTabelaGrade() {
  if (!state.grade.length) {
    return `<div class="module-feedback module-feedback--info">Nenhuma venda por variação encontrada no período.<br><small>Apenas produtos com grade (tamanho/cor) aparecem aqui.</small></div>`;
  }

  const totalFat  = state.grade.reduce((s, r) => s + r.faturamento_total, 0);
  const totalLucro = state.grade.reduce((s, r) => s + r.lucro_total, 0);
  const totalQtd  = state.grade.reduce((s, r) => s + r.quantidade_vendida, 0);

  return `
    <div class="kpi-grid" style="margin-top:8px;margin-bottom:16px">
      <div class="kpi-card">
        <div class="kpi-card__icon"><i class="fa-solid fa-layer-group"></i></div>
        <div class="kpi-card__content">
          <span>Variações vendidas</span>
          <strong>${state.grade.length}</strong>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card__icon"><i class="fa-solid fa-boxes-stacked"></i></div>
        <div class="kpi-card__content">
          <span>Unidades vendidas</span>
          <strong>${totalQtd}</strong>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card__icon"><i class="fa-solid fa-chart-line"></i></div>
        <div class="kpi-card__content">
          <span>Faturamento</span>
          <strong>${formatCurrency(totalFat)}</strong>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card__icon"><i class="fa-solid fa-coins"></i></div>
        <div class="kpi-card__content">
          <span>Lucro total</span>
          <strong>${formatCurrency(totalLucro)}</strong>
        </div>
      </div>
    </div>

    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Variação</th>
            <th>Qtd. vendida</th>
            <th>Faturamento</th>
            <th>Custo total</th>
            <th>Lucro total</th>
            <th>Estoque atual</th>
            <th>Última venda</th>
          </tr>
        </thead>
        <tbody>
          ${state.grade.map((item) => {
            const margem = item.faturamento_total > 0
              ? ((item.lucro_total / item.faturamento_total) * 100).toFixed(1)
              : '0.0';
            return `
              <tr>
                <td><strong>${escapeHtml(item.produto_nome || '-')}</strong></td>
                <td>
                  <span class="badge badge--info" style="font-size:12px">${escapeHtml(item.variacao)}</span>
                </td>
                <td>${item.quantidade_vendida}</td>
                <td>${formatCurrency(item.faturamento_total)}</td>
                <td>${formatCurrency(item.custo_total)}</td>
                <td class="${item.lucro_total >= 0 ? 'text-success' : 'text-danger'}">
                  <strong>${formatCurrency(item.lucro_total)}</strong>
                  <div class="table-muted">${margem}% margem</div>
                </td>
                <td>
                  <span class="${item.estoque_atual <= 0 ? 'badge badge--danger' : item.estoque_atual <= 3 ? 'badge badge--warning' : ''}">
                    ${item.estoque_atual}
                  </span>
                </td>
                <td>${formatDate(item.ultima_venda)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderResumo() {
  const r = state.resumo || {
    contas_receber: { pago: 0, pendente: 0, atrasado: 0 },
    contas_pagar: { pago: 0, pendente: 0, atrasado: 0 },
    lancamentos: { receitas: 0, despesas: 0, receitas_pagas: 0, despesas_pagas: 0 },
    fluxo: { entradas: 0, saidas: 0, saldo: 0 }
  };

  return `
    <div class="kpi-grid" style="margin-top: 8px;">
      <div class="kpi-card">
        <div class="kpi-card__icon"><i class="fa-solid fa-hand-holding-dollar"></i></div>
        <div class="kpi-card__content">
          <span>A Receber Pendente</span>
          <strong>${formatCurrency(r.contas_receber.pendente)}</strong>
          <small>Atrasado: ${formatCurrency(r.contas_receber.atrasado)}</small>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-card__icon"><i class="fa-solid fa-file-invoice-dollar"></i></div>
        <div class="kpi-card__content">
          <span>A Pagar Pendente</span>
          <strong>${formatCurrency(r.contas_pagar.pendente)}</strong>
          <small>Atrasado: ${formatCurrency(r.contas_pagar.atrasado)}</small>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-card__icon"><i class="fa-solid fa-scale-balanced"></i></div>
        <div class="kpi-card__content">
          <span>Saldo do Fluxo</span>
          <strong>${formatCurrency(r.fluxo.saldo)}</strong>
          <small>Entradas: ${formatCurrency(r.fluxo.entradas)} | Saídas: ${formatCurrency(r.fluxo.saidas)}</small>
        </div>
      </div>
    </div>

    <div class="dashboard-grid" style="margin-top: 20px;">
      <div class="panel-card panel-card--large">
        <div class="panel-card__header">
          <div>
            <h3>Resumo financeiro</h3>
            <p>Visão consolidada do período aplicado</p>
          </div>
        </div>
        <div class="panel-card__body">
          <div class="dashboard-list">
            <div class="dashboard-list__item">
              <strong>Contas a receber pagas</strong>
              <span>${formatCurrency(r.contas_receber.pago)}</span>
            </div>
            <div class="dashboard-list__item">
              <strong>Contas a pagar pagas</strong>
              <span>${formatCurrency(r.contas_pagar.pago)}</span>
            </div>
            <div class="dashboard-list__item">
              <strong>Receitas lançadas</strong>
              <span>${formatCurrency(r.lancamentos.receitas)}</span>
            </div>
            <div class="dashboard-list__item">
              <strong>Despesas lançadas</strong>
              <span>${formatCurrency(r.lancamentos.despesas)}</span>
            </div>
            <div class="dashboard-list__item">
              <strong>Receitas pagas</strong>
              <span>${formatCurrency(r.lancamentos.receitas_pagas)}</span>
            </div>
            <div class="dashboard-list__item">
              <strong>Despesas pagas</strong>
              <span>${formatCurrency(r.lancamentos.despesas_pagas)}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-card__header">
          <div>
            <h3>Leitura rápida</h3>
            <p>Interpretação gerencial</p>
          </div>
        </div>
        <div class="panel-card__body">
          <div class="alert-list">
            <div class="alert-list__item info">
              O relatório respeita o período global aplicado no topo.
            </div>
            <div class="alert-list__item ${r.fluxo.saldo >= 0 ? 'warning' : 'danger'}">
              ${
                r.fluxo.saldo >= 0
                  ? 'Resultado financeiro equilibrado ou positivo.'
                  : 'Resultado financeiro negativo no período.'
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderTabelaReceber() {
  if (!state.receber.length) {
    return `<div class="module-feedback module-feedback--info">Nenhum registro de contas a receber no período.</div>`;
  }

  return `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Parcela</th>
            <th>Vencimento</th>
            <th>Status</th>
            <th class="text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${state.receber
            .map(
              (item) => `
            <tr>
              <td>${escapeHtml(item.cliente_nome || '-')}</td>
              <td>${Number(item.parcela || 1)}/${Number(item.total_parcelas || 1)}</td>
              <td>${formatDate(item.data_vencimento)}</td>
              <td>${escapeHtml(item.status || '-')}</td>
              <td class="text-right"><strong>${formatCurrency(item.valor)}</strong></td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTabelaPagar() {
  if (!state.pagar.length) {
    return `<div class="module-feedback module-feedback--info">Nenhum registro de contas a pagar no período.</div>`;
  }

  return `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fornecedor</th>
            <th>Parcela</th>
            <th>Vencimento</th>
            <th>Status</th>
            <th class="text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${state.pagar
            .map(
              (item) => `
            <tr>
              <td>${escapeHtml(item.fornecedor_nome || '-')}</td>
              <td>${Number(item.parcela || 1)}/${Number(item.total_parcelas || 1)}</td>
              <td>${formatDate(item.data_vencimento)}</td>
              <td>${escapeHtml(item.status || '-')}</td>
              <td class="text-right"><strong>${formatCurrency(item.valor)}</strong></td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTabelaLucratividade() {
  if (!state.lucratividade.length) {
    return `
      <div class="module-feedback module-feedback--info">
        Nenhum dado de lucratividade encontrado no período.
      </div>
    `;
  }

  return `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>ABC</th>
            <th>Produto</th>
            <th>Qtd.</th>
            <th>Faturamento</th>
            <th>Custo Médio</th>
            <th>Lucro Unitário</th>
            <th>Margem</th>
            <th>Lucro Total</th>
            <th>Estoque Investido</th>
            <th>Lucro Potencial</th>
            <th>Capital Parado</th>
            <th>Última Venda</th>
          </tr>
        </thead>

        <tbody>
          ${state.lucratividade
            .map(
              (item) => `
            <tr>
              <tr>
  <td>
    <span class="badge ${
      item.classe_abc === 'A'
        ? 'badge--success'
        : item.classe_abc === 'B'
          ? 'badge--warning'
          : 'badge--danger'
    }">
      ${escapeHtml(item.classe_abc || 'C')}
    </span>
  </td>

  <td>
    <strong>${escapeHtml(item.produto_nome || '-')}</strong>
    <div class="table-muted">
      ${Number(item.participacao_lucro || 0).toFixed(2)}% do lucro
    </div>
  </td>

              <td>
                ${Number(item.quantidade_vendida || 0)}
              </td>

              <td>
                ${formatCurrency(item.faturamento_total)}
              </td>

              <td>
                ${formatCurrency(item.custo_medio)}
              </td>

              <td class="${Number(item.lucro_unitario || 0) >= 0 ? 'text-success' : 'text-danger'}">
                <strong>
                  ${formatCurrency(item.lucro_unitario)}
                </strong>
              </td>

              <td>
                <span class="badge ${
                  Number(item.margem_lucro || 0) >= 30
                    ? 'badge--success'
                    : Number(item.margem_lucro || 0) >= 10
                      ? 'badge--warning'
                      : 'badge--danger'
                }">
                  ${Number(item.margem_lucro || 0).toFixed(2)}%
                </span>
              </td>

              <td class="${Number(item.lucro_total || 0) >= 0 ? 'text-success' : 'text-danger'}">
                <strong>
                  ${formatCurrency(item.lucro_total)}
                </strong>
              </td>

              <td>
                ${formatCurrency(item.estoque_investido)}
              </td>

              <td class="${
                Number(item.lucro_potencial || 0) >= 0 ? 'text-success' : 'text-danger'
              }">
                <strong>
                  ${formatCurrency(item.lucro_potencial)}
                </strong>
              </td>
              <td>
                <strong>${formatCurrency(item.capital_parado || 0)}</strong>
              </td>

              <td>
  <div class="stock-alert-stack">
    <span>
      ${formatDate(item.ultima_venda)}
    </span>

    ${
      Number(item.capital_parado || 0) >= 500
        ? `
          <span class="badge badge--warning">
            Capital alto parado
          </span>
        `
        : ''
    }

    ${
      Number(item.estoque_parado || 0) >= 20
        ? `
          <span class="badge badge--danger">
            Estoque elevado
          </span>
        `
        : ''
    }
  </div>
</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTabelaFluxo() {
  if (!state.fluxo.length) {
    return `<div class="module-feedback module-feedback--info">Nenhum movimento de fluxo de caixa no período.</div>`;
  }

  return `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Tipo</th>
            <th>Origem</th>
            <th>Descrição</th>
            <th>Referência</th>
            <th class="text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${state.fluxo
            .map(
              (item) => `
            <tr>
              <td>${formatDate(item.data_movimento || item.data)}</td>
              <td>${escapeHtml(item.tipo || '-')}</td>
              <td>${formatOrigem(item.origem)}</td>
              <td>${escapeHtml(item.descricao || '-')}</td>
              <td>${formatReferencia(item)}</td>
              <td class="text-right"><strong>${formatCurrency(item.valor)}</strong></td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function bindEventos() {
  document
    .getElementById('btnAtualizarRelatoriosFinanceiros')
    ?.addEventListener('click', async () => {
      await recarregarModulo('Relatórios atualizados.');
    });

  document.querySelectorAll('[data-aba]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.aba = btn.dataset.aba;
      render();
    });
  });
}

async function recarregarModulo(mensagem = '') {
  try {
    renderLoading();
    await carregarDados();
    render();
    if (mensagem) renderFeedback(mensagem, 'success');
  } catch (error) {
    console.error(error);
    renderErro('Não foi possível atualizar os relatórios financeiros.');
  }
}

function renderFeedback(message, type = 'success') {
  const feedback = document.getElementById('relatoriosFeedback');
  if (!feedback) return;

  feedback.className = `module-feedback module-feedback--${type}`;
  feedback.textContent = message;

  setTimeout(() => {
    const current = document.getElementById('relatoriosFeedback');
    if (current) {
      current.className = 'module-feedback';
      current.textContent = '';
    }
  }, 3500);
}

function renderErro(message) {
  const c = document.getElementById('relatoriosContainer');
  if (!c) return;

  c.innerHTML = `
    <div class="module-card">
      <div class="module-feedback module-feedback--error">
        ${escapeHtml(message)}
      </div>
    </div>
  `;
}

function formatOrigem(origem) {
  const mapa = {
    conta_receber: 'Conta a Receber',
    conta_pagar: 'Conta a Pagar',
    lancamento_financeiro: 'Lançamento Financeiro',
    investimento: 'Investimento'
  };
  return mapa[origem] || origem || '-';
}

function formatReferencia(item) {
  if (!item?.referencia_id) return '-';
  if (item.origem === 'conta_receber') return `Venda #${item.referencia_id}`;
  if (item.origem === 'conta_pagar') return `Compra #${item.referencia_id}`;
  return `#${item.referencia_id}`;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatDate(value) {
  if (!value) return '-';
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(String(value))) {
    const [ano, mes, dia] = String(value).split('-');
    return `${dia}/${mes}/${ano}`;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('pt-BR');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
