/**
 * exportUtils — LF ERP
 * Exportação CSV com UTF-8 BOM para compatibilidade com Excel em português.
 *
 * Uso:
 *   import { exportCSV } from './exportUtils.js';
 *   exportCSV(linhas, 'relatorio_vendas');
 *
 * @param {Object[]} linhas  — array de objetos planos; keys viram cabeçalhos
 * @param {string}   arquivo — nome sem extensão (padrão: 'exportacao')
 */
export function exportCSV(linhas, arquivo = 'exportacao') {
  if (!Array.isArray(linhas) || linhas.length === 0) return;

  const cabecalhos = Object.keys(linhas[0]);

  const linhasCSV = linhas.map((row) =>
    cabecalhos
      .map((k) => {
        const v = String(row[k] ?? '');
        return v.includes(';') || v.includes('\n') || v.includes('"')
          ? `"${v.replace(/"/g, '""')}"`
          : v;
      })
      .join(';')
  );

  // UTF-8 BOM (﻿) garante que Excel abra o arquivo em português corretamente
  const csv = '﻿' + [cabecalhos.join(';'), ...linhasCSV].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${arquivo}_${hojeFormatado()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Formata número para o padrão BR sem símbolo (útil em células numéricas do Excel) */
export function numCSV(v) {
  return Number(v || 0).toFixed(2).replace('.', ',');
}

function hojeFormatado() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
