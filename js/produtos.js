import api from './api.js';
import { getAuth } from './auth.js';
import { showToast, confirmarAcao } from './feedback.js';

const ProdutosModule = {
  state: {
    items: [],
    filteredItems: [],
    loading: false,
    editingId: null,
    deletingId: null,
    empresa: null,
    initialized: false,
    eventsBound: false
  },

  init() {
    this.resolveEmpresa();

    if (!this.state.initialized) {
      this.state.initialized = true;
      this.renderInitialState();
      this.cacheElements();
      this.bindEvents();
    } else {
      this.cacheElements();
    }
  },

  cacheElements() {
    this.el = {
      container: document.getElementById('produtosContainer'),
      toolbarSearch: document.getElementById('produtosSearchInput'),
      toolbarRefresh: document.getElementById('produtosRefreshBtn'),
      toolbarNew: document.getElementById('produtosNewBtn'),
      statsTotal: document.getElementById('produtosStatsTotal'),
      statsStock: document.getElementById('produtosStatsStock'),
      statsAlert: document.getElementById('produtosStatsAlert'),
      tableBody: document.getElementById('produtosTableBody'),
      emptyState: document.getElementById('produtosEmptyState'),
      feedback: document.getElementById('produtosFeedback'),

      modal: document.getElementById('produtoModal'),
      modalTitle: document.getElementById('produtoModalTitle'),
      form: document.getElementById('produtoForm'),
      id: document.getElementById('produtoId'),
      nome: document.getElementById('produtoNome'),
      categoria: document.getElementById('produtoCategoria'),
      codigoBarras: document.getElementById('produtoCodigoBarras'),
      preco: document.getElementById('produtoPreco'),
      custo: document.getElementById('produtoCusto'),
      precoPromocional: document.getElementById('produtoPrecoPromocional'),
      promocaoAtiva: document.getElementById('produtoPromocaoAtiva'),
      estoque: document.getElementById('produtoEstoque'),
      estoqueMinimo: document.getElementById('produtoEstoqueMinimo'),
      saveBtn: document.getElementById('produtoSaveBtn'),
      cancelBtn: document.getElementById('produtoCancelBtn'),
      closeBtn: document.getElementById('produtoModalCloseBtn'),
      formFeedback: document.getElementById('produtoFormFeedback')
    };
  },

  bindEvents() {
    if (this.state.eventsBound) return;
    this.state.eventsBound = true;

    document.addEventListener('input', (event) => {
      if (event.target?.id === 'produtosSearchInput') {
        this.applySearch(event.target.value);
      }
    });

    document.addEventListener('click', async (event) => {
      const target = event.target.closest('button');
      if (!target) return;

      if (target.id === 'produtosRefreshBtn') {
        await this.load();
        return;
      }

      if (target.id === 'produtosNewBtn') {
        this.openCreateModal();
        return;
      }

      if (target.id === 'produtoCancelBtn' || target.id === 'produtoModalCloseBtn') {
        this.closeModal();
        return;
      }

      if (target.dataset.action === 'edit') {
        const id = Number(target.dataset.id);
        this.openEditModal(id);
        return;
      }

      if (target.dataset.action === 'delete') {
        const id = Number(target.dataset.id);
        await this.handleDelete(id);
      }
    });

    document.addEventListener('submit', async (event) => {
      if (event.target?.id === 'produtoForm') {
        event.preventDefault();
        await this.handleSubmit();
      }
    });

    document.addEventListener('click', (event) => {
      const modal = document.getElementById('produtoModal');
      if (event.target === modal) {
        this.closeModal();
      }
    });
  },

  resolveEmpresa() {
    const auth = getAuth();
    this.state.empresa = auth?.empresa?.nome || auth?.user?.empresa || 'LF ERP';
  },

  async load() {
    this.resolveEmpresa();
    this.cacheElements();

    if (!this.state.empresa) {
      this.showModuleMessage('Empresa não identificada para carregar produtos.', 'error');
      return;
    }

    this.setLoading(true);
    this.showModuleMessage('Carregando produtos...', 'info');

    try {
      const items = await api.getProdutos();

      this.state.items = Array.isArray(items) ? items : [];
      this.state.filteredItems = [...this.state.items];

      this.renderStats();
      this.renderTable();
      this.toggleEmptyState();
      this.showModuleMessage('', 'info');
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);

      this.state.items = [];
      this.state.filteredItems = [];

      this.renderStats();
      this.renderTable();
      this.toggleEmptyState('Não foi possível carregar os produtos.');
      const message = buildFriendlyError(error);
      this.showModuleMessage(message, 'error');
    } finally {
      this.setLoading(false);
    }
  },

  renderInitialState() {
    const container = document.getElementById('produtosContainer');
    if (!container) return;

    container.innerHTML = `
      <section class="module-card">
        <div class="module-card__header">
          <div>
            <h3>Produtos</h3>
            <p>Cadastro, edição, estoque e consulta de produtos</p>
          </div>

          <div class="module-card__actions">
            <button type="button" class="btn btn-light" id="produtosRefreshBtn">
              <i class="fa-solid fa-rotate"></i>
              Atualizar
            </button>

            <button type="button" class="btn btn-primary" id="produtosNewBtn">
              <i class="fa-solid fa-plus"></i>
              Novo produto
            </button>
          </div>
        </div>

        <div class="module-toolbar">
          <div class="module-toolbar__search">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input
              type="text"
              id="produtosSearchInput"
              placeholder="Buscar por nome, categoria ou código de barras"
            />
          </div>

          <div class="module-toolbar__stats">
            <div class="mini-stat">
              <span>Total</span>
              <strong id="produtosStatsTotal">0</strong>
            </div>

            <div class="mini-stat">
              <span>Estoque</span>
              <strong id="produtosStatsStock">0</strong>
            </div>

            <div class="mini-stat">
              <span>Em alerta</span>
              <strong id="produtosStatsAlert">0</strong>
            </div>
          </div>
        </div>

        <div class="module-feedback" id="produtosFeedback"></div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Código</th>
                <th>Preço</th>
                <th>Custo Médio</th>
                <th>Lucro</th>
                <th>Margem</th>
                <th>Estoque</th>
                <th>Mínimo</th>
                <th>Status</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody id="produtosTableBody"></tbody>
          </table>
        </div>

        <div class="empty-state hidden" id="produtosEmptyState">
          Nenhum produto encontrado.
        </div>
      </section>

      <div class="modal-overlay hidden" id="produtoModal">
        <div class="modal-card modal-card--large">
          <div class="modal-card__header">
            <div>
              <h3 id="produtoModalTitle">Novo produto</h3>
              <p>Preencha os dados para salvar no ERP.</p>
            </div>

            <button
              type="button"
              class="icon-button"
              id="produtoModalCloseBtn"
              aria-label="Fechar"
            >
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <form id="produtoForm" class="form-grid">
            <input type="hidden" id="produtoId" />

            <div class="form-field form-field--span-2">
              <label for="produtoNome">Nome do produto</label>
              <input type="text" id="produtoNome" required />
            </div>

            <div class="form-field">
              <label for="produtoCategoria">Categoria</label>
              <input type="text" id="produtoCategoria" />
            </div>

            <div class="form-field">
              <label for="produtoCodigoBarras">Código de barras</label>
              <input type="text" id="produtoCodigoBarras" />
            </div>

            <div class="form-field">
              <label for="produtoPreco">Preço de venda</label>
              <input type="number" id="produtoPreco" min="0" step="0.01" required />
            </div>

            <div class="form-field">
              <label for="produtoCusto">Custo</label>
              <input type="number" id="produtoCusto" min="0" step="0.01" required />
            </div>

            <div class="form-field">
              <label for="produtoPrecoPromocional">Preço promocional</label>
              <input
                type="number"
                id="produtoPrecoPromocional"
                min="0"
                step="0.01"
              />
            </div>

            <div class="form-field form-field--checkbox">
              <label class="checkbox-wrapper">
                <input type="checkbox" id="produtoPromocaoAtiva" />
                <span>Promoção ativa</span>
              </label>
            </div>

            <div class="form-field">
              <label for="produtoEstoque">Estoque</label>
              <input type="number" id="produtoEstoque" min="0" step="1" required />
            </div>

            <div class="form-field">
              <label for="produtoEstoqueMinimo">Estoque mínimo</label>
              <input type="number" id="produtoEstoqueMinimo" min="0" step="1" />
            </div>

            <div class="form-feedback form-field--span-2" id="produtoFormFeedback"></div>

            <div class="modal-card__footer form-field--span-2">
              <button type="button" class="btn btn-light" id="produtoCancelBtn">
                Cancelar
              </button>

              <button type="submit" class="btn btn-primary" id="produtoSaveBtn">
                Salvar produto
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  renderStats() {
    const total = this.state.items.length;
    const stock = this.state.items.reduce((acc, item) => acc + Number(item.estoque || 0), 0);
    const alert = this.state.items.filter((item) => Boolean(item.alerta_estoque)).length;

    if (this.el.statsTotal) this.el.statsTotal.textContent = String(total);
    if (this.el.statsStock) this.el.statsStock.textContent = String(stock);
    if (this.el.statsAlert) this.el.statsAlert.textContent = String(alert);
  },

  renderTable() {
    if (!this.el.tableBody) return;

    if (!this.state.filteredItems.length) {
      this.el.tableBody.innerHTML = '';
      return;
    }

    this.el.tableBody.innerHTML = this.state.filteredItems
      .map((item) => {
        const alerta = Boolean(item.alerta_estoque);
        const statusClass = alerta ? 'badge badge--danger' : 'badge badge--success';
        const statusText = alerta ? 'Abaixo do mínimo' : 'Ok';

        return `
          <tr>
            <td>
              <div class="table-primary">
                <strong>${escapeHtml(item.nome || '-')}</strong>
              </div>
            </td>
            <td>${escapeHtml(item.categoria || '-')}</td>
            <td>${escapeHtml(item.codigo_barras || '-')}</td>
            <td>
  ${
    item.promocao_ativa && Number(item.preco_promocional || 0) > 0
      ? `
        <div class="price-stack">
          <small class="price-old">${toCurrency(item.preco)}</small>
          <strong class="price-promo">
            ${toCurrency(item.preco_promocional)}
          </strong>
        </div>
      `
      : toCurrency(item.preco)
  }
</td>

<td>${toCurrency(item.custo_medio || item.custo)}</td>

<td class="${Number(item.lucro_unitario || 0) >= 0 ? 'text-success' : 'text-danger'}">
  ${toCurrency(item.lucro_unitario || 0)}
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

<td>${Number(item.estoque || 0)}</td>
            <td>${Number(item.estoque_minimo || 0)}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td class="text-right">
              <div class="table-actions">
                <button type="button" class="btn-inline" data-action="edit" data-id="${item.id}">
                  Editar
                </button>
                <button
                  type="button"
                  class="btn-inline btn-inline--danger"
                  data-action="delete"
                  data-id="${item.id}"
                >
                  Excluir
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  },

  toggleEmptyState(message = 'Nenhum produto encontrado.') {
    if (!this.el.emptyState) return;

    if (this.state.filteredItems.length) {
      this.el.emptyState.classList.add('hidden');
      return;
    }

    this.el.emptyState.textContent = message;
    this.el.emptyState.classList.remove('hidden');
  },

  applySearch(term) {
    const normalized = String(term || '')
      .trim()
      .toLowerCase();

    if (!normalized) {
      this.state.filteredItems = [...this.state.items];
    } else {
      this.state.filteredItems = this.state.items.filter((item) => {
        return [item.nome, item.categoria, item.codigo_barras]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(normalized));
      });
    }

    this.renderTable();
    this.toggleEmptyState();
  },

  openCreateModal() {
    this.state.editingId = null;
    this.cacheElements();

    if (this.el.modalTitle) this.el.modalTitle.textContent = 'Novo produto';
    if (this.el.saveBtn) this.el.saveBtn.textContent = 'Salvar produto';
    if (this.el.form) this.el.form.reset();
    if (this.el.id) this.el.id.value = '';

    this.setFormFeedback('', 'info');
    this.openModal();
  },

  openEditModal(id) {
    const item = this.state.items.find((product) => Number(product.id) === Number(id));
    if (!item) {
      this.showModuleMessage('Produto não encontrado para edição.', 'error');
      return;
    }

    this.state.editingId = id;
    this.cacheElements();

    if (this.el.modalTitle) this.el.modalTitle.textContent = 'Editar produto';
    if (this.el.saveBtn) this.el.saveBtn.textContent = 'Salvar alterações';

    if (this.el.id) this.el.id.value = String(item.id);
    if (this.el.nome) this.el.nome.value = item.nome || '';
    if (this.el.categoria) this.el.categoria.value = item.categoria || '';
    if (this.el.codigoBarras) this.el.codigoBarras.value = item.codigo_barras || '';
    if (this.el.preco) this.el.preco.value = Number(item.preco || 0);
    if (this.el.custo) this.el.custo.value = Number(item.custo || 0);
    if (this.el.precoPromocional) {
      this.el.precoPromocional.value = Number(item.preco_promocional || 0);
    }

    if (this.el.promocaoAtiva) {
      this.el.promocaoAtiva.checked = Boolean(item.promocao_ativa);
    }
    if (this.el.estoque) this.el.estoque.value = Number(item.estoque || 0);
    if (this.el.estoqueMinimo) this.el.estoqueMinimo.value = Number(item.estoque_minimo || 0);

    this.setFormFeedback('', 'info');
    this.openModal();
  },

  openModal() {
    this.el.modal?.classList.remove('hidden');
  },

  closeModal() {
    this.cacheElements();
    this.el.modal?.classList.add('hidden');
    this.state.editingId = null;
    this.el.form?.reset();
    this.setFormFeedback('', 'info');
  },

  async handleSubmit() {
    this.cacheElements();

    const payload = {
      empresa: this.state.empresa,
      nome: this.el.nome?.value?.trim() || '',
      categoria: this.el.categoria?.value?.trim() || '',
      codigo_barras: this.el.codigoBarras?.value?.trim() || '',
      preco: Number(this.el.preco?.value || 0),
      custo: Number(this.el.custo?.value || 0),
      preco_promocional: Number(this.el.precoPromocional?.value || 0),
      promocao_ativa: Boolean(this.el.promocaoAtiva?.checked),
      estoque: Number(this.el.estoque?.value || 0),
      estoque_minimo: Number(this.el.estoqueMinimo?.value || 0)
    };

    if (!payload.nome) {
      this.setFormFeedback('Informe o nome do produto.', 'error');
      return;
    }

    if (!payload.empresa) {
      this.setFormFeedback('Empresa não identificada.', 'error');
      return;
    }

    if (
      payload.preco < 0 ||
      payload.custo < 0 ||
      payload.estoque < 0 ||
      payload.estoque_minimo < 0
    ) {
      this.setFormFeedback('Valores negativos não são permitidos.', 'error');
      return;
    }

    if (this.el.saveBtn) this.el.saveBtn.disabled = true;
    this.setFormFeedback('Salvando produto...', 'info');

    try {
      if (this.state.editingId) {
        await api.updateProduto(this.state.editingId, payload);
        this.showMessage('Produto atualizado com sucesso.', 'success');
      } else {
        await api.createProduto(payload);
        this.showMessage('Produto cadastrado com sucesso.', 'success');
      }

      this.closeModal();
      await this.load();
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      const message = buildFriendlyError(error);
      this.setFormFeedback(message, 'error');
    } finally {
      if (this.el.saveBtn) this.el.saveBtn.disabled = false;
    }
  },

  async handleDelete(id) {
    const item = this.state.items.find((product) => Number(product.id) === Number(id));
    if (!item) {
      this.showModuleMessage('Produto não encontrado.', 'error');
      return;
    }

    const confirmed = await confirmarAcao(`Excluir o produto "${item.nome}"?`, 'Excluir', 'danger');
    if (!confirmed) return;

    this.state.deletingId = id;
    this.showModuleMessage('Excluindo produto...', 'info');

    try {
      await api.deleteProduto(id);
      this.showMessage('Produto excluído com sucesso.', 'success');
      await this.load();
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      const message = buildFriendlyError(error);
      this.showModuleMessage(message, 'error');
    } finally {
      this.state.deletingId = null;
    }
  },

  setLoading(value) {
    this.state.loading = value;
    this.cacheElements();

    if (this.el.toolbarRefresh) this.el.toolbarRefresh.disabled = value;
    if (this.el.toolbarNew) this.el.toolbarNew.disabled = value;
  },

  showModuleMessage(message, type = 'info') {
    this.cacheElements();

    if (!this.el.feedback) return;

    if (!message) {
      this.el.feedback.className = 'module-feedback';
      this.el.feedback.textContent = '';
      return;
    }

    this.el.feedback.className = `module-feedback module-feedback--${type}`;
    this.el.feedback.textContent = message;
  },

  showMessage(message, type = 'info') {
    this.showModuleMessage(message, type);
    showToast(message, type);
  },

  setFormFeedback(message, type = 'info') {
    this.cacheElements();

    if (!this.el.formFeedback) return;

    if (!message) {
      this.el.formFeedback.className = 'form-feedback';
      this.el.formFeedback.textContent = '';
      return;
    }

    this.el.formFeedback.className = `form-feedback form-feedback--${type}`;
    this.el.formFeedback.textContent = message;
  }
};

function buildFriendlyError(error) {
  if (!error) return 'Erro inesperado.';

  if (typeof api.formatPlanError === 'function') {
    return api.formatPlanError(error);
  }

  if (error.status === 400) return error.message || 'Dados inválidos.';
  if (error.status === 403) return error.message || 'Sem permissão para esta operação.';
  if (error.status === 404) return error.message || 'Registro não encontrado.';
  if (error.status === 500) return 'Erro interno no backend.';
  if (String(error.message || '').includes('Failed to fetch')) {
    return 'Não foi possível conectar ao backend.';
  }

  return error.message || 'Falha na operação.';
}

function toCurrency(value) {
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
    .replaceAll("'", '&#039;');
}

export async function initProdutosModule() {
  ProdutosModule.init();
  await ProdutosModule.load();
}

export default ProdutosModule;
