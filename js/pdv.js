import api from './api.js';
import { getAuth } from './auth.js';
import { showToast } from './feedback.js';

const PDVModule = {
  state: {
    initialized: false,
    empresa: null,
    clientes: [],
    produtos: [],
    produtosFiltrados: [],
    carrinho: [],
    clienteId: '',
    clienteNome: '',
    pagamento: 'Dinheiro',
    parcelas: 1,
    primeiroVencimento: '',
    desconto: 0,
    acrescimo: 0,
    observacao: '',
    salvando: false
  },

  init() {
    this.resolveEmpresa();
    this.render();
    this.cache();
    this.bindLocalEvents();
  },

  resolveEmpresa() {
    const auth = getAuth();
    this.state.empresa = auth?.empresa?.nome || auth?.user?.empresa || 'LF ERP';
  },

  cache() {
    this.el = {
      container: document.getElementById('pdvContainer'),
      clienteSelect: document.getElementById('pdvCliente'),
      clienteNomeInfo: document.getElementById('pdvClienteNomeInfo'),
      buscaProduto: document.getElementById('pdvBuscaProduto'),
      listaProdutos: document.getElementById('pdvListaProdutos'),
      carrinhoBody: document.getElementById('pdvCarrinhoBody'),
      emptyCarrinho: document.getElementById('pdvCarrinhoEmpty'),
      pagamento: document.getElementById('pdvPagamento'),
      parcelas: document.getElementById('pdvParcelas'),
      primeiroVencimento: document.getElementById('pdvPrimeiroVencimento'),
      desconto: document.getElementById('pdvDesconto'),
      acrescimo: document.getElementById('pdvAcrescimo'),
      observacao: document.getElementById('pdvObservacao'),
      subtotal: document.getElementById('pdvSubtotal'),
      total: document.getElementById('pdvTotal'),
      totalItens: document.getElementById('pdvTotalItens'),
      formFeedback: document.getElementById('pdvFormFeedback'),
      finalizarBtn: document.getElementById('pdvFinalizarBtn'),
      limparBtn: document.getElementById('pdvLimparBtn'),
      atualizarBtn: document.getElementById('pdvAtualizarBtn')
    };
  },

  bindLocalEvents() {
    this.cache();

    this.el.buscaProduto?.addEventListener('input', (event) => {
      this.filterProdutos(event.target.value);
    });

    this.el.desconto?.addEventListener('input', (event) => {
      this.state.desconto = this.parseMoneyInput(event.target.value);
      this.renderResumo();
    });

    this.el.acrescimo?.addEventListener('input', (event) => {
      this.state.acrescimo = this.parseMoneyInput(event.target.value);
      this.renderResumo();
    });

    this.el.observacao?.addEventListener('input', (event) => {
      this.state.observacao = event.target.value || '';
    });

    this.el.clienteSelect?.addEventListener('change', (event) => {
      this.handleClienteChange(event.target.value);
    });

    this.el.pagamento?.addEventListener('change', (event) => {
      this.state.pagamento = event.target.value || 'Dinheiro';
      this.syncParcelasState();
      this.togglePrimeiroVencimentoField();
      this.renderResumo();
    });

    this.el.parcelas?.addEventListener('change', (event) => {
      this.state.parcelas = Number(event.target.value || 1);
    });

    this.el.primeiroVencimento?.addEventListener('change', (event) => {
      this.state.primeiroVencimento = event.target.value || '';
    });

    this.el.atualizarBtn?.addEventListener('click', async (event) => {
      event.preventDefault();
      await this.load();
    });

    this.el.limparBtn?.addEventListener('click', (event) => {
      event.preventDefault();
      this.resetVenda();
    });

    this.el.finalizarBtn?.addEventListener('click', async (event) => {
      event.preventDefault();
      await this.finalizarVenda();
    });

    this.el.listaProdutos?.addEventListener('click', (event) => {
      const button = event.target.closest("[data-action='pdv-add-produto']");
      if (!button) return;

      event.preventDefault();
      const id = Number(button.dataset.id);
      this.addProduto(id);
    });

    this.el.carrinhoBody?.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;

      event.preventDefault();

      if (button.dataset.action === 'pdv-remove-item') {
        const index = Number(button.dataset.index);
        this.removeItem(index);
        return;
      }

      if (button.dataset.action === 'pdv-qty-minus') {
        const index = Number(button.dataset.index);
        this.updateQuantidade(index, -1);
        return;
      }

      if (button.dataset.action === 'pdv-qty-plus') {
        const index = Number(button.dataset.index);
        this.updateQuantidade(index, 1);
      }
    });
  },

  async load() {
    this.resolveEmpresa();
    this.cache();

    if (!this.state.empresa) {
      this.setFeedback('Empresa não identificada para carregar o PDV.', 'error');
      return;
    }

    this.setLoading(true);
    this.setFeedback('Carregando dados do PDV...', 'info');

    try {
      const [clientes, produtos] = await Promise.all([this.fetchClientes(), this.fetchProdutos()]);

      this.state.clientes = Array.isArray(clientes) ? clientes : [];
      this.state.produtos = Array.isArray(produtos) ? produtos : [];
      this.state.produtosFiltrados = [...this.state.produtos];

      this.renderClientes();
      this.renderProdutos();
      this.renderCarrinho();
      this.renderResumo();
      this.togglePrimeiroVencimentoField();
      this.setFeedback('', 'info');
    } catch (error) {
      console.error('Erro ao carregar PDV:', error);

      this.state.clientes = [];
      this.state.produtos = [];
      this.state.produtosFiltrados = [];

      this.renderClientes();
      this.renderProdutos();
      this.renderCarrinho();
      this.renderResumo();

      const message = this.buildFriendlyError(error);
      this.setFeedback(message, 'error');
      showToast(message, 'error');
    } finally {
      this.setLoading(false);
    }
  },

  render() {
    const container = document.getElementById('pdvContainer');
    if (!container) return;

    container.innerHTML = `
      <section class="module-card">
        <div class="module-card__header">
          <div>
            <h3>PDV</h3>
            <p>Ponto de venda rápido e profissional</p>
          </div>

          <div class="module-card__actions">
            <button type="button" class="btn btn-light" id="pdvAtualizarBtn">
              <i class="fa-solid fa-rotate"></i>
              Atualizar
            </button>

            <button type="button" class="btn btn-light" id="pdvLimparBtn">
              <i class="fa-solid fa-broom"></i>
              Limpar venda
            </button>
          </div>
        </div>

        <div class="module-feedback" id="pdvFormFeedback"></div>

        <div class="pdv-grid">
          <div class="pdv-panel">
            <div class="pdv-panel__header">
              <h4>Cliente e produtos</h4>
              <p>Selecione o cliente, busque produtos e monte o carrinho.</p>
            </div>

            <div class="pdv-section">
              <div class="form-grid">
                <div class="form-field form-field--span-2">
                  <label for="pdvCliente">Cliente</label>
                  <select id="pdvCliente">
                    <option value="">Consumidor sem cadastro</option>
                  </select>
                  <small class="pdv-helper" id="pdvClienteNomeInfo">Nenhum cliente selecionado.</small>
                </div>

                <div class="form-field form-field--span-2">
                  <label for="pdvBuscaProduto">Buscar produto</label>
                  <input
                    type="text"
                    id="pdvBuscaProduto"
                    placeholder="Digite nome, categoria ou código de barras"
                  />
                </div>
              </div>
            </div>

            <div class="pdv-products">
              <div class="pdv-products__header">
                <h5>Produtos disponíveis</h5>
                <span class="pdv-helper">Clique em adicionar para incluir no carrinho.</span>
              </div>
              <div class="pdv-products__list" id="pdvListaProdutos"></div>
            </div>
          </div>

          <div class="pdv-panel">
            <div class="pdv-panel__header">
              <h4>Carrinho e fechamento</h4>
              <p>Revise os itens, informe o pagamento e finalize a venda.</p>
            </div>

            <div class="table-wrapper">
              <table class="data-table pdv-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Qtd</th>
                    <th>Preço</th>
                    <th>Total</th>
                    <th class="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody id="pdvCarrinhoBody"></tbody>
              </table>
            </div>

            <div class="empty-state hidden" id="pdvCarrinhoEmpty">
              Nenhum item no carrinho.
            </div>

            <div class="pdv-checkout">
              <div class="form-grid">
                <div class="form-field">
                  <label for="pdvPagamento">Forma de pagamento</label>
                  <select id="pdvPagamento">
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Pix">Pix</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Promissória">Promissória</option>
                  </select>
                </div>

                <div class="form-field">
                  <label for="pdvParcelas">Parcelas</label>
                  <select id="pdvParcelas">
                    <option value="1">1x</option>
                    <option value="2">2x</option>
                    <option value="3">3x</option>
                    <option value="4">4x</option>
                    <option value="5">5x</option>
                    <option value="6">6x</option>
                  </select>
                </div>

                <div class="form-field" id="pdvPrimeiroVencimentoField" style="display:none;">
                  <label for="pdvPrimeiroVencimento">Primeiro vencimento</label>
                  <input type="date" id="pdvPrimeiroVencimento" />
                </div>

                <div class="form-field">
                  <label for="pdvDesconto">Desconto</label>
                  <input type="number" min="0" step="0.01" id="pdvDesconto" value="0" />
                </div>

                <div class="form-field">
                  <label for="pdvAcrescimo">Acréscimo</label>
                  <input type="number" min="0" step="0.01" id="pdvAcrescimo" value="0" />
                </div>

                <div class="form-field form-field--span-2">
                  <label for="pdvObservacao">Observação</label>
                  <textarea
                    id="pdvObservacao"
                    placeholder="Informações adicionais da venda"
                  ></textarea>
                </div>
              </div>

              <div class="pdv-summary">
                <div class="pdv-summary__row">
                  <span>Itens</span>
                  <strong id="pdvTotalItens">0</strong>
                </div>

                <div class="pdv-summary__row">
                  <span>Subtotal</span>
                  <strong id="pdvSubtotal">R$ 0,00</strong>
                </div>

                <div class="pdv-summary__row pdv-summary__row--total">
                  <span>Total final</span>
                  <strong id="pdvTotal">R$ 0,00</strong>
                </div>
              </div>

              <div class="pdv-actions">
                <button type="button" class="btn btn-primary" id="pdvFinalizarBtn">
                  <i class="fa-solid fa-check"></i>
                  Finalizar venda
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    this.injectStyles();
  },

  injectStyles() {
    if (document.getElementById('pdv-inline-styles')) return;

    const style = document.createElement('style');
    style.id = 'pdv-inline-styles';
    style.textContent = `
      .pdv-grid {
        display: grid;
        grid-template-columns: 1.15fr 1fr;
        gap: 20px;
      }

      .pdv-panel {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 18px;
      }

      .pdv-panel__header {
        margin-bottom: 16px;
      }

      .pdv-panel__header h4 {
        font-size: 1.12rem;
        font-weight: 800;
        color: var(--text);
        margin-bottom: 6px;
      }

      .pdv-panel__header p,
      .pdv-helper {
        color: var(--text-muted);
        font-size: 0.9rem;
      }

      .pdv-section {
        margin-bottom: 18px;
      }

      .pdv-products {
        border-top: 1px solid var(--border);
        padding-top: 18px;
      }

      .pdv-products__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }

      .pdv-products__header h5 {
        font-size: 1rem;
        font-weight: 800;
        color: var(--text);
      }

      .pdv-products__list {
        display: grid;
        gap: 12px;
        max-height: 520px;
        overflow-y: auto;
        padding-right: 4px;
      }

      .pdv-product-card {
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 14px;
        background: var(--surface-2);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
      }

      .pdv-product-card__info {
        min-width: 0;
      }

      .pdv-product-card__info strong {
        display: block;
        color: var(--text);
        font-weight: 800;
        margin-bottom: 4px;
      }

      .pdv-product-card__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .pdv-chip {
        display: inline-flex;
        align-items: center;
        min-height: 28px;
        padding: 0 10px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text-soft);
        font-size: 0.8rem;
        font-weight: 700;
      }

      .pdv-table {
        min-width: 640px;
      }

      .pdv-qty {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .pdv-qty__value {
        min-width: 24px;
        text-align: center;
        font-weight: 800;
        color: var(--text);
      }

      .pdv-mini-btn {
        width: 30px;
        height: 30px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text-soft);
        display: inline-grid;
        place-items: center;
      }

      .pdv-mini-btn:hover {
        background: var(--surface-3);
        color: var(--text);
      }

      .pdv-checkout {
        margin-top: 18px;
        border-top: 1px solid var(--border);
        padding-top: 18px;
      }

      .pdv-summary {
        margin-top: 12px;
        border: 1px solid var(--border);
        border-radius: 18px;
        background: var(--surface-2);
        padding: 16px;
        display: grid;
        gap: 10px;
      }

      .pdv-summary__row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        color: var(--text-soft);
      }

      .pdv-summary__row strong {
        color: var(--text);
        font-weight: 800;
      }

      .pdv-summary__row--total {
        padding-top: 10px;
        border-top: 1px solid var(--border);
      }

      .pdv-summary__row--total span,
      .pdv-summary__row--total strong {
        font-size: 1.05rem;
      }

      .pdv-actions {
        margin-top: 16px;
        display: flex;
        justify-content: flex-end;
      }

      @media (max-width: 1100px) {
        .pdv-grid {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  },

  async fetchClientes() {
    return api.getClientes();
  },

  async fetchProdutos() {
    return api.getProdutos();
  },

  async postVenda(payload) {
    return api.createVenda(payload);
  },

  renderClientes() {
    this.cache();
    if (!this.el.clienteSelect) return;

    const currentValue = this.state.clienteId ? String(this.state.clienteId) : '';
    const options = [
      `<option value="">Consumidor sem cadastro</option>`,
      ...this.state.clientes.map((cliente) => {
        return `<option value="${cliente.id}">${this.escapeHtml(cliente.nome || 'Cliente')}</option>`;
      })
    ];

    this.el.clienteSelect.innerHTML = options.join('');
    this.el.clienteSelect.value = currentValue;

    this.updateClienteInfo();
  },

  renderProdutos() {
    this.cache();
    if (!this.el.listaProdutos) return;

    if (!this.state.produtosFiltrados.length) {
      this.el.listaProdutos.innerHTML = `
        <div class="empty-state">
          Nenhum produto encontrado.
        </div>
      `;
      return;
    }

    this.el.listaProdutos.innerHTML = this.state.produtosFiltrados
      .map((produto) => {
        const estoque = Number(produto.estoque || 0);
        const semEstoque = estoque <= 0;

        return `
          <div class="pdv-product-card">
            <div class="pdv-product-card__info">
              <strong>${this.escapeHtml(produto.nome || 'Produto')}</strong>
              <div class="pdv-product-card__meta">
                <span class="pdv-chip">Categoria: ${this.escapeHtml(produto.categoria || '-')}</span>
                <span class="pdv-chip">Preço: ${this.toCurrency(produto.preco)}</span>
                <span class="pdv-chip">Estoque: ${estoque}</span>
              </div>
            </div>

            <button
              type="button"
              class="btn ${semEstoque ? 'btn-light' : 'btn-primary'}"
              data-action="pdv-add-produto"
              data-id="${produto.id}"
              ${semEstoque ? 'disabled' : ''}
            >
              <i class="fa-solid fa-plus"></i>
              ${semEstoque ? 'Sem estoque' : 'Adicionar'}
            </button>
          </div>
        `;
      })
      .join('');
  },

  renderCarrinho() {
    this.cache();

    if (!this.el.carrinhoBody || !this.el.emptyCarrinho) return;

    if (!this.state.carrinho.length) {
      this.el.carrinhoBody.innerHTML = '';
      this.el.emptyCarrinho.classList.remove('hidden');
      return;
    }

    this.el.emptyCarrinho.classList.add('hidden');

    this.el.carrinhoBody.innerHTML = this.state.carrinho
      .map((item, index) => {
        const totalItem = Number(item.quantidade || 0) * Number(item.preco_unitario || 0);

        return `
          <tr>
            <td>
              <div class="table-primary">
                <strong>${this.escapeHtml(item.produto_nome || 'Produto')}</strong>
              </div>
            </td>

            <td>
              <div class="pdv-qty">
                <button type="button" class="pdv-mini-btn" data-action="pdv-qty-minus" data-index="${index}">
                  <i class="fa-solid fa-minus"></i>
                </button>
                <span class="pdv-qty__value">${Number(item.quantidade || 0)}</span>
                <button type="button" class="pdv-mini-btn" data-action="pdv-qty-plus" data-index="${index}">
                  <i class="fa-solid fa-plus"></i>
                </button>
              </div>
            </td>

            <td>${this.toCurrency(item.preco_unitario)}</td>
            <td>${this.toCurrency(totalItem)}</td>

            <td class="text-right">
              <button
                type="button"
                class="btn-inline btn-inline--danger"
                data-action="pdv-remove-item"
                data-index="${index}"
              >
                Remover
              </button>
            </td>
          </tr>
        `;
      })
      .join('');
  },

  renderResumo() {
    this.cache();

    const subtotal = this.getSubtotal();
    const totalItens = this.state.carrinho.reduce(
      (acc, item) => acc + Number(item.quantidade || 0),
      0
    );
    const desconto = Number(this.state.desconto || 0);
    const acrescimo = Number(this.state.acrescimo || 0);
    const total = Math.max(0, subtotal - desconto + acrescimo);

    if (this.el.subtotal) this.el.subtotal.textContent = this.toCurrency(subtotal);
    if (this.el.total) this.el.total.textContent = this.toCurrency(total);
    if (this.el.totalItens) this.el.totalItens.textContent = String(totalItens);

    this.syncParcelasState();
  },

  togglePrimeiroVencimentoField() {
    const field = document.getElementById('pdvPrimeiroVencimentoField');
    if (!field) return;

    const exibir = this.state.pagamento === 'Promissória';
    field.style.display = exibir ? 'block' : 'none';

    if (!exibir) {
      this.state.primeiroVencimento = '';
      if (this.el.primeiroVencimento) {
        this.el.primeiroVencimento.value = '';
      }
    }
  },

  handleClienteChange(clienteId) {
    this.state.clienteId = clienteId || '';

    const cliente = this.state.clientes.find((item) => String(item.id) === String(clienteId));
    this.state.clienteNome = cliente?.nome || '';

    this.updateClienteInfo();
  },

  updateClienteInfo() {
    this.cache();
    if (!this.el.clienteNomeInfo) return;

    if (!this.state.clienteId) {
      this.el.clienteNomeInfo.textContent = 'Nenhum cliente selecionado.';
      return;
    }

    this.el.clienteNomeInfo.textContent = `Cliente selecionado: ${this.state.clienteNome}`;
  },

  filterProdutos(term) {
    const normalized = String(term || '')
      .trim()
      .toLowerCase();

    if (!normalized) {
      this.state.produtosFiltrados = [...this.state.produtos];
    } else {
      this.state.produtosFiltrados = this.state.produtos.filter((produto) => {
        return [produto.nome, produto.categoria, produto.codigo_barras]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(normalized));
      });
    }

    this.renderProdutos();
  },

  addProduto(produtoId) {
    const produto = this.state.produtos.find((item) => Number(item.id) === Number(produtoId));
    if (!produto) {
      this.showMessage('Produto não encontrado.', 'error');
      return;
    }

    const estoqueDisponivel = Number(produto.estoque || 0);
    if (estoqueDisponivel <= 0) {
      this.showMessage(`O produto "${produto.nome}" está sem estoque.`, 'error');
      return;
    }

    const existenteIndex = this.state.carrinho.findIndex(
      (item) => Number(item.produto_id) === Number(produto.id)
    );

    if (existenteIndex >= 0) {
      const itemAtual = this.state.carrinho[existenteIndex];

      if (Number(itemAtual.quantidade || 0) + 1 > estoqueDisponivel) {
        this.showMessage(`Estoque insuficiente para "${produto.nome}".`, 'error');
        return;
      }

      this.state.carrinho[existenteIndex].quantidade += 1;
    } else {
      this.state.carrinho.push({
        produto_id: Number(produto.id),
        produto_nome: produto.nome,
        quantidade: 1,
        preco_unitario: Number(produto.preco || 0),
        custo_unitario: Number(produto.custo || 0)
      });
    }

    this.renderCarrinho();
    this.renderResumo();
    this.setFeedback('', 'info');
  },

  updateQuantidade(index, delta) {
    const item = this.state.carrinho[index];
    if (!item) return;

    const produto = this.state.produtos.find((prod) => Number(prod.id) === Number(item.produto_id));
    const estoqueDisponivel = Number(produto?.estoque || 0);
    const novaQuantidade = Number(item.quantidade || 0) + Number(delta || 0);

    if (novaQuantidade <= 0) {
      this.removeItem(index);
      return;
    }

    if (novaQuantidade > estoqueDisponivel) {
      this.showMessage(`Estoque insuficiente para "${item.produto_nome}".`, 'error');
      return;
    }

    this.state.carrinho[index].quantidade = novaQuantidade;
    this.renderCarrinho();
    this.renderResumo();
  },

  removeItem(index) {
    this.state.carrinho.splice(index, 1);
    this.renderCarrinho();
    this.renderResumo();
  },

  getSubtotal() {
    return this.state.carrinho.reduce((acc, item) => {
      return acc + Number(item.quantidade || 0) * Number(item.preco_unitario || 0);
    }, 0);
  },

  syncParcelasState() {
    this.cache();
    if (!this.el.parcelas) return;

    const pagamento = this.state.pagamento || 'Dinheiro';
    const permiteParcelas = pagamento === 'Promissória';

    this.el.parcelas.disabled = !permiteParcelas;

    if (!permiteParcelas) {
      this.state.parcelas = 1;
      this.el.parcelas.value = '1';
      return;
    }

    this.el.parcelas.value = String(this.state.parcelas || 1);
  },

  async finalizarVenda() {
    if (this.state.salvando) return;

    if (!this.state.carrinho.length) {
      this.showMessage('Adicione pelo menos um produto ao carrinho.', 'error');
      return;
    }

    const subtotal = this.getSubtotal();
    const desconto = Number(this.state.desconto || 0);
    const acrescimo = Number(this.state.acrescimo || 0);
    const total = Math.max(0, subtotal - desconto + acrescimo);

    if (total <= 0) {
      this.showMessage('O total da venda deve ser maior que zero.', 'error');
      return;
    }

    const pagamento = this.state.pagamento || 'Dinheiro';
    const ehPromissoria = pagamento === 'Promissória';
    const status_pagamento = ehPromissoria ? 'pendente' : 'pago';

    if (ehPromissoria && !this.state.primeiroVencimento) {
      this.showMessage('Informe o primeiro vencimento para a promissória.', 'error');
      return;
    }

    const payload = {
      empresa: this.state.empresa,
      cliente_id: this.state.clienteId ? Number(this.state.clienteId) : null,
      cliente_nome: this.state.clienteNome || '',
      itens: this.state.carrinho.map((item) => ({
        produto_id: Number(item.produto_id),
        quantidade: Number(item.quantidade),
        preco_unitario: Number(item.preco_unitario),
        custo_unitario: Number(item.custo_unitario)
      })),
      subtotal,
      desconto,
      acrescimo,
      total,
      pagamento,
      parcelas: ehPromissoria ? Number(this.state.parcelas || 1) : 1,
      status_pagamento,
      data: this.today(),
      observacao: this.state.observacao || '',
      conta_receber: ehPromissoria
        ? {
            gerar: true,
            parcelas: Number(this.state.parcelas || 1),
            data_primeiro_vencimento: this.state.primeiroVencimento,
            intervalo_dias: 30,
            observacao: this.state.observacao || ''
          }
        : null
    };

    this.state.salvando = true;
    this.setLoading(true);
    this.setFeedback('Finalizando venda...', 'info');

    if (this.el.finalizarBtn) {
      this.el.finalizarBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
    }

    try {
      await this.postVenda(payload);
      const message = 'Venda finalizada com sucesso.';
      this.setFeedback(message, 'success');
      showToast(message, 'success');
      this.resetVenda();
      await this.load();
    } catch (error) {
      console.error('Erro ao finalizar venda:', error);
      const message = this.buildFriendlyError(error);
      this.setFeedback(message, 'error');
    } finally {
      this.state.salvando = false;
      this.setLoading(false);

      if (this.el.finalizarBtn) {
        this.el.finalizarBtn.innerHTML = '<i class="fa-solid fa-check"></i> Finalizar venda';
      }
    }
  },

  resetVenda() {
    this.state.carrinho = [];
    this.state.clienteId = '';
    this.state.clienteNome = '';
    this.state.pagamento = 'Dinheiro';
    this.state.parcelas = 1;
    this.state.primeiroVencimento = '';
    this.state.desconto = 0;
    this.state.acrescimo = 0;
    this.state.observacao = '';

    this.cache();

    if (this.el.clienteSelect) this.el.clienteSelect.value = '';
    if (this.el.pagamento) this.el.pagamento.value = 'Dinheiro';
    if (this.el.parcelas) this.el.parcelas.value = '1';
    if (this.el.primeiroVencimento) this.el.primeiroVencimento.value = '';
    if (this.el.desconto) this.el.desconto.value = '0';
    if (this.el.acrescimo) this.el.acrescimo.value = '0';
    if (this.el.observacao) this.el.observacao.value = '';
    if (this.el.buscaProduto) this.el.buscaProduto.value = '';

    this.state.produtosFiltrados = [...this.state.produtos];

    this.updateClienteInfo();
    this.renderProdutos();
    this.renderCarrinho();
    this.renderResumo();
    this.togglePrimeiroVencimentoField();
    this.setFeedback('', 'info');
  },

  setLoading(value) {
    this.cache();

    if (this.el.finalizarBtn) this.el.finalizarBtn.disabled = value;
    if (this.el.limparBtn) this.el.limparBtn.disabled = value;
    if (this.el.atualizarBtn) this.el.atualizarBtn.disabled = value;
  },

  setFeedback(message, type = 'info') {
    this.cache();

    if (!this.el.formFeedback) return;

    if (!message) {
      this.el.formFeedback.className = 'module-feedback';
      this.el.formFeedback.textContent = '';
      return;
    }

    this.el.formFeedback.className = `module-feedback module-feedback--${type}`;
    this.el.formFeedback.textContent = message;
  },

  showMessage(message, type = 'info') {
    this.setFeedback(message, type);
    showToast(message, type);
  },

  buildFriendlyError(error) {
    if (!error) return 'Erro inesperado.';

    if (typeof api.formatPlanError === 'function') {
      return api.formatPlanError(error);
    }

    if (error.status === 400) return error.message || 'Dados inválidos para a venda.';
    if (error.status === 403) return error.message || 'Sem permissão para realizar esta venda.';
    if (error.status === 404) return error.message || 'Recurso não encontrado.';
    if (error.status === 500) return 'Erro interno no backend ao finalizar a venda.';
    if (String(error.message || '').includes('Failed to fetch')) {
      return 'Não foi possível conectar ao backend.';
    }

    return error.message || 'Falha ao concluir a venda.';
  },

  parseMoneyInput(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  },

  today() {
    return new Date().toISOString().slice(0, 10);
  },

  toCurrency(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  },

  escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
};

export async function initPDVModule() {
  PDVModule.init();
  await PDVModule.load();
}

export default PDVModule;
