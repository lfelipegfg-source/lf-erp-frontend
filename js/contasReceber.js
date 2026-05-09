import api from './api.js';
import { showToast } from './feedback.js';

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
  clientes: [],
  filtros: {
    status: '',
    cliente_id: '',
    busca: ''
  },
  loading: false
};

function showMessage(message, type = 'info') {
  const feedback = document.getElementById('contasReceberFeedback');

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

  if (typeof showToast === 'function') {
    showToast(message, type);
  }
}

function setLoading(value) {
  state.loading = value;

  const btnAtualizar = document.getElementById('btnAtualizarContasReceber');
  const btnFiltrar = document.getElementById('btnFiltrarContasReceber');
  const btnLimpar = document.getElementById('btnLimparFiltrosContasReceber');

  if (btnAtualizar) btnAtualizar.disabled = value;
  if (btnFiltrar) btnFiltrar.disabled = value;
  if (btnLimpar) btnLimpar.disabled = value;

  if (btnAtualizar) {
    btnAtualizar.innerHTML = value
      ? '<i class="fa-solid fa-spinner fa-spin"></i> Atualizando...'
      : '<i class="fa-solid fa-rotate"></i> Atualizar';
  }
}

function buildFriendlyError(error) {
  const message = error?.message || '';

  if (message.includes('Failed to fetch')) {
    return 'Não foi possível conectar ao backend.';
  }

  if (error?.status === 403) {
    return 'Acesso negado ou limite do plano atingido.';
  }

  return message || 'Não foi possível concluir a operação.';
}

export async function initContasReceberModule() {
  try {
    state.loading = true;
    renderSkeleton();

    await Promise.all([carregarClientes(), carregarContas()]);

    render();
  } catch (error) {
    console.error('Erro ao iniciar contas a receber:', error);
    const message = buildFriendlyError(error);
    renderErro(message);
    showMessage(message, 'error');
  } finally {
    state.loading = false;
  }
}

async function carregarClientes() {
  const response = await api.getContasReceberClientes();
  state.clientes = Array.isArray(response) ? response : [];
}

