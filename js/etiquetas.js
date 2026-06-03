/**
 * etiquetas.js — LF ERP
 * Módulo de impressão de etiquetas. Standalone, sem dependências externas de JS.
 * Barcode gerado via fonte CSS "Libre Barcode 39 Text" (Code 39).
 *
 * Recebe dados via localStorage['lf_erp_etiquetas']:
 *   [{ nome, preco, codigo_barras, categoria, empresa_nome, variacao, quantidade }]
 */

(function () {
  const STORAGE_KEY = 'lf_erp_etiquetas';

  // ── Lê dados do localStorage ─────────────────────────────────────────────
  function lerItens() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) || [];
    } catch {
      return [];
    }
  }

  function limparStorage() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ── Formata preço ────────────────────────────────────────────────────────
  function fmtPreco(v) {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // ── Gera HTML de uma etiqueta ────────────────────────────────────────────
  function renderEtiqueta(item, mostrarBarcode) {
    const temBarcode = mostrarBarcode && item.codigo_barras && String(item.codigo_barras).trim();
    // Code 39: envolver em * (start/stop character)
    const barcodeText = temBarcode ? `*${item.codigo_barras.trim().toUpperCase()}*` : '';

    return `
      <div class="etiqueta${temBarcode ? '' : ' etiqueta--sem-barcode'}">
        <div class="etiqueta__empresa">${esc(item.empresa_nome || 'LF ERP')}</div>
        <div class="etiqueta__nome">${esc(item.nome || 'Produto')}</div>
        ${item.variacao ? `<div class="etiqueta__variacao">${esc(item.variacao)}</div>` : ''}
        <div class="etiqueta__preco">${fmtPreco(item.preco)}</div>
        ${temBarcode ? `<div class="etiqueta__barcode">${esc(barcodeText)}</div>` : ''}
      </div>
    `;
  }

  // ── Renderiza grade de etiquetas ─────────────────────────────────────────
  function render() {
    const itens        = lerItens();
    const preview      = document.getElementById('preview');
    const semDados     = document.getElementById('semDados');
    const selColunas   = document.getElementById('selColunas');
    const copias       = document.getElementById('copias');
    const chkBarcode   = document.getElementById('chkBarcode');

    if (!itens.length) {
      if (semDados) semDados.style.display = 'block';
      return;
    }

    if (semDados) semDados.style.display = 'none';

    const colunas      = Number(selColunas?.value || 3);
    const copiasExtra  = Number(copias?.value || 0);
    const mostrarBC    = chkBarcode?.checked ?? true;

    // Expande itens com quantidade + cópias extras
    const expandido = itens.flatMap((item) => {
      const qtd = Number(item.quantidade || 1) + copiasExtra;
      return Array.from({ length: qtd }, () => item);
    });

    const html = expandido.map((item) => renderEtiqueta(item, mostrarBC)).join('');

    preview.innerHTML = `
      <div class="label-grid cols-${colunas}">
        ${html}
      </div>
    `;
  }

  // ── Escape HTML ──────────────────────────────────────────────────────────
  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[c]));
  }

  // ── Eventos ──────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    render();

    document.getElementById('btnImprimir')?.addEventListener('click', () => {
      window.print();
    });

    document.getElementById('btnFechar')?.addEventListener('click', () => {
      limparStorage();
      window.close();
    });

    document.getElementById('selColunas')?.addEventListener('change', render);
    document.getElementById('copias')?.addEventListener('input', render);
    document.getElementById('chkBarcode')?.addEventListener('change', render);

    // Não apaga do storage aqui — apaga só ao fechar
  });
})();
