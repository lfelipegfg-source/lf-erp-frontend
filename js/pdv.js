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

    // ── Split de pagamento — delegação de eventos ───────────────────────────
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

    // ── Eventos do modal de grade ──────────────────────────────────────────
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
      if (estoque <= 0) { showToast('Variação sem estoque.', 'error'); return; }
      this.selectGrade(gradeId, atrib1, atrib2, estoque, preco);
    });

    // ── Abas mobile ────────────────────────────────────────────────────────────
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

        <!-- Abas visíveis apenas no mobile -->
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
                    inputmode="search"
                    autocomplete="off"
                    placeholder="Nome, categoria ou código de barras"
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

          <div class="pdv-panel" data-pdv-panel="carrinho">
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
                  <label for="pdvAcrescimo">Acréscimo</label>
                  <input type="number" min="0" step="0.01" id="pdvAcrescimo" value="0" inputmode="decimal" />
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
                <button type="button" class="btn btn-light" id="pdvSalvarOrcamentoBtn">
                  <i class="fa-solid fa-file-lines"></i>
                  Salvar orçamento
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

    // Modal de seleção de grade (injetado uma vez)
    if (!document.getElementById('pdvGradeModal')) {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay hidden';
      overlay.id = 'pdvGradeModal';
      overlay.innerHTML = `
        <div class="modal-card" style="max-width:520px">
          <div class="modal-card__header">
            <div>
              <h3 id="pdvGradeModalTitle">Selecionar variação</h3>
              <p id="pdvGradeModalSub">Escolha o tamanho/cor disponível.</p>
            </div>
            <button type="button" class="icon-button" id="pdvGradeModalClose">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div style="padding:20px 24px 24px">
            <div class="grade-grid" id="pdvGradeGrid"></div>
            <div class="section-empty hidden" id="pdvGradeEmpty">Nenhuma variação disponível.</div>
          </div>
        </div>`;
      document.body.appendChild(overlay);
    }
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
        .pdv-grid { grid-template-columns: 1fr; }
      }

      /* ── Mobile responsivo (< 768px) ─────────────────────── */
      .pdv-tabs {
        display: none;
        gap: 0;
        border: 1px solid var(--border);
        border-radius: 16px;
        overflow: hidden;
        margin-bottom: 16px;
      }

      .pdv-tab {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 12px 8px;
        border: none;
        background: var(--surface-2);
        color: var(--text-muted);
        font-size: 0.9rem;
        font-weight: 700;
        cursor: pointer;
        position: relative;
      }

      .pdv-tab--active {
        background: var(--primary, #2563eb);
        color: #fff;
      }

      .pdv-tab-badge {
        position: absolute;
        top: 6px;
        right: 10px;
        background: #ef4444;
        color: #fff;
        font-size: 0.7rem;
        font-weight: 800;
        border-radius: 999px;
        padding: 1px 6px;
        min-width: 18px;
        text-align: center;
      }

      .pdv-mobile-sticky {
        display: none;
      }

      @media (max-width: 767px) {
        .pdv-tabs { display: flex; }

        /* Mostra só o painel ativo no mobile */
        [data-pdv-panel]:not(.pdv-panel--active) { display: none; }

        /* Produtos: lista mais alta, sem altura fixa */
        .pdv-products__list {
          max-height: calc(100dvh - 340px);
          min-height: 200px;
        }

        /* Touch targets maiores */
        .pdv-mini-btn {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          font-size: 1rem;
        }

        .pdv-qty__value {
          min-width: 32px;
          font-size: 1.1rem;
        }

        /* Tabela do carrinho → cards */
        .pdv-table { min-width: unset; width: 100%; }
        .pdv-table thead { display: none; }
        .pdv-table tbody tr {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px 12px;
          padding: 12px 4px;
          border-bottom: 1px solid var(--border);
        }
        .pdv-table tbody tr td { border: none; padding: 0; }
        .pdv-table tbody tr td[data-label="Produto"] {
          flex: 1 1 100%;
          font-size: 1rem;
        }
        .pdv-table tbody tr td[data-label="Qtd"] { flex: 0 0 auto; }
        .pdv-table tbody tr td[data-label="Preço"] {
          flex: 1 1 auto;
          color: var(--text-muted);
          font-size: 0.88rem;
        }
        .pdv-table tbody tr td[data-label="Total"] {
          flex: 0 0 auto;
          font-weight: 800;
          font-size: 1rem;
        }
        .pdv-table tbody tr td:last-child {
          flex: 0 0 auto;
          margin-left: auto;
        }
        .pdv-remove-label { display: none; }

        /* Esconde header do painel no mobile (aba já contextualiza) */
        .pdv-panel__header { display: none; }

        /* Checkout mais compacto */
        .pdv-checkout { margin-top: 12px; padding-top: 12px; }

        /* Esconde summary e botões normais no mobile — sticky faz o trabalho */
        .pdv-summary { display: none; }
        .pdv-actions { display: none; }

        /* Sticky footer */
        .pdv-mobile-sticky {
          display: flex;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 200;
          background: var(--surface);
          border-top: 1px solid var(--border);
          padding: 12px 16px;
          padding-bottom: max(12px, env(safe-area-inset-bottom));
          gap: 12px;
          align-items: center;
          box-shadow: 0 -4px 20px rgba(0,0,0,.12);
        }

        .pdv-mobile-sticky__total {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .pdv-mobile-sticky__total span {
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .pdv-mobile-sticky__total strong {
          font-size: 1.2rem;
          font-weight: 800;
          color: var(--text);
        }

        .pdv-mobile-sticky__btn {
          flex-shrink: 0;
          padding: 14px 24px;
          font-size: 1rem;
          border-radius: 14px;
        }

        /* Padding para não ficar atrás do sticky */
        [data-pdv-panel="carrinho"] { padding-bottom: 90px; }

        /* Botão adicionar produto — maior para touch */
        .pdv-product-card .btn {
          min-height: 44px;
          padding: 10px 16px;
        }

        /* Form fields do checkout mais espaçados */
        .form-grid { gap: 10px; }
        .form-control, select, input[type="text"],
        input[type="number"], input[type="date"] {
          min-height: 44px;
          font-size: 1rem;
        }

        /* Split payment mais compacto */
        .pdv-split-row .pdv-split-forma,
        .pdv-split-row .pdv-split-valor { min-height: 44px; }
      }

      /* ── Split de pagamento ───────────────────────────────── */
      .pdv-split-lista {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .pdv-split-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        flex-wrap: wrap;
      }

      .pdv-split-row .pdv-split-forma {
        flex: 1 1 140px;
        min-width: 130px;
      }

      .pdv-split-row .pdv-split-valor {
        flex: 1 1 100px;
        min-width: 90px;
      }

      .pdv-split-promissoria {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        width: 100%;
      }

      .pdv-split-promissoria .pdv-split-parcelas { flex: 0 0 72px; }
      .pdv-split-promissoria .pdv-split-vencimento { flex: 1 1 140px; }

      .pdv-split-remove {
        width: 34px;
        height: 34px;
        flex-shrink: 0;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--danger, #e53e3e);
        display: grid;
        place-items: center;
        cursor: pointer;
        font-size: 0.85rem;
      }

      .pdv-split-remove:hover { background: var(--surface-3); }

      .pdv-split-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 8px;
        gap: 10px;
      }

      .pdv-split-restante {
        font-size: 0.88rem;
        font-weight: 700;
      }

      .pdv-split-restante--ok { color: var(--success, #38a169); }
      .pdv-split-restante--pendente { color: var(--warning, #d69e2e); }
      .pdv-split-restante--excesso { color: var(--danger, #e53e3e); }

      .btn-sm {
        padding: 6px 12px;
        font-size: 0.85rem;
      }

      /* ── Grade selector ───────────────────────────────── */
      .grade-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 10px;
      }

      .grade-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 12px 8px;
        border: 2px solid var(--border);
        border-radius: 14px;
        background: var(--surface-2);
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s;
        width: 100%;
      }

      .grade-btn:not(:disabled):hover {
        border-color: var(--primary);
        background: var(--surface-3, var(--surface));
      }

      .grade-btn--esgotado,
      .grade-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .grade-btn__label {
        font-weight: 800;
        color: var(--text);
        font-size: 0.95rem;
      }

      .grade-btn__estoque {
        font-size: 0.77rem;
        color: var(--text-muted);
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

            <td data-label="Preço">${this.toCurrency(item.preco_unitario)}</td>
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

    // Ajusta o valor da única forma de pagamento quando total muda e só há uma
    if (this.state.pagamentos.length === 1) {
      this.state.pagamentos[0].valor = total;
    }
    this.renderPagamentos();
  },

  // ── Abas mobile ─────────────────────────────────────────────────────────────

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

  // ── Split de pagamento ──────────────────────────────────────────────────────

  FORMAS_PAGAMENTO: ['Dinheiro', 'Pix', 'Cartão de Débito', 'Cartão de Crédito', 'Promissória'],

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
      const ehPromissoria = p.forma === 'Promissória';
      const opcoesForma = this.FORMAS_PAGAMENTO.map((f) =>
        `<option value="${f}" ${p.forma === f ? 'selected' : ''}>${f}</option>`
      ).join('');

      return `
        <div class="pdv-split-row" data-idx="${i}">
          <select class="pdv-split-forma form-control" data-idx="${i}">${opcoesForma}</select>
          <input type="number" class="pdv-split-valor form-control" data-idx="${i}"
            min="0" step="0.01" value="${Number(p.valor || 0).toFixed(2)}" />
          ${ehPromissoria ? `
            <div class="pdv-split-promissoria">
              <select class="pdv-split-parcelas form-control" data-idx="${i}">
                ${[1,2,3,4,5,6,8,10,12].map((n) => `<option value="${n}" ${p.parcelas === n ? 'selected' : ''}>${n}x</option>`).join('')}
              </select>
              <input type="date" class="pdv-split-vencimento form-control" data-idx="${i}"
                value="${p.vencimento || ''}" placeholder="1º vencimento" />
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

    // Recalcula preços do carrinho pela tabela de preços do cliente
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
      this.showMessage('Produto não encontrado.', 'error');
      return;
    }

    const estoqueDisponivel = Number(produto.estoque || 0);
    if (estoqueDisponivel <= 0) {
      this.showMessage(`O produto "${produto.nome}" está sem estoque.`, 'error');
      return;
    }

    // Produto com grade → abre modal de seleção de variação
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
        estoque_disponivel: estoqueDisponivel
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

  // ── SELETOR DE GRADE ────────────────────────────────────────────────────────

  async openGradeSelector(produto) {
    this.state.gradeModalProduto = produto;
    this.state.gradesDisponiveis = [];

    const modal = document.getElementById('pdvGradeModal');
    if (!modal) return;

    modal.classList.remove('hidden');

    const grid = document.getElementById('pdvGradeGrid');
    if (grid) grid.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px">Carregando variações...</div>';

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
        this.showMessage(`Estoque insuficiente para "${produto.nome} — ${gradeLabel}".`, 'error');
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
        estoque_disponivel: estoque
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
    if (title) title.textContent = this.escapeHtml(produto?.nome || 'Selecionar variação');
    if (sub)   sub.textContent   = 'Escolha o tamanho/cor disponível.';

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

  // ── TABELA DE PREÇOS ─────────────────────────────────────────────────────────

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

        // Sem tabela ou sem cliente → preço padrão armazenado no item
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
      return acc + Number(item.quantidade || 0) * Number(item.preco_unitario || 0);
    }, 0);
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

    // Validação do split
    const restante = this.getPagamentoRestante();
    if (Math.abs(restante) >= 0.01) {
      this.showMessage(
        restante > 0
          ? `Faltam ${this.toCurrency(restante)} para cobrir o total.`
          : `O total dos pagamentos excede o valor da venda em ${this.toCurrency(Math.abs(restante))}.`,
        'error'
      );
      return;
    }

    // Valida vencimento para Promissória
    const promissoriaEntry = this.state.pagamentos.find((p) => p.forma === 'Promissória');
    if (promissoriaEntry && !promissoriaEntry.vencimento) {
      this.showMessage('Informe o primeiro vencimento para a promissória.', 'error');
      return;
    }

    const pagamentoPrincipal = this.state.pagamentos[0]?.forma || 'Dinheiro';
    const temPromissoria = !!promissoriaEntry;
    const status_pagamento = temPromissoria ? 'pendente' : 'pago';

    const payload = {
      empresa: this.state.empresa,
      cliente_id: this.state.clienteId ? Number(this.state.clienteId) : null,
      cliente_nome: this.state.clienteNome || '',
      itens: this.state.carrinho.map((item) => ({
        produto_id: Number(item.produto_id),
        grade_id: item.grade_id ? Number(item.grade_id) : null,
        quantidade: Number(item.quantidade),
        preco_unitario: Number(item.preco_unitario),
        custo_unitario: Number(item.custo_unitario)
      })),
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
      const msg = `Orçamento #${numero} salvo com sucesso.`;
      this.showMessage(msg, 'success');
      showToast(msg, 'success');
      this.resetVenda();
    } catch (err) {
      this.showMessage(err.message || 'Erro ao salvar orçamento.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-file-lines"></i> Salvar orçamento'; }
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
