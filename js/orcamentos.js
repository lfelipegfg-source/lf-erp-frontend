import api from './api.js';
import { showToast } from './feedback.js';

const STATUS_BADGE = {
  rascunho:   'badge--info',
  enviado:    'badge--warning',
  aprovado:   'badge--success',
  recusado:   'badge--danger',
  expirado:   '',
  convertido: ''
};

const STATUS_LABEL = {
  rascunho:   'Rascunho',
  enviado:    'Enviado',
  aprovado:   'Aprovado',
  recusado:   'Recusado',
  expirado:   'Expirado',
  convertido: 'Convertido'
};

const OrcamentosModule = {
  state: {
    orcamentos: [],
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
    this.setFeedback('Carregando orçamentos...', 'info');
    try {
      const q = {};
      if (this.state.filtroStatus) q.status = this.state.filtroStatus;
      const result = await api.getOrcamentos(q);
      this.state.orcamentos = result?.orcamentos || (Array.isArray(result) ? result : []);
      this.renderLista();
      this.setFeedback('', '');
    } catch (err) {
      console.error('[orcamentos] load:', err);
      this.setFeedback('Erro ao carregar orçamentos.', 'error');
    } finally {
      this.state.carregando = false;
    }
  },

  render() {
    const c = document.getElementById('orcamentosContainer');
    if (!c) return;

    c.innerHTML = `
      <section class="module-card">
        <div class="module-card__header">
          <div>
            <h3>Orçamentos</h3>
            <p>Cotações emitidas — gerencie aprovações e converta em pedidos</p>
          </div>
          <div class="module-card__actions">
            <button class="btn btn-light" id="orcAtualizarBtn">
              <i class="fa-solid fa-rotate"></i> Atualizar
            </button>
          </div>
        </div>

        <div class="module-feedback" id="orcFeedback"></div>

        <div class="module-toolbar">
          <div class="table-actions">
            ${['', 'rascunho', 'enviado', 'aprovado', 'recusado', 'convertido'].map((s) => `
              <button class="btn-inline ${this.state.filtroStatus === s ? 'btn-inline--active' : ''}" data-orc-filtro="${s}">
                ${s === '' ? 'Todos' : STATUS_LABEL[s]}
              </button>
            `).join('')}
          </div>
        </div>

        <div id="orcLista"></div>
      </section>
    `;
  },

  bindShellEvents() {
    const c = document.getElementById('orcamentosContainer');
    if (!c) return;

    document.getElementById('orcAtualizarBtn')?.addEventListener('click', () => this.load());

    c.addEventListener('click', async (e) => {
      const filtroBtn = e.target.closest('[data-orc-filtro]');
      if (filtroBtn) {
        this.state.filtroStatus = filtroBtn.dataset.orcFiltro;
        document.querySelectorAll('[data-orc-filtro]').forEach((b) => b.classList.remove('btn-inline--active'));
        filtroBtn.classList.add('btn-inline--active');
        await this.load();
        return;
      }

      const acao = e.target.closest('[data-orc-acao]');
      if (!acao) return;
      const { orcAcao, orcId } = acao.dataset;
      await this.executarAcao(Number(orcId), orcAcao, acao);
    });
  },

  renderLista() {
    const c = document.getElementById('orcLista');
    if (!c) return;

    const lista = this.state.orcamentos;

    if (!lista.length) {
      c.innerHTML = `<div class="module-feedback module-feedback--info">Nenhum orçamento encontrado${this.state.filtroStatus ? ` com status "${STATUS_LABEL[this.state.filtroStatus]}"` : ''}.</div>`;
      return;
    }

    c.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Cliente</th>
              <th>Status</th>
              <th>Validade</th>
              <th>Itens</th>
              <th class="text-right">Total</th>
              <th>Criado em</th>
              <th class="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${lista.map((o) => this.renderLinha(o)).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderLinha(o) {
    const badge = STATUS_BADGE[o.status] || '';
    const data  = o.criado_em ? new Date(o.criado_em).toLocaleDateString('pt-BR') : '-';
    const valid = o.validade ? this.fmtDate(o.validade) : '-';
    const acoes = this.renderAcoes(o);

    return `
      <tr>
        <td><strong>#${o.numero}</strong></td>
        <td>${this.esc(o.cliente_nome || 'Sem cliente')}</td>
        <td><span class="badge ${badge}">${STATUS_LABEL[o.status] || o.status}</span></td>
        <td>${valid}</td>
        <td>${Number(o.total_itens || 0)}</td>
        <td class="text-right"><strong>${this.fmtCur(o.total)}</strong></td>
        <td>${data}</td>
        <td class="text-right">
          <div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap">
            ${acoes}
          </div>
        </td>
      </tr>
    `;
  },

  renderAcoes(o) {
    const btn = (label, acao, cls = '') =>
      `<button class="btn-inline ${cls}" data-orc-acao="${acao}" data-orc-id="${o.id}">${label}</button>`;

    const acoes = [];
    // PDF disponível para qualquer status exceto excluído
    if (!['expirado'].includes(o.status)) {
      acoes.push(btn('<i class="fa-solid fa-file-pdf"></i> PDF', 'pdf'));
    }
    if (o.status === 'rascunho') {
      acoes.push(btn('Enviar', 'enviar'));
      acoes.push(btn('Excluir', 'excluir', 'btn-inline--danger'));
    }
    if (o.status === 'enviado') {
      acoes.push(btn('Aprovar', 'aprovar'));
      acoes.push(btn('Recusar', 'recusar', 'btn-inline--danger'));
    }
    if (o.status === 'aprovado') {
      acoes.push(btn('Converter em Pedido', 'converter'));
    }
    return acoes.join('');
  },

  async gerarPdf(id) {
    try {
      showToast('Carregando orçamento...', 'info');
      const result = await api.getOrcamento(id);
      const orc = result?.orcamento || result;
      localStorage.setItem('lf_erp_orcamento_pdf', JSON.stringify(orc));
      window.open('./orcamento-pdf.html', '_blank');
    } catch (err) {
      showToast(err.message || 'Erro ao gerar PDF.', 'error');
    }
  },

  async executarAcao(id, acao, btnEl) {
    if (btnEl) btnEl.disabled = true;
    try {
      if (acao === 'pdf') { await this.gerarPdf(id); if (btnEl) btnEl.disabled = false; return; }
      if (acao === 'enviar') {
        await api.enviarOrcamento(id);
        showToast('Orçamento marcado como enviado.', 'success');
      } else if (acao === 'aprovar') {
        await api.aprovarOrcamento(id);
        showToast('Orçamento aprovado.', 'success');
      } else if (acao === 'recusar') {
        await api.recusarOrcamento(id);
        showToast('Orçamento recusado.', 'info');
      } else if (acao === 'excluir') {
        if (!confirm('Excluir este orçamento em rascunho?')) return;
        await api.deleteOrcamento(id);
        showToast('Orçamento excluído.', 'success');
      } else if (acao === 'converter') {
        await this.converterEmPedido(id);
        return;
      }
      await this.load();
    } catch (err) {
      showToast(err.message || 'Erro ao executar ação.', 'error');
      if (btnEl) btnEl.disabled = false;
    }
  },

  async converterEmPedido(orcId) {
    const forma = await this.promptFormaPagamento('Converter Orçamento em Pedido', 'Informe a forma de pagamento (opcional):');
    try {
      const result = await api.converterOrcamentoPedido(orcId, { forma_pagamento: forma || null });
      const num = result?.pedido?.numero ?? result?.numero ?? '?';
      showToast(`Pedido #${num} criado com sucesso.`, 'success');
      await this.load();
    } catch (err) {
      showToast(err.message || 'Erro ao converter orçamento.', 'error');
    }
  },

  promptFormaPagamento(titulo, descricao) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px';
      overlay.innerHTML = `
        <div style="background:var(--surface);border-radius:16px;padding:24px;max-width:420px;width:100%;box-shadow:0 24px 50px rgba(0,0,0,.2)">
          <h3 style="margin:0 0 8px;font-size:16px;font-weight:700">${titulo}</h3>
          <p style="font-size:13px;color:var(--text-muted);margin:0 0 14px">${descricao}</p>
          <select id="_orcFormaSelect" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;box-sizing:border-box;margin-bottom:14px">
            <option value="">Não informado</option>
            <option value="Dinheiro">Dinheiro</option>
            <option value="Pix">Pix</option>
            <option value="Cartão de Débito">Cartão de Débito</option>
            <option value="Cartão de Crédito">Cartão de Crédito</option>
            <option value="Promissória">Promissória</option>
          </select>
          <div style="display:flex;gap:10px;justify-content:flex-end">
            <button id="_orcCancelarConv" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--surface-3);font-size:13px;cursor:pointer">Cancelar</button>
            <button id="_orcConfirmarConv" style="padding:8px 16px;border-radius:8px;border:none;background:var(--primary);color:#fff;font-size:13px;font-weight:600;cursor:pointer">Converter</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector('#_orcCancelarConv').onclick = () => { document.body.removeChild(overlay); resolve(null); };
      overlay.querySelector('#_orcConfirmarConv').onclick = () => {
        const val = overlay.querySelector('#_orcFormaSelect').value;
        document.body.removeChild(overlay);
        resolve(val || null);
      };
    });
  },

  setFeedback(msg, type = 'info') {
    const el = document.getElementById('orcFeedback');
    if (!el) return;
    if (!msg) { el.className = 'module-feedback'; el.textContent = ''; return; }
    el.className = `module-feedback module-feedback--${type}`;
    el.textContent = msg;
  },

  fmtCur(v) {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },

  fmtDate(v) {
    if (!v) return '-';
    if (/^\d{4}-\d{2}-\d{2}/.test(String(v))) {
      const [ano, mes, dia] = String(v).slice(0, 10).split('-');
      return `${dia}/${mes}/${ano}`;
    }
    return new Date(v).toLocaleDateString('pt-BR');
  },

  esc(v) {
    return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }
};

export async function initOrcamentosModule() {
  OrcamentosModule.init();
  await OrcamentosModule.load();
}

export default OrcamentosModule;
