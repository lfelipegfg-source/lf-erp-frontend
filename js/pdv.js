import api from './api.js';
import { getAuth } from './auth.js';
import { showToast } from './feedback.js';
import * as PdvOffline from './pdvOffline.js';

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
    desconto: 0,
    acrescimo: 0,
    observacao: '',
    salvando: false,
    pagamentos: [{ forma: 'Dinheiro', valor: 0, parcelas: 1, vencimento: '' }],
    activeTab: 'produtos',
    gradeModalProduto: null,
    gradesDisponiveis: []
  },

  init() {
    this._eventsBound = false;
    this._keyboardBound = false;
    this._offlineBound = false;
    this.resolveEmpresa();
    this.render();
    this.cache();
    this.bindLocalEvents();
    this.bindOfflineEvents();
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
      pagamentosLista: document.getElementById('pdvPagamentosLista'),
      splitRestante: document.getElementById('pdvSplitRestante'),
      addPagamentoBtn: document.getElementById('pdvAddPagamentoBtn'),
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
    if (this._eventsBound) return;
    this._eventsBound = true;
    this.cache();

    this.el.buscaProduto?.addEventListener('input', (event) => {
      clearTimeout(this._buscaTimer);
      this._buscaTimer = setTimeout(() => this.filterProdutos(event.target.value), 250);
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

    // â”€â”€ Split de pagamento â€” delegaÃ§Ã£o de eventos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    document.getElementById('pdvAddPagamentoBtn')?.addEventListener('click', () => {
      this.addPagamento();
    });

    document.getElementById('pdvPagamentosLista')?.addEventListener('change', (e) => {
      const idx = Number(e.target.dataset.idx);
      if (isNaN(idx)) return;

      if (e.target.classList.contains('pdv-split-forma')) {
        this.state.pagamentos[idx].forma = e.target.value;
        this.renderPagamentos();
      } else if (e.target.classList.contains('pdv-split-parcelas')) {
        this.state.pagamentos[idx].parcelas = Math.max(1, Number(e.target.value) || 1);
      } else if (e.target.classList.contains('pdv-split-vencimento')) {
        this.state.pagamentos[idx].vencimento = e.target.value || '';
      }
    });

    document.getElementById('pdvPagamentosLista')?.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.idx);
      if (isNaN(idx)) return;

      if (e.target.classList.contains('pdv-split-valor')) {
        this.state.pagamentos[idx].valor = this.parseMoneyInput(e.target.value);
        this.renderSplitRestante();
      }
    });

    document.getElementById('pdvPagamentosLista')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.pdv-split-remove');
      if (!btn) return;
      const idx = Number(btn.dataset.idx);
      if (isNaN(idx)) return;
      this.removePagamento(idx);
    });

    // â”€â”€ Eventos do modal de grade â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    document.getElementById('pdvGradeModalClose')?.addEventListener('click', () => {
      this.closeGradeSelector();
    });

    document.getElementById('pdvGradeModal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('pdvGradeModal')) this.closeGradeSelector();
    });

    document.getElementById('pdvGradeGrid')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pdv-grade-id]');
      if (!btn) return;
      const gradeId  = Number(btn.dataset.pdvGradeId);
      const estoque  = Number(btn.dataset.estoque);
      const preco    = Number(btn.dataset.preco) || null;
      const atrib1   = btn.dataset.atrib1;
      const atrib2   = btn.dataset.atrib2 || '';
      if (estoque <= 0) { showToast('VariaÃ§Ã£o sem estoque.', 'error'); return; }
      this.selectGrade(gradeId, atrib1, atrib2, estoque, preco);
    });

    // â”€â”€ Abas mobile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    document.getElementById('pdvTabs')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      this.switchTab(btn.dataset.tab);
    });

    // Sticky Finalizar mobile
    document.getElementById('pdvMobileFinalizarBtn')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await this.finalizarVenda();
    });

    this.el.atualizarBtn?.addEventListener('click', async (event) => {
      event.preventDefault();
      await this.load();
    });

    this.el.limparBtn?.addEventListener('click', (event) => {
      event.preventDefault();
      this.resetVenda();
    });

    document.getElementById('pdvSalvarOrcamentoBtn')?.addEventListener('click', async (event) => {
      event.preventDefault();
      await this.salvarOrcamento();
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

    this.el.carrinhoBody?.addEventListener('input', (e) => {
      if (!e.target.classList.contains('pdv-item-desc')) return;
      const idx = Number(e.target.dataset.index);
      if (isNaN(idx) || !this.state.carrinho[idx]) return;
      this.state.carrinho[idx].desconto_pct = Math.min(100, Math.max(0, Number(e.target.value) || 0));
      this.renderResumo();
    });

    this.el.carrinhoBody?.addEventListener('change', (e) => {
      if (!e.target.classList.contains('pdv-item-desc')) return;
      const idx = Number(e.target.dataset.index);
      if (isNaN(idx) || !this.state.carrinho[idx]) return;
      const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
      e.target.value = val || '';
      this.state.carrinho[idx].desconto_pct = val;
      this.renderCarrinho();
      this.renderResumo();
    });

    this.bindKeyboardShortcuts();
  },

  bindKeyboardShortcuts() {
    if (this._keyboardBound) return;
    this._keyboardBound = true;

    document.addEventListener('keydown', (e) => {
      // SÃ³ ativa quando o PDV estÃ¡ visÃ­vel
      if (!document.getElementById('pdvBuscaProduto')) return;

      const tag      = document.activeElement?.tagName?.toLowerCase();
      const inInput  = ['input', 'textarea', 'select'].includes(tag);
      const inBusca  = document.activeElement === this.el.buscaProduto;

      // F2 â€” focar campo de busca de produto
      if (e.key === 'F2') {
        e.preventDefault();
        this.el.buscaProduto?.focus();
        this.el.buscaProduto?.select();
        return;
      }

      // / â€” focar busca se nÃ£o estiver em nenhum input
      if (e.key === '/' && !inInput) {
        e.preventDefault();
        this.el.buscaProduto?.focus();
        this.el.buscaProduto?.select();
        return;
      }

      // F9 â€” finalizar venda
      if (e.key === 'F9') {
        e.preventDefault();
        if (!this.state.salvando && this.state.carrinho.length > 0) {
          this.finalizarVenda();
        }
        return;
      }

      // F8 â€” limpar venda
      if (e.key === 'F8') {
        e.preventDefault();
        if (this.state.carrinho.length > 0) this.resetVenda();
        return;
      }

      // Escape â€” fecha modal de grade, ou limpa o campo de busca
      if (e.key === 'Escape') {
        const gradeModal = document.getElementById('pdvGradeModal');
        if (gradeModal && !gradeModal.classList.contains('hidden')) {
          this.closeGradeSelector();
          return;
        }
        if (inBusca) {
          this.el.buscaProduto.value = '';
          this.filterProdutos('');
        }
        return;
      }

      // Enter na busca â€” adiciona o primeiro produto visÃ­vel e limpa a busca
      if (e.key === 'Enter' && inBusca) {
        e.preventDefault();
        const primeiroBtn = this.el.listaProdutos
          ?.querySelector("[data-action='pdv-add-produto']");
        if (primeiroBtn) {
          this.addProduto(Number(primeiroBtn.dataset.id));
          this.el.buscaProduto.value = '';
          this.filterProdutos('');
          this.el.buscaProduto.focus();
        }
        return;
      }

      // + / = â€” aumentar quantidade do Ãºltimo item do carrinho
      if (!inInput && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        if (this.state.carrinho.length > 0) {
          this.updateQuantidade(this.state.carrinho.length - 1, 1);
        }
        return;
      }

      // - â€” diminuir quantidade do Ãºltimo item do carrinho
      if (!inInput && e.key === '-') {
        e.preventDefault();
        if (this.state.carrinho.length > 0) {
          this.updateQuantidade(this.state.carrinho.length - 1, -1);
        }
        return;
      }

      // Delete â€” remover Ãºltimo item do carrinho
      if (!inInput && e.key === 'Delete') {
        e.preventDefault();
        if (this.state.carrinho.length > 0) {
          this.removeItem(this.state.carrinho.length - 1);
        }
        return;
      }
    });
  },

  async load() {
    this.resolveEmpresa();
    this.cache();

    if (!this.state.empresa) {
      this.setFeedback('Empresa nÃ£o identificada para carregar o PDV.', 'error');
      return;
    }

    const isOnline = navigator.onLine;
    this.updateOfflineIndicator(isOnline);
    this.setLoading(true);
    this.setFeedback('Carregando dados do PDV...', 'info');

    try {
      if (isOnline) {
        const [clientes, produtos] = await Promise.all([
          this.fetchClientes(),
          this.fetchProdutos(),
          this.syncPendentesIfOnline().catch(() => {})
        ]);
        this.state.clientes = Array.isArray(clientes) ? clientes : [];
        this.state.produtos = Array.isArray(produtos) ? produtos : [];
        PdvOffline.salvarProdutos(this.state.produtos).catch(() => {});
        PdvOffline.salvarClientes(this.state.clientes).catch(() => {});
      } else {
        const [produtos, clientes] = await Promise.all([PdvOffline.getProdutos(), PdvOffline.getClientes()]);
        this.state.produtos = produtos;
        this.state.clientes = clientes;
      }

      this.state.produtosFiltrados = [...this.state.produtos];
      this.renderClientes();
      this.renderProdutos();
      this.renderCarrinho();
      this.renderResumo();
      this.togglePrimeiroVencimentoField();

      if (!isOnline) {
        const pendentes = await PdvOffline.contarVendasPendentes();
        if (!this.state.produtos.length) {
          this.setFeedback('Sem conexÃ£o e sem dados em cache. Aguarde a conexÃ£o.', 'error');
        } else {
          const msg = pendentes > 0
            ? `Offline â€” ${this.state.produtos.length} produto(s) em cache. ${pendentes} venda(s) aguardando sincronizaÃ§Ã£o.`
            : `Offline â€” ${this.state.produtos.length} produto(s) em cache.`;
          this.setFeedback(msg, 'warning');
        }
      } else {
        this.setFeedback('', 'info');
      }
    } catch (error) {
      console.error('Erro ao carregar PDV:', error);

      if (!navigator.onLine) {
        try {
          this.state.produtos = await PdvOffline.getProdutos();
          this.state.clientes = await PdvOffline.getClientes();
          this.state.produtosFiltrados = [...this.state.produtos];
          this.renderClientes();
          this.renderProdutos();
          this.renderCarrinho();
          this.renderResumo();
          this.setFeedback(`Sem conexÃ£o â€” usando ${this.state.produtos.length} produto(s) do cache.`, 'warning');
          return;
        } catch { /* sem cache */ }
      }

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
        <div class="module-card__header" style="margin-bottom:12px">
          <span id="pdvOfflineIndicator" class="pdv-offline-badge hidden">
            <i class="fa-solid fa-wifi-slash"></i> Offline
          </span>

          <div class="module-card__actions">
            <button type="button" class="btn btn-light" id="pdvAtualizarBtn">
              <i class="fa-solid fa-rotate"></i> Atualizar
            </button>
            <button type="button" class="btn btn-light" id="pdvLimparBtn">
              <i class="fa-solid fa-broom"></i> Limpar venda
            </button>
          </div>
        </div>

        <div class="module-feedback" id="pdvFormFeedback"></div>

        <!-- Abas visÃ­veis apenas no mobile -->
        <div class="pdv-tabs" id="pdvTabs">
          <button type="button" class="pdv-tab pdv-tab--active" data-tab="produtos" id="pdvTabProdutos">
            <i class="fa-solid fa-box"></i>
            <span>Produtos</span>
          </button>
          <button type="button" class="pdv-tab" data-tab="carrinho" id="pdvTabCarrinho">
            <i class="fa-solid fa-cart-shopping"></i>
            <span>Carrinho</span>
            <span class="pdv-tab-badge hidden" id="pdvTabCarrinhoBadge">0</span>
          </button>
        </div>

        <div class="pdv-grid">
          <div class="pdv-panel pdv-panel--active" data-pdv-panel="produtos">
            <div class="pdv-panel__header">
              <h4>Cliente e produtos</h4>
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
                    inputmode="search"
                    autocomplete="off"
                    placeholder="Nome, categoria ou cÃ³digo de barras"
                  />
                  <div class="pdv-shortcuts-hint">
                    <span><kbd>F2</kbd> Focar busca</span>
                    <span><kbd>Enter</kbd> Adicionar</span>
                    <span><kbd>F9</kbd> Finalizar</span>
                    <span><kbd>F8</kbd> Limpar</span>
                    <span><kbd>Esc</kbd> Limpar busca</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="pdv-products">
              <div class="pdv-products__header">
                <h5>Produtos disponÃ­veis</h5>
              </div>
              <div class="pdv-products__list" id="pdvListaProdutos"></div>
            </div>
          </div>

          <div class="pdv-panel" data-pdv-panel="carrinho">
            <div class="pdv-panel__header">
              <h4>Carrinho e fechamento</h4>
            </div>

            <div class="table-wrapper">
              <table class="data-table pdv-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Qtd</th>
                    <th>PreÃ§o</th>
                    <th>Desc%</th>
                    <th>Total</th>
                    <th class="text-right">AÃ§Ãµes</th>
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
                <div class="form-field form-field--span-2">
                  <label>Formas de pagamento</label>
                  <div id="pdvPagamentosLista" class="pdv-split-lista"></div>
                  <div class="pdv-split-footer">
                    <span id="pdvSplitRestante" class="pdv-split-restante"></span>
                    <button type="button" class="btn btn-light btn-sm" id="pdvAddPagamentoBtn">
                      <i class="fa-solid fa-plus"></i> Adicionar forma
                    </button>
                  </div>
                </div>

                <div class="form-field">
                  <label for="pdvDesconto">Desconto</label>
                  <input type="number" min="0" step="0.01" id="pdvDesconto" value="0" inputmode="decimal" />
                </div>

                <div class="form-field">
                  <label for="pdvAcrescimo">AcrÃ©scimo</label>
                  <input type="number" min="0" step="0.01" id="pdvAcrescimo" value="0" inputmode="decimal" />
                </div>

                <div class="form-field form-field--span-2">
                  <label for="pdvObservacao">ObservaÃ§Ã£o</label>
                  <textarea
                    id="pdvObservacao"
                    placeholder="InformaÃ§Ãµes adicionais da venda"
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
                <button type="button" class="btn btn-light" id="pdvSalvarOrcamentoBtn">
                  <i class="fa-solid fa-file-lines"></i>
                  Salvar orÃ§amento
                </button>
                <button type="button" class="btn btn-primary" id="pdvFinalizarBtn">
                  <i class="fa-solid fa-check"></i>
                  Finalizar venda
                </button>
              </div>

              <!-- Footer fixo no mobile -->
              <div class="pdv-mobile-sticky" id="pdvMobileSticky">
                <div class="pdv-mobile-sticky__total">
                  <span>Total</span>
                  <strong id="pdvMobileStickyTotal">R$ 0,00</strong>
                </div>
                <button type="button" class="btn btn-primary pdv-mobile-sticky__btn" id="pdvMobileFinalizarBtn">
                  <i class="fa-solid fa-check"></i> Finalizar
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    this.injectStyles();

    // Modal de seleÃ§Ã£o de grade (injetado uma vez)
    if (!document.getElementById('pdvGradeModal')) {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay hidden';
      overlay.id = 'pdvGradeModal';
      overlay.innerHTML = `
        <div class="modal-card" style="max-width:520px">
          <div class="modal-card__header">
            <div>
              <h3 id="pdvGradeModalTitle">Selecionar variaÃ§Ã£o</h3>
              <p id="pdvGradeModalSub">Escolha o tamanho/cor disponÃ­vel.</p>
            </div>
            <button type="button" class="icon-button" id="pdvGradeModalClose">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div style="padding:20px 24px 24px">
            <div class="grade-grid" id="pdvGradeGrid"></div>
            <div class="section-empty hidden" id="pdvGradeEmpty">Nenhuma variaÃ§Ã£o disponÃ­vel.</div>
          </div>
        </div>`;
      document.body.appendChild(overlay);
    }
  },

  injectStyles() {
    // estilos migrados para style.css
  },

  async fetchClientes() {
    const r = await api.getClientes();
    return r?.dados ?? r;
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
              <span class="pdv-product-card__sub">${this.escapeHtml(produto.categoria || '-')} &nbsp;Â·&nbsp; ${estoque} un.</span>
            </div>
            <div class="pdv-product-card__right">
              <span class="pdv-product-card__price">${this.toCurrency(produto.preco)}</span>
              <button
                type="button"
                class="btn btn-sm ${semEstoque ? 'btn-light' : 'btn-primary'}"
                data-action="pdv-add-produto"
                data-id="${produto.id}"
                ${semEstoque ? 'disabled' : ''}
              ><i class="fa-solid fa-plus"></i> ${semEstoque ? 'Sem estoque' : 'Adicionar'}</button>
            </div>
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
        const descPct = Number(item.desconto_pct || 0);
        const precoComDesconto = Number(item.preco_unitario || 0) * (1 - descPct / 100);
        const totalItem = Number(item.quantidade || 0) * precoComDesconto;

        return `
          <tr>
            <td data-label="Produto">
              <div class="table-primary">
                <strong>${this.escapeHtml(item.produto_nome || 'Produto')}</strong>
                ${item.grade_label ? `<small style="display:block;color:var(--text-muted);margin-top:2px">${this.escapeHtml(item.grade_label)}</small>` : ''}
              </div>
            </td>

            <td data-label="Qtd">
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

            <td data-label="PreÃ§o">
              ${descPct > 0
                ? `<span style="text-decoration:line-through;color:var(--text-muted);font-size:.82em;display:block">${this.toCurrency(item.preco_unitario)}</span><span style="color:var(--success,#16a34a);font-weight:700">${this.toCurrency(precoComDesconto)}</span>`
                : this.toCurrency(item.preco_unitario)
              }
            </td>

            <td data-label="Desc%">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value="${descPct || ''}"
                placeholder="0"
                class="pdv-item-desc"
                data-index="${index}"
                inputmode="decimal"
                style="width:56px;text-align:center;padding:4px 6px;border:1px solid var(--border);border-radius:8px;font-size:.88rem;background:var(--surface)"
              />
            </td>

            <td data-label="Total">${this.toCurrency(totalItem)}</td>

            <td class="text-right">
              <button
                type="button"
                class="btn-inline btn-inline--danger"
                data-action="pdv-remove-item"
                data-index="${index}"
              >
                <i class="fa-solid fa-xmark"></i>
                <span class="pdv-remove-label">Remover</span>
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

    // Sticky mobile footer
    const stickyTotal = document.getElementById('pdvMobileStickyTotal');
    if (stickyTotal) stickyTotal.textContent = this.toCurrency(total);

    // Badge da aba carrinho
    const badge = document.getElementById('pdvTabCarrinhoBadge');
    if (badge) {
      if (totalItens > 0) {
        badge.textContent = String(totalItens);
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    // Ajusta o valor da Ãºnica forma de pagamento quando total muda e sÃ³ hÃ¡ uma
    if (this.state.pagamentos.length === 1) {
      this.state.pagamentos[0].valor = total;
    }
    this.renderPagamentos();
  },

  // â”€â”€ Abas mobile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  switchTab(tab) {
    this.state.activeTab = tab;

    document.querySelectorAll('[data-pdv-panel]').forEach((panel) => {
      if (panel.dataset.pdvPanel === tab) {
        panel.classList.add('pdv-panel--active');
      } else {
        panel.classList.remove('pdv-panel--active');
      }
    });

    document.querySelectorAll('[data-tab]').forEach((btn) => {
      if (btn.dataset.tab === tab) {
        btn.classList.add('pdv-tab--active');
      } else {
        btn.classList.remove('pdv-tab--active');
      }
    });
  },

  // â”€â”€ Split de pagamento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  FORMAS_PAGAMENTO: ['Dinheiro', 'Pix', 'CartÃ£o de DÃ©bito', 'CartÃ£o de CrÃ©dito', 'PromissÃ³ria'],

  getSomaPagamentos() {
    return this.state.pagamentos.reduce((acc, p) => acc + Number(p.valor || 0), 0);
  },

  getPagamentoTotal() {
    const subtotal = this.getSubtotal();
    const desconto = Number(this.state.desconto || 0);
    const acrescimo = Number(this.state.acrescimo || 0);
    return Math.max(0, subtotal - desconto + acrescimo);
  },

  getPagamentoRestante() {
    return Number((this.getPagamentoTotal() - this.getSomaPagamentos()).toFixed(2));
  },

  addPagamento() {
    const restante = this.getPagamentoRestante();
    this.state.pagamentos.push({
      forma: 'Dinheiro',
      valor: Math.max(0, restante),
      parcelas: 1,
      vencimento: ''
    });
    this.renderPagamentos();
  },

  removePagamento(idx) {
    if (this.state.pagamentos.length <= 1) return;
    this.state.pagamentos.splice(idx, 1);
    this.renderPagamentos();
  },

  renderPagamentos() {
    this.cache();
    const lista = this.el.pagamentosLista;
    if (!lista) return;

    lista.innerHTML = this.state.pagamentos.map((p, i) => {
      const ehPromissoria = p.forma === 'PromissÃ³ria';
      const opcoesForma = this.FORMAS_PAGAMENTO.map((f) =>
        `<option value="${f}" ${p.forma === f ? 'selected' : ''}>${f}</option>`
      ).join('');

      return `
        <div class="pdv-split-row" data-idx="${i}">
          <select class="pdv-split-forma form-control" data-idx="${i}">${opcoesForma}</select>
          <input type="number" class="pdv-split-valor form-control" data-idx="${i}"
            min="0" step="0.01" inputmode="decimal" value="${Number(p.valor || 0).toFixed(2)}" />
          ${ehPromissoria ? `
            <div class="pdv-split-promissoria">
              <select class="pdv-split-parcelas form-control" data-idx="${i}">
                ${[1,2,3,4,5,6,8,10,12].map((n) => `<option value="${n}" ${p.parcelas === n ? 'selected' : ''}>${n}x</option>`).join('')}
              </select>
              <input type="date" class="pdv-split-vencimento form-control" data-idx="${i}"
                value="${p.vencimento || ''}" placeholder="1Âº vencimento" />
            </div>` : ''}
          ${this.state.pagamentos.length > 1
            ? `<button type="button" class="pdv-split-remove" data-idx="${i}" title="Remover">
                <i class="fa-solid fa-xmark"></i>
               </button>`
            : ''}
        </div>`;
    }).join('');

    this.renderSplitRestante();
  },

  renderSplitRestante() {
    this.cache();
    const el = this.el.splitRestante;
    if (!el) return;
    const restante = this.getPagamentoRestante();
    if (Math.abs(restante) < 0.01) {
      el.textContent = '';
      el.className = 'pdv-split-restante pdv-split-restante--ok';
    } else if (restante > 0) {
      el.textContent = `Restante: ${this.toCurrency(restante)}`;
      el.className = 'pdv-split-restante pdv-split-restante--pendente';
    } else {
      el.textContent = `Excesso: ${this.toCurrency(Math.abs(restante))}`;
      el.className = 'pdv-split-restante pdv-split-restante--excesso';
    }
  },

  handleClienteChange(clienteId) {
    this.state.clienteId = clienteId || '';

    const cliente = this.state.clientes.find((item) => String(item.id) === String(clienteId));
    this.state.clienteNome = cliente?.nome || '';

    this.updateClienteInfo();

    // Recalcula preÃ§os do carrinho pela tabela de preÃ§os do cliente
    if (this.state.carrinho.length) {
      this.recalcularPrecosCarrinho();
    }
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

  togglePrimeiroVencimentoField() {
    const field = document.getElementById('pdvPrimeiroVencimentoField');
    if (!field) return;

    const exibir = this.state.pagamento === 'PromissÃ³ria';
    field.style.display = exibir ? 'block' : 'none';

    if (!exibir) {
      this.state.primeiroVencimento = '';
      if (this.el.primeiroVencimento) this.el.primeiroVencimento.value = '';
    }
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

  async addProduto(produtoId) {
    const produto = this.state.produtos.find((item) => Number(item.id) === Number(produtoId));
    if (!produto) {
      this.showMessage('Produto nÃ£o encontrado.', 'error');
      return;
    }

    const estoqueDisponivel = Number(produto.estoque || 0);
    if (estoqueDisponivel <= 0) {
      this.showMessage(`O produto "${produto.nome}" estÃ¡ sem estoque.`, 'error');
      return;
    }

    // Produto com grade â†’ abre modal de seleÃ§Ã£o de variaÃ§Ã£o
    if (produto.tem_grade) {
      await this.openGradeSelector(produto);
      return;
    }

    await this._addProdutoSemGrade(produto, estoqueDisponivel);
  },

  async _addProdutoSemGrade(produto, estoqueDisponivel) {
    const precoResolvido = await this.resolverPrecoItem(produto.id, null, this.state.clienteId, 1);
    const preco = precoResolvido ?? Number(produto.preco || 0);

    const existenteIndex = this.state.carrinho.findIndex(
      (item) => Number(item.produto_id) === Number(produto.id) && !item.grade_id
    );

    if (existenteIndex >= 0) {
      const itemAtual = this.state.carrinho[existenteIndex];
      if (Number(itemAtual.quantidade || 0) + 1 > estoqueDisponivel) {
        this.showMessage(`Estoque insuficiente para "${produto.nome}".`, 'error');
        return;
      }
      this.state.carrinho[existenteIndex].quantidade += 1;
      if (precoResolvido !== null) this.state.carrinho[existenteIndex].preco_unitario = preco;
    } else {
      this.state.carrinho.push({
        produto_id: Number(produto.id),
        produto_nome: produto.nome,
        grade_id: null,
        grade_label: '',
        quantidade: 1,
        preco_unitario: preco,
        preco_padrao: Number(produto.preco || 0),
        custo_unitario: Number(produto.custo || 0),
        estoque_disponivel: estoqueDisponivel,
        desconto_pct: 0
      });
    }

    this.renderCarrinho();
    this.renderResumo();
    this.setFeedback('', 'info');

    // No mobile, ao adicionar o primeiro item troca para a aba do carrinho
    if (this.state.carrinho.length === 1 && window.innerWidth < 768) {
      this.switchTab('carrinho');
    }
  },

  // â”€â”€ SELETOR DE GRADE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async openGradeSelector(produto) {
    this.state.gradeModalProduto = produto;
    this.state.gradesDisponiveis = [];

    const modal = document.getElementById('pdvGradeModal');
    if (!modal) return;

    modal.classList.remove('hidden');

    const grid = document.getElementById('pdvGradeGrid');
    if (grid) grid.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px">Carregando variaÃ§Ãµes...</div>';

    try {
      const result = await api.getGradesProduto(produto.id);
      this.state.gradesDisponiveis = result?.grades || (Array.isArray(result) ? result : []);
    } catch {
      this.state.gradesDisponiveis = [];
    }

    this.renderGradeGrid();
  },

  closeGradeSelector() {
    this.state.gradeModalProduto = null;
    this.state.gradesDisponiveis = [];
    document.getElementById('pdvGradeModal')?.classList.add('hidden');
  },

  async selectGrade(gradeId, atrib1, atrib2, estoque, precoPadrao) {
    const produto = this.state.gradeModalProduto;
    if (!produto) return;

    this.closeGradeSelector();

    const gradeLabel = atrib2 ? `${atrib1} / ${atrib2}` : atrib1;
    const precoBase = Number(precoPadrao) > 0 ? Number(precoPadrao) : Number(produto.preco || 0);
    const precoResolvido = await this.resolverPrecoItem(produto.id, gradeId, this.state.clienteId, 1);
    const preco = precoResolvido ?? precoBase;

    const existenteIndex = this.state.carrinho.findIndex(
      (item) => Number(item.produto_id) === Number(produto.id) && Number(item.grade_id) === Number(gradeId)
    );

    if (existenteIndex >= 0) {
      const itemAtual = this.state.carrinho[existenteIndex];
      if (Number(itemAtual.quantidade) + 1 > estoque) {
        this.showMessage(`Estoque insuficiente para "${produto.nome} â€” ${gradeLabel}".`, 'error');
        return;
      }
      this.state.carrinho[existenteIndex].quantidade += 1;
      if (precoResolvido !== null) this.state.carrinho[existenteIndex].preco_unitario = preco;
    } else {
      this.state.carrinho.push({
        produto_id: Number(produto.id),
        produto_nome: produto.nome,
        grade_id: Number(gradeId),
        grade_label: gradeLabel,
        quantidade: 1,
        preco_unitario: preco,
        preco_padrao: precoBase,
        custo_unitario: Number(produto.custo || 0),
        estoque_disponivel: estoque,
        desconto_pct: 0
      });
    }

    this.renderCarrinho();
    this.renderResumo();
    this.setFeedback('', 'info');

    if (this.state.carrinho.length === 1 && window.innerWidth < 768) {
      this.switchTab('carrinho');
    }
  },

  renderGradeGrid() {
    const grid  = document.getElementById('pdvGradeGrid');
    const empty = document.getElementById('pdvGradeEmpty');
    const title = document.getElementById('pdvGradeModalTitle');
    const sub   = document.getElementById('pdvGradeModalSub');
    if (!grid) return;

    const produto = this.state.gradeModalProduto;
    if (title) title.textContent = this.escapeHtml(produto?.nome || 'Selecionar variaÃ§Ã£o');
    if (sub)   sub.textContent   = 'Escolha o tamanho/cor disponÃ­vel.';

    const grades = this.state.gradesDisponiveis;

    if (!grades.length) {
      grid.innerHTML = '';
      empty?.classList.remove('hidden');
      return;
    }

    empty?.classList.add('hidden');

    grid.innerHTML = grades.map((g) => {
      const label      = g.atributo2 ? `${g.atributo1} / ${g.atributo2}` : g.atributo1;
      const est        = Number(g.estoque || 0);
      const semEstoque = est <= 0;
      return `
        <button
          type="button"
          class="grade-btn${semEstoque ? ' grade-btn--esgotado' : ''}"
          data-pdv-grade-id="${g.id}"
          data-estoque="${est}"
          data-preco="${Number(g.preco || 0)}"
          data-atrib1="${this.escapeHtml(g.atributo1 || '')}"
          data-atrib2="${this.escapeHtml(g.atributo2 || '')}"
          ${semEstoque ? 'disabled' : ''}
        >
          <span class="grade-btn__label">${this.escapeHtml(label)}</span>
          <span class="grade-btn__estoque">${semEstoque ? 'Esgotado' : `Est: ${est}`}</span>
        </button>
      `;
    }).join('');
  },

  // â”€â”€ TABELA DE PREÃ‡OS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async resolverPrecoItem(produtoId, gradeId, clienteId, quantidade) {
    if (!clienteId) return null;
    try {
      const result = await api.resolverPrecoTabela({
        produtoId,
        gradeId: gradeId || null,
        clienteId,
        quantidade: quantidade || 1
      });
      return result?.preco != null ? Number(result.preco) : null;
    } catch {
      return null;
    }
  },

  async recalcularPrecosCarrinho() {
    if (!this.state.carrinho.length) return;

    await Promise.all(
      this.state.carrinho.map(async (item, i) => {
        let preco = null;

        if (this.state.clienteId) {
          preco = await this.resolverPrecoItem(
            item.produto_id,
            item.grade_id || null,
            this.state.clienteId,
            item.quantidade
          );
        }

        // Sem tabela ou sem cliente â†’ preÃ§o padrÃ£o armazenado no item
        if (preco === null) {
          preco = item.preco_padrao ?? item.preco_unitario;
        }

        this.state.carrinho[i].preco_unitario = preco;
      })
    );

    this.renderCarrinho();
    this.renderResumo();
  },

  updateQuantidade(index, delta) {
    const item = this.state.carrinho[index];
    if (!item) return;

    const produto = this.state.produtos.find((prod) => Number(prod.id) === Number(item.produto_id));
    const estoqueDisponivel = item.estoque_disponivel != null
      ? Number(item.estoque_disponivel)
      : Number(produto?.estoque || 0);
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
      const descPct = Number(item.desconto_pct || 0);
      const precoComDesconto = Number(item.preco_unitario || 0) * (1 - descPct / 100);
      return acc + Number(item.quantidade || 0) * precoComDesconto;
    }, 0);
  },


  async finalizarVenda() {
    if (this.state.salvando) return;

    if (!this.state.carrinho.length) {
      this.showMessage('Adicione pelo menos um produto ao carrinho.', 'error');
      return;
    }

    const subtotal = Math.round(this.getSubtotal() * 100) / 100;
    const desconto = Number(this.state.desconto || 0);
    const acrescimo = Number(this.state.acrescimo || 0);
    const total = Math.round(Math.max(0, subtotal - desconto + acrescimo) * 100) / 100;

    if (total <= 0) {
      this.showMessage('O total da venda deve ser maior que zero.', 'error');
      return;
    }

    // ValidaÃ§Ã£o do split
    const restante = this.getPagamentoRestante();
    if (restante > 0.01) {
      this.showMessage(`Faltam ${this.toCurrency(restante)} para cobrir o total.`, 'error');
      return;
    }
    const troco = restante < -0.01 ? Math.abs(restante) : 0;
    if (troco > 0) {
      const todosDinheiro = this.state.pagamentos.every((p) => p.forma === 'Dinheiro');
      if (!todosDinheiro) {
        this.showMessage(`O total dos pagamentos excede o valor da venda em ${this.toCurrency(troco)}.`, 'error');
        return;
      }
      // Troco em Dinheiro: subtrai do primeiro pagamento em Dinheiro apenas
      let trocoRestante = troco;
      this.state.pagamentos = this.state.pagamentos.map((p) => {
        if (p.forma === 'Dinheiro' && trocoRestante > 0) {
          const novoValor = Number((Number(p.valor || 0) - trocoRestante).toFixed(2));
          trocoRestante = 0;
          return { ...p, valor: novoValor };
        }
        return p;
      });
    }

    // Valida vencimento para PromissÃ³ria
    const promissoriaEntry = this.state.pagamentos.find((p) => p.forma === 'PromissÃ³ria');
    if (promissoriaEntry && !promissoriaEntry.vencimento) {
      this.showMessage('Informe o primeiro vencimento para a promissÃ³ria.', 'error');
      return;
    }

    const pagamentoPrincipal = this.state.pagamentos[0]?.forma || 'Dinheiro';
    const temPromissoria = !!promissoriaEntry;
    const status_pagamento = temPromissoria ? 'pendente' : 'pago';

    const payload = {
      empresa: this.state.empresa,
      cliente_id: this.state.clienteId ? Number(this.state.clienteId) : null,
      cliente_nome: this.state.clienteNome || '',
      itens: this.state.carrinho.map((item) => {
        const descPct = Number(item.desconto_pct || 0);
        const precoFinal = Number((Number(item.preco_unitario || 0) * (1 - descPct / 100)).toFixed(2));
        return {
          produto_id: Number(item.produto_id),
          grade_id: item.grade_id ? Number(item.grade_id) : null,
          quantidade: Number(item.quantidade),
          preco_unitario: precoFinal,
          custo_unitario: Number(item.custo_unitario)
        };
      }),
      subtotal,
      desconto,
      acrescimo,
      total,
      pagamento: pagamentoPrincipal,
      pagamentos: this.state.pagamentos.map((p) => ({
        forma: p.forma,
        valor: Number(p.valor || 0),
        parcelas: Number(p.parcelas || 1),
        vencimento: p.vencimento || null
      })),
      parcelas: promissoriaEntry ? Number(promissoriaEntry.parcelas || 1) : 1,
      status_pagamento,
      data: this.today(),
      observacao: this.state.observacao || '',
      conta_receber: null
    };

    // Offline â€” salvar na fila local
    if (!navigator.onLine) {
      this.state.salvando = true;
      this.setLoading(true);
      if (this.el.finalizarBtn) {
        this.el.finalizarBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando offline...';
      }
      try {
        const pendingId = await PdvOffline.salvarVendaPendente(payload);
        const msg = pendingId
          ? `Venda salva offline (fila #${pendingId}). SerÃ¡ enviada quando a conexÃ£o retornar.`
          : 'Venda salva offline. SerÃ¡ enviada quando a conexÃ£o retornar.';
        this.setFeedback(msg, 'warning');
        showToast(msg, 'warning');
        this.resetVenda();
        await this.load();
      } catch {
        this.setFeedback('Erro ao salvar a venda offline.', 'error');
        showToast('NÃ£o foi possÃ­vel salvar a venda offline.', 'error');
      } finally {
        this.state.salvando = false;
        this.setLoading(false);
        if (this.el.finalizarBtn) {
          this.el.finalizarBtn.innerHTML = '<i class="fa-solid fa-check"></i> Finalizar venda';
        }
      }
      return;
    }

    this.state.salvando = true;
    this.setLoading(true);
    this.setFeedback('Finalizando venda...', 'info');

    if (this.el.finalizarBtn) {
      this.el.finalizarBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
    }

    try {
      const result = await this.postVenda(payload);
      const vendaId = result?.id || result?.venda_id || null;

      const pixEntries = this.state.pagamentos.filter(
        (p) => (p.forma || '').toLowerCase() === 'pix'
      );

      if (pixEntries.length > 0) {
        const valorPix = pixEntries.reduce((s, p) => s + Number(p.valor || 0), 0);
        const msg = vendaId ? `Venda #${vendaId} registrada. Gerando QR Code PIX...` : 'Venda registrada. Gerando QR Code PIX...';
        this.setFeedback(msg, 'info');
        showToast(msg, 'info');
        await this.abrirModalPix(vendaId, valorPix, this.state.clienteNome || '');
      } else {
        const trocoMsg = troco > 0 ? ` | Troco: ${this.toCurrency(troco)}` : '';
        const message = vendaId
          ? `Venda #${vendaId} finalizada com sucesso!${trocoMsg}`
          : `Venda finalizada com sucesso.${trocoMsg}`;
        this.setFeedback(message, 'success');
        showToast(message, 'success');
      }

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
    this.closeGradeSelector();
    this.state.carrinho = [];
    this.state.clienteId = '';
    this.state.clienteNome = '';
    this.state.pagamentos = [{ forma: 'Dinheiro', valor: 0, parcelas: 1, vencimento: '' }];
    this.state.desconto = 0;
    this.state.acrescimo = 0;
    this.state.observacao = '';

    this.cache();

    if (this.el.clienteSelect) this.el.clienteSelect.value = '';
    if (this.el.desconto) this.el.desconto.value = '0';
    if (this.el.acrescimo) this.el.acrescimo.value = '0';
    if (this.el.observacao) this.el.observacao.value = '';
    if (this.el.buscaProduto) this.el.buscaProduto.value = '';

    this.state.produtosFiltrados = [...this.state.produtos];

    this.switchTab('produtos');
    this.updateClienteInfo();
    this.renderProdutos();
    this.renderCarrinho();
    this.renderResumo();
    this.setFeedback('', 'info');
  },

  async abrirModalPix(vendaId, valor, clienteNome) {
    const empresa = this.state.empresa;

    return new Promise((resolve) => {
      let pollInterval = null;
      let txid = null;
      let segundosRestantes = 900; // 15 minutos
      let timerInterval = null;

      const fmtValor = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const fmtTempo = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:3000;display:flex;align-items:center;justify-content:center;padding:16px';

      overlay.innerHTML = `
        <div id="_pixModal" style="background:var(--surface);border-radius:20px;padding:32px 28px;max-width:420px;width:100%;box-shadow:0 32px 64px rgba(0,0,0,.3);text-align:center;position:relative">
          <button id="_pixFechar" style="position:absolute;top:14px;right:16px;background:none;border:none;cursor:pointer;font-size:18px;color:var(--text-muted)" title="Fechar">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <div id="_pixConteudo">
            <div style="font-size:36px;color:#32b768;margin-bottom:8px"><i class="fa-brands fa-pix"></i></div>
            <h3 style="margin:0 0 4px;font-size:18px;font-weight:800">PIX â€” ${fmtValor(valor)}</h3>
            ${clienteNome ? `<p style="margin:0 0 16px;font-size:13px;color:var(--text-muted)">${this.escapeHtml(clienteNome)}</p>` : '<div style="margin-bottom:16px"></div>'}
            <div id="_pixStatus" style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
              <i class="fa-solid fa-spinner fa-spin"></i> Gerando QR Code...
            </div>
            <div id="_pixQrArea" style="display:none">
              <div id="_pixQrImg" style="margin:0 auto 12px;width:200px;height:200px;border:2px solid var(--border);border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden"></div>
              <div style="margin-bottom:12px">
                <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px">PIX Copia e Cola</label>
                <div style="display:flex;gap:6px">
                  <input id="_pixCopiaCola" readonly style="flex:1;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:11px;font-family:monospace;background:var(--surface-2);color:var(--text);min-width:0" />
                  <button id="_pixCopiar" style="padding:8px 12px;border-radius:8px;border:1.5px solid var(--border);background:var(--surface);cursor:pointer;font-size:13px" title="Copiar cÃ³digo">
                    <i class="fa-solid fa-copy"></i>
                  </button>
                </div>
              </div>
              <div id="_pixTimer" style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
                Expira em <strong id="_pixTempoRestante">15:00</strong>
              </div>
              <div id="_pixStatusPagamento" style="padding:10px;border-radius:10px;background:var(--surface-2);font-size:13px;font-weight:600;color:var(--text-muted)">
                <i class="fa-solid fa-clock"></i> Aguardando pagamento...
              </div>
            </div>
            <div id="_pixErroArea" style="display:none;color:var(--danger);font-size:13px;padding:12px;background:var(--danger-soft);border-radius:10px;margin-top:8px"></div>
          </div>
          <div id="_pixSucessoArea" style="display:none">
            <div style="font-size:56px;color:#22c55e;margin-bottom:12px"><i class="fa-solid fa-circle-check"></i></div>
            <h3 style="margin:0 0 6px;font-size:20px;font-weight:800;color:#22c55e">Pagamento Confirmado!</h3>
            <p style="margin:0;font-size:14px;color:var(--text-muted)">PIX recebido com sucesso.<br>Obrigado!</p>
          </div>
        </div>`;

      document.body.appendChild(overlay);

      let _pixFechado = false;
      const fechar = () => {
        _pixFechado = true;
        clearInterval(pollInterval);
        clearInterval(timerInterval);
        if (overlay.parentNode) document.body.removeChild(overlay);
        resolve();
      };

      overlay.querySelector('#_pixFechar').onclick = fechar;
      overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });

      const mostrarSucesso = () => {
        clearInterval(pollInterval);
        clearInterval(timerInterval);
        overlay.querySelector('#_pixConteudo').style.display = 'none';
        overlay.querySelector('#_pixSucessoArea').style.display = 'block';
        showToast('PIX recebido! Pagamento confirmado.', 'success');
        setTimeout(fechar, 2500);
      };

      const iniciarPoll = () => {
        if (!txid) return;
        pollInterval = setInterval(async () => {
          try {
            const st = await api.request(`/pagamentos/pix/status/${txid}`);
            if (st?.status === 'CONCLUIDA') mostrarSucesso();
          } catch { /* silencioso â€” continua tentando */ }
        }, 4000);
      };

      const iniciarTimer = (expiracaoISO) => {
        if (!expiracaoISO) return;
        const expMs = new Date(expiracaoISO).getTime();
        timerInterval = setInterval(() => {
          segundosRestantes = Math.max(0, Math.round((expMs - Date.now()) / 1000));
          const el = overlay.querySelector('#_pixTempoRestante');
          if (el) el.textContent = fmtTempo(segundosRestantes);
          if (segundosRestantes === 0) {
            clearInterval(timerInterval);
            const sp = overlay.querySelector('#_pixStatusPagamento');
            if (sp) { sp.style.color = '#ef4444'; sp.innerHTML = '<i class="fa-solid fa-clock"></i> QR Code expirado. Gere um novo.'; }
          }
        }, 1000);
      };

      // Gera o QR Code
      (async () => {
        try {
          const dados = await api.request('/pagamentos/pix/gerar', {
            method: 'POST',
            body: { empresa, valor: Number(valor), cliente_nome: clienteNome || '' }
          });

          txid = dados?.txid || null;

          const qrArea = overlay.querySelector('#_pixQrArea');
          const qrImg  = overlay.querySelector('#_pixQrImg');
          const ccInput = overlay.querySelector('#_pixCopiaCola');
          const st      = overlay.querySelector('#_pixStatus');

          if (st) st.style.display = 'none';

          if (dados?.qr_image) {
            qrImg.innerHTML = `<img src="data:image/png;base64,${dados.qr_image}" style="width:100%;height:100%;object-fit:contain" alt="QR Code PIX" />`;
          } else {
            qrImg.innerHTML = `<div style="padding:16px;font-size:11px;color:var(--text-muted);line-height:1.5"><i class="fa-solid fa-qrcode" style="font-size:32px;display:block;margin-bottom:8px"></i>QR Code disponÃ­vel<br>em produÃ§Ã£o</div>`;
          }

          if (ccInput && dados?.pix_copia_e_cola) ccInput.value = dados.pix_copia_e_cola;

          qrArea.style.display = 'block';
          if (!_pixFechado) iniciarTimer(dados?.expiracao);
          if (!_pixFechado) iniciarPoll();

          const btnCopiar = overlay.querySelector('#_pixCopiar');
          if (btnCopiar) {
            btnCopiar.onclick = async () => {
              try {
                await navigator.clipboard.writeText(dados.pix_copia_e_cola || '');
                btnCopiar.innerHTML = '<i class="fa-solid fa-check"></i>';
                setTimeout(() => { btnCopiar.innerHTML = '<i class="fa-solid fa-copy"></i>'; }, 1800);
              } catch { /* fallback silencioso */ }
            };
          }
        } catch (e) {
          const errArea = overlay.querySelector('#_pixErroArea');
          const st = overlay.querySelector('#_pixStatus');
          if (st) st.style.display = 'none';
          if (errArea) {
            errArea.style.display = 'block';
            errArea.textContent = `Erro ao gerar PIX: ${e.message || 'verifique as configuraÃ§Ãµes de PIX nas ConfiguraÃ§Ãµes do sistema.'}`;
          }
        }
      })();
    });
  },

  async salvarOrcamento() {
    if (!this.state.carrinho.length) {
      this.showMessage('Adicione ao menos um produto ao carrinho.', 'error');
      return;
    }

    const btn = document.getElementById('pdvSalvarOrcamentoBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...'; }

    try {
      const result = await api.createOrcamento({
        cliente_id: this.state.clienteId ? Number(this.state.clienteId) : null,
        cliente_nome: this.state.clienteNome || '',
        itens: this.state.carrinho.map((item) => ({
          produto_id: Number(item.produto_id),
          produto_nome: item.produto_nome,
          grade_id: item.grade_id ? Number(item.grade_id) : null,
          quantidade: Number(item.quantidade),
          preco_unitario: Number(item.preco_unitario)
        })),
        desconto: Number(this.state.desconto || 0),
        acrescimo: Number(this.state.acrescimo || 0),
        observacao: this.state.observacao || ''
      });

      const numero = result?.orcamento?.numero ?? result?.numero ?? '?';
      const msg = `OrÃ§amento #${numero} salvo com sucesso.`;
      this.showMessage(msg, 'success');
      showToast(msg, 'success');
      this.resetVenda();
    } catch (err) {
      this.showMessage(err.message || 'Erro ao salvar orÃ§amento.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-file-lines"></i> Salvar orÃ§amento'; }
    }
  },

  setLoading(value) {
    this.cache();

    if (this.el.finalizarBtn) this.el.finalizarBtn.disabled = value;
    if (this.el.limparBtn) this.el.limparBtn.disabled = value;
    if (this.el.atualizarBtn) this.el.atualizarBtn.disabled = value;
    const orcBtn = document.getElementById('pdvSalvarOrcamentoBtn');
    if (orcBtn) orcBtn.disabled = value;
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

    if (error.status === 400) return error.message || 'Dados invÃ¡lidos para a venda.';
    if (error.status === 403) return error.message || 'Sem permissÃ£o para realizar esta venda.';
    if (error.status === 404) return error.message || 'Recurso nÃ£o encontrado.';
    if (error.status === 500) return 'Erro interno no backend ao finalizar a venda.';
    if (String(error.message || '').includes('Failed to fetch')) {
      return 'NÃ£o foi possÃ­vel conectar ao backend.';
    }

    return error.message || 'Falha ao concluir a venda.';
  },

  updateOfflineIndicator(isOnline) {
    const el = document.getElementById('pdvOfflineIndicator');
    if (el) el.classList.toggle('hidden', isOnline);
  },

  async syncPendentesIfOnline() {
    if (!navigator.onLine) return 0;
    const pendentes = await PdvOffline.getVendasPendentes();
    if (!pendentes.length) return 0;

    let sincronizadas = 0;
    let erros = 0;

    for (const venda of pendentes) {
      try {
        const { id: localId, _queued_at, ...payload } = venda;
        await this.postVenda(payload);
        await PdvOffline.removerVendaPendente(localId);
        sincronizadas++;
      } catch (err) {
        console.error('[PDV Sync] Erro ao sincronizar venda pendente:', err);
        erros++;
      }
    }

    if (sincronizadas > 0) {
      showToast(`${sincronizadas} venda(s) offline sincronizada(s) com sucesso!`, 'success');
    }
    if (erros > 0) {
      showToast(`${erros} venda(s) falharam na sincronizaÃ§Ã£o. Verifique e tente novamente.`, 'error');
    }

    return sincronizadas;
  },

  bindOfflineEvents() {
    if (this._offlineBound) return;
    this._offlineBound = true;
    window.addEventListener('online', async () => {
      this.updateOfflineIndicator(true);
      showToast('ConexÃ£o restaurada. Sincronizando vendas pendentes...', 'success');
      await this.syncPendentesIfOnline().catch(() => {});
      await this.load();
    });

    window.addEventListener('offline', () => {
      this.updateOfflineIndicator(false);
      showToast('Sem conexÃ£o. Modo offline ativado â€” vendas serÃ£o salvas localmente.', 'warning');
    });
  },

  parseMoneyInput(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  },

  today() {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' });
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

