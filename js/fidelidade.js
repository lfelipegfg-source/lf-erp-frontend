import api from './api.js';
import { showToast, confirmarAcao } from './feedback.js';

function esc(v) { return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function moeda(v) { return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function dataBR(d) { if (!d) return '—'; const [y,m,dia]=String(d).substring(0,10).split('-'); return `${dia}/${m}/${y}`; }

const TIPO_MOV = {
  credito:   { label: 'Crédito',   cor: 'var(--success)', bg: 'var(--success-soft)', sinal: '+' },
  debito:    { label: 'Resgate',   cor: '#2563eb',        bg: '#dbeafe',             sinal: '-' },
  ajuste:    { label: 'Ajuste',    cor: 'var(--warning)', bg: 'var(--warning-soft)', sinal: '±' },
  expiracao: { label: 'Expirado',  cor: 'var(--danger)',  bg: 'var(--danger-soft)',  sinal: '-' }
};

const FidelidadeModule = {
  state: {
    tab: 'dashboard',
    cfg: null,
    clientes: [],
    initialized: false
  },

  async init() {
    if (!this.state.initialized) {
      this.injectStyles();
      this.render();
      this.bindTabEvents();
      this.state.initialized = true;
    }
    await this.loadTab('dashboard');
  },

  async loadTab(tab) {
    this.state.tab = tab;
    document.querySelectorAll('.fid-tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'dashboard') await this.loadDashboard();
    if (tab === 'config')    await this.loadConfig();
    if (tab === 'clientes')  await this.loadClientes();
    if (tab === 'resgatar')  await this.renderResgate();
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────

  async loadDashboard() {
    try {
      const [dash, cfg] = await Promise.all([
        api.fetchAPI('/fidelidade/dashboard'),
        api.fetchAPI('/fidelidade/config')
      ]);
      this.state.cfg = cfg.config;
      this.renderDashboard(dash, cfg.config);
    } catch (err) { showToast(err.message || 'Erro', 'error'); }
  },

  renderDashboard(d, cfg) {
    const el = document.getElementById('fidContent');
    if (!el) return;

    const ativo = cfg?.ativo !== false;

    el.innerHTML = `
      ${!ativo ? `<div class="fid-alert"><i class="fa fa-triangle-exclamation"></i> Programa de fidelidade <strong>inativo</strong>. Ative em "Configuração".</div>` : ''}
      <div class="fid-kpis">
        <div class="fid-kpi">
          <div class="fid-kpi-label">Clientes com pontos</div>
          <div class="fid-kpi-val">${d.clientes_com_pontos}</div>
        </div>
        <div class="fid-kpi fid-kpi--gold">
          <div class="fid-kpi-label">Pontos em circulação</div>
          <div class="fid-kpi-val">${Number(d.total_pontos_circulacao).toLocaleString('pt-BR')}</div>
          <div class="fid-kpi-sub">${moeda(d.total_pontos_circulacao * Number(cfg?.reais_por_ponto || 0.05))} em valor</div>
        </div>
        <div class="fid-kpi">
          <div class="fid-kpi-label">Prontos para resgatar</div>
          <div class="fid-kpi-val">${d.clientes_prontos_resgatar}</div>
          <div class="fid-kpi-sub">≥ ${cfg?.minimo_resgate || 100} pts</div>
        </div>
        <div class="fid-kpi">
          <div class="fid-kpi-label">Créditos este mês</div>
          <div class="fid-kpi-val">${Number(d.movimentos_mes?.credito?.pontos || 0).toLocaleString('pt-BR')}</div>
          <div class="fid-kpi-sub">${d.movimentos_mes?.credito?.total || 0} transações</div>
        </div>
      </div>

      ${d.top_clientes?.length > 0 ? `
        <div class="fid-section-label">Top clientes por pontos</div>
        <div class="fid-top-list">
          ${d.top_clientes.map((c, i) => `
            <div class="fid-top-item">
              <div class="fid-top-rank">#${i + 1}</div>
              <div class="fid-top-nome">${esc(c.nome)}</div>
              <div class="fid-top-pts"><i class="fa fa-star"></i> ${Number(c.pontos_fidelidade).toLocaleString('pt-BR')} pts</div>
            </div>`).join('')}
        </div>` : ''}

      <div class="fid-section-label" style="margin-top:20px;">Como funciona</div>
      <div class="fid-regras">
        <div><i class="fa fa-circle-check"></i> A cada <strong>R$ 1,00</strong> comprado → <strong>${cfg?.pontos_por_real || 1} ponto(s)</strong></div>
        <div><i class="fa fa-circle-check"></i> Cada ponto vale <strong>${moeda(cfg?.reais_por_ponto || 0.05)}</strong> no resgate</div>
        <div><i class="fa fa-circle-check"></i> Resgate mínimo: <strong>${cfg?.minimo_resgate || 100} pontos</strong></div>
        <div><i class="fa fa-circle-check"></i> Validade: <strong>${cfg?.validade_dias > 0 ? cfg.validade_dias + ' dias' : 'Sem validade'}</strong></div>
      </div>
    `;
  },

  // ── Config ────────────────────────────────────────────────────────────────

  async loadConfig() {
    try {
      const data = await api.fetchAPI('/fidelidade/config');
      this.state.cfg = data.config;
      this.renderConfig(data.config);
    } catch (err) { showToast(err.message || 'Erro', 'error'); }
  },

  renderConfig(cfg) {
    const el = document.getElementById('fidContent');
    if (!el) return;

    el.innerHTML = `
      <div style="max-width:500px;">
        <form id="fidCfgForm" style="display:flex;flex-direction:column;gap:16px;">
          <div class="fid-form-row">
            <div class="fid-form-group fid-form-group--full">
              <label>Nome do programa</label>
              <input id="fidNome" class="filter-input" value="${esc(cfg?.nome_programa || 'Programa de Fidelidade')}">
            </div>
          </div>
          <div class="fid-form-row">
            <div class="fid-form-group">
              <label>Pontos por R$ 1,00 gasto</label>
              <input id="fidPtsPorReal" class="filter-input" type="number" step="0.01" min="0.01" value="${cfg?.pontos_por_real || 1}">
            </div>
            <div class="fid-form-group">
              <label>Valor do ponto no resgate (R$)</label>
              <input id="fidReaisPorPonto" class="filter-input" type="number" step="0.01" min="0.001" value="${cfg?.reais_por_ponto || 0.05}">
            </div>
          </div>
          <div class="fid-form-row">
            <div class="fid-form-group">
              <label>Pontos mínimos para resgatar</label>
              <input id="fidMinResgate" class="filter-input" type="number" min="1" value="${cfg?.minimo_resgate || 100}">
            </div>
            <div class="fid-form-group">
              <label>Validade dos pontos (dias, 0 = sem)</label>
              <input id="fidValidade" class="filter-input" type="number" min="0" value="${cfg?.validade_dias ?? 365}">
            </div>
          </div>
          <div class="fid-form-row">
            <div class="fid-form-group" style="flex-direction:row;align-items:center;gap:10px;">
              <label>Programa ativo</label>
              <label class="fid-toggle">
                <input type="checkbox" id="fidAtivo" ${cfg?.ativo !== false ? 'checked' : ''}>
                <span class="fid-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="fid-preview">
            <i class="fa fa-calculator"></i>
            Exemplo: compra de <strong>R$ 100</strong> → <strong id="fidPrevPts">—</strong> pontos → valor de resgate: <strong id="fidPrevVal">—</strong>
          </div>
          <button type="submit" class="btn btn-primary btn-sm"><i class="fa fa-save"></i> Salvar configuração</button>
        </form>

        <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border);">
          <div class="fid-section-label">Manutenção</div>
          <button class="btn btn-secondary btn-sm" id="fidExpirarBtn"><i class="fa fa-clock"></i> Processar pontos expirados</button>
        </div>
      </div>
    `;

    const atualizarPreview = () => {
      const ppr   = parseFloat(document.getElementById('fidPtsPorReal').value) || 1;
      const rpp   = parseFloat(document.getElementById('fidReaisPorPonto').value) || 0.05;
      const pontos = Math.floor(100 * ppr);
      document.getElementById('fidPrevPts').textContent = pontos + ' pontos';
      document.getElementById('fidPrevVal').textContent = moeda(pontos * rpp);
    };
    document.getElementById('fidPtsPorReal').addEventListener('input', atualizarPreview);
    document.getElementById('fidReaisPorPonto').addEventListener('input', atualizarPreview);
    atualizarPreview();

    document.getElementById('fidCfgForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.salvarConfig();
    });

    document.getElementById('fidExpirarBtn')?.addEventListener('click', async () => {
      const ok = await confirmarAcao('Processar e remover todos os pontos expirados?');
      if (!ok) return;
      try {
        const data = await api.fetchAPI('/fidelidade/expirar', 'POST');
        showToast(data.mensagem, 'success');
      } catch (err) { showToast(err.message || 'Erro', 'error'); }
    });
  },

  async salvarConfig() {
    const payload = {
      ativo:           document.getElementById('fidAtivo').checked,
      nome_programa:   document.getElementById('fidNome').value.trim(),
      pontos_por_real: parseFloat(document.getElementById('fidPtsPorReal').value),
      reais_por_ponto: parseFloat(document.getElementById('fidReaisPorPonto').value),
      minimo_resgate:  parseInt(document.getElementById('fidMinResgate').value),
      validade_dias:   parseInt(document.getElementById('fidValidade').value)
    };
    try {
      await api.fetchAPI('/fidelidade/config', 'PUT', payload);
      showToast('Configuração salva!', 'success');
      this.state.cfg = { ...this.state.cfg, ...payload };
    } catch (err) { showToast(err.message || 'Erro', 'error'); }
  },

  // ── Clientes ──────────────────────────────────────────────────────────────

  async loadClientes() {
    try {
      const data = await api.fetchAPI('/fidelidade/clientes');
      this.state.clientes = data.clientes || [];
      this.renderClientes();
    } catch (err) { showToast(err.message || 'Erro', 'error'); }
  },

  renderClientes() {
    const el = document.getElementById('fidContent');
    if (!el) return;

    el.innerHTML = `
      <div class="fid-toolbar">
        <input id="fidBuscaCliente" class="filter-input" placeholder="Buscar cliente..." style="min-width:220px;">
        <button class="btn btn-secondary btn-sm" id="fidAjusteBtn"><i class="fa fa-sliders"></i> Ajuste manual</button>
      </div>
      ${this.state.clientes.length === 0
        ? `<div class="fid-empty"><i class="fa fa-star" style="font-size:32px;display:block;margin-bottom:10px;"></i>Nenhum cliente com pontos acumulados ainda.<br>Os pontos são acumulados automaticamente em cada venda com cliente vinculado.</div>`
        : `<div class="fid-table-wrap"><table>
            <thead><tr><th>#</th><th>Cliente</th><th class="text-right">Pontos</th><th class="text-right">Valor resgate</th><th></th></tr></thead>
            <tbody>
              ${this.state.clientes.map((c, i) => {
                const valor = moeda(c.pontos_fidelidade * Number(this.state.cfg?.reais_por_ponto || 0.05));
                return `<tr>
                  <td style="color:var(--text-muted);font-size:12px;">${i+1}</td>
                  <td>
                    <strong>${esc(c.nome)}</strong>
                    ${c.telefone ? `<div style="font-size:11px;color:var(--text-muted);">${esc(c.telefone)}</div>` : ''}
                  </td>
                  <td class="text-right">
                    <span class="fid-pts-badge"><i class="fa fa-star"></i> ${Number(c.pontos_fidelidade).toLocaleString('pt-BR')}</span>
                  </td>
                  <td class="text-right" style="font-size:13px;color:var(--success);">${valor}</td>
                  <td>
                    <button class="btn-icon" data-extrato="${c.id}" title="Ver extrato"><i class="fa fa-eye"></i></button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
           </table></div>`
      }
      <!-- Modal extrato -->
      <div id="fidExtratoModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;align-items:center;justify-content:center;">
        <div style="background:var(--surface);border-radius:16px;padding:0;width:95%;max-width:560px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3);">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-bottom:1px solid var(--border);">
            <h3 id="fidExtratoTitle" style="margin:0;font-size:15px;font-weight:700;">Extrato de pontos</h3>
            <button class="btn-icon" id="fidExtratoClose"><i class="fa fa-xmark"></i></button>
          </div>
          <div id="fidExtratoBody" style="overflow-y:auto;padding:16px 24px;"></div>
        </div>
      </div>
      <!-- Modal ajuste -->
      <div id="fidAjusteModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;align-items:center;justify-content:center;">
        <div style="background:var(--surface);border-radius:16px;padding:24px;width:95%;max-width:440px;box-shadow:0 20px 60px rgba(0,0,0,.3);">
          <h3 style="margin:0 0 16px;font-size:15px;font-weight:700;">Ajuste manual de pontos</h3>
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div class="fid-form-group"><label>Cliente</label>
              <select id="fidAjusteCliente" class="filter-input">
                ${this.state.clientes.map((c) => `<option value="${c.id}">${esc(c.nome)} (${c.pontos_fidelidade} pts)</option>`).join('')}
              </select>
            </div>
            <div class="fid-form-group"><label>Pontos (negativo para remover)</label>
              <input id="fidAjustePontos" class="filter-input" type="number" placeholder="Ex: 50 ou -20">
            </div>
            <div class="fid-form-group"><label>Motivo</label>
              <input id="fidAjusteMot" class="filter-input" placeholder="Ex: correção, bônus especial...">
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
              <button class="btn btn-secondary btn-sm" id="fidAjusteCancelBtn">Cancelar</button>
              <button class="btn btn-primary btn-sm" id="fidAjusteSalvarBtn">Aplicar ajuste</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('fidBuscaCliente')?.addEventListener('input', async (e) => {
      const q = e.target.value;
      const data = await api.fetchAPI('/fidelidade/clientes', 'GET', null, q ? { busca: q } : {}).catch(() => ({ clientes: [] }));
      this.state.clientes = data.clientes || [];
      this.renderClientes();
    });

    el.querySelectorAll('[data-extrato]').forEach((btn) => {
      btn.addEventListener('click', () => this.abrirExtrato(Number(btn.dataset.extrato)));
    });

    document.getElementById('fidAjusteBtn')?.addEventListener('click', () => {
      document.getElementById('fidAjusteModal').style.display = 'flex';
    });
    document.getElementById('fidAjusteCancelBtn')?.addEventListener('click', () => {
      document.getElementById('fidAjusteModal').style.display = 'none';
    });
    document.getElementById('fidAjusteSalvarBtn')?.addEventListener('click', () => this.aplicarAjuste());
    document.getElementById('fidExtratoClose')?.addEventListener('click', () => {
      document.getElementById('fidExtratoModal').style.display = 'none';
    });
  },

  async abrirExtrato(clienteId) {
    document.getElementById('fidExtratoModal').style.display = 'flex';
    document.getElementById('fidExtratoBody').innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">Carregando...</div>';
    try {
      const data = await api.fetchAPI(`/fidelidade/clientes/${clienteId}/extrato`);
      const c = data.cliente;
      document.getElementById('fidExtratoTitle').textContent = `Extrato — ${c.nome}`;

      const movs = data.movimentos;
      document.getElementById('fidExtratoBody').innerHTML = `
        <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;">
          <div class="fid-mini-kpi"><div class="fid-mini-label">Saldo atual</div><div class="fid-mini-val fid-mini-val--gold"><i class="fa fa-star"></i> ${Number(c.pontos_fidelidade).toLocaleString('pt-BR')} pts</div></div>
          <div class="fid-mini-kpi"><div class="fid-mini-label">Valor de resgate</div><div class="fid-mini-val" style="color:var(--success);">${moeda(data.valor_resgate)}</div></div>
        </div>
        ${movs.length === 0
          ? `<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px;">Nenhum movimento</div>`
          : `<table>
              <thead><tr><th>Tipo</th><th>Pontos</th><th>Saldo</th><th>Descrição</th><th>Data</th></tr></thead>
              <tbody>
                ${movs.map((m) => {
                  const t = TIPO_MOV[m.tipo] || { label: m.tipo, cor: '#666', bg: '#eee', sinal: '' };
                  return `<tr>
                    <td><span style="background:${t.bg};color:${t.cor};padding:2px 7px;border-radius:20px;font-size:11px;font-weight:600;">${t.label}</span></td>
                    <td style="text-align:right;font-weight:600;color:${t.cor};">${t.sinal}${Math.abs(m.pontos)}</td>
                    <td style="text-align:right;color:var(--text-muted);font-size:12px;">${m.saldo_apos}</td>
                    <td style="font-size:12px;">${esc(m.descricao || '—')}</td>
                    <td style="font-size:11px;color:var(--text-muted);">${dataBR(m.criado_em)}</td>
                  </tr>`;
                }).join('')}
              </tbody>
             </table>`
        }
      `;
    } catch (err) {
      document.getElementById('fidExtratoBody').innerHTML = `<div style="color:var(--danger);padding:16px;">${esc(err.message)}</div>`;
    }
  },

  async aplicarAjuste() {
    const clienteId = document.getElementById('fidAjusteCliente').value;
    const pontos    = parseInt(document.getElementById('fidAjustePontos').value);
    const descricao = document.getElementById('fidAjusteMot').value.trim();
    if (!clienteId || isNaN(pontos) || pontos === 0) { showToast('Preencha todos os campos', 'error'); return; }
    try {
      const data = await api.fetchAPI('/fidelidade/ajustar', 'POST', { cliente_id: clienteId, pontos, descricao });
      showToast(`Ajuste aplicado. Novo saldo: ${data.novo_saldo} pontos`, 'success');
      document.getElementById('fidAjusteModal').style.display = 'none';
      await this.loadClientes();
    } catch (err) { showToast(err.message || 'Erro', 'error'); }
  },

  // ── Resgate ───────────────────────────────────────────────────────────────

  async renderResgate() {
    const el = document.getElementById('fidContent');
    if (!el) return;
    // Carrega lista para o select
    const data = await api.fetchAPI('/fidelidade/clientes').catch(() => ({ clientes: [] }));

    el.innerHTML = `
      <div style="max-width:480px;">
        <div class="fid-info-box" style="margin-bottom:20px;">
          <i class="fa fa-circle-info"></i>
          O resgate abate os pontos do saldo do cliente e retorna o valor de desconto equivalente para aplicar na venda.
        </div>
        <form id="fidResgateForm" style="display:flex;flex-direction:column;gap:14px;">
          <div class="fid-form-group">
            <label>Cliente *</label>
            <select id="fidResCli" class="filter-input" required>
              <option value="">Selecione...</option>
              ${(data.clientes || []).map((c) => `<option value="${c.id}">${esc(c.nome)} — ${Number(c.pontos_fidelidade).toLocaleString('pt-BR')} pts</option>`).join('')}
            </select>
          </div>
          <div class="fid-form-group">
            <label>Pontos a resgatar *</label>
            <input id="fidResPts" class="filter-input" type="number" min="1" placeholder="Ex: 200" required>
          </div>
          <div id="fidResPreview" style="display:none;" class="fid-preview">
            <i class="fa fa-tag"></i> Desconto gerado: <strong id="fidResValor">—</strong>
          </div>
          <button type="submit" class="btn btn-primary btn-sm"><i class="fa fa-check"></i> Confirmar resgate</button>
        </form>
        <div id="fidResResult" style="margin-top:16px;"></div>
      </div>
    `;

    document.getElementById('fidResPts')?.addEventListener('input', () => {
      const pts = parseInt(document.getElementById('fidResPts').value) || 0;
      const rpp = Number(this.state.cfg?.reais_por_ponto || 0.05);
      const preview = document.getElementById('fidResPreview');
      const valor   = document.getElementById('fidResValor');
      if (pts > 0) {
        preview.style.display = '';
        valor.textContent = moeda(pts * rpp);
      } else { preview.style.display = 'none'; }
    });

    document.getElementById('fidResgateForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const clienteId = document.getElementById('fidResCli').value;
      const pontos    = parseInt(document.getElementById('fidResPts').value);
      if (!clienteId || !pontos) return;

      const ok = await confirmarAcao(`Resgatar ${pontos} pontos para desconto de ${moeda(pontos * Number(this.state.cfg?.reais_por_ponto || 0.05))}?`);
      if (!ok) return;

      try {
        const data = await api.fetchAPI('/fidelidade/resgatar', 'POST', { cliente_id: clienteId, pontos });
        document.getElementById('fidResResult').innerHTML = `
          <div class="fid-success-box">
            <i class="fa fa-circle-check"></i>
            <div>
              <strong>${data.pontos_resgatados} pontos resgatados!</strong><br>
              Desconto: <strong>${moeda(data.valor_desconto)}</strong> — Saldo restante: <strong>${data.saldo_restante} pts</strong>
            </div>
          </div>`;
        showToast(data.mensagem, 'success');
      } catch (err) { showToast(err.message || 'Erro', 'error'); }
    });
  },

  // ── Estrutura ─────────────────────────────────────────────────────────────

  render() {
    const c = document.getElementById('fidelidadeContainer');
    if (!c) return;
    c.innerHTML = `
      <div class="fid-tabs">
        <button class="fid-tab-btn active" data-tab="dashboard"><i class="fa fa-chart-pie"></i> Dashboard</button>
        <button class="fid-tab-btn" data-tab="clientes"><i class="fa fa-users"></i> Clientes</button>
        <button class="fid-tab-btn" data-tab="resgatar"><i class="fa fa-tag"></i> Resgatar</button>
        <button class="fid-tab-btn" data-tab="config"><i class="fa fa-gear"></i> Configuração</button>
      </div>
      <div id="fidContent" style="margin-top:20px;"></div>
    `;
  },

  bindTabEvents() {
    document.getElementById('fidelidadeContainer')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.fid-tab-btn');
      if (btn) this.loadTab(btn.dataset.tab);
    });
  },

  injectStyles() {
    // estilos migrados para style.css
    if (true) return;
    const s = document.createElement('style');
    s.id = 'fid-styles';
    s.textContent = `
      .fid-tabs { display:flex; gap:4px; border-bottom:1px solid var(--border); }
      .fid-tab-btn { padding:10px 16px; border:none; background:none; font-size:13px; font-weight:500; color:var(--text-muted); cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; display:flex; align-items:center; gap:6px; transition:.15s; }
      .fid-tab-btn.active { color:#f59e0b; border-color:#f59e0b; }
      .fid-tab-btn:hover:not(.active) { color:var(--text); }

      .fid-kpis { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:20px; }
      .fid-kpi { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px 20px; flex:1; min-width:130px; }
      .fid-kpi--gold { border-color:#fcd34d; }
      .fid-kpi-label { font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.4px; margin-bottom:4px; }
      .fid-kpi-val { font-size:1.5rem; font-weight:700; }
      .fid-kpi-sub { font-size:11px; color:var(--text-muted); margin-top:2px; }
      .fid-kpi--gold .fid-kpi-val { color:#b45309; }

      .fid-section-label { font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.5px; margin-bottom:10px; }
      .fid-top-list { display:flex; flex-direction:column; gap:8px; max-width:500px; }
      .fid-top-item { display:flex; align-items:center; gap:12px; background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:10px 14px; }
      .fid-top-rank { font-size:16px; font-weight:700; color:var(--text-muted); width:28px; }
      .fid-top-nome { flex:1; font-size:13px; font-weight:500; }
      .fid-top-pts { font-size:13px; font-weight:700; color:#b45309; display:flex; align-items:center; gap:5px; }

      .fid-regras { display:flex; flex-direction:column; gap:8px; font-size:13px; color:var(--text-muted); max-width:420px; }
      .fid-regras i { color:#f59e0b; margin-right:6px; }

      .fid-alert { background:var(--warning-soft); border:1px solid var(--warning); border-radius:10px; padding:12px 16px; font-size:13px; color:var(--warning); margin-bottom:20px; display:flex; align-items:center; gap:8px; }
      .fid-info-box { padding:12px 16px; background:var(--surface-2); border-radius:8px; font-size:12px; color:var(--text-muted); display:flex; gap:8px; }
      .fid-success-box { background:var(--success-soft); border:1px solid #86efac; border-radius:10px; padding:14px 16px; font-size:13px; display:flex; align-items:flex-start; gap:10px; color:var(--success); }

      .fid-form-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
      .fid-form-group { display:flex; flex-direction:column; gap:5px; }
      .fid-form-group--full { grid-column:1/-1; }
      .fid-form-group label { font-size:12px; font-weight:600; color:var(--text-muted); }
      .fid-preview { padding:10px 14px; background:var(--surface-2); border-radius:8px; font-size:13px; color:var(--text-muted); display:flex; align-items:center; gap:8px; }

      .fid-toolbar { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:14px; }
      .fid-table-wrap { background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
      .fid-empty { padding:60px; text-align:center; font-size:13px; color:var(--text-muted); }
      .fid-pts-badge { display:inline-flex; align-items:center; gap:5px; background:var(--warning-soft); color:#b45309; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:700; }

      .fid-toggle { position:relative; display:inline-block; width:42px; height:24px; }
      .fid-toggle input { opacity:0; width:0; height:0; }
      .fid-toggle-slider { position:absolute; inset:0; background:#ccc; border-radius:24px; cursor:pointer; transition:.2s; }
      .fid-toggle input:checked + .fid-toggle-slider { background:#f59e0b; }
      .fid-toggle-slider:before { content:''; position:absolute; height:18px; width:18px; left:3px; bottom:3px; background:#fff; border-radius:50%; transition:.2s; }
      .fid-toggle input:checked + .fid-toggle-slider:before { transform:translateX(18px); }

      .fid-mini-kpi { background:var(--surface-2); border-radius:8px; padding:10px 14px; }
      .fid-mini-label { font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; }
      .fid-mini-val { font-size:1.2rem; font-weight:700; }
      .fid-mini-val--gold { color:#b45309; }
      .text-right { text-align:right; }
    `;
    document.head.appendChild(s);
  }
};

export async function initFidelidadeModule() {
  return FidelidadeModule.init();
}

export default FidelidadeModule;
