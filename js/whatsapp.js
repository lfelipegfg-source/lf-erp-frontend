import api from './api.js';
import { showToast, confirmarAcao } from './feedback.js';

function esc(v) { return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

const STATUS_COR = {
  enviado: { label: 'Enviado',  bg: 'var(--success-soft)', cor: 'var(--success)' },
  link:    { label: 'Link',     bg: '#ede9fe',             cor: '#7c3aed' },
  erro:    { label: 'Erro',     bg: 'var(--danger-soft)',  cor: 'var(--danger)' }
};

const WhatsappModule = {
  state: {
    tab: 'config',
    cfg: null,
    templates: [],
    historico: [],
    initialized: false
  },

  async init() {
    if (!this.state.initialized) {
      this.injectStyles();
      this.render();
      this.bindTabEvents();
      this.state.initialized = true;
    }
    await this.loadTab('config');
  },

  async loadTab(tab) {
    this.state.tab = tab;
    document.querySelectorAll('.wpp-tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'config')    await this.loadConfig();
    if (tab === 'templates') await this.loadTemplates();
    if (tab === 'enviar')    this.renderEnviar();
    if (tab === 'historico') await this.loadHistorico();
    if (tab === 'automacao') this.renderAutomacao();
  },

  // ── Config ────────────────────────────────────────────────────────────────

  async loadConfig() {
    try {
      const data = await api.fetchAPI('/whatsapp/config');
      this.state.cfg = data.config;
      this.renderConfig(data.config);
    } catch (err) { showToast(err.message || 'Erro', 'error'); }
  },

  renderConfig(cfg) {
    const el = document.getElementById('wppContent');
    if (!el) return;

    el.innerHTML = `
      <div style="max-width:560px;">
        <div class="wpp-info-box" style="margin-bottom:20px;">
          <i class="fa fa-circle-info"></i>
          Configure a integração com sua API WhatsApp. Use <strong>Evolution API</strong> (open-source, auto-hospedado) ou <strong>Z-API</strong> (SaaS). Sem API, o sistema gera links wa.me para disparo manual.
        </div>
        <form id="wppCfgForm" style="display:flex;flex-direction:column;gap:14px;">
          <div class="wpp-form-row">
            <div class="wpp-form-group">
              <label>Provedor</label>
              <select id="wppProvider" class="filter-input" onchange="document.getElementById('wppApiUrlGroup').style.display = this.value !== 'link' ? '' : 'none'">
                <option value="link"      ${(cfg?.wpp_provider||'link') === 'link'      ? 'selected':''}>Link wa.me (sem API)</option>
                <option value="evolution" ${(cfg?.wpp_provider||'link') === 'evolution' ? 'selected':''}>Evolution API</option>
                <option value="zapi"      ${(cfg?.wpp_provider||'link') === 'zapi'      ? 'selected':''}>Z-API</option>
              </select>
            </div>
            <div class="wpp-form-group">
              <label>Ativar envio automático</label>
              <label class="wpp-toggle">
                <input type="checkbox" id="wppAtivo" ${cfg?.wpp_ativo ? 'checked' : ''}>
                <span class="wpp-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div id="wppApiUrlGroup" style="${(cfg?.wpp_provider||'link') === 'link' ? 'display:none' : ''}">
            <div class="wpp-form-row">
              <div class="wpp-form-group">
                <label>URL da API</label>
                <input id="wppApiUrl" class="filter-input" value="${esc(cfg?.wpp_api_url||'')}" placeholder="https://api.evolution.exemplo.com">
              </div>
              <div class="wpp-form-group">
                <label>Instância / Instance ID</label>
                <input id="wppInstance" class="filter-input" value="${esc(cfg?.wpp_instance||'')}" placeholder="minha-instancia">
              </div>
            </div>
            <div class="wpp-form-row">
              <div class="wpp-form-group">
                <label>Token / API Key</label>
                <input id="wppToken" class="filter-input" type="password" value="${cfg?.wpp_token ? '***configurado***' : ''}" placeholder="Cole o token aqui">
              </div>
              <div class="wpp-form-group">
                <label>Número WhatsApp Business</label>
                <input id="wppNumero" class="filter-input" value="${esc(cfg?.wpp_numero||'')}" placeholder="5585999999999">
              </div>
            </div>
          </div>
          <div class="wpp-form-row">
            <div class="wpp-form-group">
              <label>Cooldown entre mensagens (horas)</label>
              <input id="wppCooldown" class="filter-input" type="number" min="1" max="168" value="${cfg?.wpp_cooldown_h || 24}">
            </div>
          </div>
          <div style="display:flex;gap:10px;">
            <button type="submit" class="btn btn-primary btn-sm"><i class="fa fa-save"></i> Salvar configuração</button>
            <button type="button" class="btn btn-secondary btn-sm" id="wppTestarBtn"><i class="fa fa-flask"></i> Testar conexão</button>
          </div>
        </form>
      </div>
    `;

    document.getElementById('wppCfgForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.salvarConfig();
    });
    document.getElementById('wppTestarBtn')?.addEventListener('click', () => this.testar());
  },

  async salvarConfig() {
    const payload = {
      wpp_provider:   document.getElementById('wppProvider').value,
      wpp_api_url:    document.getElementById('wppApiUrl')?.value.trim() || null,
      wpp_instance:   document.getElementById('wppInstance')?.value.trim() || null,
      wpp_token:      document.getElementById('wppToken')?.value.trim() || null,
      wpp_numero:     document.getElementById('wppNumero')?.value.trim() || null,
      wpp_ativo:      document.getElementById('wppAtivo').checked,
      wpp_cooldown_h: parseInt(document.getElementById('wppCooldown').value) || 24
    };
    try {
      await api.fetchAPI('/whatsapp/config', 'PUT', payload);
      showToast('Configuração salva!', 'success');
      await this.loadConfig();
    } catch (err) { showToast(err.message || 'Erro', 'error'); }
  },

  async testar() {
    const btn = document.getElementById('wppTestarBtn');
    btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Testando...';
    try {
      const data = await api.fetchAPI('/whatsapp/testar', 'POST');
      if (data.link) {
        showToast('Sem API configurada. Abrindo link manualmente...', 'info');
        window.open(data.link, '_blank');
      } else {
        showToast(data.mensagem || 'Teste enviado!', 'success');
      }
    } catch (err) { showToast(err.message || 'Erro no teste', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fa fa-flask"></i> Testar conexão'; }
  },

  // ── Templates ─────────────────────────────────────────────────────────────

  async loadTemplates() {
    try {
      const data = await api.fetchAPI('/whatsapp/templates');
      this.state.templates = data.templates || [];
      this.renderTemplates();
    } catch (err) { showToast(err.message || 'Erro', 'error'); }
  },

  renderTemplates() {
    const el = document.getElementById('wppContent');
    if (!el) return;

    el.innerHTML = `
      <div class="wpp-info-box" style="margin-bottom:16px;">
        <i class="fa fa-circle-info"></i>
        Use <strong>{{nome}}</strong>, <strong>{{valor}}</strong>, <strong>{{vencimento}}</strong>, <strong>{{dias}}</strong>, <strong>{{empresa}}</strong> e <strong>{{link}}</strong> nas mensagens.
      </div>
      <div id="wppTemplatesList"></div>
    `;

    const lista = document.getElementById('wppTemplatesList');
    lista.innerHTML = this.state.templates.map((t) => `
      <div class="wpp-template-card">
        <div class="wpp-template-head">
          <div>
            <span class="wpp-template-label">${esc(t.label)}</span>
            ${t.customizado ? '<span class="wpp-badge wpp-badge--custom">Personalizado</span>' : '<span class="wpp-badge">Padrão</span>'}
          </div>
          <label class="wpp-toggle wpp-toggle--sm">
            <input type="checkbox" class="wpp-tpl-ativo" data-evento="${t.evento}" ${t.ativo ? 'checked' : ''}>
            <span class="wpp-toggle-slider"></span>
          </label>
        </div>
        <textarea class="filter-input wpp-tpl-msg" data-evento="${t.evento}"
          rows="4" style="font-size:12px;font-family:monospace;resize:vertical;margin-top:8px;">${esc(t.mensagem)}</textarea>
        <div style="text-align:right;margin-top:6px;">
          <button class="btn btn-secondary btn-sm wpp-tpl-save" data-evento="${t.evento}">
            <i class="fa fa-save"></i> Salvar template
          </button>
        </div>
      </div>
    `).join('');

    lista.querySelectorAll('.wpp-tpl-save').forEach((btn) => {
      btn.addEventListener('click', () => this.salvarTemplate(btn.dataset.evento));
    });
    lista.querySelectorAll('.wpp-tpl-ativo').forEach((chk) => {
      chk.addEventListener('change', () => this.salvarTemplate(chk.dataset.evento));
    });
  },

  async salvarTemplate(evento) {
    const msg  = document.querySelector(`.wpp-tpl-msg[data-evento="${evento}"]`)?.value.trim();
    const ativo = document.querySelector(`.wpp-tpl-ativo[data-evento="${evento}"]`)?.checked;
    if (!msg) return;
    try {
      await api.fetchAPI(`/whatsapp/templates/${evento}`, 'PUT', { mensagem: msg, ativo });
      showToast('Template salvo!', 'success');
      await this.loadTemplates();
    } catch (err) { showToast(err.message || 'Erro', 'error'); }
  },

  // ── Envio manual ──────────────────────────────────────────────────────────

  renderEnviar() {
    const el = document.getElementById('wppContent');
    if (!el) return;
    el.innerHTML = `
      <div style="max-width:500px;">
        <form id="wppEnviarForm" style="display:flex;flex-direction:column;gap:14px;">
          <div class="wpp-form-group">
            <label>Telefone (com DDD e DDI, ex: 5585999999999)</label>
            <input id="wppEnvTel" class="filter-input" placeholder="5585999999999" required>
          </div>
          <div class="wpp-form-group">
            <label>Nome do cliente (opcional)</label>
            <input id="wppEnvNome" class="filter-input" placeholder="Nome para usar no template">
          </div>
          <div class="wpp-form-group">
            <label>Mensagem</label>
            <textarea id="wppEnvMsg" class="filter-input" rows="5" style="resize:vertical;" required placeholder="Digite a mensagem..."></textarea>
          </div>
          <button type="submit" class="btn btn-primary btn-sm"><i class="fa fa-paper-plane"></i> Enviar mensagem</button>
        </form>
      </div>
    `;

    document.getElementById('wppEnviarForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tel  = document.getElementById('wppEnvTel').value.trim();
      const nome = document.getElementById('wppEnvNome').value.trim();
      const msg  = document.getElementById('wppEnvMsg').value.trim();
      if (!tel || !msg) return;

      const btn = e.submitter;
      btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Enviando...';
      try {
        const data = await api.fetchAPI('/whatsapp/enviar', 'POST', { telefone: tel, mensagem: msg, cliente_nome: nome || null });
        if (data.status === 'link') {
          showToast('Sem API configurada. Abrindo link...', 'info');
          window.open(data.link, '_blank');
        } else if (data.sucesso) {
          showToast('Mensagem enviada!', 'success');
          document.getElementById('wppEnviarForm').reset();
        } else {
          showToast(data.erro || 'Falha no envio', 'error');
        }
      } catch (err) { showToast(err.message || 'Erro', 'error'); }
      finally { btn.disabled = false; btn.innerHTML = '<i class="fa fa-paper-plane"></i> Enviar mensagem'; }
    });
  },

  // ── Automação ─────────────────────────────────────────────────────────────

  renderAutomacao() {
    const el = document.getElementById('wppContent');
    if (!el) return;

    el.innerHTML = `
      <div style="max-width:560px;">
        <div class="wpp-info-box" style="margin-bottom:20px;">
          <i class="fa fa-robot"></i>
          O processamento de cobranças busca clientes com parcelas atrasadas ou próximas do vencimento e envia mensagens automáticas (respeitando o cooldown configurado).
        </div>
        <div class="wpp-auto-card">
          <h4 style="margin:0 0 16px;font-size:14px;font-weight:700;"><i class="fa fa-triangle-exclamation"></i> Cobranças atrasadas + Vencimento próximo</h4>
          <div class="wpp-form-row" style="margin-bottom:16px;">
            <div class="wpp-form-group">
              <label>Avisar X dias antes do vencimento</label>
              <input id="wppDiasAviso" class="filter-input" type="number" min="1" max="30" value="3">
            </div>
            <div class="wpp-form-group">
              <label>Cobrar a partir de X dias de atraso</label>
              <input id="wppDiasAtraso" class="filter-input" type="number" min="1" max="30" value="1">
            </div>
          </div>
          <button class="btn btn-primary" id="wppProcessarBtn">
            <i class="fa fa-play"></i> Processar agora
          </button>
          <div id="wppProcessarResult" style="margin-top:16px;"></div>
        </div>
        <div class="wpp-info-box" style="margin-top:16px;">
          <i class="fa fa-clock"></i>
          Para automação periódica (ex: todo dia às 9h), configure um cron no Render ou use o endpoint
          <code>POST /whatsapp/processar/cobrancas</code> via webhook agendado externo.
        </div>
      </div>
    `;

    document.getElementById('wppProcessarBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('wppProcessarBtn');
      const result = document.getElementById('wppProcessarResult');
      const diasAviso  = parseInt(document.getElementById('wppDiasAviso').value) || 3;
      const diasAtraso = parseInt(document.getElementById('wppDiasAtraso').value) || 1;

      btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Processando...';
      result.innerHTML = '';
      try {
        const data = await api.fetchAPI('/whatsapp/processar/cobrancas', 'POST', { dias_aviso: diasAviso, dias_atraso: diasAtraso });
        const r = data.resumo;
        result.innerHTML = `
          <div class="wpp-resumo">
            <div class="wpp-resumo-item wpp-resumo-item--ok"><strong>${r.atrasadas + r.vencendo}</strong><span>Enviadas via API</span></div>
            <div class="wpp-resumo-item wpp-resumo-item--link"><strong>${r.links}</strong><span>Links gerados</span></div>
            <div class="wpp-resumo-item ${r.erros > 0 ? 'wpp-resumo-item--err' : 'wpp-resumo-item--ok'}"><strong>${r.erros}</strong><span>Erros</span></div>
          </div>`;
        showToast(data.mensagem, r.erros > 0 ? 'error' : 'success');
      } catch (err) {
        result.innerHTML = `<div style="color:var(--danger);font-size:13px;">${esc(err.message || 'Erro')}</div>`;
        showToast(err.message || 'Erro ao processar', 'error');
      } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fa fa-play"></i> Processar agora';
      }
    });
  },

  // ── Histórico ─────────────────────────────────────────────────────────────

  async loadHistorico() {
    try {
      const data = await api.fetchAPI('/whatsapp/historico');
      this.state.historico = data.historico || [];
      this.renderHistorico();
    } catch (err) { showToast(err.message || 'Erro', 'error'); }
  },

  renderHistorico() {
    const el = document.getElementById('wppContent');
    if (!el) return;

    if (!this.state.historico.length) {
      el.innerHTML = `<div style="padding:60px;text-align:center;color:var(--text-muted);"><i class="fa fa-clock-rotate-left" style="font-size:32px;display:block;margin-bottom:10px;"></i>Nenhuma mensagem enviada ainda.</div>`;
      return;
    }

    el.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
        <table>
          <thead><tr><th>Evento</th><th>Cliente</th><th>Telefone</th><th>Status</th><th>Data</th><th>Erro</th></tr></thead>
          <tbody>
            ${this.state.historico.map((h) => {
              const st = STATUS_COR[h.status] || { label: h.status, bg: '#eee', cor: '#666' };
              return `<tr>
                <td><code style="font-size:11px;">${esc(h.evento)}</code></td>
                <td style="font-size:12px;">${esc(h.cliente_nome || '—')}</td>
                <td style="font-size:12px;">${esc(h.telefone)}</td>
                <td><span style="background:${st.bg};color:${st.cor};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;">${st.label}</span></td>
                <td style="font-size:11px;color:var(--text-muted);">${new Date(h.criado_em).toLocaleString('pt-BR')}</td>
                <td style="font-size:11px;color:var(--danger);">${esc(h.erro_msg || '')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // ── Estrutura ─────────────────────────────────────────────────────────────

  render() {
    const c = document.getElementById('whatsappContainer');
    if (!c) return;
    c.innerHTML = `
      <div class="wpp-tabs">
        <button class="wpp-tab-btn active" data-tab="config"><i class="fa fa-gear"></i> Configuração</button>
        <button class="wpp-tab-btn" data-tab="templates"><i class="fa fa-message"></i> Templates</button>
        <button class="wpp-tab-btn" data-tab="automacao"><i class="fa fa-robot"></i> Automação</button>
        <button class="wpp-tab-btn" data-tab="enviar"><i class="fa fa-paper-plane"></i> Enviar</button>
        <button class="wpp-tab-btn" data-tab="historico"><i class="fa fa-clock-rotate-left"></i> Histórico</button>
      </div>
      <div id="wppContent" style="margin-top:20px;"></div>
    `;
  },

  bindTabEvents() {
    document.getElementById('whatsappContainer')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.wpp-tab-btn');
      if (btn) this.loadTab(btn.dataset.tab);
    });
  },

  injectStyles() {
    // estilos migrados para style.css
    if (true) return;
    const s = document.createElement('style');
    s.id = 'wpp-styles';
    s.textContent = `
      .wpp-tabs { display:flex; gap:4px; border-bottom:1px solid var(--border); }
      .wpp-tab-btn { padding:10px 16px; border:none; background:none; font-size:13px; font-weight:500; color:var(--text-muted); cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; display:flex; align-items:center; gap:6px; transition:.15s; }
      .wpp-tab-btn.active { color:#25d366; border-color:#25d366; }
      .wpp-tab-btn:hover:not(.active) { color:var(--text); }

      .wpp-form-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
      .wpp-form-group { display:flex; flex-direction:column; gap:5px; }
      .wpp-form-group label { font-size:12px; font-weight:600; color:var(--text-muted); }
      @media(max-width:480px){ .wpp-form-row { grid-template-columns:1fr; } }

      .wpp-toggle { position:relative; display:inline-block; width:42px; height:24px; }
      .wpp-toggle input { opacity:0; width:0; height:0; }
      .wpp-toggle-slider { position:absolute; inset:0; background:#ccc; border-radius:24px; cursor:pointer; transition:.2s; }
      .wpp-toggle input:checked + .wpp-toggle-slider { background:#25d366; }
      .wpp-toggle-slider:before { content:''; position:absolute; height:18px; width:18px; left:3px; bottom:3px; background:#fff; border-radius:50%; transition:.2s; }
      .wpp-toggle input:checked + .wpp-toggle-slider:before { transform:translateX(18px); }
      .wpp-toggle--sm { width:36px; height:20px; }
      .wpp-toggle--sm .wpp-toggle-slider:before { height:14px; width:14px; }
      .wpp-toggle--sm input:checked + .wpp-toggle-slider:before { transform:translateX(16px); }

      .wpp-info-box { padding:12px 16px; background:var(--surface-2); border-radius:8px; font-size:12px; color:var(--text-muted); display:flex; gap:8px; align-items:flex-start; line-height:1.6; }
      .wpp-info-box i { margin-top:2px; flex-shrink:0; }

      .wpp-template-card { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:10px; }
      .wpp-template-head { display:flex; align-items:center; justify-content:space-between; }
      .wpp-template-label { font-size:13px; font-weight:600; }
      .wpp-badge { display:inline-flex; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:600; background:var(--surface-3); color:var(--text-muted); margin-left:6px; }
      .wpp-badge--custom { background:#dbeafe; color:#1d4ed8; }

      .wpp-auto-card { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:20px; }
      .wpp-resumo { display:flex; gap:12px; flex-wrap:wrap; margin-top:4px; }
      .wpp-resumo-item { display:flex; flex-direction:column; align-items:center; gap:2px; padding:10px 16px; border-radius:10px; min-width:80px; font-size:13px; }
      .wpp-resumo-item strong { font-size:1.4rem; font-weight:700; }
      .wpp-resumo-item span { font-size:11px; color:var(--text-muted); }
      .wpp-resumo-item--ok   { background:var(--success-soft); color:var(--success); }
      .wpp-resumo-item--link { background:#ede9fe; color:#7c3aed; }
      .wpp-resumo-item--err  { background:var(--danger-soft); color:var(--danger); }
    `;
    document.head.appendChild(s);
  }
};

export async function initWhatsappModule() {
  return WhatsappModule.init();
}

export default WhatsappModule;