async function carregarContas() {
  const filtrosGlobais = getFiltrosGlobais();

  const response = await api.getContasReceber({
    ...filtrosGlobais,
    ...state.filtros
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

  console.log('Resumo contas receber:', response?.resumo);
}

function getFiltrosGlobais() {
  return {
    data_inicial: document.getElementById('filtroDataInicial')?.value || '',
    data_final: document.getElementById('filtroDataFinal')?.value || '',
    busca: state.filtros.busca || document.getElementById('filtroBuscaGlobal')?.value?.trim() || ''
  };
}

function renderSkeleton() {
  const container = document.getElementById('contasReceberContainer');
  if (!container) return;

  container.innerHTML = `
    <section class="finance-module">
      <div class="finance-module__panel">
        <div class="finance-module__loading">
          <div class="finance-module__loading-spinner"></div>
          <p>Carregando contas a receber...</p>
        </div>
      </div>
    </section>
  `;
}

function render() {
  const container = document.getElementById('contasReceberContainer');
  if (!container) return;

  container.innerHTML = `
    <section class="module-card cr-module-card">
      <div id="contasReceberFeedback" class="module-feedback"></div>

      <div class="module-card__header">
        <div>
          <h3>Contas a Receber</h3>
          <p>Controle de títulos pendentes, atrasados e recebidos</p>
        </div>

        <div class="module-card__actions">

          <button class="btn btn-primary" id="btnNovaContaManual" type="button">
            <i class="fa-solid fa-plus"></i>
            Conta manual
          </button>

          <button class="btn btn-light" id="btnAtualizarContasReceber" type="button">
            <i class="fa-solid fa-rotate"></i>
            Atualizar
          </button>
        </div>
      </div>

      <div class="cr-explain-card">
        <div>
          <strong>Importante</strong>
          <span>Esta tela mostra títulos. Valores recebidos só entram no Fluxo de Caixa após baixa/pagamento.</span>
        </div>
      </div>

      <div class="cr-toolbar-grid">
        <div class="module-toolbar__search cr-search-box">
          <i class="fa-solid fa-search"></i>
          <input
            type="text"
            id="crBusca"
            placeholder="Buscar cliente, observação ou nº da venda..."
            value="${escapeHtml(state.filtros.busca || '')}"
          />
        </div>

        <div class="cr-filter-box">
          <select id="crStatus" class="input">
            <option value="">Todos os status</option>
            <option value="pendente" ${state.filtros.status === 'pendente' ? 'selected' : ''}>Pendentes</option>
            <option value="atrasado" ${state.filtros.status === 'atrasado' ? 'selected' : ''}>Atrasados</option>
            <option value="pago" ${state.filtros.status === 'pago' ? 'selected' : ''}>Recebidos</option>
          </select>
        </div>

        <div class="cr-filter-box cr-filter-box--cliente">
          <select id="crCliente" class="input">
            <option value="">Todos os clientes</option>
            ${state.clientes
              .map(
                (cliente) => `
              <option value="${cliente.id}" ${String(state.filtros.cliente_id) === String(cliente.id) ? 'selected' : ''}>
                ${escapeHtml(cliente.nome)}
              </option>
            `
              )
              .join('')}
          </select>
        </div>

        <div class="cr-action-box">
          <button class="btn btn-primary" id="btnFiltrarContasReceber" type="button">
            <i class="fa-solid fa-filter"></i>
            Filtrar
          </button>

          <button class="btn btn-light" id="btnLimparFiltrosContasReceber" type="button">
            <i class="fa-solid fa-eraser"></i>
            Limpar
          </button>
        </div>
      </div>

      <div class="cr-stats-grid">
        <article class="mini-stat cr-stat-card cr-stat-card--total">
          <span>Total de títulos</span>
          <strong>${formatCurrency(state.resumo.total)}</strong>
          <small>${state.contas.length} registro(s)</small>
        </article>

        <article class="mini-stat cr-stat-card cr-stat-card--pendente">
          <span>Pendentes</span>
          <strong>${formatCurrency(state.resumo.total_pendente)}</strong>
          <small>${Number(state.resumo.qtd_pendente || 0)} título(s)</small>
        </article>

        <article class="mini-stat cr-stat-card cr-stat-card--atrasado">
          <span>Atrasados</span>
          <strong>${formatCurrency(state.resumo.total_atrasado)}</strong>
          <small>${Number(state.resumo.qtd_atrasado || 0)} título(s)</small>
        </article>

        <article class="mini-stat cr-stat-card cr-stat-card--pago">
  <span>Recebidos</span>
  <strong>${formatCurrency(state.resumo.total_pago)}</strong>
  <small>${Number(state.resumo.qtd_pago || 0)} título(s)</small>
</article>

<article class="mini-stat cr-stat-card cr-stat-card--parcial">
  <span>Recebido parcial</span>
  <strong>${formatCurrency(state.resumo.total_recebido_parcial || 0)}</strong>
  <small>Baixas parciais realizadas</small>
</article>
      </div>

      <div class="table-wrapper">
        <table class="data-table cr-table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Cliente</th>
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
    </section>
  `;

  bindEventos();
  injectContasReceberStyles();
}

function renderLinhas() {
  if (!state.contas.length) {
    return `
      <tr>
        <td colspan="7">
          <div class="empty-table-state">
            <strong>Nenhuma conta encontrada</strong>
            <span>Use os filtros acima ou gere contas a receber por vendas promissórias.</span>
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
            <strong>${escapeHtml(conta.cliente_nome || 'Cliente não informado')}</strong>
            <small>Cliente</small>
          </div>
        </td>

        <td>
          <div class="table-primary">
            <strong>${conta.venda_id ? `Venda #${escapeHtml(conta.venda_id)}` : 'Manual'}</strong>
            <small>${escapeHtml(conta.forma_pagamento || conta.venda_pagamento || 'Conta a receber')}</small>
          </div>
        </td>

        <td>
          <div class="table-primary">
            <strong>${formatDate(conta.data_vencimento)}</strong>
            <small>${status === 'pago' ? `Recebido em ${formatDate(conta.data_pagamento)}` : getVencimentoInfo(conta.data_vencimento)}</small>
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
          ${
            conta.cliente_id
              ? `
      <button class="btn-inline" type="button" data-action="historico-cliente-cr" data-id="${conta.cliente_id}">
        <i class="fa-solid fa-user-clock"></i>
        Cliente
      </button>
    `
              : ''
          }
            <button class="btn-inline" type="button" data-action="detalhe-cr" data-id="${conta.id}">
              <i class="fa-solid fa-eye"></i>
              Detalhes
            </button>

            ${
              status === 'parcial'
                ? `
      <button class="btn-inline btn-inline--warning" type="button" data-action="recebimentos-parciais-cr" data-id="${conta.id}">
        <i class="fa-solid fa-clock-rotate-left"></i>
        Parciais
      </button>
    `
                : ''
            }

            ${
              conta.venda_id
                ? `
                  <button class="btn-inline" type="button" data-action="origem-venda-cr" data-id="${conta.id}">
                    <i class="fa-solid fa-receipt"></i>
                    Venda
                  </button>
                `
                : ''
            }

           ${
             status === 'pago'
               ? `
      <button class="btn-inline btn-inline--warning" type="button" data-action="estornar-cr" data-id="${conta.id}">
        <i class="fa-solid fa-rotate-left"></i>
        Estornar
      </button>
    `
               : `
      <button class="btn-inline btn-inline--success" type="button" data-action="baixar-cr" data-id="${conta.id}">
        <i class="fa-solid fa-check"></i>
        Baixar
      </button>

      ${
        !conta.venda_id && status !== 'parcial'
          ? `
            <button
              class="btn-inline btn-inline--danger"
              type="button"
              data-action="excluir-cr"
              data-id="${conta.id}"
            >
              <i class="fa-solid fa-trash"></i>
              Excluir
            </button>
          `
          : ''
      }
    `
           }
          </div>
        </td>
      </tr>
    `;
    })
    .join('');
}

function bindEventos() {
  const btnAtualizar = document.getElementById('btnAtualizarContasReceber');
  const btnNovaContaManual = document.getElementById('btnNovaContaManual');
  const btnFiltrar = document.getElementById('btnFiltrarContasReceber');
  const btnLimpar = document.getElementById('btnLimparFiltrosContasReceber');
  const busca = document.getElementById('crBusca');
  const status = document.getElementById('crStatus');
  const cliente = document.getElementById('crCliente');

  btnAtualizar?.addEventListener('click', async () => {
    await recarregar();
  });

  btnNovaContaManual?.addEventListener('click', () => {
    abrirModalContaManual();
  });

  btnFiltrar?.addEventListener('click', async () => {
    state.filtros.busca = busca?.value?.trim() || '';
    state.filtros.status = status?.value || '';
    state.filtros.cliente_id = cliente?.value || '';

    await recarregar();
  });

  btnLimpar?.addEventListener('click', async () => {
    state.filtros = {
      status: '',
      cliente_id: '',
      busca: ''
    };

    await recarregar();
  });

  busca?.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      state.filtros.busca = busca.value.trim();
      state.filtros.status = status?.value || '';
      state.filtros.cliente_id = cliente?.value || '';

      await recarregar();
    }
  });

  document.querySelectorAll("[data-action='estornar-cr']").forEach((button) => {
    button.addEventListener('click', async () => {
      await estornarConta(button.dataset.id);
    });
  });

  document.querySelectorAll("[data-action='baixar-cr']").forEach((button) => {
    button.addEventListener('click', async () => {
      await baixarConta(button.dataset.id);
    });
  });

  document.querySelectorAll("[data-action='excluir-cr']").forEach((button) => {
    button.addEventListener('click', async () => {
      await excluirConta(button.dataset.id);
    });
  });

  document.querySelectorAll("[data-action='historico-cliente-cr']").forEach((button) => {
    button.addEventListener('click', async () => {
      await abrirHistoricoCliente(button.dataset.id);
    });
  });

  document.querySelectorAll("[data-action='recebimentos-parciais-cr']").forEach((button) => {
    button.addEventListener('click', async () => {
      await abrirRecebimentosParciais(button.dataset.id);
    });
  });

  document.querySelectorAll("[data-action='detalhe-cr']").forEach((button) => {
    button.addEventListener('click', async () => {
      await abrirDetalheConta(button.dataset.id);
    });
  });

  document.querySelectorAll("[data-action='origem-venda-cr']").forEach((button) => {
    button.addEventListener('click', async () => {
      await abrirOrigemVenda(button.dataset.id);
    });
  });
}

async function recarregar() {
  setLoading(true);
  showMessage('Atualizando contas a receber...', 'info');

  try {
    renderSkeleton();

    await Promise.all([carregarClientes(), carregarContas()]);

    render();
  } catch (error) {
    console.error('Erro ao recarregar contas a receber:', error);
    const message = buildFriendlyError(error);
    renderErro(message);
    showMessage(message, 'error');
  } finally {
    setLoading(false);
  }
}

async function estornarConta(id) {
  const confirmar = window.confirm(
    'Deseja estornar a baixa desta conta?\n\nEla voltará para pendente ou atrasada conforme o vencimento.'
  );

  if (!confirmar) return;

  try {
    await api.estornarContaReceber(id);

    showMessage('Baixa estornada com sucesso.', 'success');

    await recarregar();
  } catch (error) {
    console.error('Erro ao estornar conta a receber:', error);
    const message = buildFriendlyError(error);
    showMessage(message, 'error');
  }
}

async function baixarConta(id) {
  const conta = state.contas.find((item) => String(item.id) === String(id));

  if (!conta) {
    showMessage('Conta não encontrada para baixa.', 'error');
    return;
  }

  abrirModalBaixaConta(conta);
}

async function excluirConta(id) {
  const confirmar = window.confirm(
    'Deseja realmente excluir esta conta manual?\n\nEsta ação não poderá ser desfeita.'
  );

  if (!confirmar) return;

  try {
    await api.request(`/contas-receber/${id}`, {
      method: 'DELETE'
    });

    showMessage('Conta manual excluída com sucesso.', 'success');

    await recarregar();
  } catch (error) {
    console.error('Erro ao excluir conta manual:', error);

    const message = buildFriendlyError(error);

    showMessage(message, 'error');
  }
}

async function abrirRecebimentosParciais(id) {
  try {
    const data = await api.request(`/contas-receber/${id}/recebimentos-parciais`);
    const recebimentos = Array.isArray(data?.recebimentos) ? data.recebimentos : [];

    const modalExistente = document.getElementById('crRecebimentosParciaisModal');
    if (modalExistente) modalExistente.remove();

    const modal = document.createElement('div');
    modal.id = 'crRecebimentosParciaisModal';
    modal.className = 'modal-overlay cr-detail-overlay';

    modal.innerHTML = `
      <div class="modal-card cr-detail-card">
        <div class="cr-detail-header">
          <div>
            <span class="cr-detail-eyebrow">Conta #${escapeHtml(id)}</span>
            <h3>Recebimentos parciais</h3>
            <p>Estorne apenas o recebimento lançado incorretamente.</p>
          </div>

          <button class="icon-button" type="button" id="fecharRecebimentosParciais">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="cr-detail-body">
          <section class="cr-detail-section">
            <div class="cr-detail-section__header">
              <div>
                <h4>Baixas parciais realizadas</h4>
                <p>${recebimentos.length} recebimento(s)</p>
              </div>
            </div>

            <div class="cr-detail-list">
              ${
                recebimentos.length
                  ? recebimentos
                      .map(
                        (item) => `
                          <div class="cr-detail-row">
                            <div>
                              <strong>${formatCurrency(item.valor)}</strong>
                              <small>${escapeHtml(item.descricao || 'Recebimento parcial')}</small>
                            </div>

                            <div>
                              <span>Data</span>
                              <strong>${formatDate(item.pagamento_data)}</strong>
                            </div>

                            <div>
                              <button
                                class="btn-inline btn-inline--warning"
                                type="button"
                                data-action="estornar-parcial-cr"
                                data-id="${item.id}"
                              >
                                <i class="fa-solid fa-rotate-left"></i>
                                Estornar
                              </button>
                            </div>
                          </div>
                        `
                      )
                      .join('')
                  : `<div class="empty-detail-state">Nenhum recebimento parcial encontrado.</div>`
              }
            </div>
          </section>
        </div>

        <div class="cr-detail-footer">
          <button class="btn btn-light" type="button" id="fecharRecebimentosParciaisFooter">
            Fechar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document
      .getElementById('fecharRecebimentosParciais')
      ?.addEventListener('click', () => modal.remove());

    document
      .getElementById('fecharRecebimentosParciaisFooter')
      ?.addEventListener('click', () => modal.remove());

    modal.querySelectorAll("[data-action='estornar-parcial-cr']").forEach((button) => {
      button.addEventListener('click', async () => {
        await estornarRecebimentoParcial(button.dataset.id, modal);
      });
    });

    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.remove();
    });
  } catch (error) {
    console.error('Erro ao abrir recebimentos parciais:', error);
    showMessage(buildFriendlyError(error), 'error');
  }
}

