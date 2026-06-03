/**
 * orcamento-pdf.js — LF ERP
 * Renderiza um orçamento em layout profissional para impressão/PDF.
 * Recebe dados via localStorage['lf_erp_orcamento_pdf'].
 */
(function () {
  const STORAGE_KEY = 'lf_erp_orcamento_pdf';

  function lerOrcamento() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch { return null; }
  }

  function fmtCur(v) {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function fmtDate(v) {
    if (!v) return '—';
    const s = String(v).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [a, m, d] = s.split('-');
      return `${d}/${m}/${a}`;
    }
    return new Date(v).toLocaleDateString('pt-BR');
  }

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[c]));
  }

  function render(orc) {
    const itens = Array.isArray(orc.itens) ? orc.itens : [];
    const numero = String(orc.numero || orc.id || '').padStart(4, '0');
    const titulo = `Orçamento Nº ${numero}`;

    document.title = `${titulo} — ${esc(orc.empresa || 'LF ERP')}`;
    document.getElementById('toolbarTitle').textContent = titulo;

    const linhasItens = itens.map((item, idx) => {
      const variacao = item.atributo1
        ? ` <small>${esc(item.atributo2 ? `${item.atributo1} / ${item.atributo2}` : item.atributo1)}</small>`
        : '';
      return `
        <tr>
          <td style="width:36px;color:var(--muted)">${idx + 1}</td>
          <td>
            <strong>${esc(item.produto_nome || 'Produto')}</strong>
            ${variacao}
          </td>
          <td class="right">${Number(item.quantidade || 0).toFixed(Number(item.quantidade) % 1 !== 0 ? 3 : 0)}</td>
          <td class="right">${fmtCur(item.preco_unitario)}</td>
          ${Number(item.desconto_item || 0) > 0
            ? `<td class="right" style="color:var(--muted)">-${fmtCur(item.desconto_item)}</td>`
            : '<td></td>'}
          <td class="right"><strong>${fmtCur(item.total)}</strong></td>
        </tr>
      `;
    }).join('');

    const doc = document.getElementById('documento');
    doc.innerHTML = `
      <!-- Cabeçalho -->
      <div class="doc-header">
        <div class="doc-empresa">
          <h1>${esc(orc.empresa || 'LF ERP')}</h1>
          <p>Sistema de Gestão Empresarial</p>
        </div>
        <div class="doc-titulo">
          <h2>ORÇAMENTO</h2>
          <div class="num">Nº ${numero}</div>
        </div>
      </div>

      <!-- Metadados -->
      <div class="doc-meta">
        <div class="doc-meta__item">
          <label>Data de emissão</label>
          <span>${fmtDate(orc.criado_em || new Date())}</span>
        </div>
        <div class="doc-meta__item">
          <label>Validade</label>
          <span>${orc.validade ? fmtDate(orc.validade) : '—'}</span>
        </div>
        <div class="doc-meta__item">
          <label>Status</label>
          <span style="text-transform:capitalize">${esc(orc.status || 'rascunho')}</span>
        </div>
      </div>

      <!-- Cliente -->
      <div class="doc-section">
        <h3>Destinatário</h3>
        <p>${orc.cliente_nome ? esc(orc.cliente_nome) : '<span style="color:var(--muted)">Consumidor Final</span>'}</p>
      </div>

      <!-- Itens -->
      <div class="doc-section">
        <h3>Itens do orçamento</h3>
        <table class="doc-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Produto</th>
              <th class="right">Qtd</th>
              <th class="right">Preço unit.</th>
              <th class="right">Desconto</th>
              <th class="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${linhasItens.length ? linhasItens : `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted)">Nenhum item</td></tr>`}
          </tbody>
        </table>
      </div>

      <!-- Totais -->
      <div style="display:flex;justify-content:flex-end">
        <div class="doc-totais">
          <div class="doc-totais__row">
            <span>Subtotal</span>
            <strong>${fmtCur(orc.subtotal)}</strong>
          </div>
          ${Number(orc.desconto || 0) > 0 ? `
            <div class="doc-totais__row">
              <span>Desconto</span>
              <strong style="color:var(--danger)">-${fmtCur(orc.desconto)}</strong>
            </div>
          ` : ''}
          ${Number(orc.acrescimo || 0) > 0 ? `
            <div class="doc-totais__row">
              <span>Acréscimo</span>
              <strong>+${fmtCur(orc.acrescimo)}</strong>
            </div>
          ` : ''}
          <div class="doc-totais__row doc-totais__row--total">
            <span>TOTAL</span>
            <strong>${fmtCur(orc.total)}</strong>
          </div>
        </div>
      </div>

      <!-- Observação -->
      ${orc.observacao ? `
        <div class="doc-obs">
          <strong>Observações</strong>
          ${esc(orc.observacao)}
        </div>
      ` : ''}

      <!-- Rodapé -->
      <div class="doc-footer">
        ${orc.validade
          ? `<p>Este orçamento é válido até <strong>${fmtDate(orc.validade)}</strong>.</p>`
          : '<p>Orçamento sem prazo de validade definido.</p>'}
        <p style="margin-top:6px">Gerado por LF ERP · ${new Date().toLocaleString('pt-BR')}</p>
      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const orc = lerOrcamento();

    if (!orc) {
      document.getElementById('documento').innerHTML = `
        <div style="text-align:center;padding:60px;color:var(--muted)">
          <p style="font-size:2rem;margin-bottom:12px">⚠️</p>
          <p>Nenhum orçamento para exibir.</p>
          <small>Volte ao módulo de Orçamentos e clique em "PDF".</small>
        </div>
      `;
      return;
    }

    render(orc);

    document.getElementById('btnImprimir').addEventListener('click', () => window.print());
    document.getElementById('btnFechar').addEventListener('click', () => {
      localStorage.removeItem('lf_erp_orcamento_pdf');
      window.close();
    });
  });
})();
