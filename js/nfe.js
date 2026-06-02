import api from './api.js';
import { showToast } from './feedback.js';

const NfeModule = {
  state: {
    aba: 'lista',
    nfes: [],
    config: null,
    empresa: null,
    total: 0,
    pagina: 1,
    filtroStatus: '',
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
      await Promise.all([this.fetchLista(), this.fetchConfig()]);
      this.renderConteudo();
      this.setFeedback('', '');
    } catch (err) {
      console.error('[nfe] load:', err);
      this.setFeedback('Erro ao carregar o módulo NF-e.', 'error');
    } finally {
      this.state.carregando = false;
    }
  },

  async fetchLista() {
    const q = { pagina: this.state.pagina, limite: 50 };
    if (this.state.filtroStatus) q.status = this.state.filtroStatus;
    const result = await api.getNfeLista(q);
    this.state.nfes  = result?.nfes  || [];
    this.state.total = result?.total || 0;
  },

  async fetchConfig() {
    try {
      const result = await api.getNfeConfig();
      this.state.config  = result?.config  || null;
      this.state.empresa = result?.empresa || null;
    } catch {
      this.state.config  = null;
      this.state.empresa = null;
    }
  },

  // ── RENDER SHELL ───────────────────────────────────────────────────────────

  render() {
    const c = document.getElementById('nfeContainer');
    if (!c) return;

    c.innerHTML = `
      <section class="module-card">
        <div class="module-card__header">
          <div>
            <h3>NF-e</h3>
            <p>Emissão, consulta e cancelamento de Notas Fiscais Eletrônicas</p>
          </div>
          <div class="module-card__actions">
            <button class="btn btn-light" id="nfeAtualizarBtn">
              <i class="fa-solid fa-rotate"></i> Atualizar
            </button>
          </div>
        </div>

        <div class="module-feedback" id="nfeFeedback"></div>

        <div class="module-toolbar">
          <div class="table-actions">
            <button class="btn-inline btn-inline--active" data-nfe-aba="lista">NF-es Emitidas</button>
            <button class="btn-inline" data-nfe-aba="emitir">Emitir NF-e</button>
            <button class="btn-inline" data-nfe-aba="config">Configuração</button>
          </div>
        </div>

        <div id="nfeConteudo"></div>
      </section>
    `;
  },

  bindShellEvents() {
    document.getElementById('nfeAtualizarBtn')?.addEventListener('click', async () => {
      await this.load();
    });

    document.getElementById('nfeContainer')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-nfe-aba]');
      if (!btn) return;
      this.state.aba = btn.dataset.nfeAba;
      // Update active tab
      document.querySelectorAll('[data-nfe-aba]').forEach((b) => b.classList.remove('btn-inline--active'));
      btn.classList.add('btn-inline--active');
      this.renderConteudo();
    });
  },

  renderConteudo() {
    const c = document.getElementById('nfeConteudo');
    if (!c) return;

    if (this.state.aba === 'lista')   { c.innerHTML = this.renderLista();  this.bindListaEvents();  return; }
    if (this.state.aba === 'emitir')  { c.innerHTML = this.renderEmitir(); this.bindEmitirEvents(); return; }
    c.innerHTML = this.renderConfig();
    this.bindConfigEvents();
  },

  // ── LISTA ─────────────────────────────────────────────────────────────────

  renderLista() {
    const statusFiltros = ['', 'autorizado', 'processando', 'erro', 'cancelado', 'rejeitado'];
    const filterBar = `
      <div class="module-toolbar" style="margin-bottom:12px">
        <div class="table-actions">
          ${statusFiltros.map((s) => `
            <button class="btn-inline ${this.state.filtroStatus === s ? 'btn-inline--active' : ''}" data-nfe-filtro="${s}">
              ${s === '' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    if (!this.state.nfes.length) {
      return filterBar + `<div class="module-feedback module-feedback--info">Nenhuma NF-e encontrada${this.state.filtroStatus ? ` com status "${this.state.filtroStatus}"` : ''}.</div>`;
    }

    const rows = this.state.nfes.map((n) => {
      const badgeClass = {
        autorizado: 'badge--success',
        processando: 'badge--warning',
        erro: 'badge--danger',
        cancelado: 'badge--danger',
        rejeitado: 'badge--danger'
      }[n.status] || 'badge--info';

      const data = n.criado_em ? new Date(n.criado_em).toLocaleDateString('pt-BR') : '-';
      const ambLabel = Number(n.ambiente) === 1 ? 'Produção' : 'Homologação';

      const acoes = [];
      if (n.status === 'autorizado') {
        acoes.push(`<button class="btn-inline" data-nfe-danfe="${this.esc(n.ref)}">DANFE</button>`);
        acoes.push(`<button class="btn-inline" data-nfe-xml="${this.esc(n.ref)}">XML</button>`);
        acoes.push(`<button class="btn-inline btn-inline--danger" data-nfe-cancelar-id="${n.id}">Cancelar</button>`);
      }
      if (n.status === 'processando' || n.status === 'erro') {
        acoes.push(`<button class="btn-inline" data-nfe-consultar="${this.esc(n.ref)}">Consultar</button>`);
      }

      return `
        <tr>
          <td>${n.id}</td>
          <td><span class="badge ${badgeClass}">${n.status}</span></td>
          <td>${this.esc(n.cliente_nome || 'Consumidor Final')}</td>
          <td>${n.venda_id ? `#${n.venda_id}` : '-'}</td>
          <td>${n.numero ? `${this.esc(n.serie || '')}/${n.numero}` : '-'}</td>
          <td><small style="color:var(--text-muted);word-break:break-all;font-size:11px">${this.esc(n.chave_nfe || '-')}</small></td>
          <td><span class="badge ${Number(n.ambiente)===1?'badge--danger':'badge--warning'}">${ambLabel}</span></td>
          <td>${data}</td>
          <td class="text-right">
            <div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap">
              ${acoes.join('')}
              ${n.mensagem ? `<small style="color:var(--text-muted);display:block;margin-top:4px;max-width:140px">${this.esc(n.mensagem)}</small>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    return filterBar + `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Status</th>
              <th>Cliente</th>
              <th>Venda</th>
              <th>Número</th>
              <th>Chave NF-e</th>
              <th>Ambiente</th>
              <th>Emitida em</th>
              <th class="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="module-feedback module-feedback--info" style="margin-top:8px">
        Total: ${this.state.total} NF-e(s).
      </div>
    `;
  },

  bindListaEvents() {
    const c = document.getElementById('nfeConteudo');
    if (!c) return;

    c.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-nfe-filtro]');
      if (btn) {
        this.state.filtroStatus = btn.dataset.nfeFiltro;
        this.state.pagina = 1;
        await this.fetchLista();
        this.renderConteudo();
        return;
      }

      const danfe = e.target.closest('[data-nfe-danfe]');
      if (danfe) { await this.abrirDanfe(danfe.dataset.nfeDanfe); return; }

      const xml = e.target.closest('[data-nfe-xml]');
      if (xml) { await this.baixarXml(xml.dataset.nfeXml); return; }

      const consultar = e.target.closest('[data-nfe-consultar]');
      if (consultar) { await this.consultarStatus(consultar.dataset.nfeConsultar); return; }

      const cancelar = e.target.closest('[data-nfe-cancelar-id]');
      if (cancelar) { await this.cancelarNfe(Number(cancelar.dataset.nfeCancelarId)); return; }
    });
  },

  // ── EMITIR ────────────────────────────────────────────────────────────────

  renderEmitir() {
    const temConfig = Boolean(this.state.config?.token_focusnfe);
    const ambLabel  = Number(this.state.config?.ambiente) === 1 ? 'Produção' : 'Homologação';

    if (!temConfig) {
      return `
        <div class="module-feedback module-feedback--error" style="margin-top:16px">
          Configure o token Focus NFe antes de emitir. Acesse a aba <strong>Configuração</strong>.
        </div>
      `;
    }

    return `
      <div class="panel-card" style="max-width:480px;margin-top:16px">
        <div class="panel-card__header">
          <div>
            <h3>Emitir NF-e por venda</h3>
            <p>Ambiente: <span class="badge ${Number(this.state.config?.ambiente)===1?'badge--danger':'badge--warning'}">${ambLabel}</span></p>
          </div>
        </div>
        <div class="panel-card__body">
          <div class="module-feedback module-feedback--info" style="margin-bottom:12px">
            Os produtos da venda devem ter NCM preenchido. O cliente precisa ter CPF/CNPJ para emissão com destinatário identificado.
          </div>
          <div class="form-field" style="margin-bottom:12px">
            <label for="nfeVendaId">ID da venda</label>
            <input type="number" id="nfeVendaId" placeholder="Ex: 42" min="1" />
          </div>
          <button class="btn btn-primary" id="nfeEmitirBtn">
            <i class="fa-solid fa-file-invoice"></i> Emitir NF-e
          </button>
          <div class="module-feedback" id="nfeEmitirFeedback" style="margin-top:12px"></div>
        </div>
      </div>
    `;
  },

  bindEmitirEvents() {
    document.getElementById('nfeEmitirBtn')?.addEventListener('click', async () => {
      const vendaId = Number(document.getElementById('nfeVendaId')?.value || 0);
      if (!vendaId) { showToast('Informe o ID da venda.', 'error'); return; }

      const btn = document.getElementById('nfeEmitirBtn');
      const feedback = document.getElementById('nfeEmitirFeedback');
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Emitindo...'; }
      if (feedback) { feedback.className = 'module-feedback module-feedback--info'; feedback.textContent = 'Enviando para Focus NFe...'; }

      try {
        const result = await api.emitirNfe(vendaId);
        const statusBadge = result.status === 'autorizado' ? 'badge--success'
                          : result.status === 'erro' ? 'badge--danger' : 'badge--warning';
        if (feedback) {
          feedback.className = `module-feedback module-feedback--${result.status === 'autorizado' ? 'success' : result.status === 'erro' ? 'error' : 'info'}`;
          feedback.innerHTML = `
            <strong>Status:</strong> <span class="badge ${statusBadge}">${result.status}</span><br>
            ${result.chave_nfe ? `<strong>Chave:</strong> <small>${this.esc(result.chave_nfe)}</small><br>` : ''}
            ${result.numero ? `<strong>Número:</strong> ${result.serie}/${result.numero}<br>` : ''}
            ${result.mensagem ? `<strong>SEFAZ:</strong> ${this.esc(result.mensagem)}<br>` : ''}
            <strong>Ambiente:</strong> ${result.ambiente}
          `;
        }
        if (result.status === 'autorizado') {
          showToast('NF-e autorizada com sucesso!', 'success');
          await this.fetchLista();
        }
      } catch (err) {
        const msg = err.message || 'Erro ao emitir NF-e.';
        if (feedback) { feedback.className = 'module-feedback module-feedback--error'; feedback.textContent = msg; }
        showToast(msg, 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-file-invoice"></i> Emitir NF-e'; }
      }
    });
  },

  // ── CONFIGURAÇÃO ──────────────────────────────────────────────────────────

  renderConfig() {
    const cfg = this.state.config  || {};
    const emp = this.state.empresa || {};
    const temToken = Boolean(cfg.token_focusnfe);

    const v = (val) => this.esc(val || '');

    return `
      <div style="max-width:620px;margin-top:16px;display:grid;gap:20px">

        <div class="panel-card">
          <div class="panel-card__header">
            <div><h3>Integração Focus NFe</h3><p>Token e ambiente para emissão</p></div>
          </div>
          <div class="panel-card__body">
            <div class="form-grid">
              <div class="form-field form-field--span-2">
                <label>Token Focus NFe</label>
                <input type="password" id="nfeCfgToken"
                  placeholder="${temToken ? '***configurado*** — cole um novo para alterar' : 'Cole seu token do painel Focus NFe'}" />
                ${temToken
                  ? '<small style="color:var(--success)"><i class="fa-solid fa-circle-check"></i> Token configurado.</small>'
                  : '<small style="color:var(--danger)"><i class="fa-solid fa-triangle-exclamation"></i> Token não configurado — emissão bloqueada.</small>'}
              </div>
              <div class="form-field">
                <label>Ambiente</label>
                <select id="nfeCfgAmbiente">
                  <option value="2" ${Number(cfg.ambiente) !== 1 ? 'selected' : ''}>Homologação (Testes)</option>
                  <option value="1" ${Number(cfg.ambiente) === 1 ? 'selected' : ''}>Produção</option>
                </select>
              </div>
              <div class="form-field">
                <label>Série</label>
                <input id="nfeCfgSerie" value="${v(cfg.serie || '1')}" maxlength="3" />
              </div>
            </div>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-card__header">
            <div><h3>Dados fiscais do emitente</h3><p>Obrigatórios para emissão</p></div>
          </div>
          <div class="panel-card__body">
            <div class="form-grid">
              <div class="form-field">
                <label>IE — Inscrição Estadual</label>
                <input id="nfeCfgIe" value="${v(emp.ie)}" placeholder="Ex: 12345678 ou ISENTO" />
              </div>
              <div class="form-field">
                <label>IM — Inscrição Municipal</label>
                <input id="nfeCfgIm" value="${v(emp.im)}" placeholder="Opcional" />
              </div>
              <div class="form-field form-field--span-2">
                <label>CRT — Regime Tributário</label>
                <select id="nfeCfgCrt">
                  <option value="1" ${Number(emp.crt) === 1 ? 'selected' : ''}>1 — Simples Nacional</option>
                  <option value="2" ${Number(emp.crt) === 2 ? 'selected' : ''}>2 — Simples Nacional Excesso</option>
                  <option value="3" ${Number(emp.crt) === 3 ? 'selected' : ''}>3 — Regime Normal (Lucro Presumido/Real)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-card__header">
            <div><h3>Endereço do emitente</h3><p>Deve corresponder exatamente ao CNPJ cadastrado na SEFAZ</p></div>
          </div>
          <div class="panel-card__body">
            <div class="form-grid">
              <div class="form-field form-field--span-2">
                <label>Logradouro</label>
                <input id="nfeCfgLogradouro" value="${v(emp.logradouro)}" placeholder="Rua, Av., Trav..." />
              </div>
              <div class="form-field">
                <label>Número</label>
                <input id="nfeCfgNumero" value="${v(emp.numero)}" placeholder="Ex: 123 ou SN" />
              </div>
              <div class="form-field">
                <label>Complemento</label>
                <input id="nfeCfgComplemento" value="${v(emp.complemento)}" placeholder="Sala, Loja..." />
              </div>
              <div class="form-field">
                <label>Bairro</label>
                <input id="nfeCfgBairro" value="${v(emp.bairro)}" />
              </div>
              <div class="form-field">
                <label>Município</label>
                <input id="nfeCfgMunicipio" value="${v(emp.municipio)}" />
              </div>
              <div class="form-field">
                <label>UF</label>
                <input id="nfeCfgUf" value="${v(emp.uf)}" maxlength="2" placeholder="CE" style="text-transform:uppercase" />
              </div>
              <div class="form-field">
                <label>CEP</label>
                <input id="nfeCfgCep" value="${v(emp.cep)}" placeholder="00000-000" />
              </div>
              <div class="form-field">
                <label>Código IBGE</label>
                <input id="nfeCfgCodigoMunicipio" value="${v(emp.codigo_municipio)}" placeholder="Ex: 2304400" />
              </div>
            </div>
          </div>
        </div>

        <div>
          <button class="btn btn-primary" id="nfeSalvarConfigBtn">
            <i class="fa-solid fa-floppy-disk"></i> Salvar configuração
          </button>
          <div class="module-feedback" id="nfeConfigFeedback" style="margin-top:12px"></div>
        </div>
      </div>
    `;
  },

  bindConfigEvents() {
    document.getElementById('nfeSalvarConfigBtn')?.addEventListener('click', async () => {
      const btn      = document.getElementById('nfeSalvarConfigBtn');
      const feedback = document.getElementById('nfeConfigFeedback');

      const payload = {
        token_focusnfe:    document.getElementById('nfeCfgToken')?.value?.trim() || undefined,
        ambiente:          Number(document.getElementById('nfeCfgAmbiente')?.value || 2),
        serie:             document.getElementById('nfeCfgSerie')?.value?.trim() || '1',
        ie:                document.getElementById('nfeCfgIe')?.value?.trim() || null,
        im:                document.getElementById('nfeCfgIm')?.value?.trim() || null,
        crt:               Number(document.getElementById('nfeCfgCrt')?.value || 1),
        logradouro:        document.getElementById('nfeCfgLogradouro')?.value?.trim() || null,
        numero:            document.getElementById('nfeCfgNumero')?.value?.trim() || null,
        complemento:       document.getElementById('nfeCfgComplemento')?.value?.trim() || null,
        bairro:            document.getElementById('nfeCfgBairro')?.value?.trim() || null,
        municipio:         document.getElementById('nfeCfgMunicipio')?.value?.trim() || null,
        uf:                document.getElementById('nfeCfgUf')?.value?.trim().toUpperCase() || null,
        cep:               document.getElementById('nfeCfgCep')?.value?.trim() || null,
        codigo_municipio:  document.getElementById('nfeCfgCodigoMunicipio')?.value?.trim() || null
      };

      // Remove token se campo vazio (não sobrescreve)
      if (!payload.token_focusnfe) delete payload.token_focusnfe;

      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...'; }

      try {
        await api.salvarNfeConfig(payload);
        if (feedback) { feedback.className = 'module-feedback module-feedback--success'; feedback.textContent = 'Configuração salva com sucesso.'; }
        showToast('Configuração NF-e salva.', 'success');
        await this.fetchConfig();
        // Re-render para atualizar badge de token
        this.renderConteudo();
      } catch (err) {
        const msg = err.message || 'Erro ao salvar configuração.';
        if (feedback) { feedback.className = 'module-feedback module-feedback--error'; feedback.textContent = msg; }
        showToast(msg, 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar configuração'; }
      }
    });
  },

  // ── AÇÕES ─────────────────────────────────────────────────────────────────

  async abrirDanfe(ref) {
    try {
      showToast('Baixando DANFE...', 'info');
      const url = await api.downloadNfePdf(ref);
      window.open(url, '_blank');
    } catch (err) {
      showToast(err.message || 'Erro ao baixar DANFE.', 'error');
    }
  },

  async baixarXml(ref) {
    try {
      showToast('Baixando XML...', 'info');
      const url = await api.downloadNfeXml(ref);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nfe-${ref}.xml`;
      a.click();
    } catch (err) {
      showToast(err.message || 'Erro ao baixar XML.', 'error');
    }
  },

  async consultarStatus(ref) {
    try {
      showToast('Consultando status...', 'info');
      const result = await api.consultarNfe(ref);
      showToast(`Status: ${result.status || 'desconhecido'}`, result.status === 'autorizado' ? 'success' : 'info');
      await this.fetchLista();
      this.renderConteudo();
    } catch (err) {
      showToast(err.message || 'Erro ao consultar NF-e.', 'error');
    }
  },

  async cancelarNfe(nfeId) {
    const justificativa = await this.promptJustificativa();
    if (!justificativa) return;

    try {
      await api.cancelarNfe(nfeId, justificativa);
      showToast('NF-e cancelada com sucesso.', 'success');
      await this.fetchLista();
      this.renderConteudo();
    } catch (err) {
      showToast(err.message || 'Erro ao cancelar NF-e.', 'error');
    }
  },

  promptJustificativa() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px';
      overlay.innerHTML = `
        <div style="background:var(--surface);border-radius:16px;padding:24px;max-width:440px;width:100%;box-shadow:0 24px 50px rgba(0,0,0,.2)">
          <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;color:var(--danger)">Cancelar NF-e</h3>
          <p style="font-size:13px;color:var(--text-muted);margin:0 0 14px">
            O cancelamento é irreversível e deve ser solicitado em até 24h da emissão.<br>
            <strong>Justificativa (mínimo 15 caracteres):</strong>
          </p>
          <textarea id="_nfeJustInput" rows="3" placeholder="Motivo do cancelamento..."
            style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;box-sizing:border-box;resize:vertical;margin-bottom:14px"></textarea>
          <div style="display:flex;gap:10px;justify-content:flex-end">
            <button id="_nfeCancelarAbort" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--surface-3);font-size:13px;cursor:pointer">Voltar</button>
            <button id="_nfeCancelarConfirm" style="padding:8px 16px;border-radius:8px;border:none;background:var(--danger);color:#fff;font-size:13px;font-weight:600;cursor:pointer">Confirmar cancelamento</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector('#_nfeCancelarAbort').onclick = () => { document.body.removeChild(overlay); resolve(null); };
      overlay.querySelector('#_nfeCancelarConfirm').onclick = () => {
        const val = overlay.querySelector('#_nfeJustInput').value.trim();
        if (val.length < 15) { showToast('Justificativa deve ter ao menos 15 caracteres.', 'error'); return; }
        document.body.removeChild(overlay);
        resolve(val);
      };
    });
  },

  // ── HELPERS ───────────────────────────────────────────────────────────────

  setFeedback(msg, type = 'info') {
    const el = document.getElementById('nfeFeedback');
    if (!el) return;
    if (!msg) { el.className = 'module-feedback'; el.textContent = ''; return; }
    el.className = `module-feedback module-feedback--${type}`;
    el.textContent = msg;
  },

  esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
};

export async function initNfeModule() {
  NfeModule.init();
  await NfeModule.load();
}

export default NfeModule;