async function estornarRecebimentoParcial(lancamentoId, modal) {
  const confirmar = window.confirm(
    'Deseja estornar este recebimento parcial?\n\nO valor voltará para o saldo da conta.'
  );

  if (!confirmar) return;

  try {
    await api.request(`/contas-receber/estornar-parcial/${lancamentoId}`, {
      method: 'POST'
    });

    showMessage('Recebimento parcial estornado com sucesso.', 'success');

    modal.remove();

    await recarregar();
  } catch (error) {
    console.error('Erro ao estornar recebimento parcial:', error);
    showMessage(buildFriendlyError(error), 'error');
  }
}

function abrirModalBaixaConta(conta) {
  const modalExistente = document.getElementById('crBaixaModal');
  if (modalExistente) modalExistente.remove();

  const valorAtual = Number(conta?.valor || 0);
  const hojeISO = new Date().toLocaleDateString('en-CA');

  const modal = document.createElement('div');
  modal.id = 'crBaixaModal';
  modal.className = 'modal-overlay cr-detail-overlay';

  modal.innerHTML = `
    <div class="modal-card cr-detail-card">
      <div class="cr-detail-header">
        <div>
          <span class="cr-detail-eyebrow">Recebimento</span>
          <h3>Baixar conta #${escapeHtml(conta.id)}</h3>
          <p>${escapeHtml(conta.cliente_nome || 'Cliente não informado')}</p>
        </div>

        <button class="icon-button" type="button" id="fecharCrBaixa">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="cr-detail-body">
        <section class="cr-detail-summary">
          <article class="cr-detail-summary__main">
            <span>Saldo atual</span>
            <strong>${formatCurrency(valorAtual)}</strong>
            <small>Informe o valor recebido agora</small>
          </article>

          <article>
            <span>Vencimento</span>
            <strong>${formatDate(conta.data_vencimento)}</strong>
          </article>

          <article>
            <span>Status</span>
            <strong>${getStatusLabel(normalizarStatus(conta.status))}</strong>
          </article>

          <article>
            <span>Origem</span>
            <strong>${conta.venda_id ? `Venda #${escapeHtml(conta.venda_id)}` : 'Manual'}</strong>
          </article>
        </section>

        <div class="form-grid">
          <div class="form-group">
            <label>Valor recebido</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="${valorAtual}"
              id="crBaixaValor"
              class="input"
              value="${valorAtual}"
            />
            <small>Para baixa parcial, informe somente o valor recebido.</small>
          </div>

          <div class="form-group">
            <label>Data do recebimento</label>
            <input
              type="date"
              id="crBaixaData"
              class="input"
              value="${hojeISO}"
            />
            <small>Formato correto: dia/mês/ano no calendário.</small>
          </div>
        </div>

        <section class="cr-detail-note">
          <span>Importante</span>
          <p>
            Se o valor recebido for menor que o saldo atual, a conta ficará como Parcial.
            Se for igual ao saldo, será marcada como Recebida.
          </p>
        </section>
      </div>

      <div class="cr-detail-footer">
        <button class="btn btn-primary" type="button" id="confirmarCrBaixa">
          <i class="fa-solid fa-check"></i>
          Confirmar recebimento
        </button>

        <button class="btn btn-light" type="button" id="cancelarCrBaixa">
          Cancelar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('fecharCrBaixa')?.addEventListener('click', () => modal.remove());
  document.getElementById('cancelarCrBaixa')?.addEventListener('click', () => modal.remove());

  document.getElementById('confirmarCrBaixa')?.addEventListener('click', async () => {
    const valorPago = document.getElementById('crBaixaValor')?.value || '';
    const dataPagamento = document.getElementById('crBaixaData')?.value || '';

    if (!valorPago || Number(valorPago) <= 0) {
      showMessage('Informe um valor recebido válido.', 'error');
      return;
    }

    if (Number(valorPago) > valorAtual) {
      showMessage('O valor recebido não pode ser maior que o saldo atual.', 'error');
      return;
    }

    if (!dataPagamento) {
      showMessage('Informe a data do recebimento.', 'error');
      return;
    }

    try {
      await api.baixarContaReceber(conta.id, {
        valor_pago: valorPago,
        data_pagamento: dataPagamento
      });

      showMessage('Recebimento registrado com sucesso.', 'success');

      modal.remove();

      await recarregar();
    } catch (error) {
      console.error('Erro ao baixar conta a receber:', error);
      showMessage(buildFriendlyError(error), 'error');
    }
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.remove();
  });
}

