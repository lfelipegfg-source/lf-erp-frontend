import api from './api.js';
import { getAuth } from './auth.js';
import { showToast, confirmarAcao } from './feedback.js';

const ComprasModule = {
  state: {
    items: [],
    fornecedores: [],
    produtos: [],
    filteredItems: [],
    empresa: null,
    initialized: false,
    eventsBound: false,
    itensCompra: [],
    loading: false
  },

  init() {
    this.resolveEmpresa();

    if (!this.state.initialized) {
      this.state.initialized = true;
      this.render();
      this.cache();
      this.bind();
    } else {
      this.cache();
    }
  },

  resolveEmpresa() {
    const auth = getAuth();

    this.state.empresa = auth?.empresa?.nome || auth?.user?.empresa || 'LF ERP';
  },

  cache() {
    this.el = {
      container: document.getElementById('comprasContainer'),
      table: document.getElementById('comprasTable'),
      search: document.getElementById('comprasSearch'),
      feedback: document.getElementById('comprasFeedback'),

      modal: document.getElementById('compraModal'),
      form: document.getElementById('compraForm'),
      fornecedor: document.getElementById('compraFornecedor'),
      data: document.getElementById('compraData'),
      formaPagamento: document.getElementById('compraFormaPagamento'),
      parcelas: document.getElementById('compraParcelas'),
      primeiroVencimento: document.getElementById('compraPrimeiroVencimento'),
      observacao: document.getElementById('compraObservacao'),

      produto: document.getElementById('compraProduto'),
      quantidade: document.getElementById('compraQuantidade'),
      custoUnitario: document.getElementById('compraCustoUnitario'),
      itensTable: document.getElementById('compraItensTable'),
      totalCompra: document.getElementById('compraTotalValor')
    };
  },

  bind() {
    if (this.state.eventsBound) return;
    this.state.eventsBound = true;

    document.addEventListener('input', (e) => {
      if (e.target.id === 'comprasSearch') {
        this.search(e.target.value);
      }
    });

    document.addEventListener('change', (e) => {
      if (e.target.id === 'compraFormaPagamento') {
        this.toggleVencimentoField();
      }
      if (e.target.id === 'xmlNFInput') {
        const file = e.target.files?.[0];
        if (file) this.importarXML(file);
        e.target.value = '';
      }
    });

    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      if (btn.id === 'importarXmlBtn') {
        document.getElementById('xmlNFInput')?.click();
        return;
      }

      if (btn.id === 'novaCompraBtn') {
        this.openModal();
        return;
      }

      if (btn.id === 'cancelCompra' || btn.id === 'cancelCompraFooter') {
        this.closeModal();
        return;
      }

      if (btn.id === 'addItemCompraBtn') {
        this.addItem();
        return;
      }

      if (btn.dataset.action === 'remove-item-compra') {
        this.removeItem(btn.dataset.index);
        return;
      }

      if (btn.dataset.action === 'view-compra') {
        await this.showDetails(btn.dataset.id);
        return;
      }

      if (btn.dataset.action === 'edit-compra') {
        await this.openEditModal(btn.dataset.id);
        return;
      }

      if (btn.dataset.action === 'delete-compra') {
        await this.remove(btn.dataset.id);
      }
    });

    document.addEventListener('submit', async (e) => {
      if (e.target.id === 'compraForm') {
        e.preventDefault();
        await this.save();
      }
    });
  },

  async load() {
    this.resolveEmpresa();
    this.state.loading = true;

    this.setFeedback('Carregando compras...', 'info');


    this.setLoading(true);

    try {
      const [compras, fornecedores, produtos] = await Promise.all([
        api.getCompras(),
        api.getFornecedores(),
        api.getProdutos()
      ]);

      this.state.items = Array.isArray(compras) ? compras : [];
      this.state.filteredItems = [...this.state.items];
      this.state.fornecedores = Array.isArray(fornecedores) ? fornecedores : [];
      this.state.produtos = Array.isArray(produtos) ? produtos : [];

      this.render();
      this.cache();
      this.renderTable();
      this.setFeedback('', '');
    } catch (error) {
      console.error('Erro ao carregar compras:', error);

      this.state.items = [];
      this.state.filteredItems = [];
      this.state.fornecedores = [];
      this.state.produtos = [];

      this.render();
      this.cache();
      this.renderTable();
      const message = this.buildFriendlyError(error);
      this.setFeedback(message, 'error');
    } finally {
      this.state.loading = false;
    }
  },

  render() {
    const c = document.getElementById('comprasContainer');
    if (!c) return;

    c.innerHTML = `
      <section class="module-card">
        <div id="comprasFeedback" class="module-feedback"></div>

        <div class="module-card__header">
          <div>
            <h3>Compras</h3>
            <p>Lançamentos, histórico, estoque e financeiro vinculados</p>
          </div>

          <div class="module-card__actions">
            <button class="btn btn-light" id="importarXmlBtn" type="button" title="Importar NF do fornecedor (XML)">
              <i class="fa-solid fa-file-import"></i>
              Importar XML
            </button>
            <button class="btn btn-primary" id="novaCompraBtn" type="button">
              <i class="fa-solid fa-plus"></i>
              Nova Compra
            </button>
          </div>
          <input type="file" id="xmlNFInput" accept=".xml" style="display:none"/>
        </div>

        <div class="module-toolbar">
          <div class="module-toolbar__search">
            <i class="fa-solid fa-search"></i>
            <input
              id="comprasSearch"
              placeholder="Buscar por fornecedor, data ou número da compra..."
              value="${escapeHtml(this.getCurrentSearchValue())}"
            />
          </div>

          <div class="module-toolbar__stats">
            <div class="mini-stat">
              <span>Total</span>
              <strong>${this.state.items.length}</strong>
            </div>

            <div class="mini-stat">
              <span>Valor</span>
              <strong>${formatCurrency(this.getTotalCompras())}</strong>
            </div>

            <div class="mini-stat">
              <span>Fornecedores</span>
              <strong>${this.getTotalFornecedores()}</strong>
            </div>
          </div>
        </div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Compra</th>
                <th>Fornecedor</th>
                <th>Data</th>
                <th>Status</th>
                <th class="text-right">Total</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody id="comprasTable"></tbody>
          </table>
        </div>
      </section>

      <div class="modal-overlay hidden" id="compraModal">
        <div class="modal-card modal-card--large">
          <div class="modal-card__header">
            <div>
              <h3>Nova compra</h3>
              <p>Lance a compra e atualize automaticamente estoque e financeiro.</p>
            </div>

            <button type="button" class="icon-button" id="cancelCompra" aria-label="Fechar">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <form id="compraForm" class="form-grid">
            <div class="form-field">
              <label for="compraFornecedor">Fornecedor</label>
              <select id="compraFornecedor" class="filter-input" required>
                <option value="">Selecione...</option>
                ${this.state.fornecedores
                  .map(
                    (f) => `
                  <option value="${f.id}">
                    ${escapeHtml(f.nome)}
                  </option>
                `
                  )
                  .join('')}
              </select>
            </div>

            <div class="form-field">
              <label for="compraData">Data da compra</label>
              <input type="date" id="compraData" class="filter-input" value="${getTodayDate()}" required />
            </div>

            <div class="form-field">
              <label for="compraFormaPagamento">Forma de pagamento</label>
              <select id="compraFormaPagamento" class="filter-input" required>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Pix">Pix</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Boleto">Boleto</option>
                <option value="Promissoria">Promissória</option>
              </select>
            </div>

            <div class="form-field">
              <label for="compraParcelas">Parcelas</label>
              <input type="number" id="compraParcelas" min="1" value="1" />
            </div>

            <div class="form-field hidden" id="compraPrimeiroVencimentoField">
              <label for="compraPrimeiroVencimento">Primeiro vencimento</label>
              <input type="date" id="compraPrimeiroVencimento" class="filter-input" />
            </div>

            <div class="form-field form-field--span-2">
              <label for="compraObservacao">Observação</label>
              <textarea id="compraObservacao" placeholder="Observações internas da compra"></textarea>
            </div>

            <div class="form-field">
              <label for="compraProduto">Produto</label>
              <select id="compraProduto">
                <option value="">Selecione...</option>
                ${this.state.produtos
                  .map(
                    (p) => `
                  <option value="${p.id}" data-custo="${Number(p.custo || 0)}">
                    ${escapeHtml(p.nome)}
                  </option>
                `
                  )
                  .join('')}
              </select>
            </div>

            <div class="form-field">
              <label for="compraQuantidade">Quantidade</label>
              <input type="number" id="compraQuantidade" min="1" value="1" />
            </div>

            <div class="form-field">
              <label for="compraCustoUnitario">Custo unitário</label>
              <input type="number" id="compraCustoUnitario" min="0" step="0.01" value="0" />
            </div>

            <div class="form-field">
              <label>&nbsp;</label>
              <button type="button" class="btn btn-light" id="addItemCompraBtn">
                <i class="fa-solid fa-plus"></i>
                Adicionar item
              </button>
            </div>

            <div class="form-field form-field--span-2">
              <div class="table-wrapper">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Qtd.</th>
                      <th>Custo unit.</th>
                      <th class="text-right">Subtotal</th>
                      <th class="text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody id="compraItensTable"></tbody>
                </table>
              </div>
            </div>

            <div class="form-field form-field--span-2">
              <div class="compra-total-box">
                <span>Total da compra</span>
                <strong id="compraTotalValor">R$ 0,00</strong>
              </div>
            </div>

            <div class="form-field form-field--span-2">
              <div class="modal-card__footer">
                <button type="button" class="btn btn-light" id="cancelCompraFooter">
                  Cancelar
                </button>

                <button type="submit" class="btn btn-primary">
                  <i class="fa-solid fa-check"></i>
                  Salvar compra
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    this.injectProfessionalStyles();
  },

  renderTable() {
    this.cache();

    if (!this.el.table) return;

    if (!this.state.filteredItems.length) {
      this.el.table.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-table-state">
              <strong>Nenhuma compra encontrada</strong>
              <span>Cadastre uma nova compra para movimentar estoque e financeiro.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    this.el.table.innerHTML = this.state.filteredItems
      .map((item) => {
        const id = Number(item.id || 0);
        const fornecedor = item.fornecedor_nome || item.fornecedor || 'Fornecedor não informado';
        const data = formatDate(item.data);
        const total = formatCurrency(item.total || 0);
        const status = item.status || 'finalizada';

        return `
        <tr>
          <td>
            <div class="table-primary">
              <strong>#${id}</strong>
              <small>Compra registrada</small>
            </div>
          </td>

          <td>
            <div class="table-primary">
              <strong>${escapeHtml(fornecedor)}</strong>
              <small>Fornecedor</small>
            </div>
          </td>

          <td>${data}</td>

          <td>
            <span class="badge badge--success">
              ${escapeHtml(capitalize(status))}
            </span>
          </td>

          <td class="text-right">
            <strong>${total}</strong>
          </td>

          <td class="text-right">
            <div class="table-actions">
              <button class="btn-inline" data-action="view-compra" data-id="${id}" type="button">
                <i class="fa-solid fa-eye"></i>
                Detalhes
              </button>

              <button class="btn-inline" data-action="edit-compra" data-id="${id}" type="button">
                <i class="fa-solid fa-pen"></i>
                Editar
              </button>

              <button class="btn-inline btn-inline--danger" data-action="delete-compra" data-id="${id}" type="button">
                <i class="fa-solid fa-trash"></i>
                Excluir
              </button>
            </div>
          </td>
        </tr>
      `;
      })
      .join('');
  },

  search(value) {
    const termo = String(value || '')
      .trim()
      .toLowerCase();

    if (!termo) {
      this.state.filteredItems = [...this.state.items];
      this.renderTable();
      return;
    }

    this.state.filteredItems = this.state.items.filter((item) => {
      const texto = [
        item.id,
        item.fornecedor_nome,
        item.fornecedor,
        item.data,
        item.total,
        item.status,
        item.observacao
      ]
        .join(' ')
        .toLowerCase();

      return texto.includes(termo);
    });

    this.renderTable();
  },

  openModal() {
    this.cache();

    this.state.itensCompra = [];

    if (this.el.form) {
      this.el.form.reset();
    }

    if (this.el.data) {
      this.el.data.value = getTodayDate();
    }

    if (this.el.parcelas) {
      this.el.parcelas.value = '1';
    }

    if (this.el.custoUnitario) {
      this.el.custoUnitario.value = '0';
    }

    if (this.el.quantidade) {
      this.el.quantidade.value = '1';
    }

    this.renderItensCompra();
    this.toggleVencimentoField();

    if (this.el.modal) {
      this.el.modal.classList.remove('hidden');
    }
  },

  async openEditModal(id) {
    try {
      this.showMessage('Carregando compra...', 'info');
      const compra = await api.getCompraDetalhe(id);

      this.state.editingId = Number(id);
      this.state.itensCompra = (compra.itens || []).map(i => ({
        produto_id: i.produto_id,
        produto_nome: i.produto_nome,
        quantidade: Number(i.quantidade),
        custo_unitario: Number(i.custo_unitario || 0),
        subtotal: Number(i.subtotal || 0)
      }));

      this.openModal();

      setTimeout(() => {
        if (this.el.fornecedor) this.el.fornecedor.value = compra.compra?.fornecedor_id || '';
        if (this.el.data) this.el.data.value = (compra.compra?.data || '').slice(0, 10);
        if (this.el.formaPagamento) this.el.formaPagamento.value = compra.compra?.pagamento || '';
        if (this.el.parcelas) this.el.parcelas.value = compra.compra?.total_parcelas || 1;
        if (this.el.observacao) this.el.observacao.value = compra.compra?.observacao || '';
        this.toggleVencimentoField();
        this.renderItensCompra();

        const titulo = document.querySelector('#compraModal h2, #compraModal .modal-title');
        if (titulo) titulo.textContent = `Editar Compra #${id}`;
      }, 50);
    } catch (error) {
      this.showMessage('Erro ao carregar compra para edição.', 'error');
    }
  },

  closeModal() {
    this.cache();

    if (this.el.modal) {
      this.el.modal.classList.add('hidden');
    }

    this.state.itensCompra = [];
    this.state.editingId = null;

    const titulo = document.querySelector('#compraModal h2, #compraModal .modal-title');
    if (titulo) titulo.textContent = 'Nova Compra';
  },

  toggleVencimentoField() {
    const formaPagamento = document.getElementById('compraFormaPagamento')?.value || '';
    const field = document.getElementById('compraPrimeiroVencimentoField');

    const exigeVencimento =
      formaPagamento.toLowerCase() === 'boleto' ||
      formaPagamento.toLowerCase() === 'promissoria' ||
      formaPagamento.toLowerCase() === 'promissória';

    if (field) {
      field.classList.toggle('hidden', !exigeVencimento);
    }

    const primeiroVencimento = document.getElementById('compraPrimeiroVencimento');
    if (primeiroVencimento && exigeVencimento && !primeiroVencimento.value) {
      primeiroVencimento.value = getTodayDate();
    }
  },

  addItem() {
    this.cache();

    const produtoId = Number(this.el.produto?.value || 0);
    const quantidade = Number(this.el.quantidade?.value || 0);
    const custoUnitario = Number(this.el.custoUnitario?.value || 0);

    if (!produtoId) {
      this.showMessage('Selecione um produto.', 'error');
      return;
    }

    if (!quantidade || quantidade <= 0) {
      this.showMessage('Informe uma quantidade válida.', 'error');
      return;
    }

    if (custoUnitario < 0) {
      this.showMessage('Informe um custo válido.', 'error');
      return;
    }

    const produto = this.state.produtos.find((p) => Number(p.id) === produtoId);

    if (!produto) {
      this.showMessage('Produto não encontrado.', 'error');
      return;
    }

    const existente = this.state.itensCompra.find((item) => Number(item.produto_id) === produtoId);

    if (existente) {
      existente.quantidade += quantidade;
      existente.custo_unitario = custoUnitario;
      existente.subtotal = Number((existente.quantidade * existente.custo_unitario).toFixed(2));
    } else {
      this.state.itensCompra.push({
        produto_id: produtoId,
        produto_nome: produto.nome,
        quantidade,
        custo_unitario: custoUnitario,
        subtotal: Number((quantidade * custoUnitario).toFixed(2))
      });
    }

    if (this.el.produto) this.el.produto.value = '';
    if (this.el.quantidade) this.el.quantidade.value = '1';
    if (this.el.custoUnitario) this.el.custoUnitario.value = '0';

    this.renderItensCompra();
  },

  removeItem(index) {
    const idx = Number(index);

    if (!Number.isInteger(idx) || idx < 0) return;

    this.state.itensCompra.splice(idx, 1);
    this.renderItensCompra();
  },

  renderItensCompra() {
    this.cache();

    if (!this.el.itensTable) return;

    if (!this.state.itensCompra.length) {
      this.el.itensTable.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-table-state compact">
              Nenhum item adicionado.
            </div>
          </td>
        </tr>
      `;
    } else {
      this.el.itensTable.innerHTML = this.state.itensCompra
        .map(
          (item, index) => `
        <tr>
          <td>
            <strong>${escapeHtml(item.produto_nome)}</strong>
          </td>
          <td>${Number(item.quantidade || 0)}</td>
          <td>${formatCurrency(item.custo_unitario || 0)}</td>
          <td class="text-right">
            <strong>${formatCurrency(item.subtotal || 0)}</strong>
          </td>
          <td class="text-right">
            <button
              type="button"
              class="btn-inline btn-inline--danger"
              data-action="remove-item-compra"
              data-index="${index}"
            >
              Remover
            </button>
          </td>
        </tr>
      `
        )
        .join('');
    }

    const total = this.getTotalItensCompra();

    if (this.el.totalCompra) {
      this.el.totalCompra.textContent = formatCurrency(total);
    }
  },

  getTotalItensCompra() {
    return this.state.itensCompra.reduce((acc, item) => {
      return acc + Number(item.subtotal || 0);
    }, 0);
  },

  async save() {
    this.cache();

    const fornecedorId = Number(this.el.fornecedor?.value || 0);
    const data = this.el.data?.value || '';
    const pagamento = this.el.formaPagamento?.value || '';
    const parcelas = Number(this.el.parcelas?.value || 1);
    const primeiroVencimento = this.el.primeiroVencimento?.value || '';
    const observacao = this.el.observacao?.value || '';

    if (!fornecedorId) {
      this.showMessage('Selecione o fornecedor.', 'error');
      return;
    }

    if (!data) {
      this.showMessage('Informe a data da compra.', 'error');
      return;
    }

    if (!pagamento) {
      this.showMessage('Informe a forma de pagamento.', 'error');
      return;
    }

    if (!this.state.itensCompra.length) {
      this.showMessage('Adicione pelo menos um item à compra.', 'error');
      return;
    }

    const payload = {
      fornecedor_id: fornecedorId,
      data,
      pagamento,
      parcelas: Math.max(1, parcelas || 1),
      primeiro_vencimento: primeiroVencimento || data,
      observacao,
      itens: this.state.itensCompra.map((item) => ({
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        custo_unitario: item.custo_unitario
      }))
    };

    try {
      if (this.state.editingId) {
        await api.updateCompra(this.state.editingId, payload);
        this.showMessage('Compra atualizada com sucesso.', 'success');
      } else {
        await api.createCompra(payload);
        this.showMessage('Compra cadastrada com sucesso.', 'success');
      }

      this.state.editingId = null;
      this.closeModal();
      await this.load();
    } catch (error) {
      console.error('Erro ao salvar compra:', error);
      const message = this.buildFriendlyError(error);
      this.setFeedback(message, 'error');
    }
  },

  async remove(id) {
    const confirmar = await confirmarAcao('Excluir esta compra? O estoque e as contas vinculadas serão ajustados.', 'Excluir', 'danger');

    if (!confirmar) return;

    try {
      await api.deleteCompra(id);
      this.showMessage('Compra excluída com sucesso.', 'success');
      await this.load();
    } catch (error) {
      console.error('Erro ao excluir compra:', error);
      const message = this.buildFriendlyError(error);
      this.setFeedback(message, 'error');
    }
  },

  async showDetails(id) {
    try {
      const detalhe = await api.getCompraDetalhe(id);
      this.renderDetailsModal(detalhe);
    } catch (error) {
      console.error('Erro ao carregar detalhe da compra:', error);
      const message = this.buildFriendlyError(error);
      this.setFeedback(message, 'error');
    }
  },

  renderDetailsModal(compra) {
    const modalExistente = document.getElementById('compraDetalheModal');
    if (modalExistente) modalExistente.remove();

    const itens = Array.isArray(compra?.itens) ? compra.itens : [];
    const contas = Array.isArray(compra?.contas_pagar) ? compra.contas_pagar : [];

    const modal = document.createElement('div');
    modal.id = 'compraDetalheModal';
    modal.className = 'modal-overlay compra-detail-overlay';

    modal.innerHTML = `
      <div class="modal-card compra-detail-card">
        <div class="compra-detail-header">
          <div>
            <span class="compra-detail-eyebrow">Compra #${escapeHtml(compra?.id || '-')}</span>
            <h3>Detalhes da compra</h3>
            <p>${escapeHtml(compra?.fornecedor_nome || 'Fornecedor não informado')}</p>
          </div>

          <button type="button" class="icon-button" id="fecharCompraDetalhe" aria-label="Fechar">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="compra-detail-body">
          <section class="compra-detail-summary">
            <article class="compra-detail-summary__main">
              <span>Total da compra</span>
              <strong>${formatCurrency(compra?.total || 0)}</strong>
              <small>${formatDate(compra?.data)}</small>
            </article>

            <article>
              <span>Pagamento</span>
              <strong>${escapeHtml(compra?.pagamento || compra?.forma_pagamento || '-')}</strong>
            </article>

            <article>
              <span>Parcelas</span>
              <strong>${escapeHtml(compra?.parcelas || 1)}x</strong>
            </article>

            <article>
              <span>Status</span>
              <strong>${escapeHtml(capitalize(compra?.status || 'finalizada'))}</strong>
            </article>
          </section>

          <section class="compra-detail-note">
            <span>Observação</span>
            <p>${escapeHtml(compra?.observacao || 'Nenhuma observação registrada.')}</p>
          </section>

          <section class="compra-detail-section">
            <div class="compra-detail-section__header">
              <div>
                <h4>Itens da compra</h4>
                <p>Produtos vinculados a esta entrada de estoque</p>
              </div>
              <span>${itens.length} item(ns)</span>
            </div>

            <div class="compra-detail-list">
              ${
                itens.length
                  ? itens
                      .map(
                        (item) => `
                    <div class="compra-detail-row">
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

          <section class="compra-detail-section">
            <div class="compra-detail-section__header">
              <div>
                <h4>Contas a pagar</h4>
                <p>Parcelas financeiras vinculadas à compra</p>
              </div>
              <span>${contas.length} parcela(s)</span>
            </div>

            <div class="compra-detail-list">
              ${
                contas.length
                  ? contas
                      .map(
                        (conta) => `
                    <div class="compra-detail-row">
                      <div>
                        <strong>Parcela ${Number(conta.parcela || 1)}/${Number(conta.total_parcelas || 1)}</strong>
                        <small>Vencimento: ${formatDate(conta.data_vencimento)}</small>
                      </div>

                      <div>
                        <span>Status</span>
                        <strong>${escapeHtml(capitalize(conta.status || 'pendente'))}</strong>
                      </div>

                      <div>
                        <span>Valor</span>
                        <strong>${formatCurrency(conta.valor || 0)}</strong>
                      </div>
                    </div>
                  `
                      )
                      .join('')
                  : `<div class="empty-detail-state">Nenhuma conta a pagar gerada.</div>`
              }
            </div>
          </section>
        </div>

        <div class="compra-detail-footer">
          <button type="button" class="btn btn-light" id="fecharCompraDetalheFooter">
            Fechar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('fecharCompraDetalhe')?.addEventListener('click', () => modal.remove());
    document
      .getElementById('fecharCompraDetalheFooter')
      ?.addEventListener('click', () => modal.remove());

    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.remove();
    });
  },

  setFeedback(message, type = 'info') {
    const feedback = document.getElementById('comprasFeedback');
    if (!feedback) return;

    feedback.textContent = message || '';
    feedback.className = `module-feedback ${message ? `module-feedback--${type}` : ''}`;
  },

  showMessage(message, type = 'info') {
    this.setFeedback(message, type);

    showToast(message, type);
  },

  setLoading(value) {
    this.cache();

    if (this.el.search) this.el.search.disabled = value;

    const btnNova = document.getElementById('novaCompraBtn');
    if (btnNova) btnNova.disabled = value;

    if (btnNova) {
      btnNova.innerHTML = value
        ? '<i class="fa-solid fa-spinner fa-spin"></i> Carregando...'
        : '<i class="fa-solid fa-plus"></i> Nova Compra';
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
  },

  getCurrentSearchValue() {
    return document.getElementById('comprasSearch')?.value || '';
  },

  getTotalCompras() {
    return this.state.items.reduce((acc, item) => acc + Number(item.total || 0), 0);
  },

  getTotalFornecedores() {
    const fornecedores = new Set(
      this.state.items.map((item) => item.fornecedor_nome || item.fornecedor).filter(Boolean)
    );

    return fornecedores.size;
  },

  injectProfessionalStyles() {
    if (document.getElementById('comprasProfessionalStyles')) return;

    const style = document.createElement('style');
    style.id = 'comprasProfessionalStyles';
    style.textContent = `
      .compra-total-box {
        border: 1px solid var(--border);
        background: linear-gradient(135deg, var(--surface-2), var(--surface));
        border-radius: 18px;
        padding: 18px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .compra-total-box span {
        color: var(--text-muted);
        font-weight: 800;
        font-size: 0.9rem;
      }

      .compra-total-box strong {
        color: var(--text);
        font-size: 1.55rem;
        font-weight: 800;
        letter-spacing: -0.04em;
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

      .empty-table-state.compact {
        min-height: 60px;
        font-weight: 700;
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

      .compra-detail-overlay {
        padding: 18px;
        align-items: center;
      }

      .compra-detail-card {
        width: min(100%, 760px);
        max-height: calc(100vh - 36px);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        border-radius: 26px;
        padding: 0;
      }

      .compra-detail-header {
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

      .compra-detail-eyebrow {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        padding: 5px 10px;
        margin-bottom: 8px;
        border-radius: 999px;
        background: var(--primary-soft);
        color: var(--primary-hover);
        font-size: 0.74rem;
        font-weight: 800;
      }

      .compra-detail-header h3 {
        font-size: 1.28rem;
        font-weight: 800;
        letter-spacing: -0.04em;
        color: var(--text);
        margin-bottom: 4px;
      }

      .compra-detail-header p {
        color: var(--text-muted);
        font-size: 0.9rem;
        font-weight: 600;
      }

      .compra-detail-body {
        padding: 18px 22px;
        display: grid;
        gap: 14px;
        overflow-y: auto;
      }

      .compra-detail-summary {
        display: grid;
        grid-template-columns: 1.25fr repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .compra-detail-summary article,
      .compra-detail-note {
        border: 1px solid var(--border);
        background: var(--surface-2);
        border-radius: 18px;
        padding: 14px 16px;
        min-width: 0;
      }

      .compra-detail-summary article span,
      .compra-detail-note span {
        display: block;
        color: var(--text-muted);
        font-size: 0.76rem;
        font-weight: 800;
        margin-bottom: 6px;
      }

      .compra-detail-summary article strong {
        display: block;
        color: var(--text);
        font-size: 0.98rem;
        font-weight: 800;
        line-height: 1.25;
        word-break: break-word;
      }

      .compra-detail-summary__main strong {
        font-size: 1.35rem !important;
        letter-spacing: -0.04em;
      }

      .compra-detail-summary article small {
        display: block;
        margin-top: 6px;
        color: var(--text-muted);
        font-weight: 700;
      }

      .compra-detail-note {
        padding: 12px 16px;
      }

      .compra-detail-note p {
        color: var(--text);
        font-weight: 700;
        line-height: 1.45;
      }

      .compra-detail-section {
        border: 1px solid var(--border);
        border-radius: 20px;
        background: var(--surface);
        overflow: hidden;
      }

      .compra-detail-section__header {
        padding: 13px 16px;
        background: var(--surface-2);
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
      }

      .compra-detail-section__header h4 {
        color: var(--text);
        font-size: 0.98rem;
        font-weight: 800;
        margin-bottom: 3px;
      }

      .compra-detail-section__header p {
        color: var(--text-muted);
        font-size: 0.82rem;
        font-weight: 600;
      }

      .compra-detail-section__header > span {
        flex-shrink: 0;
        border-radius: 999px;
        background: var(--surface);
        border: 1px solid var(--border);
        color: var(--text-muted);
        padding: 7px 10px;
        font-size: 0.78rem;
        font-weight: 800;
      }

      .compra-detail-list {
        display: grid;
      }

      .compra-detail-row {
        display: grid;
        grid-template-columns: 1.4fr 0.8fr 0.8fr;
        gap: 14px;
        align-items: center;
        padding: 13px 16px;
        border-bottom: 1px solid var(--border);
      }

      .compra-detail-row:last-child {
        border-bottom: none;
      }

      .compra-detail-row strong {
        color: var(--text);
        font-size: 0.92rem;
        font-weight: 800;
      }

      .compra-detail-row small,
      .compra-detail-row span {
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

      .compra-detail-footer {
        padding: 14px 22px 18px;
        border-top: 1px solid var(--border);
        display: flex;
        justify-content: flex-end;
        background: var(--surface);
      }

      @media (max-width: 820px) {
        .compra-detail-summary {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .compra-detail-row {
          grid-template-columns: 1fr;
          gap: 8px;
        }
      }

      @media (max-width: 560px) {
        .compra-detail-overlay {
          padding: 10px;
          align-items: flex-start;
        }

        .compra-detail-card {
          max-height: calc(100vh - 20px);
          border-radius: 20px;
        }

        .compra-detail-summary {
          grid-template-columns: 1fr;
        }

        .compra-detail-body {
          padding: 14px;
        }
      }
    `;

    document.head.appendChild(style);
  },

  // ── Import XML NF de Fornecedor ────────────────────────────────────────────

  async importarXML(file) {
    const btn = document.getElementById('importarXmlBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }

    try {
      const conteudo = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload  = (e) => res(e.target.result);
        reader.onerror = () => rej(new Error('Erro ao ler arquivo'));
        reader.readAsText(file, 'utf-8');
      });

      const data = await api.importarXmlNF(conteudo);
      this.renderModalXML(data);
    } catch (err) {
      showToast(err?.message || 'Erro ao processar XML', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-file-import"></i> Importar XML'; }
    }
  },

  renderModalXML(data) {
    const existing = document.getElementById('_xmlNFModal');
    if (existing) existing.remove();

    const esc = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const cur = (v) => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

    const fornecedorOptions = this.state.fornecedores.map(f =>
      `<option value="${f.id}" ${f.id === data.fornecedor_id ? 'selected' : ''}>${esc(f.nome)}</option>`
    ).join('');

    const itensHTML = (data.itens || []).map((item, idx) => `
      <tr>
        <td style="font-size:.82rem">${esc(item.nome)}</td>
        <td style="text-align:center">${item.quantidade}</td>
        <td style="text-align:right">${cur(item.custo_unitario)}</td>
        <td style="text-align:right"><strong>${cur(item.total)}</strong></td>
        <td>
          <select class="input xml-produto-select" style="font-size:.8rem;padding:4px 8px" data-idx="${idx}">
            <option value="">— Vincular produto —</option>
            ${this.state.produtos.map(p =>
              `<option value="${p.id}">${esc(p.nome)}</option>`
            ).join('')}
          </select>
        </td>
      </tr>`).join('');

    const overlay = document.createElement('div');
    overlay.id = '_xmlNFModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,23,.55);z-index:3500;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto';

    overlay.innerHTML = `
      <div style="background:var(--surface);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);width:100%;max-width:860px;max-height:90vh;overflow-y:auto">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--border)">
          <div>
            <h3 style="margin:0;font-size:1rem;font-weight:700">Importar NF do Fornecedor</h3>
            <p style="margin:4px 0 0;font-size:.83rem;color:var(--text-muted)">NF-e nº ${esc(data.numero_nf || '—')} · ${esc(data.data_emissao || '—')} · Total: ${cur(data.total)}</p>
          </div>
          <button id="_xmlFechar" class="modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div style="padding:22px;display:grid;gap:18px">

          ${!data.fornecedor_id ? `<div class="module-feedback module-feedback--info" style="margin:0">
            CNPJ ${esc(data.fornecedor_cnpj)} não encontrado na base. Selecione um fornecedor abaixo ou cadastre-o primeiro.
          </div>` : `<div class="module-feedback module-feedback--success" style="margin:0">
            Fornecedor identificado: <strong>${esc(data.fornecedor_nome)}</strong>
          </div>`}

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <div class="form-field">
              <label>Fornecedor <span style="color:var(--danger)">*</span></label>
              <select id="_xmlFornecedor" class="input" required>
                <option value="">Selecionar...</option>
                ${fornecedorOptions}
              </select>
            </div>
            <div class="form-field">
              <label>Data</label>
              <input id="_xmlData" class="input" type="date" value="${esc(data.data_emissao || '')}" />
            </div>
            <div class="form-field">
              <label>Forma de Pagamento</label>
              <select id="_xmlForma" class="input">
                ${['dinheiro','boleto','pix','transferencia','cartao credito','cartao debito','cheque','promissoria'].map(f =>
                  `<option value="${f}" ${f === data.forma_pagamento ? 'selected' : ''}>${f.charAt(0).toUpperCase()+f.slice(1)}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-field">
              <label>Observação</label>
              <input id="_xmlObs" class="input" placeholder="Ex: NF ${esc(data.numero_nf)}" value="NF ${esc(data.numero_nf)}" />
            </div>
          </div>

          <div>
            <h4 style="font-size:.9rem;font-weight:700;margin-bottom:10px">Itens da NF (${(data.itens||[]).length})</h4>
            <p style="font-size:.8rem;color:var(--text-muted);margin-bottom:10px">Vincule cada item da NF a um produto do seu cadastro. Itens sem vínculo serão ignorados.</p>
            <div class="table-wrapper">
              <table class="data-table" style="font-size:.85rem">
                <thead>
                  <tr><th>Produto na NF</th><th>Qtd</th><th class="text-right">Unit</th><th class="text-right">Total</th><th>Produto no sistema</th></tr>
                </thead>
                <tbody>${itensHTML}</tbody>
              </table>
            </div>
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:8px;border-top:1px solid var(--border)">
            <button class="btn btn-light" id="_xmlCancelar">Cancelar</button>
            <button class="btn btn-primary" id="_xmlConfirmar">
              <i class="fa-solid fa-basket-shopping"></i> Criar Compra
            </button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    document.getElementById('_xmlFechar').onclick  = () => overlay.remove();
    document.getElementById('_xmlCancelar').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    document.getElementById('_xmlConfirmar').onclick = async () => {
      const fornecedorId = Number(document.getElementById('_xmlFornecedor').value);
      const dataVal      = document.getElementById('_xmlData').value;
      const formaVal     = document.getElementById('_xmlForma').value;
      const obsVal       = document.getElementById('_xmlObs').value;

      if (!fornecedorId) { showToast('Selecione o fornecedor.', 'error'); return; }
      if (!dataVal)      { showToast('Informe a data da compra.', 'error'); return; }

      // Coleta itens vinculados
      const itensVinculados = [];
      overlay.querySelectorAll('.xml-produto-select').forEach((sel, idx) => {
        if (!sel.value) return;
        const item = data.itens[idx];
        itensVinculados.push({
          produto_id:    Number(sel.value),
          quantidade:    item.quantidade,
          custo_unitario: item.custo_unitario
        });
      });

      if (!itensVinculados.length) { showToast('Vincule pelo menos um item a um produto.', 'error'); return; }

      const btn = document.getElementById('_xmlConfirmar');
      btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando...';

      try {
        await api.createCompra({
          fornecedor_id: fornecedorId,
          data: dataVal,
          pagamento: formaVal,
          observacao: obsVal,
          itens: itensVinculados
        });
        showToast('Compra criada com sucesso a partir da NF!', 'success');
        overlay.remove();
        await this.load();
      } catch (err) {
        showToast(err?.message || 'Erro ao criar compra', 'error');
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-basket-shopping"></i> Criar Compra';
      }
    };
  }
};

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

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
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

export function initComprasModule() {
  ComprasModule.init();
  return ComprasModule.load();
}

export default ComprasModule;
