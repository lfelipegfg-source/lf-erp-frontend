import api from './api.js';
import { getAuth } from './auth.js';
import { showToast, confirmarAcao } from './feedback.js';
import { escapeHtml } from './utils.js';

const EstoqueModule = {
  state: {
    items: [],
    filteredItems: [],
    initialized: false,
    eventsBound: false,
    loading: false,
    empresa: ''
  },

  init() {
    const auth = getAuth();
    this.state.empresa = api.getEmpresaNome() || auth?.empresa?.nome || auth?.user?.empresa || '';

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

      if (btn.id === 'estoqueSugestaoBtn') {
        await this.abrirSugestaoCompra();
      }

      if (btn.id === 'estoqueDepositosBtn') {
        await this.abrirDepositos();
      }

      if (btn.id === 'sugestaoFecharBtn') {
        document.getElementById('sugestaoCompraModal')?.classList.add('hidden');
      }

      if (btn.id === 'depositosFecharBtn') {
        document.getElementById('depositosModal')?.classList.add('hidden');
      }

      if (btn.id === 'depositoNovoBtn') {
        await this.criarDeposito();
      }

      if (btn.id === 'depositosFecharBtn2') {
        document.getElementById('depositosModal')?.classList.add('hidden');
      }

      if (btn.dataset.action === 'verEstoqueDeposito') {
        await this.verEstoqueDeposito(Number(btn.dataset.id), btn.dataset.nome || '');
      }

      if (btn.dataset.action === 'excluirDeposito') {
        await this.excluirDeposito(Number(btn.dataset.id));
      }

      if (btn.dataset.action === 'renderDepositos') {
        await this._renderDepositos();
      }
    });
  },

  async load() {
    this.state.loading = true;
    this.setFeedback('Carregando estoque...', 'info');


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
            <button class="btn btn-light" id="estoqueDepositosBtn" type="button">
              <i class="fa-solid fa-warehouse"></i>
              Depósitos
            </button>
            <button class="btn btn-light" id="estoqueSugestaoBtn" type="button">
              <i class="fa-solid fa-cart-shopping"></i>
              Sugestão de compra
            </button>
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
            <div class="empty-state" style="padding:36px 24px">
              <i class="fa-solid fa-warehouse"></i>
              <strong>Nenhum produto encontrado</strong>
              <p>Tente ajustar os filtros de busca ou status.</p>
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
      return `<span class="badge badge--danger">Crítico</span>`;
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

    showToast(message, type);
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
  },

  // ── Sugestão automática de compra ─────────────────────────────────────────

  // ── Multi-depósito ──────────────────────────────────────────────────────────

  async abrirDepositos() {
    if (!document.getElementById('depositosModal')) {
      const el = document.createElement('div');
      el.className = 'modal-overlay hidden';
      el.id = 'depositosModal';
      el.innerHTML = `
        <div class="modal-card" style="max-width:700px;width:95vw">
          <div class="modal-card__header">
            <div>
              <h3><i class="fa-solid fa-warehouse" style="margin-right:8px"></i>Depósitos</h3>
              <p style="color:var(--text-muted);font-size:.9rem">Gerencie locais de armazenamento</p>
            </div>
            <button type="button" class="icon-button" id="depositosFecharBtn" aria-label="Fechar">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div id="depositosCorpo" style="padding:20px 24px 24px;overflow-y:auto;max-height:70vh"></div>
          <div class="modal-card__footer" style="padding:16px 24px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <button type="button" class="btn btn-primary" id="depositoNovoBtn">
              <i class="fa-solid fa-plus"></i> Novo depósito
            </button>
            <button type="button" class="btn btn-light" id="depositosFecharBtn2">Fechar</button>
          </div>
        </div>`;
      document.body.appendChild(el);
    }

    document.getElementById('depositosModal').classList.remove('hidden');
    await this._renderDepositos();
  },

  async _renderDepositos() {
    const corpo = document.getElementById('depositosCorpo');
    if (!corpo) return;
    corpo.innerHTML = `<div class="module-feedback module-feedback--info">Carregando...</div>`;

    try {
      const empresa = this.state.empresa || '';
      const data = await api.request('/depositos', { method: 'GET', query: { empresa } });
      const lista = data.depositos || [];

      if (!lista.length) {
        corpo.innerHTML = `
          <div class="empty-state">Nenhum depósito cadastrado. Clique em "Novo depósito" para começar.</div>`;
        return;
      }

      corpo.innerHTML = `
        <div class="table-wrapper">
        <table class="data-table">
          <thead><tr>
            <th>Depósito</th><th>Produtos</th><th>Unidades</th><th>Status</th><th class="text-right">Ações</th>
          </tr></thead>
          <tbody>
            ${lista.map((d) => `
              <tr>
                <td>
                  <div class="table-primary">
                    <strong>${escapeHtml(d.nome)}</strong>
                    ${d.principal ? '<span class="badge badge--primary" style="font-size:.7rem;margin-left:6px">Principal</span>' : ''}
                    ${d.descricao ? `<small style="color:var(--text-muted)">${escapeHtml(d.descricao)}</small>` : ''}
                  </div>
                </td>
                <td>${d.total_produtos || 0}</td>
                <td>${d.total_unidades || 0}</td>
                <td><span class="badge ${d.ativo ? 'badge--success' : 'badge--warning'}">${d.ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td class="text-right">
                  <button class="btn-inline" type="button" data-action="verEstoqueDeposito" data-id="${d.id}" data-nome="${escapeHtml(d.nome)}">
                    <i class="fa-solid fa-eye"></i> Ver estoque
                  </button>
                  ${!d.principal ? `
                    <button class="btn-inline btn-inline--danger" type="button"
                      data-action="excluirDeposito" data-id="${d.id}" aria-label="Excluir depósito ${escapeHtml(d.nome)}">
                      <i class="fa-solid fa-trash"></i>
                    </button>` : ''}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
        </div>`;
    } catch (err) {
      corpo.innerHTML = `<div class="module-feedback module-feedback--error">${escapeHtml(err.message)}</div>`;
    }
  },

  async criarDeposito() {
    const dados = await new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-card" style="max-width:400px">
          <div class="modal-card__header">
            <div>
              <h3>Novo Depósito</h3>
              <p>Cadastre um local de armazenamento de estoque</p>
            </div>
            <button class="icon-button" id="_dep_cancel" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-card__body">
            <div class="form-grid">
              <div class="form-field form-field--span-2">
                <label>Nome <span style="color:var(--danger)">*</span></label>
                <input id="_dep_nome" type="text" autocomplete="off" placeholder="Ex: Depósito Principal" />
              </div>
              <div class="form-field form-field--span-2">
                <label>Descrição (opcional)</label>
                <input id="_dep_desc" type="text" autocomplete="off" />
              </div>
            </div>
          </div>
          <div class="modal-card__footer">
            <button class="btn btn-light" id="_dep_cancel2">Cancelar</button>
            <button class="btn btn-primary" id="_dep_criar">Criar depósito</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      let done = false;
      const fechar = (val) => { if (done) return; done = true; overlay.remove(); resolve(val); };
      overlay.querySelector('#_dep_criar').addEventListener('click', () => {
        const nome = overlay.querySelector('#_dep_nome').value.trim();
        const desc = overlay.querySelector('#_dep_desc').value.trim();
        fechar(nome ? { nome, descricao: desc } : null);
      });
      overlay.querySelectorAll('#_dep_cancel, #_dep_cancel2').forEach(b => b.addEventListener('click', () => fechar(null)));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(null); });
      document.addEventListener('keydown', function onKey(e) {
        if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); fechar(null); }
      });
      overlay.querySelector('#_dep_nome').focus();
    });
    if (!dados) return;
    try {
      const empresa = this.state.empresa || '';
      await api.request('/depositos', {
        method: 'POST',
        body: { nome: dados.nome, descricao: dados.descricao, empresa }
      });
      showToast('Depósito criado!', 'success');
      await this._renderDepositos();
    } catch (err) {
      showToast(err.message || 'Erro ao criar depósito', 'error');
    }
  },

  async excluirDeposito(id) {
    const ok = await confirmarAcao('Excluir este depósito? Só é possível se não houver estoque.', 'Excluir');
    if (!ok) return;
    try {
      await api.request(`/depositos/${id}`, { method: 'DELETE' });
      showToast('Depósito excluído!', 'success');
      await this._renderDepositos();
    } catch (err) {
      showToast(err.message || 'Erro ao excluir', 'error');
    }
  },

  async verEstoqueDeposito(id, nome) {
    const corpo = document.getElementById('depositosCorpo');
    if (!corpo) return;
    corpo.innerHTML = `
      <div style="margin-bottom:16px">
        <button type="button" class="btn btn-light btn-sm" type="button" data-action="renderDepositos">
          <i class="fa-solid fa-arrow-left"></i> Voltar
        </button>
        <strong style="margin-left:12px">${escapeHtml(nome)}</strong>
      </div>
      <div class="module-feedback module-feedback--info">Carregando estoque...</div>`;

    try {
      const data = await api.request(`/depositos/${id}/estoque`);
      const itens = data.itens || [];

      if (!itens.length) {
        corpo.querySelector('.module-feedback').outerHTML = `<div class="empty-state">Nenhum produto neste depósito.</div>`;
        return;
      }

      const tabela = document.createElement('div');
      tabela.className = 'table-wrapper';
      tabela.innerHTML = `
        <table class="data-table">
          <thead><tr>
            <th>Produto</th><th>Categoria</th><th>Variação</th>
            <th class="text-right">Estoque</th>
          </tr></thead>
          <tbody>
            ${itens.map((i) => `
              <tr>
                <td><strong>${escapeHtml(i.produto_nome)}</strong></td>
                <td>${escapeHtml(i.categoria || '-')}</td>
                <td>${i.atributo1 ? escapeHtml(`${i.atributo1}${i.atributo2 ? ' / ' + i.atributo2 : ''}`) : '-'}</td>
                <td class="text-right ${Number(i.estoque) <= 0 ? 'text-danger' : ''}">${i.estoque}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;

      corpo.innerHTML = `
        <div style="margin-bottom:16px">
          <button type="button" class="btn btn-light btn-sm" type="button" data-action="renderDepositos">
            <i class="fa-solid fa-arrow-left"></i> Voltar
          </button>
          <strong style="margin-left:12px">${escapeHtml(nome)}</strong>
          <span style="color:var(--text-muted);font-size:.85rem;margin-left:8px">(${itens.length} produto(s))</span>
        </div>`;
      corpo.appendChild(tabela);
    } catch (err) {
      showToast(err.message || 'Erro ao carregar estoque', 'error');
    }
  },

  async abrirSugestaoCompra() {
    if (!document.getElementById('sugestaoCompraModal')) {
      const el = document.createElement('div');
      el.className = 'modal-overlay hidden';
      el.id = 'sugestaoCompraModal';
      el.innerHTML = `
        <div class="modal-card" style="max-width:820px;width:95vw">
          <div class="modal-card__header">
            <div>
              <h3>Sugestão de Compra</h3>
              <p id="sugestaoSubtitulo" style="color:var(--text-muted);font-size:.9rem">Produtos abaixo do estoque mínimo</p>
            </div>
            <button type="button" class="icon-button" id="sugestaoFecharBtn">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div id="sugestaoCorpo" style="padding:20px 24px 24px;overflow-y:auto;max-height:70vh">
            <div class="skeleton-line" style="height:200px;border-radius:12px"></div>
          </div>
        </div>`;
      document.body.appendChild(el);
    }

    const modal  = document.getElementById('sugestaoCompraModal');
    const corpo  = document.getElementById('sugestaoCorpo');
    const sub    = document.getElementById('sugestaoSubtitulo');
    modal.classList.remove('hidden');
    if (corpo) corpo.innerHTML = `<div class="module-feedback module-feedback--info">Calculando sugestão...</div>`;

    try {
      const empresa = this.state.empresa || '';
      const data = await api.request('/estoque/sugestao-compra', { method: 'GET', query: { empresa } });
      const { itens = [], total_itens = 0, total_estimado = 0 } = data;

      if (sub) sub.textContent = total_itens === 0
        ? 'Todos os produtos estão acima do estoque mínimo'
        : `${total_itens} produto(s) abaixo do mínimo · Custo estimado: ${formatCurrency(total_estimado)}`;

      if (!itens.length) {
        corpo.innerHTML = `<div class="empty-state"><i class="fa-solid fa-check-circle" style="color:var(--success,#38a169);font-size:2rem;margin-bottom:8px"></i><br>Nenhum produto precisa de reposição.</div>`;
        return;
      }

      corpo.innerHTML = `
        <div class="table-wrapper">
        <table class="data-table">
          <thead><tr>
            <th>Produto</th>
            <th>Categoria</th>
            <th class="text-right">Atual</th>
            <th class="text-right">Mínimo</th>
            <th class="text-right">Sugerido</th>
            <th class="text-right">Custo unit.</th>
            <th class="text-right">Total est.</th>
            <th>Fornecedor</th>
          </tr></thead>
          <tbody>
            ${itens.map((i) => `
              <tr>
                <td>
                  <div class="table-primary">
                    <strong>${escapeHtml(i.nome)}</strong>
                    ${i.codigo_barras ? `<small style="display:block;color:var(--text-muted)">${escapeHtml(i.codigo_barras)}</small>` : ''}
                  </div>
                </td>
                <td>${escapeHtml(i.categoria || '-')}</td>
                <td class="text-right" style="color:var(--danger,#e53e3e);font-weight:800">${i.estoque_atual}</td>
                <td class="text-right">${i.estoque_minimo}</td>
                <td class="text-right"><strong>${i.qtd_sugerida}</strong></td>
                <td class="text-right">${i.custo_estimado > 0 ? formatCurrency(i.custo_estimado) : '-'}</td>
                <td class="text-right">${i.custo_estimado > 0 ? formatCurrency(i.qtd_sugerida * i.custo_estimado) : '-'}</td>
                <td>${escapeHtml(i.fornecedor_preferencial || '-')}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight:800;border-top:2px solid var(--border)">
              <td colspan="6" class="text-right" style="padding-top:10px">Total estimado:</td>
              <td class="text-right" style="padding-top:10px">${formatCurrency(total_estimado)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        </div>`;
    } catch (err) {
      if (corpo) corpo.innerHTML = `<div class="module-feedback module-feedback--error">${escapeHtml(err.message || 'Erro ao carregar sugestão')}</div>`;
    }
  }
};

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}


export async function initEstoqueModule() {
  EstoqueModule.init();
  await EstoqueModule.load();
}