async function abrirDetalheConta(id) {
  try {
    const conta = await api.getContaReceberDetalhe(id);
    renderDetalheConta(conta);
  } catch (error) {
    console.error('Erro ao abrir detalhe da conta:', error);
    const message = buildFriendlyError(error);
    showMessage(message, 'error');
  }
}

function renderDetalheConta(conta) {
  const modalExistente = document.getElementById('crDetalheModal');
  if (modalExistente) modalExistente.remove();

  const status = normalizarStatus(conta.status);

  const modal = document.createElement('div');
  modal.id = 'crDetalheModal';
  modal.className = 'modal-overlay cr-detail-overlay';

  modal.innerHTML = `
    <div class="modal-card cr-detail-card">
      <div class="cr-detail-header">
        <div>
          <span class="cr-detail-eyebrow">Conta #${escapeHtml(conta.id || '-')}</span>
          <h3>Detalhe da conta a receber</h3>
          <p>${escapeHtml(conta.cliente_nome || 'Cliente não informado')}</p>
        </div>

        <button class="icon-button" type="button" id="fecharCrDetalhe" aria-label="Fechar">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="cr-detail-body">
        <section class="cr-detail-summary">
          <article class="cr-detail-summary__main">
            <span>Valor do título</span>
            <strong>${formatCurrency(conta.valor)}</strong>
            <small>${getStatusLabel(status)}</small>
          </article>

          <article>
            <span>Vencimento</span>
            <strong>${formatDate(conta.data_vencimento)}</strong>
          </article>

          <article>
            <span>Recebimento</span>
            <strong>${formatDate(conta.data_pagamento)}</strong>
          </article>

          <article>
            <span>Parcela</span>
            <strong>${Number(conta.parcela || 1)}/${Number(conta.total_parcelas || 1)}</strong>
          </article>
        </section>

        <section class="cr-detail-section">
          <div class="cr-detail-section__header">
            <div>
              <h4>Informações financeiras</h4>
              <p>Regra: só entra no Fluxo de Caixa após baixa como recebido.</p>
            </div>
            <span class="${getStatusBadgeClass(status)}">${getStatusLabel(status)}</span>
          </div>

          <div class="cr-detail-grid">
            <div>
              <span>Origem</span>
              <strong>${conta.venda_id ? `Venda #${escapeHtml(conta.venda_id)}` : 'Manual'}</strong>
            </div>

            <div>
              <span>Forma de pagamento</span>
              <strong>${escapeHtml(conta.forma_pagamento || '-')}</strong>
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

        <section class="cr-detail-note">
          <span>Observação</span>
          <p>${escapeHtml(conta.observacao || 'Nenhuma observação registrada.')}</p>
        </section>
      </div>

      <div class="cr-detail-footer">
        ${
          status === 'pago'
            ? `
              <button class="btn btn-warning" type="button" id="estornarCrDetalhe" data-id="${conta.id}">
                <i class="fa-solid fa-rotate-left"></i>
                Estornar baixa
              </button>
            `
            : `
              <button class="btn btn-primary" type="button" id="baixarCrDetalhe" data-id="${conta.id}">
                <i class="fa-solid fa-check"></i>
                Baixar como recebido
              </button>
            `
        }

        <button class="btn btn-light" type="button" id="fecharCrDetalheFooter">
          Fechar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('fecharCrDetalhe')?.addEventListener('click', () => modal.remove());
  document.getElementById('fecharCrDetalheFooter')?.addEventListener('click', () => modal.remove());

  document.getElementById('baixarCrDetalhe')?.addEventListener('click', async (event) => {
    const contaId = event.currentTarget.dataset.id;
    modal.remove();
    await baixarConta(contaId);
  });

  document.getElementById('estornarCrDetalhe')?.addEventListener('click', async (event) => {
    const contaId = event.currentTarget.dataset.id;
    modal.remove();
    await estornarConta(contaId);
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.remove();
  });
}

