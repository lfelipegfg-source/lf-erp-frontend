import api from './api.js';

const state = {
  itens: [],
  filtros: {
    tipo: '',
    status: '',
    busca: ''
  }
};

export async function initLancamentosModule() {
  try {
    renderLoading();
    await carregarLancamentos();
    render();
  } catch (error) {
    console.error(error);
    renderErro('Erro ao carregar lançamentos financeiros.');
  }
}

async function carregarLancamentos() {
  const filtrosGlobais = getFiltrosGlobais();

  const data = await api.getLancamentosFinanceiros({
    ...filtrosGlobais,
    ...state.filtros
  });

  state.itens = Array.isArray(data) ? data : [];
}

function getFiltrosGlobais() {
  return {
    data_inicial: document.getElementById('filtroDataInicial')?.value || '',
    data_final: document.getElementById('filtroDataFinal')?.value || '',
    busca: document.getElementById('filtroBuscaGlobal')?.value || ''
  };
}

function renderLoading() {
  const c = document.getElementById('lancamentosContainer');
  if (!c) return;

  c.innerHTML = `
    <div class="module-card">
      <div class="module-feedback module-feedback--info">
        Carregando lançamentos...
      </div>
    </div>
  `;
}

function render() {
  const c = document.getElementById('lancamentosContainer');

  c.innerHTML = `
    <div class="module-card">

      <div id="lancamentosFeedback" class="module-feedback"></div>

      <div class="module-card__header">
        <div>
          <h3>Lançamentos Financeiros</h3>
          <p>Controle manual de receitas e despesas</p>
        </div>

        <div class="module-card__actions">
          <button class="btn btn-primary" id="btnNovoLancamento">
            + Novo Lançamento
          </button>
        </div>
      </div>

      <div class="module-toolbar">
        <input id="lfBusca" placeholder="Buscar..." class="input" />

        <select id="lfTipo" class="input">
          <option value="">Todos</option>
          <option value="receita">Receitas</option>
          <option value="despesa">Despesas</option>
        </select>

        <select id="lfStatus" class="input">
          <option value="">Todos</option>
          <option value="pendente">Pendentes</option>
          <option value="pago">Pagos</option>
        </select>

        <button class="btn btn-primary" id="btnFiltrarLancamentos">Filtrar</button>
      </div>

      ${renderTabela()}

      ${renderModal()}
    </div>
  `;

  bindEventos();
}

function renderTabela() {
  if (!state.itens.length) {
    return `<div class="module-feedback">Nenhum lançamento encontrado</div>`;
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
          ${state.itens.map(renderLinha).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderLinha(item) {
  return `
    <tr>
      <td>${item.tipo}</td>
      <td>${item.descricao}</td>
      <td>${item.categoria}</td>
      <td>${formatDate(item.vencimento)}</td>
      <td>${item.status}</td>
      <td class="text-right">${formatCurrency(item.valor)}</td>
      <td>
        <button data-action="pagar" data-id="${item.id}">Pagar</button>
        <button data-action="delete" data-id="${item.id}">Excluir</button>
      </td>
    </tr>
  `;
}

function renderModal() {
  return `
    <div class="modal-overlay hidden" id="lfModal">
      <div class="modal-card">
        <h3>Novo Lançamento</h3>

        <form id="lfForm" class="form-grid">

          <select id="lfTipoInput">
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>

          <input id="lfDescricao" placeholder="Descrição" required />
          <input id="lfCategoria" placeholder="Categoria" required />
          <input id="lfValor" type="number" placeholder="Valor" required />
          <input id="lfVencimento" type="date" />

          <button class="btn btn-primary">Salvar</button>
        </form>
      </div>
    </div>
  `;
}

function bindEventos() {
  document.getElementById('btnNovoLancamento').onclick = () => {
    document.getElementById('lfModal').classList.remove('hidden');
  };

  document.getElementById('btnFiltrarLancamentos').onclick = async () => {
    state.filtros.tipo = document.getElementById('lfTipo').value;
    state.filtros.status = document.getElementById('lfStatus').value;
    state.filtros.busca = document.getElementById('lfBusca').value;

    await carregarLancamentos();
    render();
  };

  document.getElementById('lfForm').onsubmit = async (e) => {
    e.preventDefault();

    await api.createLancamentoFinanceiro({
      tipo: document.getElementById('lfTipoInput').value,
      descricao: document.getElementById('lfDescricao').value,
      categoria: document.getElementById('lfCategoria').value,
      valor: document.getElementById('lfValor').value,
      vencimento: document.getElementById('lfVencimento').value
    });

    document.getElementById('lfModal').classList.add('hidden');

    await carregarLancamentos();
    render();
  };

  document.querySelectorAll("[data-action='delete']").forEach((btn) => {
    btn.onclick = async () => {
      await api.deleteLancamentoFinanceiro(btn.dataset.id);
      await carregarLancamentos();
      render();
    };
  });

  document.querySelectorAll("[data-action='pagar']").forEach((btn) => {
    btn.onclick = async () => {
      await api.pagarLancamentoFinanceiro(btn.dataset.id);
      await carregarLancamentos();
      render();
    };
  });
}

function formatCurrency(v) {
  return Number(v).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR');
}

function renderErro(msg) {
  document.getElementById('lancamentosContainer').innerHTML =
    `<div class="module-feedback module-feedback--error">${msg}</div>`;
}
