import api from './api.js';
import { showToast } from './feedback.js';
import { exportCSV, numCSV } from './exportUtils.js';

const DevolucoesModule = {
  state: {
    aba: 'nova',
    devolucoes: [],
    vendaCarregada: null,
    itensVenda: [],
    carregando: false
  },

  init() {
    this.render();
    this.bindShellEvents();
    this.loadHistorico();
  },

  async loadHistorico() {
    try {
      const result = await api.getDevolucoes();
      this.state.devolucoes = result?.devolucoes || (Array.isArray(result) ? result : []);
      if (this.state.aba === 'historico') this.renderConteudo();
    } catch (err) {
      console.error('[devolucoes] loadHistorico:', err);
    }
  },

  render() {
    const c = document.getElementById('devolucoesContainer');
    if (!c) return;
    c.innerHTML = `
      <section class="module-card">
        <div class="module-feedback" id="devFeedback"></div>
        <div class="module-toolbar">
          <div class="table-actions">
            <button class="btn-inline btn-inline--active" data-dev-aba="nova">Nova Devolução</button>
            <button class="btn-inline" data-dev-aba="historico">Histórico</button>
          </div>
          <div class="module-card__actions">
            <button class="btn btn-light" id="devExportarBtn">
              <i class="fa-solid fa-file-csv"></i> Exportar CSV
            </button>
            <button class="btn btn-light" id="devAtualizarBtn">
              <i class="fa-solid fa-rotate"></i> Atualizar
            </button>
          </div>
        </div>
        <div id="devConteudo"></div>
      </section>
    `;
    this.renderConteudo();
  },

  bindShellEvents() {
    const c = document.getElementById('devolucoesContainer');
    if (!c) return;

    document.getElementById('devAtualizarBtn')?.addEventListener('click', async () => {
      await this.loadHistorico();
      this.renderConteudo();
    });

    document.getElementById('devExportarBtn')?.addEventListener('click', () => {
      exportCSV(this.state.devolucoes.map((d) => ({
        'Nº':           d.numero || '',
        'Venda':        d.venda_id ? `#${d.venda_id}` : '-',
        'Cliente':      d.cliente_nome || 'Consumidor Final',
        'Motivo':       d.motivo || '',
        'Total (R$)':   numCSV(d.total_devolvido),
        'Status':       d.status || '',
        'Data':         d.criado_em ? new Date(d.criado_em).toLocaleDateString('pt-BR') : ''
      })), 'devolucoes');
    });

    c.addEventListener('click', (e) => {
      const abaBtn = e.target.closest('[data-dev-aba]');
      if (abaBtn) {
        this.state.aba = abaBtn.dataset.devAba;
        document.querySelectorAll('[data-dev-aba]').forEach((b) => b.classList.remove('btn-inline--active'));
        abaBtn.classList.add('btn-inline--active');
        this.renderConteudo();
      }
    });
  },

  renderConteudo() {
    const c = document.getElementById('devConteudo');
    if (!c) return;
    if (this.state.aba === 'historico') { c.innerHTML = this.renderHistorico(); return; }
    c.innerHTML = this.renderNovaDevolucao();
    this.bindNovaDevEvents();
  },

  // ── NOVA DEVOLUÇÃO ─────────────────────────────────────────────────────────

  renderNovaDevolucao() {
    const venda = this.state.vendaCarregada;

    return `
      <div style="max-width:700px;margin-top:20px">
        <div class="panel-card" style="margin-bottom:20px">
          <div class="panel-card__header">
            <div><h3>Buscar venda</h3><p>Informe o ID da venda para carregar os itens</p></div>
          </div>
          <div class="panel-card__body">
            <div style="display:flex;gap:10px;align-items:flex-end">
              <div class="form-field" style="flex:1;margin:0">
                <label>ID da venda</label>
                <input type="number" id="devVendaId" placeholder="Ex: 42" min="1"
                  value="${venda ? venda.id : ''}" />
              </div>
              <button class="btn btn-light" id="devBuscarVendaBtn">
                <i class="fa-solid fa-magnifying-glass"></i> Buscar
              </button>
            </div>
            <div class="module-feedback" id="devBuscaFeedback" style="margin-top:10px"></div>
          </div>
        </div>

        ${venda ? this.renderFormDevolucao(venda) : ''}
      </div>
    `;
  },

  renderFormDevolucao(venda) {
    const itens = this.state.itensVenda;

    const linhas = itens.map((item, idx) => {
      const variacao = item.atributo1
        ? (item.atributo2 ? `${item.atributo1} / ${item.atributo2}` : item.atributo1)
        : '';
      return `
        <tr>
          <td>
            <strong>${this.esc(item.produto_nome || '-')}</strong>
            ${variacao ? `<small style="display:block;color:var(--text-muted)">${this.esc(variacao)}</small>` : ''}
          </td>
          <td class="text-right">${Number(item.quantidade || 0)}</td>
          <td class="text-right">${this.fmtCur(item.preco_unitario)}</td>
          <td class="text-right">${this.fmtCur(item.total)}</td>
          <td>
            <input type="number" class="dev-qtd-input"
              data-idx="${idx}"
              min="0" max="${Number(item.quantidade)}" step="1" value="0"
              style="width:70px;padding:5px 8px;border:1px solid var(--border);border-radius:8px;font-size:13px;text-align:center"
            />
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="panel-card">
        <div class="panel-card__header">
          <div>
            <h3>Venda #${venda.id} — ${this.esc(venda.cliente_nome || 'Consumidor Final')}</h3>
            <p>Informe a quantidade a devolver por item (0 = não devolver)</p>
          </div>
        </div>
        <div class="panel-card__body">
          <div class="table-wrapper" style="margin-bottom:16px">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th class="text-right">Qtd Vendida</th>
                  <th class="text-right">Preço</th>
                  <th class="text-right">Total</th>
                  <th>Qtd a devolver</th>
                </tr>
              </thead>
              <tbody>${linhas}</tbody>
            </table>
          </div>

          <div class="form-field" style="margin-bottom:12px">
            <label>Motivo da devolução</label>
            <input type="text" id="devMotivo" placeholder="Ex: Produto com defeito, tamanho errado..." />
          </div>

          <div class="module-feedback module-feedback--info" style="margin-bottom:12px">
            O estoque dos itens devolvidos será restaurado automaticamente.
            Um lançamento financeiro de devolução será gerado.
          </div>

          <button class="btn btn-primary" id="devRegistrarBtn">
            <i class="fa-solid fa-rotate-left"></i> Registrar Devolução
          </button>
          <div class="module-feedback" id="devRegistrarFeedback" style="margin-top:12px"></div>
        </div>
      </div>
    `;
  },

  bindNovaDevEvents() {
    document.getElementById('devBuscarVendaBtn')?.addEventListener('click', async () => {
      const vendaId = Number(document.getElementById('devVendaId')?.value || 0);
      const fb = document.getElementById('devBuscaFeedback');
      const btn = document.getElementById('devBuscarVendaBtn');

      if (!vendaId) { if (fb) { fb.className = 'module-feedback module-feedback--error'; fb.textContent = 'Informe o ID da venda.'; } return; }

      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
      if (fb) { fb.className = 'module-feedback module-feedback--info'; fb.textContent = 'Buscando venda...'; }

      try {
        const result = await api.getVendaDetalheParaDevolucao(vendaId);
        const detalhe = result?.venda || result;

        if (!detalhe) throw new Error('Venda não encontrada');

        this.state.vendaCarregada = detalhe;
        this.state.itensVenda     = detalhe.itens || [];

        if (fb) { fb.className = 'module-feedback module-feedback--success'; fb.textContent = `Venda #${vendaId} carregada — ${(detalhe.itens || []).length} item(s).`; }
        this.renderConteudo();
        this.bindNovaDevEvents();

        // Re-bind após re-render
        document.getElementById('devVendaId').value = vendaId;
      } catch (err) {
        if (fb) { fb.className = 'module-feedback module-feedback--error'; fb.textContent = err.message || 'Venda não encontrada.'; }
        this.state.vendaCarregada = null;
        this.state.itensVenda = [];
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Buscar'; }
      }
    });

    document.getElementById('devRegistrarBtn')?.addEventListener('click', async () => {
      const venda  = this.state.vendaCarregada;
      const itens  = this.state.itensVenda;
      const motivo = document.getElementById('devMotivo')?.value?.trim() || '';
      const btn    = document.getElementById('devRegistrarBtn');
      const fb     = document.getElementById('devRegistrarFeedback');

      const itensParaDevolver = [];
      document.querySelectorAll('.dev-qtd-input').forEach((input) => {
        const idx = Number(input.dataset.idx);
        const qtd = Number(input.value || 0);
        if (qtd > 0 && itens[idx]) {
          itensParaDevolver.push({
            produto_id: itens[idx].produto_id,
            grade_id:   itens[idx].grade_id || null,
            quantidade: qtd
          });
        }
      });

      if (itensParaDevolver.length === 0) {
        if (fb) { fb.className = 'module-feedback module-feedback--error'; fb.textContent = 'Informe a quantidade a devolver de ao menos um item.'; }
        return;
      }

      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...'; }

      try {
        const result = await api.registrarDevolucao({
          venda_id: venda.id,
          motivo,
          itens: itensParaDevolver
        });

        showToast(result?.mensagem || 'Devolução registrada com sucesso!', 'success');
        this.state.vendaCarregada = null;
        this.state.itensVenda = [];
        await this.loadHistorico();
        this.renderConteudo();
      } catch (err) {
        if (fb) { fb.className = 'module-feedback module-feedback--error'; fb.textContent = err.message || 'Erro ao registrar devolução.'; }
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Registrar Devolução'; }
      }
    });
  },

  // ── HISTÓRICO ─────────────────────────────────────────────────────────────

  renderHistorico() {
    const devs = this.state.devolucoes;

    const totDev = devs.reduce((s, d) => s + Number(d.total_devolvido || 0), 0);

    if (!devs.length) {
      return `<div class="module-feedback module-feedback--info" style="margin-top:16px">Nenhuma devolução registrada ainda.</div>`;
    }

    const linhas = devs.map((d) => {
      const data = d.criado_em ? new Date(d.criado_em).toLocaleDateString('pt-BR') : '-';
      return `
        <tr>
          <td><strong>#${d.numero}</strong></td>
          <td>${d.venda_id ? `Venda #${d.venda_id}` : '-'}</td>
          <td>${this.esc(d.cliente_nome || 'Consumidor Final')}</td>
          <td>${Number(d.total_itens || 0)}</td>
          <td class="text-right"><strong>${this.fmtCur(d.total_devolvido)}</strong></td>
          <td>${this.esc(d.motivo || '—')}</td>
          <td><span class="badge badge--info">${d.status || 'processada'}</span></td>
          <td>${data}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="module-toolbar" style="margin-top:8px;margin-bottom:12px">
        <div class="module-toolbar__stats">
          <div class="mini-stat"><span>Devoluções</span><strong>${devs.length}</strong></div>
          <div class="mini-stat"><span>Total devolvido</span><strong>${this.fmtCur(totDev)}</strong></div>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Venda</th>
              <th>Cliente</th>
              <th>Itens</th>
              <th class="text-right">Total</th>
              <th>Motivo</th>
              <th>Status</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
    `;
  },

  // ── HELPERS ───────────────────────────────────────────────────────────────

  setFeedback(msg, type = 'info') {
    const el = document.getElementById('devFeedback');
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

export async function initDevolucoesModule() {
  DevolucoesModule.init();
  await DevolucoesModule.loadHistorico();
}

export default DevolucoesModule;
