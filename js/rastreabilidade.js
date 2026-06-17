import api from './api.js';
import { showToast, confirmarAcao } from './feedback.js';

function esc(v) { return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function dataBR(d) { if (!d) return '—'; const [y,m,dia] = String(d).substring(0,10).split('-'); return `${dia}/${m}/${y}`; }

const STATUS_SERIE = {
  disponivel: { label: 'Disponível',  cor: 'var(--success)', bg: 'var(--success-soft)' },
  vendido:    { label: 'Vendido',     cor: '#2563eb',        bg: '#dbeafe' },
  devolvido:  { label: 'Devolvido',   cor: 'var(--warning)', bg: 'var(--warning-soft)' },
  defeito:    { label: 'Defeito',     cor: 'var(--danger)',  bg: 'var(--danger-soft)' }
};

const RastreabilidadeModule = {
  state: {
    tab: 'lotes',
    lotes: [], series: [], produtos: [],
    filtroLoteProd: '', filtroSerieStatus: '', filtroSerieProd: '',
    initialized: false
  },

  async init() {
    if (!this.state.initialized) {
      this.injectStyles();
      this.render();
      this.bindEvents();
      this.state.initialized = true;
    }
    await Promise.all([this.loadDashboard(), this.loadProdutos()]);
    await this.loadTab(this.state.tab);
  },

  async loadDashboard() {
    try {
      const data = await api.fetchAPI('/rastreabilidade/dashboard');
      this.renderKpis(data);
    } catch { /* ignora se vazio */ }
  },

  async loadProdutos() {
    try {
      const data = await api.fetchAPI('/rastreabilidade/produtos');
      this.state.produtos = data.produtos || [];
    } catch { this.state.produtos = []; }
  },

  async loadTab(tab) {
    this.state.tab = tab;
    document.querySelectorAll('.rast-tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'lotes')   await this.loadLotes();
    if (tab === 'series')  await this.loadSeries();
    if (tab === 'rastrear') this.renderRastrear();
    if (tab === 'config')  this.renderConfig();
  },

  // ── KPIs ──────────────────────────────────────────────────────────────────

  renderKpis(d) {
    const el = document.getElementById('rastKpis');
    if (!el) return;
    el.innerHTML = `
      <div class="rast-kpi"><div class="rast-kpi-label">Lotes ativos</div><div class="rast-kpi-val">${d.lotes_ativos}</div></div>
      <div class="rast-kpi ${d.lotes_vencidos > 0 ? 'rast-kpi--danger' : ''}">
        <div class="rast-kpi-label">Lotes vencidos</div><div class="rast-kpi-val">${d.lotes_vencidos}</div>
      </div>
      <div class="rast-kpi ${d.lotes_vencendo > 0 ? 'rast-kpi--warn' : ''}">
        <div class="rast-kpi-label">Vencendo em 30 dias</div><div class="rast-kpi-val">${d.lotes_vencendo}</div>
      </div>
      <div class="rast-kpi"><div class="rast-kpi-label">Series disponíveis</div><div class="rast-kpi-val">${d.series_disponivel}</div></div>
      <div class="rast-kpi"><div class="rast-kpi-label">Series vendidas</div><div class="rast-kpi-val">${d.series_vendido}</div></div>
      ${d.series_defeito > 0 ? `<div class="rast-kpi rast-kpi--danger"><div class="rast-kpi-label">Com defeito</div><div class="rast-kpi-val">${d.series_defeito}</div></div>` : ''}
    `;
  },

  // ── Lotes ─────────────────────────────────────────────────────────────────

  async loadLotes() {
    const params = {};
    if (this.state.filtroLoteProd) params.produto_id = this.state.filtroLoteProd;
    try {
      const data = await api.fetchAPI('/rastreabilidade/lotes', 'GET', null, params);
      this.state.lotes = data.lotes || [];
      this.renderLotes();
    } catch (err) { showToast(err.message || 'Erro', 'error'); }
  },

  renderLotes() {
    const el = document.getElementById('rastContent');
    if (!el) return;

    el.innerHTML = `
      <div class="rast-toolbar">
        <select id="rastFiltroLoteProd" class="filter-input" style="min-width:180px;">
          <option value="">Todos os produtos</option>
          ${this.state.produtos.filter((p) => p.controla_rastreabilidade === 'lote').map((p) =>
            `<option value="${p.id}" ${this.state.filtroLoteProd == p.id ? 'selected' : ''}>${esc(p.nome)}</option>`
          ).join('')}
        </select>
        <button class="btn btn-primary btn-sm" id="novoLoteBtn"><i class="fa fa-plus"></i> Novo lote</button>
      </div>
      ${this.state.lotes.length === 0
        ? `<div class="rast-empty"><i class="fa fa-boxes-stacked" style="font-size:32px;display:block;margin-bottom:10px;"></i>Nenhum lote encontrado.<br>Registre produtos com controle de lote em "Configurar".</div>`
        : `<div class="rast-table-wrap"><table>
            <thead><tr>
              <th>Produto</th><th>Nº Lote</th><th>Fabricação</th><th>Validade</th>
              <th class="text-right">Entrada</th><th class="text-right">Saldo</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              ${this.state.lotes.map((l) => {
                const vencido  = l.vencido;
                const vencendo = l.vencendo;
                const statusCls = vencido ? 'rast-badge--danger' : vencendo ? 'rast-badge--warn' : 'rast-badge--ok';
                const statusLabel = vencido ? 'Vencido' : vencendo ? 'Vencendo' : 'OK';
                return `<tr>
                  <td>${esc(l.produto_nome || l.produto_nome_atual)}</td>
                  <td><code style="font-size:12px;">${esc(l.numero)}</code></td>
                  <td>${dataBR(l.data_fabricacao)}</td>
                  <td class="${vencido ? 'rast-text-danger' : vencendo ? 'rast-text-warn' : ''}">${dataBR(l.data_validade)}</td>
                  <td class="text-right">${l.quantidade_entrada}</td>
                  <td class="text-right"><strong>${l.quantidade_atual}</strong></td>
                  <td><span class="rast-badge ${statusCls}">${statusLabel}</span></td>
                  <td>
                    <button class="btn-icon" data-detalhe-lote="${l.id}" title="Detalhe"><i class="fa fa-eye"></i></button>
                    <button class="btn-icon" data-saida-lote="${l.id}" title="Registrar saída"><i class="fa fa-arrow-up-from-bracket"></i></button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
           </table></div>`
      }
    `;

    document.getElementById('rastFiltroLoteProd')?.addEventListener('change', (e) => {
      this.state.filtroLoteProd = e.target.value;
      this.loadLotes();
    });
    document.getElementById('novoLoteBtn')?.addEventListener('click', () => this.abrirFormLote());
    el.querySelectorAll('[data-detalhe-lote]').forEach((btn) =>
      btn.addEventListener('click', () => this.verDetalheLote(Number(btn.dataset.detalheLote)))
    );
    el.querySelectorAll('[data-saida-lote]').forEach((btn) =>
      btn.addEventListener('click', () => this.registrarSaida(Number(btn.dataset.saidaLote)))
    );
  },

  abrirFormLote(lote = null) {
    const modal = document.getElementById('rastModal');
    document.getElementById('rastModalTitle').textContent = 'Novo lote';
    document.getElementById('rastModalBody').innerHTML = `
      <form id="rastLoteForm" style="display:flex;flex-direction:column;gap:12px;">
        <div class="rast-form-row">
          <div class="rast-form-group">
            <label>Produto *</label>
            <select id="rlProduto" class="filter-input" required>
              <option value="">Selecione...</option>
              ${this.state.produtos.filter((p) => p.controla_rastreabilidade === 'lote').map((p) =>
                `<option value="${p.id}">${esc(p.nome)}</option>`).join('')}
            </select>
          </div>
          <div class="rast-form-group">
            <label>Nº do Lote *</label>
            <input id="rlNumero" class="filter-input" required placeholder="LOT-2024-001">
          </div>
        </div>
        <div class="rast-form-row">
          <div class="rast-form-group">
            <label>Data de Fabricação</label>
            <input id="rlFabricacao" class="filter-input" type="date">
          </div>
          <div class="rast-form-group">
            <label>Data de Validade</label>
            <input id="rlValidade" class="filter-input" type="date">
          </div>
        </div>
        <div class="rast-form-row">
          <div class="rast-form-group">
            <label>Quantidade (entrada)</label>
            <input id="rlQuantidade" class="filter-input" type="number" min="0" value="0">
          </div>
          <div class="rast-form-group">
            <label>Nº Compra (opcional)</label>
            <input id="rlCompraId" class="filter-input" type="number" placeholder="ID da compra">
          </div>
        </div>
        <div class="rast-form-group">
          <label>Observações</label>
          <textarea id="rlObs" class="filter-input" rows="2" style="resize:vertical;"></textarea>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button type="button" class="btn btn-secondary btn-sm" id="rastModalCancelBtn">Cancelar</button>
          <button type="submit" class="btn btn-primary btn-sm">Salvar lote</button>
        </div>
      </form>`;
    modal.style.display = 'flex';
    document.getElementById('rastLoteForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.salvarLote();
    });
    document.getElementById('rastModalCancelBtn').addEventListener('click', () => { modal.style.display = 'none'; });
  },

  async salvarLote() {
    const payload = {
      produto_id:      document.getElementById('rlProduto').value,
      numero:          document.getElementById('rlNumero').value.trim(),
      data_fabricacao: document.getElementById('rlFabricacao').value || null,
      data_validade:   document.getElementById('rlValidade').value || null,
      quantidade:      parseInt(document.getElementById('rlQuantidade').value) || 0,
      compra_id:       parseInt(document.getElementById('rlCompraId').value) || null,
      observacoes:     document.getElementById('rlObs').value.trim() || null
    };
    if (!payload.produto_id || !payload.numero) { showToast('Produto e número são obrigatórios', 'error'); return; }
    try {
      await api.fetchAPI('/rastreabilidade/lotes', 'POST', payload);
      showToast('Lote registrado!', 'success');
      document.getElementById('rastModal').style.display = 'none';
      await this.loadLotes();
      await this.loadDashboard();
    } catch (err) { showToast(err.message || 'Erro', 'error'); }
  },

  async verDetalheLote(id) {
    try {
      const data = await api.fetchAPI(`/rastreabilidade/lotes/${id}`);
      const l = data.lote;
      const movs = data.movimentos;
      const modal = document.getElementById('rastModal');
      document.getElementById('rastModalTitle').textContent = `Lote ${l.numero}`;
      document.getElementById('rastModalBody').innerHTML = `
        <div class="rast-detalhe-info">
          <div><strong>Produto:</strong> ${esc(l.produto_nome || l.produto_nome_atual)}</div>
          <div><strong>Fabricação:</strong> ${dataBR(l.data_fabricacao)}</div>
          <div><strong>Validade:</strong> ${dataBR(l.data_validade)}</div>
          <div><strong>Entrada:</strong> ${l.quantidade_entrada} | <strong>Saldo:</strong> ${l.quantidade_atual}</div>
          ${l.observacoes ? `<div><strong>Obs:</strong> ${esc(l.observacoes)}</div>` : ''}
        </div>
        <div class="rast-section-label">Movimentos</div>
        ${movs.length === 0
          ? `<div style="font-size:13px;color:var(--text-muted);text-align:center;padding:16px;">Nenhum movimento</div>`
          : `<table><thead><tr><th>Tipo</th><th>Origem</th><th>Qtd</th><th>Data</th></tr></thead><tbody>
             ${movs.map((m) => `<tr>
               <td><span class="rast-badge ${m.tipo === 'entrada' ? 'rast-badge--ok' : 'rast-badge--danger'}">${m.tipo}</span></td>
               <td style="font-size:12px;">${esc(m.referencia_tipo || '—')} ${m.referencia_id ? `#${m.referencia_id}` : ''} ${m.cliente_nome ? `(${esc(m.cliente_nome)})` : ''}</td>
               <td class="text-right">${m.quantidade}</td>
               <td style="font-size:11px;color:var(--text-muted);">${new Date(m.criado_em).toLocaleString('pt-BR')}</td>
             </tr>`).join('')}
             </tbody></table>`
        }
        <div style="display:flex;justify-content:flex-end;margin-top:12px;">
          <button class="btn btn-secondary btn-sm" id="rastModalCancelBtn">Fechar</button>
        </div>`;
      modal.style.display = 'flex';
      document.getElementById('rastModalCancelBtn').addEventListener('click', () => { modal.style.display = 'none'; });
    } catch (err) { showToast(err.message || 'Erro', 'error'); }
  },

  async registrarSaida(loteId) {
    const qtd = prompt('Quantidade a baixar:');
    if (!qtd || isNaN(Number(qtd)) || Number(qtd) <= 0) return;
    try {
      const data = await api.fetchAPI(`/rastreabilidade/lotes/${loteId}/saida`, 'POST', { quantidade: Number(qtd) });
      showToast(data.mensagem || 'Saída registrada', 'success');
      await this.loadLotes();
      await this.loadDashboard();
    } catch (err) { showToast(err.message || 'Erro', 'error'); }
  },

  // ── Séries ────────────────────────────────────────────────────────────────

  async loadSeries() {
    const params = {};
    if (this.state.filtroSerieProd)   params.produto_id = this.state.filtroSerieProd;
    if (this.state.filtroSerieStatus) params.status     = this.state.filtroSerieStatus;
    try {
      const data = await api.fetchAPI('/rastreabilidade/series', 'GET', null, params);
      this.state.series = data.series || [];
      this.renderSeries();
    } catch (err) { showToast(err.message || 'Erro', 'error'); }
  },

  renderSeries() {
    const el = document.getElementById('rastContent');
    if (!el) return;

    el.innerHTML = `
      <div class="rast-toolbar">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <select id="rastFiltroSerieProd" class="filter-input">
            <option value="">Todos os produtos</option>
            ${this.state.produtos.filter((p) => p.controla_rastreabilidade === 'serie').map((p) =>
              `<option value="${p.id}" ${this.state.filtroSerieProd == p.id ? 'selected' : ''}>${esc(p.nome)}</option>`
            ).join('')}
          </select>
          <select id="rastFiltroSerieStatus" class="filter-input">
            <option value="">Todos os status</option>
            ${Object.entries(STATUS_SERIE).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary btn-sm" id="importarSeriesBtn"><i class="fa fa-file-import"></i> Importar séries</button>
      </div>
      ${this.state.series.length === 0
        ? `<div class="rast-empty"><i class="fa fa-barcode" style="font-size:32px;display:block;margin-bottom:10px;"></i>Nenhum número de série encontrado.</div>`
        : `<div class="rast-table-wrap"><table>
            <thead><tr><th>Nº de Série</th><th>Produto</th><th>Status</th><th>Venda</th><th>Cadastrado</th><th></th></tr></thead>
            <tbody>
              ${this.state.series.map((s) => {
                const st = STATUS_SERIE[s.status] || { label: s.status, cor: '#666', bg: '#eee' };
                return `<tr>
                  <td><code style="font-size:12px;">${esc(s.numero)}</code></td>
                  <td>${esc(s.produto_nome)}</td>
                  <td><span class="rast-badge" style="background:${st.bg};color:${st.cor};">${st.label}</span></td>
                  <td style="font-size:12px;">${s.venda_id ? `#${s.venda_id}` : '—'}</td>
                  <td style="font-size:11px;color:var(--text-muted);">${dataBR(s.criado_em)}</td>
                  <td>
                    <select class="rast-status-sel" data-serie-id="${s.id}" style="font-size:11px;border:1px solid var(--border);border-radius:6px;padding:3px 6px;background:var(--surface-2);">
                      ${Object.entries(STATUS_SERIE).map(([k,v]) => `<option value="${k}" ${s.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
                    </select>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
           </table></div>`
      }
    `;

    document.getElementById('rastFiltroSerieProd')?.addEventListener('change', (e) => { this.state.filtroSerieProd = e.target.value; this.loadSeries(); });
    document.getElementById('rastFiltroSerieStatus')?.addEventListener('change', (e) => { this.state.filtroSerieStatus = e.target.value; this.loadSeries(); });
    document.getElementById('importarSeriesBtn')?.addEventListener('click', () => this.abrirImportarSeries());
    el.querySelectorAll('.rast-status-sel').forEach((sel) => {
      sel.addEventListener('change', () => this.atualizarStatusSerie(sel.dataset.serieId, sel.value));
    });
  },

  async atualizarStatusSerie(id, status) {
    try {
      await api.fetchAPI(`/rastreabilidade/series/${id}/status`, 'PATCH', { status });
      showToast('Status atualizado', 'success');
      await this.loadSeries();
      await this.loadDashboard();
    } catch (err) { showToast(err.message || 'Erro', 'error'); }
  },

  abrirImportarSeries() {
    const modal = document.getElementById('rastModal');
    document.getElementById('rastModalTitle').textContent = 'Importar números de série';
    document.getElementById('rastModalBody').innerHTML = `
      <form id="rastSeriesForm" style="display:flex;flex-direction:column;gap:12px;">
        <div class="rast-form-group">
          <label>Produto *</label>
          <select id="rseProduto" class="filter-input" required>
            <option value="">Selecione...</option>
            ${this.state.produtos.filter((p) => p.controla_rastreabilidade === 'serie').map((p) =>
              `<option value="${p.id}">${esc(p.nome)}</option>`).join('')}
          </select>
        </div>
        <div class="rast-form-group">
          <label>Números de série (um por linha)</label>
          <textarea id="rseNumeros" class="filter-input" rows="8" style="font-family:monospace;font-size:12px;resize:vertical;" placeholder="SN0001&#10;SN0002&#10;SN0003" required></textarea>
        </div>
        <div class="rast-form-group">
          <label>Nº da Compra (opcional)</label>
          <input id="rseCompra" class="filter-input" type="number" placeholder="ID da compra de origem">
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button type="button" class="btn btn-secondary btn-sm" id="rastModalCancelBtn">Cancelar</button>
          <button type="submit" class="btn btn-primary btn-sm">Importar</button>
        </div>
      </form>`;
    modal.style.display = 'flex';
    document.getElementById('rastSeriesForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const produtoId = document.getElementById('rseProduto').value;
      const texto     = document.getElementById('rseNumeros').value;
      const compraId  = parseInt(document.getElementById('rseCompra').value) || null;
      const numeros   = texto.split('\n').map((n) => n.trim()).filter(Boolean);
      if (!produtoId || numeros.length === 0) { showToast('Preencha todos os campos', 'error'); return; }
      try {
        const data = await api.fetchAPI('/rastreabilidade/series', 'POST', { produto_id: produtoId, numeros, compra_id: compraId });
        showToast(`${data.inseridos} série(s) importada(s). ${data.duplicados} duplicada(s) ignorada(s).`, 'success');
        modal.style.display = 'none';
        await this.loadSeries();
        await this.loadDashboard();
      } catch (err) { showToast(err.message || 'Erro', 'error'); }
    });
    document.getElementById('rastModalCancelBtn').addEventListener('click', () => { modal.style.display = 'none'; });
  },

  // ── Rastrear ──────────────────────────────────────────────────────────────

  renderRastrear() {
    const el = document.getElementById('rastContent');
    if (!el) return;
    el.innerHTML = `
      <div style="max-width:600px;">
        <div style="display:flex;gap:10px;margin-bottom:20px;">
          <input id="rastBuscaQ" class="filter-input" style="flex:1;" placeholder="Digite o número de lote ou série...">
          <button class="btn btn-primary" id="rastBuscarBtn"><i class="fa fa-magnifying-glass"></i> Rastrear</button>
        </div>
        <div id="rastResultado"></div>
      </div>`;

    document.getElementById('rastBuscarBtn')?.addEventListener('click', () => this.rastrear());
    document.getElementById('rastBuscaQ')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.rastrear(); });
  },

  async rastrear() {
    const q = document.getElementById('rastBuscaQ')?.value.trim();
    if (!q) return;
    const result = document.getElementById('rastResultado');
    result.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);">Buscando...</div>';
    try {
      const data = await api.fetchAPI('/rastreabilidade/rastrear', 'GET', null, { q });
      const total = data.lotes.length + data.series.length;
      if (total === 0) { result.innerHTML = `<div class="rast-empty">Nenhum resultado para "<strong>${esc(q)}</strong>"</div>`; return; }

      result.innerHTML = `
        ${data.lotes.length > 0 ? `
          <div class="rast-section-label">Lotes encontrados (${data.lotes.length})</div>
          ${data.lotes.map((l) => `
            <div class="rast-result-card">
              <div style="font-weight:600;">${esc(l.numero)} — ${esc(l.produto_nome || l.produto_nome_atual)}</div>
              <div style="font-size:12px;color:var(--text-muted);">Validade: ${dataBR(l.data_validade)} | Entrada: ${l.quantidade_entrada} | Saldo: ${l.quantidade_atual}</div>
            </div>`).join('')}
        ` : ''}
        ${data.series.length > 0 ? `
          <div class="rast-section-label" style="margin-top:16px;">Séries encontradas (${data.series.length})</div>
          ${data.series.map((s) => {
            const st = STATUS_SERIE[s.status] || { label: s.status };
            return `<div class="rast-result-card">
              <div style="font-weight:600;">${esc(s.numero)} — ${esc(s.produto_nome)}</div>
              <div style="font-size:12px;color:var(--text-muted);">Status: ${st.label} | Entrada: ${dataBR(s.criado_em)} ${s.venda_id ? `| Venda #${s.venda_id}` : ''}</div>
            </div>`;
          }).join('')}
        ` : ''}
        ${data.movimentos.length > 0 ? `
          <div class="rast-section-label" style="margin-top:16px;">Histórico de movimentos</div>
          <div class="rast-table-wrap"><table>
            <thead><tr><th>Tipo</th><th>Produto</th><th>Origem</th><th>Qtd</th><th>Data</th></tr></thead>
            <tbody>
              ${data.movimentos.map((m) => `<tr>
                <td><span class="rast-badge ${m.tipo === 'entrada' ? 'rast-badge--ok' : 'rast-badge--danger'}">${m.tipo}</span></td>
                <td style="font-size:12px;">${esc(m.produto_nome)}</td>
                <td style="font-size:12px;">${esc(m.referencia_tipo || '—')} ${m.referencia_id ? `#${m.referencia_id}` : ''} ${m.cliente_nome ? `· ${esc(m.cliente_nome)}` : ''}</td>
                <td class="text-right">${m.quantidade}</td>
                <td style="font-size:11px;color:var(--text-muted);">${new Date(m.criado_em).toLocaleString('pt-BR')}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>
        ` : ''}
      `;
    } catch (err) { result.innerHTML = `<div class="rast-empty" style="color:var(--danger);">${esc(err.message)}</div>`; }
  },

  // ── Config ────────────────────────────────────────────────────────────────

  renderConfig() {
    const el = document.getElementById('rastContent');
    if (!el) return;
    el.innerHTML = `
      <div style="max-width:700px;">
        <div class="rast-info-box" style="margin-bottom:16px;">
          <i class="fa fa-circle-info"></i>
          Configure quais produtos têm rastreabilidade por <strong>Lote</strong> (ex: alimentos, remédios, cosméticos) ou <strong>Número de Série</strong> (ex: eletrônicos, equipamentos).
        </div>
        <div id="rastProdConfigList"></div>
      </div>`;

    this.carregarTodosProdutos();
  },

  async carregarTodosProdutos() {
    try {
      const data = await api.fetchAPI('/produtos?limit=500');
      const todos = data.produtos || data.items || [];
      const el = document.getElementById('rastProdConfigList');
      if (!el) return;

      el.innerHTML = `<div class="rast-table-wrap"><table>
        <thead><tr><th>Produto</th><th>Código</th><th>Rastreabilidade</th></tr></thead>
        <tbody>
          ${todos.map((p) => `
            <tr>
              <td>${esc(p.nome)}</td>
              <td style="font-size:12px;color:var(--text-muted);">${esc(p.codigo_barras || '—')}</td>
              <td>
                <select class="rast-cfg-sel" data-prod-id="${p.id}" style="font-size:12px;border:1px solid var(--border);border-radius:6px;padding:4px 8px;background:var(--surface-2);">
                  <option value="none"    ${(p.controla_rastreabilidade || 'none') === 'none'  ? 'selected':''}>Nenhuma</option>
                  <option value="lote"    ${(p.controla_rastreabilidade || 'none') === 'lote'  ? 'selected':''}>Por Lote</option>
                  <option value="serie"   ${(p.controla_rastreabilidade || 'none') === 'serie' ? 'selected':''}>Por Série</option>
                </select>
              </td>
            </tr>`).join('')}
        </tbody>
      </table></div>`;

      el.querySelectorAll('.rast-cfg-sel').forEach((sel) => {
        sel.addEventListener('change', () => this.configurarProduto(sel.dataset.prodId, sel.value));
      });
    } catch (err) {
      showToast(err.message || 'Erro ao carregar produtos', 'error');
    }
  },

  async configurarProduto(id, modo) {
    try {
      await api.fetchAPI(`/rastreabilidade/produtos/${id}/config`, 'PUT', { controla_rastreabilidade: modo });
      showToast(`Rastreabilidade atualizada`, 'success');
      await this.loadProdutos();
    } catch (err) { showToast(err.message || 'Erro', 'error'); }
  },

  // ── Estrutura e estilos ───────────────────────────────────────────────────

  render() {
    const c = document.getElementById('rastreabilidadeContainer');
    if (!c) return;
    c.innerHTML = `
      <div id="rastKpis" class="rast-kpis"></div>
      <div class="rast-tabs">
        <button class="rast-tab-btn active" data-tab="lotes"><i class="fa fa-boxes-stacked"></i> Lotes</button>
        <button class="rast-tab-btn" data-tab="series"><i class="fa fa-barcode"></i> Nº de Série</button>
        <button class="rast-tab-btn" data-tab="rastrear"><i class="fa fa-magnifying-glass"></i> Rastrear</button>
        <button class="rast-tab-btn" data-tab="config"><i class="fa fa-gear"></i> Configurar</button>
      </div>
      <div id="rastContent" style="margin-top:20px;"></div>
      <!-- Modal -->
      <div id="rastModal" class="rast-modal-overlay" style="display:none;">
        <div class="rast-modal-card">
          <div class="rast-modal-header">
            <h3 id="rastModalTitle">—</h3>
            <button class="btn-icon" id="rastModalGlobalClose"><i class="fa fa-xmark"></i></button>
          </div>
          <div id="rastModalBody" style="padding:16px 24px 24px;overflow-y:auto;max-height:65vh;"></div>
        </div>
      </div>
    `;
  },

  bindEvents() {
    document.getElementById('rastreabilidadeContainer')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.rast-tab-btn');
      if (btn) this.loadTab(btn.dataset.tab);
    });
    document.getElementById('rastModalGlobalClose')?.addEventListener('click', () => {
      document.getElementById('rastModal').style.display = 'none';
    });
    document.getElementById('rastModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
    });
  },

  injectStyles() {
    // estilos migrados para style.css
    if (true) return;
    const s = document.createElement('style');
    s.id = 'rast-styles';
    s.textContent = `
      .rast-kpis { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px; }
      .rast-kpi { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:14px 18px; min-width:120px; flex:1; }
      .rast-kpi--danger { border-color:var(--danger);  background:var(--danger-soft); }
      .rast-kpi--warn   { border-color:var(--warning); background:var(--warning-soft); }
      .rast-kpi-label { font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.4px; margin-bottom:4px; }
      .rast-kpi-val { font-size:1.6rem; font-weight:700; }
      .rast-kpi--danger .rast-kpi-val { color:var(--danger); }
      .rast-kpi--warn .rast-kpi-val   { color:#b45309; }

      .rast-tabs { display:flex; gap:4px; border-bottom:1px solid var(--border); }
      .rast-tab-btn { padding:10px 18px; border:none; background:none; font-size:13px; font-weight:500; color:var(--text-muted); cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; display:flex; align-items:center; gap:6px; transition:.15s; }
      .rast-tab-btn.active { color:var(--primary); border-color:var(--primary); }
      .rast-tab-btn:hover:not(.active) { color:var(--text); }

      .rast-toolbar { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px; }
      .rast-table-wrap { background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
      .rast-empty { padding:60px; text-align:center; font-size:13px; color:var(--text-muted); }
      .rast-badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:20px; font-size:11px; font-weight:600; }
      .rast-badge--ok     { background:var(--success-soft); color:var(--success); }
      .rast-badge--warn   { background:var(--warning-soft); color:var(--warning); }
      .rast-badge--danger { background:var(--danger-soft);  color:var(--danger); }
      .rast-text-danger { color:var(--danger); font-weight:600; }
      .rast-text-warn   { color:#b45309; font-weight:600; }

      .rast-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:1000; display:flex; align-items:center; justify-content:center; }
      .rast-modal-card { background:var(--surface); border-radius:16px; width:100%; max-width:580px; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,.3); margin:16px; }
      .rast-modal-header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px 14px; border-bottom:1px solid var(--border); flex-shrink:0; }
      .rast-modal-header h3 { margin:0; font-size:15px; font-weight:700; }
      .rast-form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .rast-form-group { display:flex; flex-direction:column; gap:4px; }
      .rast-form-group label { font-size:12px; font-weight:600; color:var(--text-muted); }
      .rast-detalhe-info { display:flex; flex-direction:column; gap:6px; font-size:13px; padding-bottom:12px; border-bottom:1px solid var(--border); margin-bottom:12px; }
      .rast-section-label { font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.5px; margin-bottom:8px; margin-top:4px; }
      .rast-result-card { background:var(--surface-2); border:1px solid var(--border); border-radius:10px; padding:12px; margin-bottom:8px; }
      .rast-info-box { padding:12px 16px; background:var(--surface-2); border-radius:8px; font-size:12px; color:var(--text-muted); display:flex; gap:8px; }
      .text-right { text-align:right; }
    `;
    document.head.appendChild(s);
  }
};

export async function initRastreabilidadeModule() {
  return RastreabilidadeModule.init();
}

export default RastreabilidadeModule;
