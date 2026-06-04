import api from './api.js';
import { getAuth } from './auth.js';
import { showToast, confirmarAcao } from './feedback.js';

function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function moeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataFmt(d) {
  if (!d) return '—';
  const [y, m, dia] = String(d).substring(0, 10).split('-');
  return `${dia}/${m}/${y}`;
}

const ESTAGIOS = [
  { key: 'lead',        label: 'Lead',        cor: '#64748b' },
  { key: 'qualificado', label: 'Qualificado',  cor: '#3b82f6' },
  { key: 'proposta',    label: 'Proposta',     cor: '#f59e0b' },
  { key: 'negociacao',  label: 'Negociação',   cor: '#8b5cf6' },
  { key: 'ganho',       label: 'Ganho',        cor: '#22c55e' },
  { key: 'perdido',     label: 'Perdido',      cor: '#ef4444' }
];

const TIPOS_ATIVIDADE = [
  { key: 'ligacao',  label: 'Ligação',  icon: 'fa-phone' },
  { key: 'email',    label: 'E-mail',   icon: 'fa-envelope' },
  { key: 'reuniao',  label: 'Reunião',  icon: 'fa-users' },
  { key: 'nota',     label: 'Nota',     icon: 'fa-note-sticky' }
];

const CrmModule = {
  state: {
    oportunidades: [],
    dashboard: null,
    loading: false,
    view: 'kanban',        // 'kanban' | 'lista'
    filtroEstagio: '',
    filtroBusca: '',
    initialized: false,
    detalheId: null
  },

  async init() {
    if (!this.state.initialized) {
      this.injectStyles();
      this.render();
      this.bindEvents();
      this.state.initialized = true;
    }
    await this.load();
  },

  async load() {
    this.state.loading = true;
    try {
      const params = {};
      if (this.state.filtroEstagio) params.estagio = this.state.filtroEstagio;
      if (this.state.filtroBusca)   params.busca   = this.state.filtroBusca;

      const [dashData, opData] = await Promise.all([
        api.fetchAPI('/crm/dashboard'),
        api.fetchAPI('/crm/oportunidades', 'GET', null, params)
      ]);

      this.state.dashboard     = dashData;
      this.state.oportunidades = opData.oportunidades || [];
      this.renderDashboard();
      this.renderView();
    } catch (err) {
      showToast(err.message || 'Erro ao carregar CRM', 'error');
    } finally {
      this.state.loading = false;
    }
  },

  // ── Render principal ──────────────────────────────────────────────────────

  render() {
    const c = document.getElementById('crmContainer');
    if (!c) return;
    c.innerHTML = `
      <!-- KPIs -->
      <div id="crmKpis" class="crm-kpis"></div>

      <!-- Toolbar -->
      <div class="crm-toolbar">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input id="crmBusca" class="filter-input" placeholder="Buscar oportunidade..." style="min-width:200px;">
          <select id="crmFiltroEstagio" class="filter-input">
            <option value="">Todos os estágios</option>
            ${ESTAGIOS.map((e) => `<option value="${e.key}">${e.label}</option>`).join('')}
          </select>
          <button class="btn btn-secondary btn-sm" id="crmRefreshBtn"><i class="fa fa-rotate"></i></button>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <div class="crm-view-toggle">
            <button id="crmViewKanban" class="crm-view-btn active" title="Kanban"><i class="fa fa-columns"></i></button>
            <button id="crmViewLista"  class="crm-view-btn"        title="Lista"><i class="fa fa-list"></i></button>
          </div>
          <button class="btn btn-primary btn-sm" id="crmNovaBtn"><i class="fa fa-plus"></i> Nova oportunidade</button>
        </div>
      </div>

      <!-- Conteúdo -->
      <div id="crmViewContent"></div>

      <!-- Modal nova/editar oportunidade -->
      <div id="crmModal" class="crm-modal-overlay" style="display:none;">
        <div class="crm-modal-card">
          <div class="crm-modal-header">
            <h3 id="crmModalTitle">Nova oportunidade</h3>
            <button class="btn-icon" id="crmModalCloseBtn"><i class="fa fa-xmark"></i></button>
          </div>
          <form id="crmForm" class="crm-form">
            <input type="hidden" id="crmId">
            <div class="crm-form-row">
              <div class="crm-form-group crm-form-group--full">
                <label>Título *</label>
                <input id="crmTitulo" class="filter-input" required placeholder="Ex: Proposta para João da Silva">
              </div>
            </div>
            <div class="crm-form-row">
              <div class="crm-form-group">
                <label>Cliente (nome livre)</label>
                <input id="crmClienteNome" class="filter-input" placeholder="Nome do contato ou empresa">
              </div>
              <div class="crm-form-group">
                <label>Valor estimado (R$)</label>
                <input id="crmValor" class="filter-input" type="number" step="0.01" min="0" placeholder="0,00">
              </div>
            </div>
            <div class="crm-form-row">
              <div class="crm-form-group">
                <label>Estágio</label>
                <select id="crmEstagio" class="filter-input">
                  ${ESTAGIOS.map((e) => `<option value="${e.key}">${e.label}</option>`).join('')}
                </select>
              </div>
              <div class="crm-form-group">
                <label>Probabilidade (%)</label>
                <input id="crmProbabilidade" class="filter-input" type="number" min="0" max="100" value="50">
              </div>
            </div>
            <div class="crm-form-row">
              <div class="crm-form-group">
                <label>Previsão de fechamento</label>
                <input id="crmDataFechamento" class="filter-input" type="date">
              </div>
              <div class="crm-form-group">
                <label>Origem</label>
                <input id="crmOrigem" class="filter-input" placeholder="Ex: Instagram, indicação...">
              </div>
            </div>
            <div class="crm-form-group crm-form-group--full">
              <label>Observações</label>
              <textarea id="crmObservacoes" class="filter-input" rows="3" style="resize:vertical;"></textarea>
            </div>
            <div class="crm-modal-footer">
              <button type="button" class="btn btn-secondary btn-sm" id="crmFormCancelBtn">Cancelar</button>
              <button type="submit" class="btn btn-primary btn-sm" id="crmFormSaveBtn">Salvar</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal detalhe/atividades -->
      <div id="crmDetalheModal" class="crm-modal-overlay" style="display:none;">
        <div class="crm-modal-card" style="max-width:640px;">
          <div class="crm-modal-header">
            <h3 id="crmDetalheTitle">Oportunidade</h3>
            <button class="btn-icon" id="crmDetalheCloseBtn"><i class="fa fa-xmark"></i></button>
          </div>
          <div id="crmDetalheBody" style="padding:0 24px 8px;overflow-y:auto;max-height:70vh;"></div>
        </div>
      </div>
    `;
  },

  renderDashboard() {
    const el = document.getElementById('crmKpis');
    if (!el || !this.state.dashboard) return;
    const d = this.state.dashboard;

    el.innerHTML = `
      <div class="crm-kpi-card">
        <div class="crm-kpi-label">Pipeline em aberto</div>
        <div class="crm-kpi-value">${moeda(d.valor_pipeline)}</div>
        <div class="crm-kpi-sub">${d.em_aberto} oportunidade${d.em_aberto !== 1 ? 's' : ''}</div>
      </div>
      <div class="crm-kpi-card crm-kpi-card--green">
        <div class="crm-kpi-label">Ganhas no mês</div>
        <div class="crm-kpi-value">${moeda(d.valor_ganho_mes)}</div>
        <div class="crm-kpi-sub">${d.ganhas_mes} fechamento${d.ganhas_mes !== 1 ? 's' : ''}</div>
      </div>
      ${ESTAGIOS.filter((e) => !['ganho','perdido'].includes(e.key)).map((e) => {
        const stats = d.por_estagio?.[e.key] || { total: 0, valor_total: 0 };
        return `
          <div class="crm-kpi-card">
            <div class="crm-kpi-label" style="color:${e.cor}">${e.label}</div>
            <div class="crm-kpi-value" style="font-size:1.4rem">${stats.total}</div>
            <div class="crm-kpi-sub">${moeda(stats.valor_total)}</div>
          </div>`;
      }).join('')}
    `;
  },

  renderView() {
    if (this.state.view === 'kanban') this.renderKanban();
    else this.renderLista();
  },

  renderKanban() {
    const el = document.getElementById('crmViewContent');
    if (!el) return;

    const ops = this.getOpsFiltradas();
    const porEstagio = {};
    for (const e of ESTAGIOS) porEstagio[e.key] = [];
    for (const op of ops) {
      if (porEstagio[op.estagio]) porEstagio[op.estagio].push(op);
    }

    el.innerHTML = `<div class="crm-kanban">
      ${ESTAGIOS.map((e) => {
        const lista = porEstagio[e.key];
        const total = lista.reduce((s, o) => s + (o.valor_estimado || 0), 0);
        return `
          <div class="crm-kanban-col" data-estagio="${e.key}">
            <div class="crm-kanban-col-header" style="border-top:3px solid ${e.cor}">
              <span style="font-weight:700;font-size:13px;">${e.label}</span>
              <span class="crm-badge" style="background:${e.cor}20;color:${e.cor}">${lista.length}</span>
            </div>
            ${total > 0 ? `<div style="font-size:11px;color:var(--text-muted);padding:0 12px 8px;">${moeda(total)}</div>` : ''}
            <div class="crm-kanban-cards">
              ${lista.length === 0
                ? `<div style="padding:16px;text-align:center;font-size:12px;color:var(--text-muted);">Nenhuma</div>`
                : lista.map((op) => this.renderCard(op)).join('')
              }
            </div>
          </div>`;
      }).join('')}
    </div>`;

    el.querySelectorAll('[data-op-detalhe]').forEach((btn) => {
      btn.addEventListener('click', () => this.abrirDetalhe(Number(btn.dataset.opDetalhe)));
    });
    el.querySelectorAll('[data-op-edit]').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.abrirForm(Number(btn.dataset.opEdit)); });
    });
    el.querySelectorAll('[data-op-mover]').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        e.stopPropagation();
        this.moverEstagio(Number(sel.dataset.opMover), sel.value);
      });
    });
  },

  renderCard(op) {
    return `
      <div class="crm-card" data-op-detalhe="${op.id}">
        <div class="crm-card-title">${esc(op.titulo)}</div>
        ${op.cliente_nome ? `<div class="crm-card-sub"><i class="fa fa-user"></i> ${esc(op.cliente_nome)}</div>` : ''}
        ${op.valor_estimado > 0 ? `<div class="crm-card-valor">${moeda(op.valor_estimado)}</div>` : ''}
        ${op.data_prev_fechamento ? `<div class="crm-card-sub"><i class="fa fa-calendar"></i> ${dataFmt(op.data_prev_fechamento)}</div>` : ''}
        <div class="crm-card-footer">
          <select class="crm-estagio-sel" data-op-mover="${op.id}" onclick="event.stopPropagation()">
            ${ESTAGIOS.map((e) => `<option value="${e.key}" ${op.estagio === e.key ? 'selected' : ''}>${e.label}</option>`).join('')}
          </select>
          <button class="btn-icon" data-op-edit="${op.id}" title="Editar"><i class="fa fa-pen"></i></button>
        </div>
      </div>`;
  },

  renderLista() {
    const el = document.getElementById('crmViewContent');
    if (!el) return;
    const ops = this.getOpsFiltradas();

    if (!ops.length) {
      el.innerHTML = `<div class="crm-empty"><i class="fa fa-chart-gantt" style="font-size:36px;margin-bottom:12px;display:block;"></i>Nenhuma oportunidade encontrada.<br>Clique em "Nova oportunidade" para começar.</div>`;
      return;
    }

    el.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
        <table>
          <thead>
            <tr>
              <th>Título</th><th>Cliente</th><th>Estágio</th>
              <th class="text-right">Valor</th><th>Fechamento</th><th>Atividades</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${ops.map((op) => {
              const e = ESTAGIOS.find((x) => x.key === op.estagio);
              return `
                <tr style="cursor:pointer;" data-op-detalhe="${op.id}">
                  <td><strong>${esc(op.titulo)}</strong></td>
                  <td>${esc(op.cliente_nome || '—')}</td>
                  <td><span class="crm-badge" style="background:${e?.cor}20;color:${e?.cor}">${e?.label || op.estagio}</span></td>
                  <td class="text-right">${op.valor_estimado > 0 ? moeda(op.valor_estimado) : '—'}</td>
                  <td>${dataFmt(op.data_prev_fechamento)}</td>
                  <td style="text-align:center;">${op.total_atividades || 0}</td>
                  <td>
                    <button class="btn-icon" data-op-edit="${op.id}" title="Editar"><i class="fa fa-pen"></i></button>
                    <button class="btn-icon danger" data-op-del="${op.id}" title="Excluir"><i class="fa fa-trash"></i></button>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    el.querySelectorAll('[data-op-detalhe]').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        this.abrirDetalhe(Number(row.dataset.opDetalhe));
      });
    });
    el.querySelectorAll('[data-op-edit]').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.abrirForm(Number(btn.dataset.opEdit)); });
    });
    el.querySelectorAll('[data-op-del]').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.excluir(Number(btn.dataset.opDel)); });
    });
  },

  getOpsFiltradas() {
    let ops = this.state.oportunidades;
    if (this.state.filtroEstagio) ops = ops.filter((o) => o.estagio === this.state.filtroEstagio);
    if (this.state.filtroBusca) {
      const q = this.state.filtroBusca.toLowerCase();
      ops = ops.filter((o) => (o.titulo + (o.cliente_nome || '')).toLowerCase().includes(q));
    }
    return ops;
  },

  // ── Eventos ───────────────────────────────────────────────────────────────

  bindEvents() {
    document.getElementById('crmNovaBtn')?.addEventListener('click', () => this.abrirForm(null));
    document.getElementById('crmRefreshBtn')?.addEventListener('click', () => this.load());
    document.getElementById('crmModalCloseBtn')?.addEventListener('click', () => this.fecharModal());
    document.getElementById('crmFormCancelBtn')?.addEventListener('click', () => this.fecharModal());
    document.getElementById('crmDetalheCloseBtn')?.addEventListener('click', () => this.fecharDetalhe());
    document.getElementById('crmForm')?.addEventListener('submit', (e) => { e.preventDefault(); this.salvar(); });

    document.getElementById('crmViewKanban')?.addEventListener('click', () => {
      this.state.view = 'kanban';
      document.getElementById('crmViewKanban').classList.add('active');
      document.getElementById('crmViewLista').classList.remove('active');
      this.renderView();
    });
    document.getElementById('crmViewLista')?.addEventListener('click', () => {
      this.state.view = 'lista';
      document.getElementById('crmViewLista').classList.add('active');
      document.getElementById('crmViewKanban').classList.remove('active');
      this.renderView();
    });

    document.getElementById('crmBusca')?.addEventListener('input', (e) => {
      this.state.filtroBusca = e.target.value;
      this.renderView();
    });
    document.getElementById('crmFiltroEstagio')?.addEventListener('change', (e) => {
      this.state.filtroEstagio = e.target.value;
      this.renderView();
    });

    // Fechar modais clicando fora
    document.getElementById('crmModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.fecharModal();
    });
    document.getElementById('crmDetalheModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.fecharDetalhe();
    });
  },

  // ── Form criar/editar ─────────────────────────────────────────────────────

  abrirForm(id) {
    document.getElementById('crmModalTitle').textContent = id ? 'Editar oportunidade' : 'Nova oportunidade';
    document.getElementById('crmId').value        = id || '';
    document.getElementById('crmTitulo').value    = '';
    document.getElementById('crmClienteNome').value = '';
    document.getElementById('crmValor').value     = '';
    document.getElementById('crmEstagio').value   = 'lead';
    document.getElementById('crmProbabilidade').value = '50';
    document.getElementById('crmDataFechamento').value = '';
    document.getElementById('crmOrigem').value    = '';
    document.getElementById('crmObservacoes').value = '';

    if (id) {
      const op = this.state.oportunidades.find((o) => o.id === id);
      if (op) {
        document.getElementById('crmTitulo').value       = op.titulo || '';
        document.getElementById('crmClienteNome').value  = op.cliente_nome || '';
        document.getElementById('crmValor').value        = op.valor_estimado || '';
        document.getElementById('crmEstagio').value      = op.estagio || 'lead';
        document.getElementById('crmProbabilidade').value = op.probabilidade ?? 50;
        document.getElementById('crmDataFechamento').value = op.data_prev_fechamento?.substring(0, 10) || '';
        document.getElementById('crmOrigem').value       = op.origem || '';
        document.getElementById('crmObservacoes').value  = op.observacoes || '';
      }
    }

    document.getElementById('crmModal').style.display = 'flex';
    document.getElementById('crmTitulo').focus();
  },

  fecharModal() {
    document.getElementById('crmModal').style.display = 'none';
  },

  async salvar() {
    const id     = document.getElementById('crmId').value;
    const titulo = document.getElementById('crmTitulo').value.trim();
    if (!titulo) { showToast('Título é obrigatório', 'error'); return; }

    const payload = {
      titulo,
      cliente_nome:        document.getElementById('crmClienteNome').value.trim() || null,
      valor_estimado:      parseFloat(document.getElementById('crmValor').value) || 0,
      estagio:             document.getElementById('crmEstagio').value,
      probabilidade:       parseInt(document.getElementById('crmProbabilidade').value) || 50,
      data_prev_fechamento: document.getElementById('crmDataFechamento').value || null,
      origem:              document.getElementById('crmOrigem').value.trim() || null,
      observacoes:         document.getElementById('crmObservacoes').value.trim() || null
    };

    const btn = document.getElementById('crmFormSaveBtn');
    try {
      btn.disabled = true; btn.textContent = 'Salvando...';
      if (id) {
        await api.fetchAPI(`/crm/oportunidades/${id}`, 'PUT', payload);
        showToast('Oportunidade atualizada', 'success');
      } else {
        await api.fetchAPI('/crm/oportunidades', 'POST', payload);
        showToast('Oportunidade criada', 'success');
      }
      this.fecharModal();
      await this.load();
    } catch (err) {
      showToast(err.message || 'Erro ao salvar', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Salvar';
    }
  },

  async excluir(id) {
    const ok = await confirmarAcao('Excluir esta oportunidade?');
    if (!ok) return;
    try {
      await api.fetchAPI(`/crm/oportunidades/${id}`, 'DELETE');
      showToast('Oportunidade excluída', 'success');
      await this.load();
    } catch (err) {
      showToast(err.message || 'Erro ao excluir', 'error');
    }
  },

  async moverEstagio(id, estagio) {
    try {
      await api.fetchAPI(`/crm/oportunidades/${id}/estagio`, 'PATCH', { estagio });
      const op = this.state.oportunidades.find((o) => o.id === id);
      if (op) op.estagio = estagio;
      this.renderView();
      await this.load();
    } catch (err) {
      showToast(err.message || 'Erro ao mover oportunidade', 'error');
    }
  },

  // ── Modal detalhe ─────────────────────────────────────────────────────────

  async abrirDetalhe(id) {
    this.state.detalheId = id;
    document.getElementById('crmDetalheModal').style.display = 'flex';
    document.getElementById('crmDetalheBody').innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);">Carregando...</div>`;

    try {
      const data = await api.fetchAPI(`/crm/oportunidades/${id}`);
      this.renderDetalhe(data.oportunidade, data.atividades || []);
    } catch (err) {
      document.getElementById('crmDetalheBody').innerHTML = `<div style="padding:20px;color:var(--danger);">${esc(err.message)}</div>`;
    }
  },

  renderDetalhe(op, atividades) {
    const e = ESTAGIOS.find((x) => x.key === op.estagio);
    const corpo = document.getElementById('crmDetalheBody');
    if (!corpo) return;
    document.getElementById('crmDetalheTitle').textContent = op.titulo;

    corpo.innerHTML = `
      <!-- Info -->
      <div class="crm-detalhe-info">
        <div class="crm-detalhe-row">
          <span class="crm-badge" style="background:${e?.cor}20;color:${e?.cor}">${e?.label || op.estagio}</span>
          ${op.probabilidade != null ? `<span style="font-size:12px;color:var(--text-muted);">${op.probabilidade}% probabilidade</span>` : ''}
        </div>
        ${op.cliente_nome ? `<div class="crm-detalhe-row"><i class="fa fa-user" style="width:16px;"></i> ${esc(op.cliente_nome)}</div>` : ''}
        ${op.cliente_email ? `<div class="crm-detalhe-row"><i class="fa fa-envelope" style="width:16px;"></i> ${esc(op.cliente_email)}</div>` : ''}
        ${op.cliente_telefone ? `<div class="crm-detalhe-row"><i class="fa fa-phone" style="width:16px;"></i> ${esc(op.cliente_telefone)}</div>` : ''}
        ${op.valor_estimado > 0 ? `<div class="crm-detalhe-row"><i class="fa fa-dollar-sign" style="width:16px;"></i> ${moeda(op.valor_estimado)}</div>` : ''}
        ${op.data_prev_fechamento ? `<div class="crm-detalhe-row"><i class="fa fa-calendar" style="width:16px;"></i> Previsão: ${dataFmt(op.data_prev_fechamento)}</div>` : ''}
        ${op.origem ? `<div class="crm-detalhe-row"><i class="fa fa-tag" style="width:16px;"></i> ${esc(op.origem)}</div>` : ''}
        ${op.observacoes ? `<div style="margin-top:8px;padding:10px;background:var(--surface-2);border-radius:8px;font-size:13px;">${esc(op.observacoes)}</div>` : ''}
      </div>

      <!-- Ações -->
      <div style="display:flex;gap:8px;margin:16px 0;">
        <button class="btn btn-secondary btn-sm" id="crmEditarDetalheBtn"><i class="fa fa-pen"></i> Editar</button>
        <button class="btn btn-primary btn-sm" id="crmConverterBtn"><i class="fa fa-file-lines"></i> Converter em orçamento</button>
      </div>

      <!-- Atividades -->
      <div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">
        Histórico de atividades
      </div>

      <!-- Form nova atividade -->
      <form id="crmAtivForm" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
        <select id="crmAtivTipo" class="filter-input" style="min-width:120px;">
          ${TIPOS_ATIVIDADE.map((t) => `<option value="${t.key}">${t.label}</option>`).join('')}
        </select>
        <input id="crmAtivDesc" class="filter-input" placeholder="Descreva a atividade..." style="flex:1;min-width:180px;" required>
        <input id="crmAtivData" class="filter-input" type="date" value="${new Date().toISOString().substring(0,10)}" style="width:140px;">
        <button type="submit" class="btn btn-primary btn-sm">Registrar</button>
      </form>

      <!-- Lista de atividades -->
      <div id="crmAtivLista">
        ${atividades.length === 0
          ? `<div style="font-size:13px;color:var(--text-muted);text-align:center;padding:16px;">Nenhuma atividade registrada</div>`
          : atividades.map((a) => {
              const tipo = TIPOS_ATIVIDADE.find((t) => t.key === a.tipo) || { icon: 'fa-note-sticky', label: a.tipo };
              return `
                <div class="crm-ativ-item">
                  <div class="crm-ativ-icon"><i class="fa ${tipo.icon}"></i></div>
                  <div style="flex:1;">
                    <div style="font-size:13px;">${esc(a.descricao)}</div>
                    <div style="font-size:11px;color:var(--text-muted);">${tipo.label} · ${dataFmt(a.data)}</div>
                  </div>
                  <button class="btn-icon danger" data-at-del="${a.id}" title="Remover"><i class="fa fa-trash"></i></button>
                </div>`;
            }).join('')
        }
      </div>
    `;

    document.getElementById('crmEditarDetalheBtn')?.addEventListener('click', () => {
      this.fecharDetalhe();
      this.abrirForm(op.id);
    });
    document.getElementById('crmConverterBtn')?.addEventListener('click', () => this.converter(op.id));
    document.getElementById('crmAtivForm')?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      this.registrarAtividade(op.id);
    });
    corpo.querySelectorAll('[data-at-del]').forEach((btn) => {
      btn.addEventListener('click', () => this.removerAtividade(op.id, Number(btn.dataset.atDel)));
    });
  },

  fecharDetalhe() {
    document.getElementById('crmDetalheModal').style.display = 'none';
    this.state.detalheId = null;
  },

  async converter(id) {
    const ok = await confirmarAcao('Criar um orçamento a partir desta oportunidade?');
    if (!ok) return;
    try {
      const data = await api.fetchAPI(`/crm/oportunidades/${id}/converter`, 'POST');
      showToast(`Orçamento #${data.orcamento_id} criado com sucesso!`, 'success');
      this.fecharDetalhe();
      await this.load();
    } catch (err) {
      showToast(err.message || 'Erro ao converter', 'error');
    }
  },

  async registrarAtividade(opId) {
    const tipo     = document.getElementById('crmAtivTipo').value;
    const descricao = document.getElementById('crmAtivDesc').value.trim();
    const data     = document.getElementById('crmAtivData').value;
    if (!descricao) return;

    try {
      await api.fetchAPI(`/crm/oportunidades/${opId}/atividades`, 'POST', { tipo, descricao, data });
      await this.abrirDetalhe(opId);
    } catch (err) {
      showToast(err.message || 'Erro ao registrar atividade', 'error');
    }
  },

  async removerAtividade(opId, atId) {
    try {
      await api.fetchAPI(`/crm/oportunidades/${opId}/atividades/${atId}`, 'DELETE');
      await this.abrirDetalhe(opId);
    } catch (err) {
      showToast(err.message || 'Erro ao remover', 'error');
    }
  },

  // ── Estilos ───────────────────────────────────────────────────────────────

  injectStyles() {
    if (document.getElementById('crm-styles')) return;
    const s = document.createElement('style');
    s.id = 'crm-styles';
    s.textContent = `
      .crm-kpis { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:20px; }
      .crm-kpi-card { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px 20px; min-width:140px; flex:1; }
      .crm-kpi-card--green { border-color:#86efac; }
      .crm-kpi-label { font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; }
      .crm-kpi-value { font-size:1.6rem; font-weight:700; color:var(--text); line-height:1; }
      .crm-kpi-sub { font-size:12px; color:var(--text-muted); margin-top:4px; }

      .crm-toolbar { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:16px; }
      .crm-view-toggle { display:flex; border:1px solid var(--border); border-radius:8px; overflow:hidden; }
      .crm-view-btn { background:none; border:none; padding:6px 12px; cursor:pointer; color:var(--text-muted); font-size:13px; transition:.15s; }
      .crm-view-btn.active { background:var(--primary); color:#fff; }

      .crm-kanban { display:flex; gap:12px; overflow-x:auto; padding-bottom:8px; align-items:flex-start; }
      .crm-kanban-col { min-width:220px; flex:0 0 220px; background:var(--surface-2); border-radius:12px; border:1px solid var(--border); }
      .crm-kanban-col-header { display:flex; align-items:center; justify-content:space-between; padding:12px 12px 8px; }
      .crm-kanban-cards { padding:0 8px 8px; display:flex; flex-direction:column; gap:8px; }
      .crm-badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:20px; font-size:11px; font-weight:600; }

      .crm-card { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:12px; cursor:pointer; transition:.15s; }
      .crm-card:hover { border-color:var(--primary); box-shadow:0 2px 8px rgba(0,0,0,.08); }
      .crm-card-title { font-size:13px; font-weight:600; margin-bottom:5px; line-height:1.3; }
      .crm-card-sub { font-size:11px; color:var(--text-muted); margin-top:3px; display:flex; align-items:center; gap:5px; }
      .crm-card-valor { font-size:12px; font-weight:700; color:var(--success); margin-top:4px; }
      .crm-card-footer { display:flex; align-items:center; justify-content:space-between; margin-top:8px; padding-top:8px; border-top:1px solid var(--border); }
      .crm-estagio-sel { font-size:11px; border:none; background:var(--surface-2); border-radius:6px; padding:3px 6px; cursor:pointer; color:var(--text); max-width:110px; }

      .crm-empty { padding:60px; text-align:center; color:var(--text-muted); font-size:13px; }

      .crm-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:1000; align-items:center; justify-content:center; }
      .crm-modal-card { background:var(--surface); border-radius:16px; width:100%; max-width:560px; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,.3); margin:16px; }
      .crm-modal-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px 16px; border-bottom:1px solid var(--border); flex-shrink:0; }
      .crm-modal-header h3 { margin:0; font-size:16px; font-weight:700; }
      .crm-modal-footer { display:flex; justify-content:flex-end; gap:10px; padding:16px 24px; border-top:1px solid var(--border); flex-shrink:0; }

      .crm-form { padding:16px 24px; overflow-y:auto; }
      .crm-form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }
      .crm-form-group { display:flex; flex-direction:column; gap:5px; }
      .crm-form-group--full { grid-column:1/-1; }
      .crm-form-group label { font-size:12px; font-weight:600; color:var(--text-muted); }
      @media(max-width:480px) { .crm-form-row { grid-template-columns:1fr; } }

      .crm-detalhe-info { padding:16px 0; border-bottom:1px solid var(--border); margin-bottom:12px; display:flex; flex-direction:column; gap:8px; font-size:13px; }
      .crm-detalhe-row { display:flex; align-items:center; gap:8px; }
      .crm-ativ-item { display:flex; align-items:flex-start; gap:10px; padding:10px 0; border-bottom:1px solid var(--border); }
      .crm-ativ-icon { width:28px; height:28px; border-radius:50%; background:var(--surface-2); display:flex; align-items:center; justify-content:center; font-size:12px; flex-shrink:0; }

      .btn-icon.danger:hover { color:var(--danger); }
      .text-right { text-align:right; }
    `;
    document.head.appendChild(s);
  }
};

export async function initCrmModule() {
  return CrmModule.init();
}

export default CrmModule;
