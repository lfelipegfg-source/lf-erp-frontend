import api from './api.js';
import { showToast } from './feedback.js';

const AlertasModule = {
  state: {
    aba: 'disparar',
    config: null,
    historico: [],
    resultadoDisparo: null,
    carregando: false
  },

  init() {
    this.render();
    this.bindShellEvents();
    this.load();
  },

  async load() {
    this.state.carregando = true;
    this.setFeedback('Carregando...', 'info');
    try {
      const [cfgRes, histRes] = await Promise.allSettled([
        api.getAlertasConfig(),
        api.getAlertasHistorico()
      ]);
      this.state.config    = cfgRes.status  === 'fulfilled' ? (cfgRes.value?.config   || null) : null;
      this.state.historico = histRes.status === 'fulfilled' ? (histRes.value?.historico || []) : [];
      this.renderConteudo();
      this.setFeedback('', '');
    } catch (err) {
      console.error('[alertas] load:', err);
      this.setFeedback('Erro ao carregar alertas.', 'error');
    } finally {
      this.state.carregando = false;
    }
  },

  render() {
    const c = document.getElementById('alertasContainer');
    if (!c) return;
    c.innerHTML = `
      <section class="module-card">
        <div class="module-card__header">
          <div><h3>Alertas de Cobrança</h3><p>Envie lembretes de pagamento por email e WhatsApp</p></div>
          <div class="module-card__actions">
            <button class="btn btn-light" id="alertasAtualizarBtn">
              <i class="fa-solid fa-rotate"></i> Atualizar
            </button>
          </div>
        </div>
        <div class="module-feedback" id="alertasFeedback"></div>
        <div class="module-toolbar">
          <div class="table-actions">
            <button class="btn-inline btn-inline--active" data-al-aba="disparar">Disparar Alertas</button>
            <button class="btn-inline" data-al-aba="config">Configuração</button>
            <button class="btn-inline" data-al-aba="historico">Histórico</button>
          </div>
        </div>
        <div id="alertasConteudo"></div>
      </section>
    `;
  },

  bindShellEvents() {
    const c = document.getElementById('alertasContainer');
    if (!c) return;

    document.getElementById('alertasAtualizarBtn')?.addEventListener('click', () => this.load());

    c.addEventListener('click', (e) => {
      const abaBtn = e.target.closest('[data-al-aba]');
      if (abaBtn) {
        this.state.aba = abaBtn.dataset.alAba;
        document.querySelectorAll('[data-al-aba]').forEach((b) => b.classList.remove('btn-inline--active'));
        abaBtn.classList.add('btn-inline--active');
        this.renderConteudo();
      }
    });
  },

  renderConteudo() {
    const c = document.getElementById('alertasConteudo');
    if (!c) return;
    if (this.state.aba === 'config')    { c.innerHTML = this.renderConfig();    this.bindConfigEvents();    return; }
    if (this.state.aba === 'historico') { c.innerHTML = this.renderHistorico(); return; }
    c.innerHTML = this.renderDisparar();
    this.bindDispararEvents();
  },

  // ── DISPARAR ──────────────────────────────────────────────────────────────

  renderDisparar() {
    const cfg = this.state.config;
    const resultado = this.state.resultadoDisparo;

    const emailOk = cfg?.email_ativo && cfg?.smtp_host;
    const wppOk   = cfg?.whatsapp_ativo;

    const avisos = [];
    if (!cfg) avisos.push('Configure o módulo na aba <strong>Configuração</strong> antes de disparar.');
    else {
      if (!emailOk && !wppOk) avisos.push('Ative pelo menos um canal (Email ou WhatsApp) na configuração.');
      if (cfg.email_ativo && !cfg.smtp_host) avisos.push('Email ativado mas SMTP não configurado.');
    }

    return `
      <div style="max-width:640px;margin-top:20px">
        ${avisos.length ? `<div class="module-feedback module-feedback--error" style="margin-bottom:16px">${avisos.join('<br>')}</div>` : ''}

        <div class="panel-card" style="margin-bottom:16px">
          <div class="panel-card__header">
            <div><h3>Status dos canais</h3><p>Configure na aba Configuração</p></div>
          </div>
          <div class="panel-card__body">
            <div style="display:flex;gap:20px;flex-wrap:wrap">
              <div style="display:flex;align-items:center;gap:8px;font-size:14px">
                <i class="fa-solid fa-envelope" style="color:${emailOk ? 'var(--success)' : 'var(--text-muted)'}"></i>
                Email: <strong style="color:${emailOk ? 'var(--success)' : 'var(--danger)'}">${emailOk ? 'Configurado' : 'Não configurado'}</strong>
              </div>
              <div style="display:flex;align-items:center;gap:8px;font-size:14px">
                <i class="fa-brands fa-whatsapp" style="color:${wppOk ? '#25d366' : 'var(--text-muted)'}"></i>
                WhatsApp: <strong style="color:${wppOk ? '#25d366' : 'var(--danger)'}">${wppOk ? 'Links ativos' : 'Desativado'}</strong>
              </div>
            </div>
          </div>
        </div>

        <div class="panel-card" style="margin-bottom:16px">
          <div class="panel-card__header">
            <div><h3>Critério de disparo</h3><p>Mínimo de ${cfg?.dias_atraso_minimo || 1} dia(s) em atraso</p></div>
          </div>
          <div class="panel-card__body">
            <div class="module-feedback module-feedback--info" style="margin-bottom:14px">
              Serão alertados todos os clientes com títulos em atraso há mais de
              <strong>${cfg?.dias_atraso_minimo || 1} dia(s)</strong>.
              Clientes sem email/telefone cadastrado serão ignorados no canal correspondente.
            </div>
            <button class="btn btn-primary" id="alertasDispararBtn" ${!cfg || (!emailOk && !wppOk) ? 'disabled' : ''}>
              <i class="fa-solid fa-paper-plane"></i> Disparar Alertas Agora
            </button>
            <div class="module-feedback" id="alertasDispararFeedback" style="margin-top:12px"></div>
          </div>
        </div>

        ${resultado ? this.renderResultado(resultado) : ''}
      </div>
    `;
  },

  renderResultado(r) {
    const linksWpp = r.links_whatsapp || [];
    return `
      <div class="panel-card">
        <div class="panel-card__header">
          <div><h3>Resultado do disparo</h3><p>${this.esc(r.mensagem || '')}</p></div>
        </div>
        <div class="panel-card__body">
          <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">
            <div style="background:var(--success-soft);padding:10px 16px;border-radius:10px;font-size:13px">
              <i class="fa-solid fa-envelope" style="color:var(--success)"></i>
              <strong>${r.enviados_email || 0}</strong> email(s) enviado(s)
            </div>
            ${r.erros_email ? `
              <div style="background:var(--danger-soft);padding:10px 16px;border-radius:10px;font-size:13px">
                <i class="fa-solid fa-circle-exclamation" style="color:var(--danger)"></i>
                <strong>${r.erros_email}</strong> erro(s) de email
              </div>
            ` : ''}
            <div style="background:#f0fdf4;padding:10px 16px;border-radius:10px;font-size:13px">
              <i class="fa-brands fa-whatsapp" style="color:#25d366"></i>
              <strong>${linksWpp.length}</strong> link(s) WhatsApp
            </div>
          </div>

          ${linksWpp.length ? `
            <h4 style="font-size:13px;font-weight:700;margin-bottom:10px">
              Links WhatsApp — clique para abrir e enviar:
            </h4>
            <div style="display:grid;gap:8px;max-height:320px;overflow-y:auto">
              ${linksWpp.map((l) => `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-radius:10px;background:var(--surface-2);border:1px solid var(--border)">
                  <div>
                    <strong style="font-size:13px">${this.esc(l.cliente_nome || '-')}</strong>
                    <div style="font-size:11px;color:var(--text-muted)">${this.esc(l.telefone || '')} · ${this.fmtCur(l.valor_total)}</div>
                  </div>
                  <a href="${this.esc(l.link)}" target="_blank" rel="noopener"
                     style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:#25d366;color:#fff;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;white-space:nowrap">
                    <i class="fa-brands fa-whatsapp"></i> Enviar
                  </a>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  },

  bindDispararEvents() {
    document.getElementById('alertasDispararBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('alertasDispararBtn');
      const fb  = document.getElementById('alertasDispararFeedback');

      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Disparando...'; }
      if (fb)  { fb.className = 'module-feedback module-feedback--info'; fb.textContent = 'Enviando alertas...'; }

      try {
        const result = await api.dispararAlertas({});
        this.state.resultadoDisparo = result;
        showToast(result.mensagem || 'Alertas processados.', 'success');
        if (fb) { fb.className = 'module-feedback module-feedback--success'; fb.textContent = result.mensagem || 'Concluído.'; }
        this.renderConteudo();
        await this.load();
      } catch (err) {
        const msg = err.message || 'Erro ao disparar alertas.';
        if (fb) { fb.className = 'module-feedback module-feedback--error'; fb.textContent = msg; }
        showToast(msg, 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Disparar Alertas Agora'; }
      }
    });
  },

  // ── CONFIGURAÇÃO ───────────────────────────────────────────────────────────

  renderConfig() {
    const cfg = this.state.config || {};
    const v   = (val) => this.esc(val || '');
    const temSmtpPass = Boolean(cfg.smtp_pass);

    return `
      <div style="max-width:620px;margin-top:20px;display:grid;gap:20px">

        <div class="panel-card">
          <div class="panel-card__header">
            <div><h3>Email (SMTP)</h3><p>Envio automático de emails de cobrança</p></div>
          </div>
          <div class="panel-card__body">
            <div class="form-grid">
              <div class="form-field form-field--span-2">
                <label>
                  <input type="checkbox" id="alEmailAtivo" ${cfg.email_ativo ? 'checked' : ''} />
                  Ativar envio de email
                </label>
              </div>
              <div class="form-field">
                <label>Servidor SMTP</label>
                <input id="alSmtpHost" value="${v(cfg.smtp_host)}" placeholder="smtp.gmail.com" />
              </div>
              <div class="form-field">
                <label>Porta</label>
                <input id="alSmtpPort" type="number" value="${v(cfg.smtp_port || 587)}" />
              </div>
              <div class="form-field">
                <label>Usuário / Email</label>
                <input id="alSmtpUser" value="${v(cfg.smtp_user)}" placeholder="seuemail@gmail.com" />
              </div>
              <div class="form-field">
                <label>Senha / App Password</label>
                <input type="password" id="alSmtpPass"
                  placeholder="${temSmtpPass ? '***configurado*** — preencha para alterar' : 'Senha ou App Password'}" />
              </div>
              <div class="form-field form-field--span-2">
                <label>Nome do remetente</label>
                <input id="alSmtpFrom" value="${v(cfg.smtp_from)}" placeholder="Lucileide Variedades <email@gmail.com>" />
              </div>
              <div class="form-field form-field--span-2">
                <label>Assunto do email</label>
                <input id="alEmailAssunto" value="${v(cfg.email_assunto || 'Aviso de pagamento pendente')}" />
              </div>
              <div class="form-field form-field--span-2">
                <label>Corpo do email</label>
                <textarea id="alEmailCorpo" rows="5" placeholder="Use {{cliente_nome}}, {{valor_total}}, {{empresa_nome}}">${v(cfg.email_corpo)}</textarea>
                <small style="color:var(--text-muted)">Variáveis: {{cliente_nome}} {{valor_total}} {{empresa_nome}} {{dias_atraso}}</small>
              </div>
            </div>
            <div class="module-feedback module-feedback--info" style="margin-top:10px">
              Para Gmail: ative a Verificação em 2 etapas → crie uma <strong>Senha de App</strong> em myaccount.google.com/apppasswords.
            </div>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-card__header">
            <div><h3>WhatsApp</h3><p>Gera links wa.me para envio manual por cada cliente</p></div>
          </div>
          <div class="panel-card__body">
            <div class="form-grid">
              <div class="form-field form-field--span-2">
                <label>
                  <input type="checkbox" id="alWppAtivo" ${cfg.whatsapp_ativo ? 'checked' : ''} />
                  Ativar links WhatsApp
                </label>
              </div>
              <div class="form-field form-field--span-2">
                <label>Mensagem WhatsApp</label>
                <textarea id="alWppMsg" rows="4" placeholder="Use {{cliente_nome}}, {{valor_total}}, {{empresa_nome}}">${v(cfg.whatsapp_msg)}</textarea>
                <small style="color:var(--text-muted)">Variáveis: {{cliente_nome}} {{valor_total}} {{empresa_nome}} {{dias_atraso}}</small>
              </div>
            </div>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-card__header">
            <div><h3>Critério</h3></div>
          </div>
          <div class="panel-card__body">
            <div class="form-field">
              <label>Disparar quando atraso for maior que (dias)</label>
              <input type="number" id="alDiasMin" min="0" value="${v(cfg.dias_atraso_minimo || 1)}" style="max-width:100px" />
            </div>
          </div>
        </div>

        <div>
          <button class="btn btn-primary" id="alSalvarConfigBtn">
            <i class="fa-solid fa-floppy-disk"></i> Salvar configuração
          </button>
          <div class="module-feedback" id="alConfigFeedback" style="margin-top:10px"></div>
        </div>
      </div>
    `;
  },

  bindConfigEvents() {
    document.getElementById('alSalvarConfigBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('alSalvarConfigBtn');
      const fb  = document.getElementById('alConfigFeedback');

      const smtpPass = document.getElementById('alSmtpPass')?.value?.trim();

      const payload = {
        email_ativo:         document.getElementById('alEmailAtivo')?.checked  ?? false,
        smtp_host:           document.getElementById('alSmtpHost')?.value?.trim() || null,
        smtp_port:           Number(document.getElementById('alSmtpPort')?.value || 587),
        smtp_user:           document.getElementById('alSmtpUser')?.value?.trim() || null,
        smtp_from:           document.getElementById('alSmtpFrom')?.value?.trim() || null,
        email_assunto:       document.getElementById('alEmailAssunto')?.value?.trim() || null,
        email_corpo:         document.getElementById('alEmailCorpo')?.value?.trim() || null,
        whatsapp_ativo:      document.getElementById('alWppAtivo')?.checked ?? false,
        whatsapp_msg:        document.getElementById('alWppMsg')?.value?.trim() || null,
        dias_atraso_minimo:  Number(document.getElementById('alDiasMin')?.value || 1)
      };

      // Só envia smtp_pass se o campo foi preenchido
      if (smtpPass) payload.smtp_pass = smtpPass;

      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...'; }

      try {
        await api.salvarAlertasConfig(payload);
        showToast('Configuração de alertas salva.', 'success');
        if (fb) { fb.className = 'module-feedback module-feedback--success'; fb.textContent = 'Configuração salva com sucesso.'; }
        await this.load();
      } catch (err) {
        if (fb) { fb.className = 'module-feedback module-feedback--error'; fb.textContent = err.message || 'Erro ao salvar.'; }
        showToast('Erro ao salvar configuração.', 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar configuração'; }
      }
    });
  },

  // ── HISTÓRICO ─────────────────────────────────────────────────────────────

  renderHistorico() {
    const hist = this.state.historico;

    const totEmail = hist.filter((h) => h.tipo === 'email'     && h.status === 'enviado').length;
    const totWpp   = hist.filter((h) => h.tipo === 'whatsapp'  && h.status === 'enviado').length;
    const totErros = hist.filter((h) => h.status === 'erro').length;

    if (!hist.length) {
      return `<div class="module-feedback module-feedback--info" style="margin-top:16px">Nenhum alerta disparado ainda.</div>`;
    }

    const linhas = hist.map((h) => {
      const data = h.criado_em ? new Date(h.criado_em).toLocaleString('pt-BR') : '-';
      return `
        <tr>
          <td>
            ${h.tipo === 'email'
              ? '<i class="fa-solid fa-envelope" style="color:var(--primary)"></i> Email'
              : '<i class="fa-brands fa-whatsapp" style="color:#25d366"></i> WhatsApp'}
          </td>
          <td>${this.esc(h.cliente_nome || '-')}</td>
          <td>${this.esc(h.contato || '-')}</td>
          <td class="text-right">${this.fmtCur(h.valor_total)}</td>
          <td>
            <span class="badge ${h.status === 'enviado' ? 'badge--success' : 'badge--danger'}">
              ${h.status}
            </span>
          </td>
          <td>${data}</td>
          ${h.erro_msg ? `<td><small style="color:var(--danger)">${this.esc(h.erro_msg)}</small></td>` : '<td>—</td>'}
        </tr>
      `;
    }).join('');

    return `
      <div class="module-toolbar" style="margin-top:8px;margin-bottom:12px">
        <div class="module-toolbar__stats">
          <div class="mini-stat"><span>Emails enviados</span><strong>${totEmail}</strong></div>
          <div class="mini-stat"><span>Links WhatsApp</span><strong>${totWpp}</strong></div>
          <div class="mini-stat"><span>Erros</span><strong style="color:${totErros > 0 ? 'var(--danger)' : ''}">${totErros}</strong></div>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Canal</th>
              <th>Cliente</th>
              <th>Contato</th>
              <th class="text-right">Valor</th>
              <th>Status</th>
              <th>Enviado em</th>
              <th>Erro</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
    `;
  },

  // ── HELPERS ───────────────────────────────────────────────────────────────

  setFeedback(msg, type = 'info') {
    const el = document.getElementById('alertasFeedback');
    if (!el) return;
    if (!msg) { el.className = 'module-feedback'; el.textContent = ''; return; }
    el.className = `module-feedback module-feedback--${type}`;
    el.textContent = msg;
  },

  fmtCur(v) {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },

  esc(v) {
    return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }
};

export async function initAlertasModule() {
  AlertasModule.init();
  await AlertasModule.load();
}

export default AlertasModule;