async function abrirOrigemVenda(id) {
  try {
    const origem = await api.getOrigemVendaContaReceber(id);
    renderOrigemVenda(origem);
  } catch (error) {
    console.error('Erro ao abrir origem da venda:', error);
    const message = buildFriendlyError(error);
    showMessage(message, 'error');
  }
}

function renderOrigemVenda(data) {
  const modalExistente = document.getElementById('crOrigemVendaModal');
  if (modalExistente) modalExistente.remove();

  const venda = data?.venda || {};
  const conta = data?.conta || {};
  const itens = Array.isArray(data?.itens) ? data.itens : [];
  const parcelas = Array.isArray(data?.parcelas) ? data.parcelas : [];

  const modal = document.createElement('div');
  modal.id = 'crOrigemVendaModal';
  modal.className = 'modal-overlay cr-origin-overlay';

  modal.innerHTML = `
    <div class="modal-card cr-origin-card">
      <div class="cr-detail-header">
        <div>
          <span class="cr-detail-eyebrow">Venda #${escapeHtml(venda.id || '-')}</span>
          <h3>Origem da conta a receber</h3>
          <p>${escapeHtml(venda.cliente_nome || conta.cliente_nome || 'Cliente não informado')}</p>
        </div>

        <button class="icon-button" type="button" id="fecharCrOrigem" aria-label="Fechar">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="cr-detail-body">
        <section class="cr-detail-summary">
          <article class="cr-detail-summary__main">
            <span>Total da venda</span>
            <strong>${formatCurrency(venda.total)}</strong>
            <small>${formatDate(venda.data)}</small>
          </article>

          <article>
            <span>Pagamento</span>
            <strong>${escapeHtml(venda.pagamento || '-')}</strong>
          </article>

          <article>
            <span>Parcelas</span>
            <strong>${Number(venda.parcelas || 1)}x</strong>
          </article>

          <article>
            <span>Status</span>
            <strong>${escapeHtml(capitalize(venda.status_pagamento || 'pago'))}</strong>
          </article>
        </section>

        <section class="cr-detail-section">
          <div class="cr-detail-section__header">
            <div>
              <h4>Itens vendidos</h4>
              <p>Produtos que deram origem à conta</p>
            </div>
            <span>${itens.length} item(ns)</span>
          </div>

          <div class="cr-detail-list">
            ${
              itens.length
                ? itens
                    .map(
                      (item) => `
                  <div class="cr-detail-row">
                    <div>
                      <strong>${escapeHtml(item.produto_nome || 'Produto')}</strong>
                      <small>Qtd. ${Number(item.quantidade || 0)}</small>
                    </div>

                    <div>
                      <span>Preço unit.</span>
                      <strong>${formatCurrency(item.preco_unitario || 0)}</strong>
                    </div>

                    <div>
                      <span>Total</span>
                      <strong>${formatCurrency(item.total || 0)}</strong>
                    </div>
                  </div>
                `
                    )
                    .join('')
                : `<div class="empty-detail-state">Nenhum item vinculado.</div>`
            }
          </div>
        </section>

        <section class="cr-detail-section">
          <div class="cr-detail-section__header">
            <div>
              <h4>Parcelas geradas</h4>
              <p>Títulos financeiros vinculados à venda</p>
            </div>
            <span>${parcelas.length} parcela(s)</span>
          </div>

          <div class="cr-detail-list">
            ${
              parcelas.length
                ? parcelas
                    .map(
                      (parcela) => `
                  <div class="cr-detail-row">
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

      <div class="cr-detail-footer">
        <button class="btn btn-light" type="button" id="fecharCrOrigemFooter">
          Fechar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('fecharCrOrigem')?.addEventListener('click', () => modal.remove());
  document.getElementById('fecharCrOrigemFooter')?.addEventListener('click', () => modal.remove());

  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.remove();
  });
}

