import api from './api.js';
import { showToast } from './feedback.js';

const EstoqueModule = {
  state: {
    items: [],
    filteredItems: [],
    initialized: false,
    eventsBound: false,
    loading: false
  },

  init() {
    if (!this.state.initialized) {
      this.state.initialized = true;
      this.render();
      this.cache();
      this.bind();
    } else {
      this.cache();
    }
  },

  cache() {
    this.el = {
      table: document.getElementById('estoqueTable'),
      search: document.getElementById('estoqueSearch'),
      status: document.getElementById('estoqueStatusFiltro'),
      totalProdutos: document.getElementById('estoqueTotalProdutos'),
      totalBaixo: document.getElementById('estoqueTotalBaixo'),
      totalZerado: document.getElementById('estoqueTotalZerado'),
      feedback: document.getElementById('estoqueFeedback')
    };
  },

  bind() {
    if (this.state.eventsBound) return;
    this.state.eventsBound = true;

    document.addEventListener('input', (e) => {
      if (e.target.id === 'estoqueSearch') {
        this.applyFilters();
      }
    });

    document.addEventListener('change', (e) => {
      if (e.target.id === 'estoqueStatusFiltro') {
        this.applyFilters();
      }
    });

    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      if (btn.id === 'estoqueAtualizarBtn') {
        await this.load();
      }
    });
  },

  async load() {
    this.state.loading = true;
    this.setFeedback('Carregando estoque...', 'info');

    if (typeof showToast === 'function') {
      showToast('Carregando estoque...', 'info');
    }

    this.setLoading(true);
    try {
      const data = await api.getProdutos({
        busca: document.getElementById('filtroBuscaGlobal')?.value?.trim() || ''
      });

      this.state.items = Array.isArray(data) ? data : [];
      this.state.filteredItems = [...this.state.items];

      this.render();
      this.cache();
      this.updateStats();
      this.renderTable();
      this.setFeedback('', 'info');
    } catch (error) {
      console.error('Erro ao carregar estoque:', error);
      this.state.items = [];
      this.state.filteredItems = [];

      this.render();
      this.cache();
      this.updateStats();
      this.renderTable();
      const message = this.buildFriendlyError(error);
      this.setFeedback(message, 'error');
    } finally {
      this.state.loading = false;
      this.setLoading(false);
    }
  },

  render() {
    const c = document.getElementById('estoqueContainer');
    if (!c) return;

    c.innerHTML = `
      <section class="module-card">
        <div id="estoqueFeedback" class="module-feedback"></div>

        <div class="module-card__header">
          <div>
            <h3>Estoque</h3>
            <p>Posição atual, alerta de mínimo e visão geral dos produtos</p>
          </div>

          <div class="module-card__actions">
            <button class="btn btn-light" id="estoqueAtualizarBtn" type="button">
              <i class="fa-solid fa-rotate"></i>
              Atualizar
            </button>
          </div>
        </div>

        <div class="estoque-toolbar-grid">
          <div class="module-toolbar__search estoque-search-box">
            <i class="fa-solid fa-search"></i>
            <input
              id="estoqueSearch"
              placeholder="Buscar por nome, categoria ou código de barras..."
              value="${escapeHtml(this.getCurrentSearchValue())}"
            />
          </div>

          <div class="estoque-filter-box">
            <select id="estoqueStatusFiltro" class="input">
              <option value="">Todos os produtos</option>
              <option value="normal" ${this.getCurrentStatusValue() === 'normal' ? 'selected' : ''}>Estoque normal</option>
              <option value="baixo" ${this.getCurrentStatusValue() === 'baixo' ? 'selected' : ''}>Baixo estoque</option>
              <option value="zerado" ${this.getCurrentStatusValue() === 'zerado' ? 'selected' : ''}>Sem estoque</option>
            </select>
          </div>
        </div>

        <div class="kpi-grid" style="margin-bottom: 20px;">
          <div class="kpi-card">
            <div class="kpi-card__content">
              <span>Total de produtos</span>
              <strong id="estoqueTotalProdutos">0</strong>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card__content">
              <span>Baixo estoque</span>
              <strong id="estoqueTotalBaixo">0</strong>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card__content">
              <span>Sem estoque</span>
              <strong id="estoqueTotalZerado">0</strong>
            </div>
          </div>
        </div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Código</th>
                <th>Preço</th>
                <th>Custo</th>
                <th>Estoque</th>
                <th>Mínimo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="estoqueTable"></tbody>
          </table>
        </div>
      </section>
    `;
  },

  renderTable() {
    if (!this.el.table) return;

    if (!this.state.filteredItems.length) {
      this.el.table.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="module-feedback module-feedback--info" style="margin: 12px;">
              Nenhum produto encontrado no estoque.
            </div>
          </td>
        </tr>
      `;
      return;
    }

    this.el.table.innerHTML = this.state.filteredItems
      .map((produto) => {
        const estoque = Number(produto.estoque || 0);
        const estoqueMinimo = Number(produto.estoque_minimo || 0);
        const status = this.getStatusProduto(produto);

        return `
        <tr>
          <td>
            <div class="table-primary">
              <strong>${escapeHtml(produto.nome || '-')}</strong>
            </div>
          </td>
          <td>${escapeHtml(produto.categoria || '-')}</td>
          <td>${escapeHtml(produto.codigo_barras || '-')}</td>
          <td>${formatCurrency(produto.preco)}</td>
          <td>${formatCurrency(produto.custo)}</td>
          <td>${estoque}</td>
          <td>${estoqueMinimo}</td>
          <td>${status}</td>
        </tr>
      `;
      })
      .join('');
  },

  applyFilters() {
    const termo = String(this.el.search?.value || '')
      .trim()
      .toLowerCase();
    const status = String(this.el.status?.value || '').trim();

    this.state.filteredItems = this.state.items.filter((produto) => {
      const nome = String(produto.nome || '').toLowerCase();
      const categoria = String(produto.categoria || '').toLowerCase();
      const codigo = String(produto.codigo_barras || '').toLowerCase();

      const matchTexto =
        !termo || nome.includes(termo) || categoria.includes(termo) || codigo.includes(termo);

      if (!matchTexto) return false;

      if (!status) return true;

      const estoque = Number(produto.estoque || 0);
      const estoqueMinimo = Number(produto.estoque_minimo || 0);

      if (status === 'zerado') {
        return estoque === 0;
      }

      if (status === 'baixo') {
        return estoque > 0 && estoqueMinimo > 0 && estoque <= estoqueMinimo;
      }

      if (status === 'normal') {
        return estoque > 0 && (estoqueMinimo <= 0 || estoque > estoqueMinimo);
      }

      return true;
    });

    this.updateStats();
    this.renderTable();

    if (!this.state.filteredItems.length) {
      this.setFeedback('Nenhum produto encontrado com os filtros aplicados.', 'info');
    } else {
      this.setFeedback('', 'info');
    }
  },

  updateStats() {
    const totalProdutos = this.state.filteredItems.length;
    const totalBaixo = this.state.filteredItems.filter((produto) => {
      const estoque = Number(produto.estoque || 0);
      const estoqueMinimo = Number(produto.estoque_minimo || 0);
      return estoque > 0 && estoqueMinimo > 0 && estoque <= estoqueMinimo;
    }).length;

    const totalZerado = this.state.filteredItems.filter((produto) => {
      return Number(produto.estoque || 0) === 0;
    }).length;

    if (this.el.totalProdutos) this.el.totalProdutos.textContent = String(totalProdutos);
    if (this.el.totalBaixo) this.el.totalBaixo.textContent = String(totalBaixo);
    if (this.el.totalZerado) this.el.totalZerado.textContent = String(totalZerado);
  },

  getStatusProduto(produto) {
    const estoque = Number(produto.estoque || 0);
    const estoqueMinimo = Number(produto.estoque_minimo || 0);

    if (estoque === 0) {
      return `<span class="badge badge--danger">Sem estoque</span>`;
    }

    if (estoqueMinimo > 0 && estoque <= estoqueMinimo) {
      return `<span class="badge badge--warning">Baixo</span>`;
    }

    return `<span class="badge badge--success">Normal</span>`;
  },

  getCurrentSearchValue() {
    return document.getElementById('estoqueSearch')?.value || '';
  },

  getCurrentStatusValue() {
    return document.getElementById('estoqueStatusFiltro')?.value || '';
  },

  setFeedback(message, type = '') {
    const feedback = document.getElementById('estoqueFeedback');
    if (!feedback) return;

    feedback.className = 'module-feedback';

    if (!message) {
      feedback.innerHTML = '';
      return;
    }

    if (type === 'success') {
      feedback.classList.add('module-feedback--success');
    } else if (type === 'error') {
      feedback.classList.add('module-feedback--error');
    } else {
      feedback.classList.add('module-feedback--info');
    }

    feedback.textContent = message;
  },

  showMessage(message, type = 'info') {
    this.setFeedback(message, type);

    if (typeof showToast === 'function') {
      showToast(message, type);
    }
  },

  setLoading(value) {
    this.state.loading = value;
    this.cache();

    if (this.el.search) this.el.search.disabled = value;
    if (this.el.status) this.el.status.disabled = value;

    const btnAtualizar = document.getElementById('estoqueAtualizarBtn');
    if (btnAtualizar) btnAtualizar.disabled = value;

    if (btnAtualizar) {
      btnAtualizar.innerHTML = value
        ? '<i class="fa-solid fa-spinner fa-spin"></i> Atualizando...'
        : '<i class="fa-solid fa-rotate"></i> Atualizar';
    }
  },

  buildFriendlyError(error) {
    const message = error?.message || '';

    if (message.includes('Failed to fetch')) {
      return 'Não foi possível conectar ao backend.';
    }

    if (error?.status === 403) {
      return 'Acesso negado ou limite do plano atingido.';
    }

    return message || 'Não foi possível concluir a operação.';
  }
};

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function initEstoqueModule() {
  EstoqueModule.init();
  await EstoqueModule.load();
}
