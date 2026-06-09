import api from './api.js';
import { getAuth } from './auth.js';
import { showToast, confirmarAcao } from './feedback.js';
import { exportCSV, numCSV } from './exportUtils.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escapeHtml(v) {
  return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function buildFriendlyError(error) {
  if (!error) return 'Erro inesperado.';
  if (error.status === 400) return error.message || 'Dados inválidos.';
  if (error.status === 403) return error.message || 'Sem permissão.';
  if (error.status === 404) return error.message || 'Não encontrado.';
  if (String(error.message || '').includes('Failed to fetch')) return 'Não foi possível conectar ao backend.';
  return error.message || 'Falha na operação.';
}

// ─── Module ───────────────────────────────────────────────────────────────────

const ProdutosModule = {
  state: {
    items: [],
    filteredItems: [],
    loading: false,
    editingId: null,
    empresa: null,
    initialized: false,
    eventsBound: false,
    activeTab: 'dados',
    selectedIds: new Set(),  // IDs selecionados para impressão em lote
    // grade
    grades: [],
    // kit
    kitComponentes: [],
    kitEstoque: 0,
    allProdutos: [],
    // imagens
    imagens: []
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

  resolveEmpresa() {
    const auth = getAuth();
    this.state.empresa = auth?.empresa?.nome || auth?.user?.empresa || 'LF ERP';
  },

  cacheElements() {
    this.el = {
      container:      document.getElementById('produtosContainer'),
      toolbarSearch:  document.getElementById('produtosSearchInput'),
      toolbarRefresh: document.getElementById('produtosRefreshBtn'),
      toolbarNew:     document.getElementById('produtosNewBtn'),
      statsTotal:     document.getElementById('produtosStatsTotal'),
      statsStock:     document.getElementById('produtosStatsStock'),
      statsAlert:     document.getElementById('produtosStatsAlert'),
      tableBody:      document.getElementById('produtosTableBody'),
      emptyState:     document.getElementById('produtosEmptyState'),
      feedback:       document.getElementById('produtosFeedback'),
      modal:          document.getElementById('produtoModal'),
      modalTitle:     document.getElementById('produtoModalTitle'),
      form:           document.getElementById('produtoForm'),
      id:             document.getElementById('produtoId'),
      nome:           document.getElementById('produtoNome'),
      categoria:      document.getElementById('produtoCategoria'),
      codigoBarras:   document.getElementById('produtoCodigoBarras'),
      preco:          document.getElementById('produtoPreco'),
      custo:          document.getElementById('produtoCusto'),
      precoPromocional: document.getElementById('produtoPrecoPromocional'),
      promocaoAtiva:  document.getElementById('produtoPromocaoAtiva'),
      estoque:        document.getElementById('produtoEstoque'),
      estoqueMinimo:  document.getElementById('produtoEstoqueMinimo'),
      saveBtn:        document.getElementById('produtoSaveBtn'),
      cancelBtn:      document.getElementById('produtoCancelBtn'),
      closeBtn:       document.getElementById('produtoModalCloseBtn'),
      formFeedback:   document.getElementById('produtoFormFeedback'),
      tabs:           document.getElementById('produtoTabs'),
      tabDados:       document.getElementById('produtoTabDados'),
      tabImagens:     document.getElementById('produtoTabImagens'),
      tabGrade:       document.getElementById('produtoTabGrade'),
      tabKit:         document.getElementById('produtoTabKit'),
    };
  },

  // ── Eventos ────────────────────────────────────────────────────────────────

  bindEvents() {
    if (this.state.eventsBound) return;
    this.state.eventsBound = true;

    // Estilo de linha selecionada para impressão em lote
    if (!document.getElementById('prod-lote-styles')) {
      const s = document.createElement('style');
      s.id = 'prod-lote-styles';
      s.textContent = '.row--selected { background: color-mix(in srgb, var(--primary) 8%, transparent); }';
      document.head.appendChild(s);
    }

    document.addEventListener('input', (e) => {
      if (e.target?.id === 'produtosSearchInput') this.applySearch(e.target.value);
    });

    // Checkboxes de seleção para impressão em lote
    document.addEventListener('change', (e) => {
      if (e.target.id === 'produtosSelectAll') {
        if (e.target.checked) {
          this.state.filteredItems.forEach((i) => this.state.selectedIds.add(i.id));
        } else {
          this.state.selectedIds.clear();
        }
        this.renderTable();
        this.atualizarBotaoLote();
        return;
      }
      if (e.target.classList.contains('prod-sel-chk')) {
        const id = Number(e.target.dataset.id);
        if (e.target.checked) {
          this.state.selectedIds.add(id);
        } else {
          this.state.selectedIds.delete(id);
          const selAll = document.getElementById('produtosSelectAll');
          if (selAll) selAll.checked = false;
        }
        e.target.closest('tr')?.classList.toggle('row--selected', e.target.checked);
        this.atualizarBotaoLote();
      }
    });

    document.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-prod-action]') || e.target.closest('button');
      if (!t) return;

      const action = t.dataset.prodAction || t.id;

      // ── toolbar
      if (action === 'produtosExportBtn') {
        const lista = this.state.filteredItems.length
          ? this.state.filteredItems
          : this.state.items;
        exportCSV(lista.map((p) => ({
          'Nome':          p.nome || '',
          'Categoria':     p.categoria || '',
          'Preco (R$)':    numCSV(p.preco),
          'Custo (R$)':    numCSV(p.custo),
          'Estoque':       p.estoque ?? 0,
          'Estoque Min':   p.estoque_minimo ?? 0,
          'Codigo Barras': p.codigo_barras || '',
          'NCM':           p.ncm || '',
          'Unidade':       p.unidade || 'UN',
          'Grade':         p.tem_grade ? 'Sim' : 'Nao'
        })), 'produtos');
        return;
      }
      if (action === 'produtosRefreshBtn')     { await this.load(); return; }
      if (action === 'produtosNewBtn')         { this.openCreateModal(); return; }
      if (action === 'produtosLoteBtn')             { this.imprimirLote(); return; }
      if (action === 'produtosMarketplaceBtn')       { await this.abrirMarketplace(); return; }
      if (action === 'produtosTodasEtiquetasBtn')    { this.imprimirTodas(); return; }
      if (action === 'produtosHojeEtiquetasBtn')     { await this.imprimirHoje(); return; }

      // ── modal básico
      if (action === 'produtoCancelBtn' || action === 'produtoModalCloseBtn') {
        this.closeModal(); return;
      }
      if (t.dataset.action === 'etiqueta') { this.abrirEtiqueta(Number(t.dataset.id)); return; }
      if (t.dataset.action === 'edit')    { this.openEditModal(Number(t.dataset.id)); return; }
      if (t.dataset.action === 'delete')  { await this.handleDelete(Number(t.dataset.id)); return; }

      // ── tabs
      if (t.dataset.tab) { this.switchTab(t.dataset.tab); return; }

      // ── GRADE
      if (action === 'gradeToggleBtn')  { await this.handleGradeToggle(); return; }
      if (action === 'gradeAddBtn')     { await this.handleGradeAdd(); return; }
      if (t.dataset.action === 'gradeDelete')  { await this.handleGradeDelete(Number(t.dataset.id)); return; }
      if (t.dataset.action === 'gradeEdit')    { this.handleGradeEditInline(Number(t.dataset.id)); return; }
      if (t.dataset.action === 'gradeEditSave'){ await this.handleGradeEditSave(Number(t.dataset.id)); return; }

      // ── KIT
      if (action === 'kitToggleBtn')  { await this.handleKitToggle(); return; }
      if (action === 'kitAddBtn')     { await this.handleKitAdd(); return; }
      if (t.dataset.action === 'kitDelete')    { await this.handleKitDelete(Number(t.dataset.id)); return; }

      // ── IMAGENS
      if (action === 'imagemUploadBtn'){ document.getElementById('imagemFileInput')?.click(); return; }
      if (t.dataset.action === 'imagemPrincipal') { await this.handleImagemPrincipal(Number(t.dataset.id)); return; }
      if (t.dataset.action === 'imagemDelete')    { await this.handleImagemDelete(Number(t.dataset.id)); return; }
    });

    document.addEventListener('change', async (e) => {
      if (e.target?.id === 'imagemFileInput') {
        await this.handleImagemUpload(e.target.files[0]);
        e.target.value = '';
      }
    });

    document.addEventListener('submit', async (e) => {
      if (e.target?.id === 'produtoForm') {
        e.preventDefault();
        await this.handleSubmit();
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target === document.getElementById('produtoModal')) this.closeModal();
    });
  },

  // ── Load & Render ──────────────────────────────────────────────────────────

  async load() {
    this.resolveEmpresa();
    this.cacheElements();
    if (!this.state.empresa) { this.showModuleMessage('Empresa não identificada.', 'error'); return; }
    this.setLoading(true);
    this.showModuleMessage('Carregando...', 'info');
    try {
      const items = await api.getProdutos();
      this.state.items = Array.isArray(items) ? items : [];
      this.state.filteredItems = [...this.state.items];
      this.state.selectedIds.clear();
      this.atualizarBotaoLote();
      this.renderStats();
      this.renderTable();
      this.toggleEmptyState();
      this.showModuleMessage('', 'info');
    } catch (err) {
      this.state.items = []; this.state.filteredItems = [];
      this.renderStats(); this.renderTable();
      this.toggleEmptyState('Não foi possível carregar os produtos.');
      this.showModuleMessage(buildFriendlyError(err), 'error');
    } finally { this.setLoading(false); }
  },

  renderStats() {
    const total = this.state.items.length;
    const stock = this.state.items.reduce((s, i) => s + Number(i.estoque || 0), 0);
    const alert = this.state.items.filter((i) => Boolean(i.alerta_estoque)).length;
    if (this.el.statsTotal) this.el.statsTotal.textContent = total;
    if (this.el.statsStock) this.el.statsStock.textContent = stock;
    if (this.el.statsAlert) this.el.statsAlert.textContent = alert;
  },

  renderTable() {
    if (!this.el.tableBody) return;
    if (!this.state.filteredItems.length) { this.el.tableBody.innerHTML = ''; return; }
    this.el.tableBody.innerHTML = this.state.filteredItems.map((item) => {
      const alerta = Boolean(item.alerta_estoque);
      const statusClass = alerta ? 'badge badge--danger' : 'badge badge--success';

      const badges = [
        item.tem_grade ? '<span class="badge badge--warning" style="font-size:11px;padding:3px 8px">Grade</span>' : '',
        item.e_kit     ? '<span class="badge" style="font-size:11px;padding:3px 8px;background:var(--primary-soft);color:var(--primary)">Kit</span>' : ''
      ].filter(Boolean).join(' ');

      const selecionado = this.state.selectedIds.has(item.id);
      return `
        <tr class="${selecionado ? 'row--selected' : ''}">
          <td style="padding-right:0">
            <input type="checkbox" class="prod-sel-chk" data-id="${item.id}"
              ${selecionado ? 'checked' : ''}
              style="width:16px;height:16px;cursor:pointer" />
          </td>
          <td>
            <div class="table-primary">
              <strong>${escapeHtml(item.nome || '-')}</strong>
              ${badges ? `<div style="margin-top:4px">${badges}</div>` : ''}
            </div>
          </td>
          <td>${escapeHtml(item.categoria || '-')}</td>
          <td style="font-size:12px;color:var(--text-muted)">${escapeHtml(item.codigo_barras || '-')}</td>
          <td>${item.promocao_ativa && Number(item.preco_promocional) > 0
            ? `<div class="price-stack"><small class="price-old">${toCurrency(item.preco)}</small><strong class="price-promo">${toCurrency(item.preco_promocional)}</strong></div>`
            : toCurrency(item.preco)}</td>
          <td>${toCurrency(item.custo_medio || item.custo)}</td>
          <td class="${Number(item.lucro_unitario || 0) >= 0 ? 'text-success' : 'text-danger'}">${toCurrency(item.lucro_unitario || 0)}</td>
          <td><span class="badge ${Number(item.margem_lucro||0)>=30?'badge--success':Number(item.margem_lucro||0)>=10?'badge--warning':'badge--danger'}">${Number(item.margem_lucro||0).toFixed(1)}%</span></td>
          <td>${Number(item.estoque || 0)}</td>
          <td>${Number(item.estoque_minimo || 0)}</td>
          <td><span class="${statusClass}">${alerta ? 'Alerta' : 'Ok'}</span></td>
          <td class="text-right">
            <div class="table-actions">
              <button type="button" class="btn-inline" data-action="etiqueta" data-id="${item.id}">
                <i class="fa-solid fa-tag"></i> Etiqueta
              </button>
              <button type="button" class="btn-inline" data-action="edit" data-id="${item.id}">Editar</button>
              <button type="button" class="btn-inline btn-inline--danger" data-action="delete" data-id="${item.id}">Excluir</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  },

  toggleEmptyState(msg = 'Nenhum produto encontrado.') {
    if (!this.el.emptyState) return;
    if (this.state.filteredItems.length) { this.el.emptyState.classList.add('hidden'); return; }
    this.el.emptyState.textContent = msg;
    this.el.emptyState.classList.remove('hidden');
  },

  applySearch(term) {
    const q = String(term||'').trim().toLowerCase();
    this.state.filteredItems = q
      ? this.state.items.filter((i) => [i.nome, i.categoria, i.codigo_barras].filter(Boolean).some((f) => String(f).toLowerCase().includes(q)))
      : [...this.state.items];
    this.renderTable();
    this.toggleEmptyState();
  },

  // ── Modal ──────────────────────────────────────────────────────────────────

  renderInitialState() {
    const container = document.getElementById('produtosContainer');
    if (!container) return;
    container.innerHTML = `
      <section class="module-card">
        <div class="module-card__header">
          <div><h3>Produtos</h3><p>Cadastro, edição, estoque e consulta</p></div>
          <div class="module-card__actions">
            <button type="button" class="btn btn-light" id="produtosMarketplaceBtn">
              <i class="fa-solid fa-store"></i> Marketplace
            </button>
            <button type="button" class="btn btn-light" id="produtosLoteBtn" style="display:none">
              <i class="fa-solid fa-tags"></i>
              Etiquetas <span id="produtosLoteBadge" class="badge badge--primary" style="margin-left:4px;font-size:.75rem">0</span>
            </button>
            <button type="button" class="btn btn-light" id="produtosTodasEtiquetasBtn" title="Gera etiquetas de todos os produtos carregados em folhas A4">
              <i class="fa-solid fa-print"></i> Todas as Etiquetas
            </button>
            <button type="button" class="btn btn-light" id="produtosHojeEtiquetasBtn" title="Gera etiquetas dos produtos registrados hoje (cadastros, compras ou movimentações)">
              <i class="fa-solid fa-calendar-day"></i> Etiquetas de Hoje
            </button>
            <button type="button" class="btn btn-light" id="produtosExportBtn"><i class="fa-solid fa-file-csv"></i> Exportar CSV</button>
            <button type="button" class="btn btn-light" id="produtosRefreshBtn"><i class="fa-solid fa-rotate"></i> Atualizar</button>
            <button type="button" class="btn btn-primary" id="produtosNewBtn"><i class="fa-solid fa-plus"></i> Novo produto</button>
          </div>
        </div>
        <div class="module-toolbar">
          <div class="module-toolbar__search">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" id="produtosSearchInput" placeholder="Buscar por nome, categoria ou código" />
          </div>
          <div class="module-toolbar__stats">
            <div class="mini-stat"><span>Total</span><strong id="produtosStatsTotal">0</strong></div>
            <div class="mini-stat"><span>Estoque</span><strong id="produtosStatsStock">0</strong></div>
            <div class="mini-stat"><span>Em alerta</span><strong id="produtosStatsAlert">0</strong></div>
          </div>
        </div>
        <div class="module-feedback" id="produtosFeedback"></div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:36px;padding-right:0">
                  <input type="checkbox" id="produtosSelectAll" title="Selecionar todos"
                    style="width:16px;height:16px;cursor:pointer" />
                </th>
                <th>Produto</th><th>Categoria</th><th>Código</th>
                <th>Preço</th><th>Custo Médio</th><th>Lucro</th><th>Margem</th>
                <th>Estoque</th><th>Mínimo</th><th>Status</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody id="produtosTableBody"></tbody>
          </table>
        </div>
        <div class="empty-state hidden" id="produtosEmptyState">
          <i class="fa-solid fa-box-open"></i>
          <strong>Nenhum produto encontrado</strong>
          <p>Tente ajustar os filtros ou cadastre um novo produto.</p>
        </div>
      </section>

      <!-- MODAL PRODUTO -->
      <div class="modal-overlay hidden" id="produtoModal">
        <div class="modal-card modal-card--xl">
          <div class="modal-card__header">
            <div>
              <h3 id="produtoModalTitle">Novo produto</h3>
              <p id="produtoModalSub">Preencha os dados básicos do produto.</p>
            </div>
            <button type="button" class="icon-button" id="produtoModalCloseBtn" aria-label="Fechar">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <!-- Tabs (visíveis só ao editar) -->
          <div class="prod-tabs hidden" id="produtoTabs">
            <button class="prod-tab active" data-tab="dados">Dados</button>
            <button class="prod-tab" data-tab="imagens">
              <i class="fa-solid fa-image" style="font-size:12px"></i> Imagens
              <span class="prod-tab-badge" id="tabBadgeImagens">0</span>
            </button>
            <button class="prod-tab" data-tab="grade">
              <i class="fa-solid fa-layer-group" style="font-size:12px"></i> Grade
              <span class="prod-tab-badge" id="tabBadgeGrade">0</span>
            </button>
            <button class="prod-tab" data-tab="kit">
              <i class="fa-solid fa-cubes" style="font-size:12px"></i> Kit
              <span class="prod-tab-badge" id="tabBadgeKit">0</span>
            </button>
          </div>

          <!-- TAB: DADOS -->
          <div class="prod-tab-panel active" id="produtoTabDados">
            <form id="produtoForm" class="form-grid">
              <input type="hidden" id="produtoId" />

              <div class="form-field form-field--span-2">
                <label for="produtoNome">Nome do produto *</label>
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
                <label for="produtoPreco">Preço de venda *</label>
                <input type="number" id="produtoPreco" min="0" step="0.01" required />
              </div>
              <div class="form-field">
                <label for="produtoCusto">Custo *</label>
                <input type="number" id="produtoCusto" min="0" step="0.01" required />
              </div>
              <div class="form-field">
                <label for="produtoPrecoPromocional">Preço promocional</label>
                <input type="number" id="produtoPrecoPromocional" min="0" step="0.01" />
              </div>
              <div class="form-field form-field--checkbox">
                <label class="checkbox-wrapper">
                  <input type="checkbox" id="produtoPromocaoAtiva" />
                  <span>Promoção ativa</span>
                </label>
              </div>
              <div class="form-field">
                <label for="produtoEstoque">Estoque inicial</label>
                <input type="number" id="produtoEstoque" min="0" step="1" />
              </div>
              <div class="form-field">
                <label for="produtoEstoqueMinimo">Estoque mínimo</label>
                <input type="number" id="produtoEstoqueMinimo" min="0" step="1" />
              </div>

              <div class="form-feedback form-field--span-2" id="produtoFormFeedback"></div>
              <div class="modal-card__footer form-field--span-2">
                <button type="button" class="btn btn-light" id="produtoCancelBtn">Cancelar</button>
                <button type="submit" class="btn btn-primary" id="produtoSaveBtn">Salvar produto</button>
              </div>
            </form>
          </div>

          <!-- TAB: IMAGENS -->
          <div class="prod-tab-panel hidden" id="produtoTabImagens">
            <div class="imagem-upload-area" id="imagemUploadBtn">
              <i class="fa-solid fa-cloud-arrow-up" style="font-size:22px;margin-bottom:6px;display:block"></i>
              Clique para enviar uma imagem (JPG, PNG, WebP — máx. 5MB)
            </div>
            <input type="file" id="imagemFileInput" accept="image/jpeg,image/png,image/webp" class="hidden" />
            <div class="imagem-grid" id="imagemGrid"></div>
            <div class="section-empty hidden" id="imagemEmpty">Nenhuma imagem cadastrada ainda.</div>
          </div>

          <!-- TAB: GRADE -->
          <div class="prod-tab-panel hidden" id="produtoTabGrade">
            <div class="toggle-row">
              <div>
                <div class="toggle-row__label">Variações (Grade)</div>
                <div class="toggle-row__desc">Ativa tamanho, cor e estoque por variação</div>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="gradeToggleInput" />
                <span class="toggle-switch__track"></span>
              </label>
            </div>
            <div id="gradeContent" class="hidden">
              <p class="section-title">Variações cadastradas</p>
              <div class="grade-grid" id="gradeGrid"></div>
              <div class="section-empty hidden" id="gradeEmpty">Nenhuma variação. Adicione abaixo.</div>
              <div class="inline-add-form" style="grid-template-columns:1fr 1fr 110px 110px auto">
                <div>
                  <label style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;display:block">Tamanho / Atrib. 1 *</label>
                  <input type="text" id="gradeAtrib1" placeholder="Ex: M, 38, Azul..." />
                </div>
                <div>
                  <label style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;display:block">Cor / Atrib. 2</label>
                  <input type="text" id="gradeAtrib2" placeholder="Opcional" />
                </div>
                <div>
                  <label style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;display:block">Estoque</label>
                  <input type="number" id="gradeEstoque" min="0" value="0" />
                </div>
                <div>
                  <label style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;display:block">Preço (R$)</label>
                  <input type="number" id="gradePreco" min="0" step="0.01" placeholder="Padrão" />
                </div>
                <button type="button" id="gradeAddBtn" class="btn btn-primary" style="white-space:nowrap">
                  <i class="fa-solid fa-plus"></i> Adicionar
                </button>
              </div>
            </div>
            <div class="section-empty" id="gradeDisabledMsg" style="border-style:solid;background:var(--surface-2)">
              Ative o modo grade para gerenciar variações deste produto.
            </div>
          </div>

          <!-- TAB: KIT -->
          <div class="prod-tab-panel hidden" id="produtoTabKit">
            <div class="toggle-row">
              <div>
                <div class="toggle-row__label">Produto Composto (Kit)</div>
                <div class="toggle-row__desc">Ao vender, debita automaticamente cada componente</div>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="kitToggleInput" />
                <span class="toggle-switch__track"></span>
              </label>
            </div>
            <div id="kitContent" class="hidden">
              <div class="estoque-kit-info" id="kitEstoqueInfo">
                <i class="fa-solid fa-boxes-stacked"></i>
                <span id="kitEstoqueVal">0</span> kits disponíveis
              </div>
              <p class="section-title">Componentes do kit</p>
              <div id="kitList"></div>
              <div class="section-empty hidden" id="kitEmpty">Nenhum componente. Adicione abaixo.</div>
              <div class="inline-add-form" style="grid-template-columns:1fr 120px auto">
                <div>
                  <label style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;display:block">Produto componente *</label>
                  <select id="kitProdutoSelect" class="filter-input" style="width:100%">
                    <option value="">Selecione o produto...</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;display:block">Quantidade *</label>
                  <input type="number" id="kitQtd" min="0.001" step="0.001" value="1" />
                </div>
                <button type="button" id="kitAddBtn" class="btn btn-primary" style="white-space:nowrap">
                  <i class="fa-solid fa-plus"></i> Adicionar
                </button>
              </div>
            </div>
            <div class="section-empty" id="kitDisabledMsg" style="border-style:solid;background:var(--surface-2)">
              Ative o modo kit para definir os componentes deste produto.
            </div>
          </div>

        </div>
      </div>`;
  },

  openCreateModal() {
    this.state.editingId = null;
    this.state.activeTab = 'dados';
    this.cacheElements();
    if (this.el.modalTitle) this.el.modalTitle.textContent = 'Novo produto';
    if (this.el.form) this.el.form.reset();
    if (this.el.id) this.el.id.value = '';
    if (this.el.tabs) this.el.tabs.classList.add('hidden');
    this.switchTab('dados');
    this.setFormFeedback('', 'info');
    this.el.modal?.classList.remove('hidden');
  },

  async openEditModal(id) {
    const item = this.state.items.find((p) => Number(p.id) === Number(id));
    if (!item) { this.showModuleMessage('Produto não encontrado.', 'error'); return; }

    this.state.editingId = id;
    this.cacheElements();

    if (this.el.modalTitle) this.el.modalTitle.textContent = 'Editar produto';
    if (this.el.id) this.el.id.value = String(item.id);
    if (this.el.nome) this.el.nome.value = item.nome || '';
    if (this.el.categoria) this.el.categoria.value = item.categoria || '';
    if (this.el.codigoBarras) this.el.codigoBarras.value = item.codigo_barras || '';
    if (this.el.preco) this.el.preco.value = Number(item.preco || 0);
    if (this.el.custo) this.el.custo.value = Number(item.custo || 0);
    if (this.el.precoPromocional) this.el.precoPromocional.value = Number(item.preco_promocional || 0);
    if (this.el.promocaoAtiva) this.el.promocaoAtiva.checked = Boolean(item.promocao_ativa);
    if (this.el.estoque) this.el.estoque.value = Number(item.estoque || 0);
    if (this.el.estoqueMinimo) this.el.estoqueMinimo.value = Number(item.estoque_minimo || 0);

    if (this.el.tabs) this.el.tabs.classList.remove('hidden');
    this.switchTab('dados');
    this.setFormFeedback('', 'info');
    this.el.modal?.classList.remove('hidden');

    // Carrega tabs em paralelo
    await Promise.all([
      this.loadImagens(id),
      this.loadGrade(item),
      this.loadKit(item)
    ]);
  },

  closeModal() {
    this.cacheElements();
    this.el.modal?.classList.add('hidden');
    this.state.editingId = null;
    this.el.form?.reset();
    this.setFormFeedback('', 'info');
  },

  // ── Tabs ───────────────────────────────────────────────────────────────────

  switchTab(tab) {
    this.state.activeTab = tab;
    document.querySelectorAll('.prod-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.prod-tab-panel').forEach((panel) => {
      const id = panel.id.replace('produtoTab', '').toLowerCase();
      panel.classList.toggle('active', id === tab);
      panel.classList.toggle('hidden', id !== tab);
    });
  },

  // ── Submit básico ──────────────────────────────────────────────────────────

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
    if (!payload.nome) { this.setFormFeedback('Informe o nome do produto.', 'error'); return; }

    if (this.el.saveBtn) this.el.saveBtn.disabled = true;
    this.setFormFeedback('Salvando...', 'info');
    try {
      if (this.state.editingId) {
        await api.updateProduto(this.state.editingId, payload);
        showToast('Produto atualizado com sucesso.', 'success');
      } else {
        const result = await api.createProduto(payload);
        showToast('Produto cadastrado. Agora você pode adicionar imagens, grades e componentes.', 'success');
        // Abre automaticamente o modo de edição para continuar configurando
        await this.load();
        const novoId = result?.produto?.id || result?.id;
        if (novoId) {
          await this.openEditModal(novoId);
          return;
        }
      }
      this.closeModal();
      await this.load();
    } catch (err) {
      this.setFormFeedback(buildFriendlyError(err), 'error');
    } finally {
      if (this.el.saveBtn) this.el.saveBtn.disabled = false;
    }
  },

  async handleDelete(id) {
    const item = this.state.items.find((p) => Number(p.id) === Number(id));
    if (!item) { this.showModuleMessage('Produto não encontrado.', 'error'); return; }
    const ok = await confirmarAcao(`Excluir o produto "${item.nome}"?`, 'Excluir', 'danger');
    if (!ok) return;
    this.showModuleMessage('Excluindo...', 'info');
    try {
      await api.deleteProduto(id);
      showToast('Produto excluído.', 'success');
      await this.load();
    } catch (err) {
      this.showModuleMessage(buildFriendlyError(err), 'error');
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGENS
  // ═══════════════════════════════════════════════════════════════════════════

  async loadImagens(produtoId) {
    try {
      const res = await api.getImagensProduto(produtoId);
      this.state.imagens = res.imagens || [];
    } catch { this.state.imagens = []; }
    this.renderImagens();
  },

  renderImagens() {
    const grid  = document.getElementById('imagemGrid');
    const empty = document.getElementById('imagemEmpty');
    const badge = document.getElementById('tabBadgeImagens');
    if (!grid) return;

    if (badge) badge.textContent = this.state.imagens.length;

    if (!this.state.imagens.length) {
      grid.innerHTML = '';
      empty?.classList.remove('hidden');
      return;
    }
    empty?.classList.add('hidden');

    grid.innerHTML = this.state.imagens.map((img) => `
      <div class="imagem-card ${img.principal ? 'imagem-card--principal' : ''}">
        <img src="${escapeHtml(img.url_thumbnail || img.url)}" alt="Imagem do produto" loading="lazy" />
        ${img.principal ? '<span class="imagem-card__badge">Principal</span>' : ''}
        <div class="imagem-card__actions">
          ${!img.principal ? `<button type="button" class="btn-star" data-action="imagemPrincipal" data-id="${img.id}" title="Definir como principal"><i class="fa-solid fa-star"></i></button>` : ''}
          <button type="button" data-action="imagemDelete" data-id="${img.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`).join('');
  },

  async handleImagemUpload(file) {
    if (!file || !this.state.editingId) return;
    const btn = document.getElementById('imagemUploadBtn');
    if (btn) btn.textContent = 'Enviando...';
    try {
      await api.uploadImagemProduto(this.state.editingId, file);
      await this.loadImagens(this.state.editingId);
      showToast('Imagem enviada com sucesso.', 'success');
    } catch (err) {
      showToast(buildFriendlyError(err), 'error');
    } finally {
      if (btn) btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up" style="font-size:22px;margin-bottom:6px;display:block"></i>Clique para enviar uma imagem (JPG, PNG, WebP — máx. 5MB)';
    }
  },

  async handleImagemPrincipal(id) {
    try {
      await api.setPrincipalImagem(id);
      await this.loadImagens(this.state.editingId);
    } catch (err) { showToast(buildFriendlyError(err), 'error'); }
  },

  async handleImagemDelete(id) {
    const ok = await confirmarAcao('Excluir esta imagem?', 'Excluir', 'danger');
    if (!ok) return;
    try {
      await api.deletarImagem(id);
      await this.loadImagens(this.state.editingId);
      showToast('Imagem excluída.', 'success');
    } catch (err) { showToast(buildFriendlyError(err), 'error'); }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GRADE
  // ═══════════════════════════════════════════════════════════════════════════

  async loadGrade(item) {
    const toggle = document.getElementById('gradeToggleInput');
    const content = document.getElementById('gradeContent');
    const disabledMsg = document.getElementById('gradeDisabledMsg');
    if (!toggle) return;

    const temGrade = Boolean(item.tem_grade);
    toggle.checked = temGrade;

    if (temGrade) {
      content?.classList.remove('hidden');
      disabledMsg?.classList.add('hidden');
      try {
        const res = await api.getGradesProduto(item.id);
        this.state.grades = res.grades || [];
      } catch { this.state.grades = []; }
      this.renderGrades();
    } else {
      content?.classList.add('hidden');
      disabledMsg?.classList.remove('hidden');
      this.state.grades = [];
      this.renderGrades();
    }
  },

  renderGrades() {
    const grid  = document.getElementById('gradeGrid');
    const empty = document.getElementById('gradeEmpty');
    const badge = document.getElementById('tabBadgeGrade');
    if (!grid) return;

    if (badge) badge.textContent = this.state.grades.length;

    if (!this.state.grades.length) {
      grid.innerHTML = '';
      empty?.classList.remove('hidden');
      return;
    }
    empty?.classList.add('hidden');

    grid.innerHTML = this.state.grades.map((g) => {
      const alert = Number(g.estoque) <= Number(g.estoque_minimo || 0) && Number(g.estoque_minimo || 0) > 0;
      return `
        <div class="grade-card ${alert ? 'grade-card--alert' : ''}">
          <div class="grade-card__label">${escapeHtml(g.atributo1)}</div>
          ${g.atributo2 ? `<div class="grade-card__sub">${escapeHtml(g.atributo2)}</div>` : ''}
          <div class="grade-card__estoque">Estoque: <strong>${Number(g.estoque || 0)}</strong></div>
          ${g.preco ? `<div style="font-size:12px;color:var(--primary);margin-bottom:6px">${toCurrency(g.preco)}</div>` : ''}
          <div class="grade-card__actions">
            <button type="button" class="btn-inline" data-action="gradeEdit" data-id="${g.id}" title="Editar">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button type="button" class="btn-inline btn-inline--danger" data-action="gradeDelete" data-id="${g.id}" title="Excluir">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>`;
    }).join('');
  },

  async handleGradeToggle() {
    if (!this.state.editingId) return;
    const toggle = document.getElementById('gradeToggleInput');
    const content = document.getElementById('gradeContent');
    const disabledMsg = document.getElementById('gradeDisabledMsg');

    const item = this.state.items.find((p) => Number(p.id) === Number(this.state.editingId));
    if (item?.e_kit) {
      showToast('Não é possível ativar grade em um produto que já é kit.', 'error');
      if (toggle) toggle.checked = false;
      return;
    }

    try {
      const res = await api.toggleGrade(this.state.editingId);
      const ativo = res.tem_grade;
      if (toggle) toggle.checked = ativo;
      content?.classList.toggle('hidden', !ativo);
      disabledMsg?.classList.toggle('hidden', ativo);
      if (ativo) {
        const r = await api.getGradesProduto(this.state.editingId);
        this.state.grades = r.grades || [];
        this.renderGrades();
      }
      await this.load();
    } catch (err) {
      showToast(buildFriendlyError(err), 'error');
      const item2 = this.state.items.find((p) => Number(p.id) === Number(this.state.editingId));
      if (toggle && item2) toggle.checked = Boolean(item2.tem_grade);
    }
  },

  async handleGradeAdd() {
    if (!this.state.editingId) return;
    const atrib1  = document.getElementById('gradeAtrib1')?.value?.trim();
    const atrib2  = document.getElementById('gradeAtrib2')?.value?.trim();
    const estoque = Number(document.getElementById('gradeEstoque')?.value || 0);
    const preco   = Number(document.getElementById('gradePreco')?.value || 0) || null;

    if (!atrib1) { showToast('Informe o atributo 1 (ex: tamanho).', 'error'); return; }

    const btn = document.getElementById('gradeAddBtn');
    if (btn) btn.disabled = true;
    try {
      await api.createGrade(this.state.editingId, { atributo1: atrib1, atributo2: atrib2 || null, estoque, preco });
      document.getElementById('gradeAtrib1').value = '';
      document.getElementById('gradeAtrib2').value = '';
      document.getElementById('gradeEstoque').value = '0';
      document.getElementById('gradePreco').value = '';
      const res = await api.getGradesProduto(this.state.editingId);
      this.state.grades = res.grades || [];
      this.renderGrades();
      await this.load();
      showToast('Variação adicionada.', 'success');
    } catch (err) { showToast(buildFriendlyError(err), 'error'); }
    finally { if (btn) btn.disabled = false; }
  },

  handleGradeEditInline(gradeId) {
    const card = document.querySelector(`[data-action="gradeEdit"][data-id="${gradeId}"]`)?.closest('.grade-card');
    if (!card) return;
    const grade = this.state.grades.find((g) => Number(g.id) === gradeId);
    if (!grade) return;

    card.innerHTML = `
      <input type="text" value="${escapeHtml(grade.atributo1)}" id="gradeEditAtrib1_${gradeId}" style="width:100%;margin-bottom:4px;padding:5px;border:1px solid var(--border);border-radius:4px;font-size:12px" />
      <input type="text" value="${escapeHtml(grade.atributo2||'')}" placeholder="Cor (opcional)" id="gradeEditAtrib2_${gradeId}" style="width:100%;margin-bottom:4px;padding:5px;border:1px solid var(--border);border-radius:4px;font-size:12px" />
      <input type="number" value="${Number(grade.estoque||0)}" id="gradeEditEstoque_${gradeId}" style="width:100%;margin-bottom:4px;padding:5px;border:1px solid var(--border);border-radius:4px;font-size:12px" />
      <div class="grade-card__actions">
        <button type="button" class="btn-inline" data-action="gradeEditSave" data-id="${gradeId}">Salvar</button>
        <button type="button" class="btn-inline btn-inline--danger" onclick="this.closest('.grade-card').parentNode && location.reload()">×</button>
      </div>`;
  },

  async handleGradeEditSave(gradeId) {
    const atrib1  = document.getElementById(`gradeEditAtrib1_${gradeId}`)?.value?.trim();
    const atrib2  = document.getElementById(`gradeEditAtrib2_${gradeId}`)?.value?.trim();
    const estoque = Number(document.getElementById(`gradeEditEstoque_${gradeId}`)?.value || 0);
    if (!atrib1) { showToast('Atributo 1 é obrigatório.', 'error'); return; }
    try {
      await api.updateGrade(gradeId, { atributo1: atrib1, atributo2: atrib2 || null, estoque });
      const res = await api.getGradesProduto(this.state.editingId);
      this.state.grades = res.grades || [];
      this.renderGrades();
      await this.load();
      showToast('Variação atualizada.', 'success');
    } catch (err) { showToast(buildFriendlyError(err), 'error'); }
  },

  async handleGradeDelete(gradeId) {
    const ok = await confirmarAcao('Excluir esta variação?', 'Excluir', 'danger');
    if (!ok) return;
    try {
      await api.deleteGrade(gradeId);
      const res = await api.getGradesProduto(this.state.editingId);
      this.state.grades = res.grades || [];
      this.renderGrades();
      await this.load();
      showToast('Variação excluída.', 'success');
    } catch (err) { showToast(buildFriendlyError(err), 'error'); }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KIT
  // ═══════════════════════════════════════════════════════════════════════════

  async loadKit(item) {
    const toggle = document.getElementById('kitToggleInput');
    const content = document.getElementById('kitContent');
    const disabledMsg = document.getElementById('kitDisabledMsg');
    if (!toggle) return;

    const eKit = Boolean(item.e_kit);
    toggle.checked = eKit;

    if (eKit) {
      content?.classList.remove('hidden');
      disabledMsg?.classList.add('hidden');
      await this.refreshKitData(item.id);
    } else {
      content?.classList.add('hidden');
      disabledMsg?.classList.remove('hidden');
    }

    // Popula select de produtos
    await this.populateKitSelect(item.id);
  },

  async refreshKitData(kitId) {
    try {
      const res = await api.getKitComponentes(kitId);
      this.state.kitComponentes = res.componentes || [];
      this.state.kitEstoque = res.estoque_kit || 0;
    } catch { this.state.kitComponentes = []; this.state.kitEstoque = 0; }
    this.renderKitComponentes();
  },

  async populateKitSelect(kitId) {
    const sel = document.getElementById('kitProdutoSelect');
    if (!sel) return;
    try {
      if (!this.state.allProdutos.length) {
        const items = await api.getProdutos();
        this.state.allProdutos = Array.isArray(items) ? items : [];
      }
      const disponíveis = this.state.allProdutos.filter((p) => Number(p.id) !== Number(kitId) && !p.e_kit);
      sel.innerHTML = '<option value="">Selecione o produto...</option>' +
        disponíveis.map((p) => `<option value="${p.id}">${escapeHtml(p.nome)} (Est: ${p.estoque})</option>`).join('');
    } catch { /* silencioso */ }
  },

  renderKitComponentes() {
    const list  = document.getElementById('kitList');
    const empty = document.getElementById('kitEmpty');
    const badge = document.getElementById('tabBadgeKit');
    const estoqueInfo = document.getElementById('kitEstoqueVal');
    if (!list) return;

    if (badge) badge.textContent = this.state.kitComponentes.length;
    if (estoqueInfo) estoqueInfo.textContent = this.state.kitEstoque;

    if (!this.state.kitComponentes.length) {
      list.innerHTML = '';
      empty?.classList.remove('hidden');
      return;
    }
    empty?.classList.add('hidden');

    list.innerHTML = this.state.kitComponentes.map((comp) => `
      <div class="kit-row">
        <div class="kit-row__nome">${escapeHtml(comp.componente_nome || '-')}</div>
        <div class="kit-row__info">${Number(comp.quantidade)} por kit</div>
        <div class="kit-row__estoque">Est: ${comp.estoque_componente ?? '-'}</div>
        <button type="button" class="btn-inline btn-inline--danger" data-action="kitDelete" data-id="${comp.id}" style="flex-shrink:0">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>`).join('');
  },

  async handleKitToggle() {
    if (!this.state.editingId) return;
    const toggle = document.getElementById('kitToggleInput');
    const content = document.getElementById('kitContent');
    const disabledMsg = document.getElementById('kitDisabledMsg');

    const item = this.state.items.find((p) => Number(p.id) === Number(this.state.editingId));
    if (item?.tem_grade) {
      showToast('Não é possível ativar kit em um produto com grade. Desative a grade primeiro.', 'error');
      if (toggle) toggle.checked = false;
      return;
    }

    try {
      const res = await api.toggleKit(this.state.editingId);
      const ativo = res.e_kit;
      if (toggle) toggle.checked = ativo;
      content?.classList.toggle('hidden', !ativo);
      disabledMsg?.classList.toggle('hidden', ativo);
      if (ativo) await this.refreshKitData(this.state.editingId);
      await this.load();
    } catch (err) {
      showToast(buildFriendlyError(err), 'error');
      const item2 = this.state.items.find((p) => Number(p.id) === Number(this.state.editingId));
      if (toggle && item2) toggle.checked = Boolean(item2.e_kit);
    }
  },

  async handleKitAdd() {
    if (!this.state.editingId) return;
    const sel = document.getElementById('kitProdutoSelect');
    const qtd = Number(document.getElementById('kitQtd')?.value || 1);
    const compId = Number(sel?.value);

    if (!compId) { showToast('Selecione um produto componente.', 'error'); return; }
    if (!qtd || qtd <= 0) { showToast('Informe uma quantidade válida.', 'error'); return; }

    const btn = document.getElementById('kitAddBtn');
    if (btn) btn.disabled = true;
    try {
      await api.addKitComponente(this.state.editingId, { componente_id: compId, quantidade: qtd });
      if (sel) sel.value = '';
      document.getElementById('kitQtd').value = '1';
      await this.refreshKitData(this.state.editingId);
      await this.load();
      showToast('Componente adicionado.', 'success');
    } catch (err) { showToast(buildFriendlyError(err), 'error'); }
    finally { if (btn) btn.disabled = false; }
  },

  async handleKitDelete(compId) {
    const ok = await confirmarAcao('Remover este componente do kit?', 'Remover', 'danger');
    if (!ok) return;
    try {
      await api.deleteKitComponente(this.state.editingId, compId);
      await this.refreshKitData(this.state.editingId);
      await this.load();
      showToast('Componente removido.', 'success');
    } catch (err) { showToast(buildFriendlyError(err), 'error'); }
  },

  // ── Utilitários ────────────────────────────────────────────────────────────

  setLoading(value) {
    this.state.loading = value;
    this.cacheElements();
    if (this.el.toolbarRefresh) this.el.toolbarRefresh.disabled = value;
    if (this.el.toolbarNew) this.el.toolbarNew.disabled = value;
  },

  // ── Marketplace ──────────────────────────────────────────────────────────────

  async abrirMarketplace() {
    if (!document.getElementById('mktModal')) {
      const el = document.createElement('div');
      el.className = 'modal-overlay hidden';
      el.id = 'mktModal';
      el.innerHTML = `
        <div class="modal-card" style="max-width:720px;width:95vw">
          <div class="modal-card__header">
            <div>
              <h3><i class="fa-solid fa-store" style="margin-right:8px"></i>Marketplace</h3>
              <p style="color:var(--text-muted);font-size:.9rem">Sincronize produtos com Mercado Livre e Shopee</p>
            </div>
            <button type="button" class="icon-button" onclick="document.getElementById('mktModal').classList.add('hidden')">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div id="mktCorpo" style="padding:20px 24px;overflow-y:auto;max-height:70vh"></div>
          <div class="modal-card__footer" style="padding:16px 24px;border-top:1px solid var(--border);display:flex;justify-content:flex-end">
            <button type="button" class="btn btn-light" onclick="document.getElementById('mktModal').classList.add('hidden')">Fechar</button>
          </div>
        </div>`;
      document.body.appendChild(el);
    }
    document.getElementById('mktModal').classList.remove('hidden');
    await this._renderMarketplace();
  },

  async _renderMarketplace() {
    const corpo = document.getElementById('mktCorpo');
    if (!corpo) return;
    corpo.innerHTML = `<div class="module-feedback module-feedback--info">Carregando...</div>`;

    try {
      const [cfgData, prodData] = await Promise.all([
        api.request('/marketplace/config'),
        api.request('/marketplace/produtos')
      ]);

      const plataformas = cfgData.plataformas || [];
      const produtos    = prodData.produtos    || [];

      const statusBadge = (s) => s === 'conectado'
        ? `<span class="badge badge--success">Conectado</span>`
        : `<span class="badge badge--warning">Desconectado</span>`;

      corpo.innerHTML = `
        <!-- Plataformas conectadas -->
        <h4 style="font-size:.9rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:10px">Plataformas</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
          ${['mercadolivre', 'shopee'].map((plat) => {
            const cfg = plataformas.find((p) => p.plataforma === plat);
            return `
              <div style="border:1px solid var(--border);border-radius:14px;padding:14px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                  <strong style="text-transform:capitalize">${plat.replace('mercadolivre','Mercado Livre')}</strong>
                  ${statusBadge(cfg?.status_conexao || 'desconectado')}
                </div>
                ${cfg?.seller_id ? `<div style="font-size:.8rem;color:var(--text-muted)">Seller ID: ${cfg.seller_id}</div>` : ''}
                <div style="margin-top:10px;display:flex;gap:8px">
                  <button class="btn btn-light btn-sm" onclick="ProdutosModule._configurarMkt('${plat}')">
                    <i class="fa-solid fa-gear"></i> Config
                  </button>
                  ${plat === 'mercadolivre' ? `
                    <button class="btn btn-light btn-sm" onclick="ProdutosModule._autorizarMkt('${plat}')">
                      <i class="fa-solid fa-link"></i> Autorizar
                    </button>` : ''}
                </div>
              </div>`;
          }).join('')}
        </div>

        <!-- Produtos vinculados -->
        <h4 style="font-size:.9rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:10px">
          Produtos vinculados (${produtos.length})
        </h4>
        ${produtos.length === 0
          ? `<div class="empty-state">Nenhum produto vinculado ainda. Use o botão na linha do produto para vincular.</div>`
          : `<div class="table-wrapper">
             <table class="data-table">
               <thead><tr>
                 <th>Produto</th><th>Plataforma</th><th>Listing ID</th>
                 <th class="text-right">Est. LF</th><th class="text-right">Est. pub.</th>
                 <th class="text-right">Ações</th>
               </tr></thead>
               <tbody>
                 ${produtos.map((p) => `
                   <tr>
                     <td><strong>${escapeHtml(p.produto_nome)}</strong></td>
                     <td style="text-transform:capitalize">${escapeHtml(p.plataforma.replace('mercadolivre','ML'))}</td>
                     <td><code style="font-size:.82rem">${escapeHtml(p.listing_id)}</code></td>
                     <td class="text-right">${p.estoque_lferp}</td>
                     <td class="text-right">${p.estoque_publicado}</td>
                     <td class="text-right">
                       <button class="btn-inline" onclick="ProdutosModule._syncEstoque(${p.produto_id},'${p.plataforma}')">
                         <i class="fa-solid fa-sync"></i> Sync
                       </button>
                       <button class="btn-inline btn-inline--danger" onclick="ProdutosModule._desvincular(${p.id})">
                         <i class="fa-solid fa-unlink"></i>
                       </button>
                     </td>
                   </tr>`).join('')}
               </tbody>
             </table>
             </div>`}`;
    } catch (err) {
      corpo.innerHTML = `<div class="module-feedback module-feedback--error">${escapeHtml(err.message)}</div>`;
    }
  },

  async _configurarMkt(plataforma) {
    const appId = prompt(`App ID (Client ID) do ${plataforma}:`);
    if (!appId?.trim()) return;
    const secret = prompt('Client Secret:') || '';
    try {
      await api.request('/marketplace/config', {
        method: 'PUT',
        body: { plataforma, app_id: appId.trim(), client_secret: secret }
      });
      showToast('Configuração salva! Agora clique em Autorizar.', 'success');
      await this._renderMarketplace();
    } catch (e) { showToast(e.message, 'error'); }
  },

  async _autorizarMkt(plataforma) {
    try {
      const data = await api.request('/marketplace/oauth/url', { method: 'GET', query: { plataforma } });
      if (data.url) window.open(data.url, '_blank', 'width=600,height=700');
    } catch (e) { showToast(e.message, 'error'); }
  },

  async _syncEstoque(produtoId, plataforma) {
    try {
      const r = await api.request('/marketplace/sync-estoque', {
        method: 'POST',
        body: { produto_id: produtoId, plataforma }
      });
      showToast(r.mensagem || 'Sincronizado!', 'success');
      await this._renderMarketplace();
    } catch (e) { showToast(e.message, 'error'); }
  },

  async _desvincular(id) {
    if (!confirm('Remover vínculo com esta plataforma?')) return;
    try {
      await api.request(`/marketplace/vincular/${id}`, { method: 'DELETE' });
      showToast('Vínculo removido', 'success');
      await this._renderMarketplace();
    } catch (e) { showToast(e.message, 'error'); }
  },

  atualizarBotaoLote() {
    const btn   = document.getElementById('produtosLoteBtn');
    const badge = document.getElementById('produtosLoteBadge');
    const n = this.state.selectedIds.size;
    if (btn)   { btn.style.display = n > 0 ? '' : 'none'; }
    if (badge) badge.textContent = String(n);
  },

  imprimirLote() {
    const ids = [...this.state.selectedIds];
    if (!ids.length) return;

    const selecionados = ids
      .map((id) => this.state.items.find((p) => p.id === id))
      .filter(Boolean);

    if (!selecionados.length) return;

    // Pede quantidade uniforme de cópias extras
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
      <div style="background:var(--surface);border-radius:16px;padding:24px;max-width:380px;width:100%;box-shadow:0 24px 50px rgba(0,0,0,.2)">
        <h3 style="margin:0 0 6px;font-size:16px;font-weight:700">
          <i class="fa-solid fa-tags"></i> Imprimir etiquetas em lote
        </h3>
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 16px">
          <strong>${selecionados.length}</strong> produto(s) selecionado(s).
        </p>
        <div style="margin-bottom:16px">
          <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px;text-transform:uppercase">Cópias por produto</label>
          <input type="number" id="_loteQtd" value="1" min="1" max="100"
            style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:15px;font-weight:700;box-sizing:border-box" />
          <small style="color:var(--text-muted);font-size:11px">Cada produto imprimirá esta quantidade de etiquetas</small>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button id="_loteCancelar" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--surface-3);font-size:13px;cursor:pointer">Cancelar</button>
          <button id="_loteAbrir" style="padding:8px 16px;border-radius:8px;border:none;background:var(--primary);color:#fff;font-size:13px;font-weight:600;cursor:pointer">
            <i class="fa-solid fa-print"></i> Abrir para impressão
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#_loteCancelar').onclick = () => document.body.removeChild(overlay);
    overlay.querySelector('#_loteAbrir').onclick = () => {
      const qtd = Math.max(1, Number(overlay.querySelector('#_loteQtd').value) || 1);
      document.body.removeChild(overlay);

      const dados = selecionados.map((item) => ({
        nome:          item.nome || '',
        preco:         Number(item.preco || 0),
        codigo_barras: item.codigo_barras || '',
        categoria:     item.categoria || '',
        empresa_nome:  this.state.empresa || 'LF ERP',
        variacao:      '',
        quantidade:    qtd
      }));

      localStorage.setItem('lf_erp_etiquetas', JSON.stringify(dados));
      window.open('./etiquetas.html', '_blank');
    };
  },

  imprimirTodas() {
    const lista = this.state.filteredItems.length
      ? this.state.filteredItems
      : this.state.items;

    if (!lista.length) {
      showToast('Nenhum produto carregado para imprimir', 'warning');
      return;
    }

    const dados = lista.map((item) => ({
      nome:          item.nome || '',
      preco:         Number(item.preco || 0),
      codigo_barras: item.codigo_barras || '',
      categoria:     item.categoria || '',
      empresa_nome:  this.state.empresa || 'LF ERP',
      variacao:      '',
      quantidade:    1
    }));

    localStorage.setItem('lf_erp_etiquetas', JSON.stringify(dados));
    window.open('./etiquetas.html', '_blank');
  },

  async imprimirHoje() {
    try {
      showToast('Buscando produtos de hoje…', 'info');
      const resp = await api.request(`/produtos/etiquetas-hoje/${this.state.empresa}`);
      const itens = (resp && resp.dados) ? resp.dados : [];

      if (!itens.length) {
        showToast('Nenhum produto registrado hoje', 'warning');
        return;
      }

      const dados = itens.map((item) => ({
        nome:          item.nome || '',
        preco:         Number(item.preco || 0),
        codigo_barras: item.codigo_barras || '',
        categoria:     item.categoria || '',
        empresa_nome:  this.state.empresa || 'LF ERP',
        variacao:      '',
        quantidade:    1
      }));

      localStorage.setItem('lf_erp_etiquetas', JSON.stringify(dados));
      window.open('./etiquetas.html', '_blank');
    } catch (e) {
      showToast(e.message || 'Erro ao buscar produtos de hoje', 'error');
    }
  },

  abrirEtiqueta(produtoId) {
    const item = this.state.items.find((p) => Number(p.id) === produtoId);
    if (!item) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
      <div style="background:var(--surface);border-radius:16px;padding:24px;max-width:360px;width:100%;box-shadow:0 24px 50px rgba(0,0,0,.2)">
        <h3 style="margin:0 0 6px;font-size:16px;font-weight:700"><i class="fa-solid fa-tag"></i> Imprimir Etiqueta</h3>
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 16px">${String(item.nome).substring(0, 50)}</p>
        <div style="display:grid;gap:12px;margin-bottom:16px">
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px;text-transform:uppercase">Quantidade de etiquetas</label>
            <input type="number" id="_etiqQtd" value="1" min="1" max="100"
              style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:15px;font-weight:700;box-sizing:border-box" />
          </div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button id="_etiqCancelar" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--surface-3);font-size:13px;cursor:pointer">Cancelar</button>
          <button id="_etiqAbrir" style="padding:8px 16px;border-radius:8px;border:none;background:var(--primary);color:#fff;font-size:13px;font-weight:600;cursor:pointer">
            <i class="fa-solid fa-print"></i> Abrir para impressão
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#_etiqCancelar').onclick = () => document.body.removeChild(overlay);
    overlay.querySelector('#_etiqAbrir').onclick = () => {
      const qtd = Math.max(1, Number(overlay.querySelector('#_etiqQtd').value) || 1);
      document.body.removeChild(overlay);

      const dados = [{
        nome:          item.nome || '',
        preco:         Number(item.preco || 0),
        codigo_barras: item.codigo_barras || '',
        categoria:     item.categoria || '',
        empresa_nome:  this.state.empresa || 'LF ERP',
        variacao:      '',
        quantidade:    qtd
      }];

      localStorage.setItem('lf_erp_etiquetas', JSON.stringify(dados));
      window.open('./etiquetas.html', '_blank');
    };
  },

  showModuleMessage(message, type = 'info') {
    this.cacheElements();
    if (!this.el.feedback) return;
    if (!message) { this.el.feedback.className = 'module-feedback'; this.el.feedback.textContent = ''; return; }
    this.el.feedback.className = `module-feedback module-feedback--${type}`;
    this.el.feedback.textContent = message;
  },

  setFormFeedback(message, type = 'info') {
    this.cacheElements();
    if (!this.el.formFeedback) return;
    if (!message) { this.el.formFeedback.className = 'form-feedback'; this.el.formFeedback.textContent = ''; return; }
    this.el.formFeedback.className = `form-feedback form-feedback--${type}`;
    this.el.formFeedback.textContent = message;
  }
};

export async function initProdutosModule() {
  ProdutosModule.init();
  await ProdutosModule.load();
}

export default ProdutosModule;