function renderErro(message) {
  const container = document.getElementById('contasReceberContainer');
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

  if (normalized === 'pago') return 'Recebido';
  if (normalized === 'atrasado') return 'Atrasado';
  if (normalized === 'pendente') return 'Pendente';
  if (normalized === 'parcial') return 'Parcial';

  return capitalize(normalized);
}

function getStatusBadgeClass(status) {
  const normalized = normalizarStatus(status);

  if (normalized === 'pago') return 'badge badge--success';
  if (normalized === 'atrasado') return 'badge badge--danger';
  if (normalized === 'pendente') return 'badge badge--warning';

  return 'badge badge--info';
}

function getVencimentoInfo(dataVencimento) {
  if (!dataVencimento) return 'Sem vencimento';

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function capitalize(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function injectContasReceberStyles() {
  if (document.getElementById('contasReceberProfessionalStyles')) return;

  const style = document.createElement('style');
  style.id = 'contasReceberProfessionalStyles';
  style.textContent = `
    .cr-module-card {
      position: relative;
    }

    .cr-explain-card {
      border: 1px solid rgba(37, 99, 235, 0.14);
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(8, 145, 178, 0.06));
      border-radius: 18px;
      padding: 14px 16px;
      margin-bottom: 18px;
    }

    .cr-explain-card strong {
      display: block;
      color: var(--primary-hover);
      font-weight: 800;
      margin-bottom: 4px;
    }

    .cr-explain-card span {
      color: var(--text-soft);
      font-weight: 600;
      line-height: 1.45;
    }

    .cr-stat-card {
      min-width: 170px;
      position: relative;
      overflow: hidden;
    }

    .cr-stat-card small {
      color: var(--text-muted);
      font-weight: 700;
      font-size: 0.78rem;
    }

    .cr-stat-card--pendente {
      border-color: rgba(217, 119, 6, 0.2);
    }

    .cr-stat-card--atrasado {
      border-color: rgba(220, 38, 38, 0.2);
    }

    .cr-stat-card--pago {
      border-color: rgba(22, 163, 74, 0.2);
    }

    .cr-stat-card--parcial {
  border-color: rgba(8, 145, 178, 0.24);
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

    .btn-inline--warning {
      color: #d97706;
      border-color: rgba(217, 119, 6, 0.24);
    }

    .btn-inline--warning:hover {
      background: var(--warning-soft);
      color: #b45309;
    }

    .btn-inline--danger {
  color: #dc2626;
  border-color: rgba(220, 38, 38, 0.22);
}

.btn-inline--danger:hover {
  background: rgba(220, 38, 38, 0.08);
  color: #b91c1c;
}

    .btn-warning {
      background: #d97706;
      color: #ffffff;
      border-color: #d97706;
    }

    .btn-warning:hover {
      background: #b45309;
      border-color: #b45309;
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

    .cr-detail-overlay,
    .cr-origin-overlay {
      padding: 18px;
      align-items: center;
    }

    .cr-detail-card,
    .cr-origin-card {
      width: min(100%, 820px);
      max-height: calc(100vh - 36px);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      border-radius: 26px;
      padding: 0;
    }

    .cr-detail-header {
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

    .cr-detail-eyebrow {
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

    .cr-detail-header h3 {
      font-size: 1.28rem;
      font-weight: 800;
      letter-spacing: -0.04em;
      color: var(--text);
      margin-bottom: 4px;
    }

    .cr-detail-header p {
      color: var(--text-muted);
      font-size: 0.9rem;
      font-weight: 600;
    }

    .cr-detail-body {
      padding: 18px 22px;
      display: grid;
      gap: 14px;
      overflow-y: auto;
    }

    .cr-detail-summary {
      display: grid;
      grid-template-columns: 1.25fr repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .cr-detail-summary article,
    .cr-detail-note {
      border: 1px solid var(--border);
      background: var(--surface-2);
      border-radius: 18px;
      padding: 14px 16px;
      min-width: 0;
    }

    .cr-detail-summary article span,
    .cr-detail-note span,
    .cr-detail-grid span {
      display: block;
      color: var(--text-muted);
      font-size: 0.76rem;
      font-weight: 800;
      margin-bottom: 6px;
    }

    .cr-detail-summary article strong,
    .cr-detail-grid strong {
      display: block;
      color: var(--text);
      font-size: 0.98rem;
      font-weight: 800;
      line-height: 1.25;
      word-break: break-word;
    }

    .cr-detail-summary__main strong {
      font-size: 1.35rem !important;
      letter-spacing: -0.04em;
    }

    .cr-detail-summary article small {
      display: block;
      margin-top: 6px;
      color: var(--text-muted);
      font-weight: 700;
    }

    .cr-detail-note {
      padding: 12px 16px;
    }

    .cr-detail-note p {
      color: var(--text);
      font-weight: 700;
      line-height: 1.45;
    }

    .cr-detail-section {
      border: 1px solid var(--border);
      border-radius: 20px;
      background: var(--surface);
      overflow: hidden;
    }

    .cr-detail-section__header {
      padding: 13px 16px;
      background: var(--surface-2);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    }

    .cr-detail-section__header h4 {
      color: var(--text);
      font-size: 0.98rem;
      font-weight: 800;
      margin-bottom: 3px;
    }

    .cr-detail-section__header p {
      color: var(--text-muted);
      font-size: 0.82rem;
      font-weight: 600;
    }

    .cr-detail-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      padding: 14px 16px;
    }

    .cr-detail-grid > div {
      border: 1px solid var(--border);
      background: var(--surface-2);
      border-radius: 16px;
      padding: 12px;
    }

    .cr-detail-list {
      display: grid;
    }

    .cr-detail-row {
      display: grid;
      grid-template-columns: 1.4fr 0.8fr 0.8fr;
      gap: 14px;
      align-items: center;
      padding: 13px 16px;
      border-bottom: 1px solid var(--border);
    }

    .cr-detail-row:last-child {
      border-bottom: none;
    }

    .cr-detail-row strong {
      color: var(--text);
      font-size: 0.92rem;
      font-weight: 800;
    }

    .cr-detail-row small,
    .cr-detail-row span {
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

    .cr-detail-footer {
      padding: 14px 22px 18px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      background: var(--surface);
    }

    @media (max-width: 980px) {
      .cr-toolbar-grid {
        grid-template-columns: 1fr;
      }

      .cr-action-box {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }

      .cr-detail-summary,
      .cr-detail-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .cr-detail-row {
        grid-template-columns: 1fr;
        gap: 8px;
      }
    }

    @media (max-width: 560px) {
      .cr-detail-overlay,
      .cr-origin-overlay {
        padding: 10px;
        align-items: flex-start;
      }

      .cr-detail-card,
      .cr-origin-card {
        max-height: calc(100vh - 20px);
        border-radius: 20px;
      }

      .cr-detail-summary,
      .cr-detail-grid {
        grid-template-columns: 1fr;
      }

      .cr-detail-body {
        padding: 14px;
      }

      .cr-action-box {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);
}

function abrirModalContaManual() {
  const modalExistente = document.getElementById('crContaManualModal');

  if (modalExistente) {
    modalExistente.remove();
  }

  const modal = document.createElement('div');

  modal.id = 'crContaManualModal';
  modal.className = 'modal-overlay cr-detail-overlay';

  modal.innerHTML = `
    <div class="modal-card cr-detail-card">
      <div class="cr-detail-header">
        <div>
          <span class="cr-detail-eyebrow">
            Conta manual
          </span>

          <h3>Nova promissória antiga</h3>

          <p>
            Cadastre contas antigas sem gerar venda ou movimentar estoque.
          </p>
        </div>

        <button
          class="icon-button"
          type="button"
          id="fecharContaManual"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="cr-detail-body">

        <div class="form-grid">

          <div class="form-group">
            <label>Cliente</label>

            <select id="crManualCliente" class="input">
              <option value="">Cliente avulso</option>

              ${state.clientes
                .map(
                  (cliente) => `
                    <option value="${cliente.id}">
                      ${escapeHtml(cliente.nome)}
                    </option>
                  `
                )
                .join('')}
            </select>
          </div>

          <div class="form-group">
            <label>Nome manual</label>

            <input
              type="text"
              id="crManualNome"
              class="input"
              placeholder="Nome do cliente"
            />
          </div>

          <div class="form-group">
            <label>Valor</label>

            <input
              type="number"
              step="0.01"
              id="crManualValor"
              class="input"
              placeholder="0,00"
            />
          </div>

          <div class="form-group">
            <label>Vencimento</label>

            <input
              type="date"
              id="crManualVencimento"
              class="input"
            />
          </div>

          <div class="form-group form-group--full">
            <label>Descrição</label>

            <input
              type="text"
              id="crManualDescricao"
              class="input"
              placeholder="Ex: Promissória antiga"
            />
          </div>

          <div class="form-group form-group--full">
            <label>Observação</label>

            <textarea
              id="crManualObservacao"
              class="input"
              rows="4"
              placeholder="Observações da promissória..."
            ></textarea>
          </div>

        </div>
      </div>

      <div class="cr-detail-footer">

        <button
          class="btn btn-primary"
          type="button"
          id="salvarContaManual"
        >
          <i class="fa-solid fa-floppy-disk"></i>
          Salvar conta
        </button>

        <button
          class="btn btn-light"
          type="button"
          id="cancelarContaManual"
        >
          Cancelar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('fecharContaManual')?.addEventListener('click', () => modal.remove());

  document.getElementById('cancelarContaManual')?.addEventListener('click', () => modal.remove());

  document.getElementById('salvarContaManual')?.addEventListener('click', async () => {
    await salvarContaManual(modal);
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.remove();
    }
  });
}

async function salvarContaManual(modal) {
  try {
    const clienteId = document.getElementById('crManualCliente')?.value || '';

    const nomeManual = document.getElementById('crManualNome')?.value?.trim() || '';

    const valor = document.getElementById('crManualValor')?.value || '';

    const vencimento = document.getElementById('crManualVencimento')?.value || '';

    const descricao = document.getElementById('crManualDescricao')?.value?.trim() || '';

    const observacao = document.getElementById('crManualObservacao')?.value?.trim() || '';

    if (!valor || Number(valor) <= 0) {
      showMessage('Informe um valor válido.', 'error');
      return;
    }

    await api.request('/contas-receber/manual', {
      method: 'POST',
      body: {
        empresa: api.getEmpresaNome(),
        empresa_id: api.getEmpresaId(),
        cliente_id: clienteId || null,
        cliente_nome: nomeManual,
        valor,
        data_vencimento: vencimento,
        descricao,
        observacao,
        forma_pagamento: 'promissoria'
      }
    });

    showMessage('Conta manual cadastrada com sucesso.', 'success');

    modal.remove();

    await recarregar();
  } catch (error) {
    console.error('Erro ao salvar conta manual:', error);

    const message = buildFriendlyError(error);

    showMessage(message, 'error');
  }
}

async function abrirHistoricoCliente(clienteId) {
  try {
    const data = await api.getHistoricoFinanceiroCliente(clienteId);

    const modalExistente = document.getElementById('crHistoricoClienteModal');
    if (modalExistente) modalExistente.remove();

    const cliente = data?.cliente || {};
    const resumo = data?.resumo || {};
    const contas = Array.isArray(data?.contas) ? data.contas : [];

    const modal = document.createElement('div');
    modal.id = 'crHistoricoClienteModal';
    modal.className = 'modal-overlay cr-detail-overlay';

    modal.innerHTML = `
      <div class="modal-card cr-detail-card">
        <div class="cr-detail-header">
          <div>
            <span class="cr-detail-eyebrow">Histórico do cliente</span>
            <h3>${escapeHtml(cliente.nome || 'Cliente')}</h3>
            <p>${escapeHtml(cliente.telefone || 'Sem telefone informado')}</p>
          </div>

          <button class="icon-button" type="button" id="fecharHistoricoCliente">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="cr-detail-body">
          <section class="cr-detail-summary">
            <article class="cr-detail-summary__main">
              <span>Saldo em aberto</span>
              <strong>${formatCurrency(Number(resumo.total_pendente || 0) + Number(resumo.total_atrasado || 0))}</strong>
              <small>${contas.length} título(s)</small>
            </article>

            <article>
              <span>Pago</span>
              <strong>${formatCurrency(resumo.total_pago || 0)}</strong>
            </article>

            <article>
              <span>Atrasado</span>
              <strong>${formatCurrency(resumo.total_atrasado || 0)}</strong>
            </article>

            <article>
              <span>Total histórico</span>
              <strong>${formatCurrency(resumo.total || 0)}</strong>
            </article>
          </section>

          <section class="cr-detail-section">
            <div class="cr-detail-section__header">
              <div>
                <h4>Últimos títulos</h4>
                <p>Contas vinculadas ao cliente</p>
              </div>
            </div>

            <div class="cr-detail-list">
              ${
                contas.length
                  ? contas
                      .slice(0, 10)
                      .map(
                        (conta) => `
                          <div class="cr-detail-row">
                            <div>
                              <strong>#${escapeHtml(conta.id)}</strong>
                              <small>${escapeHtml(conta.observacao || 'Conta a receber')}</small>
                            </div>

                            <div>
                              <span>Vencimento</span>
                              <strong>${formatDate(conta.data_vencimento)}</strong>
                            </div>

                            <div>
                              <span>Valor</span>
                              <strong>${formatCurrency(conta.valor || 0)}</strong>
                            </div>
                          </div>
                        `
                      )
                      .join('')
                  : `<div class="empty-detail-state">Nenhum título encontrado.</div>`
              }
            </div>
          </section>
        </div>

        <div class="cr-detail-footer">
          <button class="btn btn-light" type="button" id="fecharHistoricoClienteFooter">
            Fechar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document
      .getElementById('fecharHistoricoCliente')
      ?.addEventListener('click', () => modal.remove());
    document
      .getElementById('fecharHistoricoClienteFooter')
      ?.addEventListener('click', () => modal.remove());

    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.remove();
    });
  } catch (error) {
    console.error('Erro ao abrir histórico do cliente:', error);
    showMessage(buildFriendlyError(error), 'error');
  }
}
