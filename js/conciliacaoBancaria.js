import api from './api.js';
import { showToast, confirmarAcao } from './feedback.js';
import { escapeHtml, buildFriendlyError } from './utils.js';

const state = {
  sessoes:   [],
  sessaoId:  null,   // sessão aberta
  itens:     [],
  filtroStatus: '',  // '' | 'pendente' | 'conciliado' | 'ignorado'
  loading:   false
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const esc = escapeHtml;

function toCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(d) {
  if (!d) return '-';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}


function showMsg(msg, type = 'info') {
  const el = document.getElementById('cbFeedback');
  if (el) {
    el.className = `module-feedback${type === 'error' ? ' module-feedback--error' : type === 'success' ? ' module-feedback--success' : ' module-feedback--info'}`;
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
  }
  showToast(msg, type);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function initConciliacaoModule() {
  try {
    renderSkeleton();
    await carregarSessoes();
    renderLista();
  } catch (error) {
    console.error('Erro ao iniciar conciliação bancária:', error);
    renderErro(buildFriendlyError(error));
  }
}

async function carregarSessoes() {
  const data = await api.getConciliacoes();
  state.sessoes = Array.isArray(data) ? data : [];
}

async function carregarItens() {
  const params = state.filtroStatus ? { status: state.filtroStatus } : {};
  const data = await api.getConciliacaoItens(state.sessaoId, params);
  state.itens = Array.isArray(data) ? data : [];
}

// ─── Tela: lista de sessões ────────────────────────────────────────────────────

function renderSkeleton() {
  const c = container();
  if (c) c.innerHTML = `<div class="module-card"><div class="module-feedback module-feedback--info">Carregando conciliações...</div></div>`;
}

function renderErro(msg) {
  const c = container();
  if (c) c.innerHTML = `<div class="module-card"><div class="module-feedback module-feedback--error">${esc(msg)}</div></div>`;
}

function container() { return document.getElementById('conciliacaoContainer'); }

function renderLista() {
  state.sessaoId = null;
  const c = container();
  if (!c) return;

  c.innerHTML = `
    <div class="module-card">
      <div id="cbFeedback" class="module-feedback hidden"></div>

      <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px">
        <button class="btn btn-light" id="cbBtnAtualizar" type="button">
          <i class="fa-solid fa-rotate"></i> Atualizar
        </button>
        <button class="btn btn-primary" id="cbBtnNova" type="button">
          <i class="fa-solid fa-upload"></i> Importar Extrato
        </button>
      </div>

      <div class="cb-info-card">
        <i class="fa-solid fa-circle-info"></i>
        <div>
          <strong>Como funciona</strong>
          <p>Exporte o extrato bancário em formato OFX ou CSV, importe aqui e use as ações para criar lançamentos financeiros ou ignorar movimentos já registrados.</p>
        </div>
      </div>

      ${state.sessoes.length
        ? `<div class="cb-sessoes-lista">${state.sessoes.map(renderCardSessao).join('')}</div>`
        : `<div class="empty-state cb-empty">
            <i class="fa-solid fa-bank"></i>
            <p>Nenhum extrato importado ainda.</p>
            <p style="font-size:.85rem;color:var(--text-muted)">Clique em "Importar Extrato" para começar.</p>
          </div>`
      }
    </div>

    ${renderModalImport()}
  `;

  bindLista();
}

function renderCardSessao(s) {
  const pendentes   = Number(s.pendentes   || 0);
  const conciliados = Number(s.itens_conciliados || 0);
  const ignorados   = Number(s.itens_ignorados   || 0);
  const total       = Number(s.total_itens       || 0);
  const pct = total > 0 ? Math.round(((conciliados + ignorados) / total) * 100) : 0;

  return `
    <div class="cb-sessao-card" data-id="${s.id}">
      <div class="cb-sessao-card__left">
        <div class="cb-sessao-card__icon">
          <i class="fa-solid fa-${s.tipo === 'ofx' ? 'building-columns' : 'file-csv'}"></i>
        </div>
        <div>
          <strong class="cb-sessao-card__nome">${esc(s.nome)}</strong>
          <span class="cb-sessao-card__meta">
            ${formatDate(s.data_inicio)} – ${formatDate(s.data_fim)}
            &nbsp;·&nbsp; ${total} transações
          </span>
        </div>
      </div>
      <div class="cb-sessao-card__right">
        <div class="cb-progresso">
          <div class="cb-progresso__bar" style="width:${pct}%"></div>
        </div>
        <div class="cb-sessao-card__badges">
          ${pendentes   > 0 ? `<span class="badge badge--warning">${pendentes} pendentes</span>`   : ''}
          ${conciliados > 0 ? `<span class="badge badge--success">${conciliados} conciliados</span>` : ''}
          ${ignorados   > 0 ? `<span class="badge">${ignorados} ignorados</span>` : ''}
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-primary" style="padding:5px 12px;font-size:12px" data-action="abrir" data-id="${s.id}">
            <i class="fa-solid fa-eye"></i> Abrir
          </button>
          <button class="btn btn-light" style="padding:5px 10px;font-size:12px;color:var(--danger)" data-action="excluir" data-id="${s.id}" title="Excluir sessão">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>`;
}

function renderModalImport() {
  return `
    <div class="modal-overlay hidden" id="cbModalImport">
      <div class="modal-card" style="max-width:480px;width:100%">
        <div class="modal-card__header">
          <h3>Importar Extrato Bancário</h3>
          <button class="modal-close" id="cbBtnFecharImport" type="button">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="cbFormImport" class="form-grid" autocomplete="off">
          <div class="form-field">
            <label>Formato do arquivo <span style="color:var(--danger)">*</span></label>
            <select id="cbTipo" class="input" required>
              <option value="ofx">OFX — Bradesco, Itaú, Santander, Nubank...</option>
              <option value="csv">CSV — genérico (data; descrição; valor)</option>
            </select>
          </div>

          <div class="form-field">
            <label>Conta bancária (opcional)</label>
            <input id="cbConta" class="input" placeholder="Ex: Conta corrente Bradesco"/>
          </div>

          <div class="form-field form-field--span-2">
            <label>Arquivo <span style="color:var(--danger)">*</span></label>
            <div class="cb-drop-area" id="cbDropArea">
              <i class="fa-solid fa-cloud-arrow-up"></i>
              <p>Clique ou arraste o arquivo aqui</p>
              <small id="cbArquivoNome">Nenhum arquivo selecionado</small>
              <input type="file" id="cbArquivoInput" accept=".ofx,.csv,.txt" style="display:none"/>
            </div>
          </div>

          <div id="cbImportFeedback" class="form-field form-field--span-2 hidden">
            <div class="module-feedback module-feedback--info" id="cbImportMsg"></div>
          </div>

          <div class="form-field form-field--span-2" style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
            <button type="button" class="btn btn-light" id="cbBtnCancelarImport">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="cbBtnImportar">
              <i class="fa-solid fa-upload"></i> Importar
            </button>
          </div>
        </form>
      </div>
    </div>`;
}

function bindLista() {
  document.getElementById('cbBtnNova').onclick      = () => document.getElementById('cbModalImport').classList.remove('hidden');
  document.getElementById('cbBtnFecharImport').onclick = fecharModalImport;
  document.getElementById('cbBtnCancelarImport').onclick = fecharModalImport;
  document.getElementById('cbModalImport').onclick  = (e) => { if (e.target.id === 'cbModalImport') fecharModalImport(); };

  document.getElementById('cbBtnAtualizar').onclick = async () => {
    try { await carregarSessoes(); renderLista(); } catch (e) { showMsg(buildFriendlyError(e), 'error'); }
  };

  // Drag & drop + click no drop area
  const dropArea = document.getElementById('cbDropArea');
  const fileInput = document.getElementById('cbArquivoInput');
  dropArea.onclick = () => fileInput.click();
  dropArea.ondragover = (e) => { e.preventDefault(); dropArea.classList.add('cb-drop-area--over'); };
  dropArea.ondragleave = () => dropArea.classList.remove('cb-drop-area--over');
  dropArea.ondrop = (e) => {
    e.preventDefault();
    dropArea.classList.remove('cb-drop-area--over');
    const f = e.dataTransfer.files[0];
    if (f) { fileInput.files = e.dataTransfer.files; mostrarNomeArquivo(f.name); }
  };
  fileInput.onchange = () => {
    if (fileInput.files[0]) mostrarNomeArquivo(fileInput.files[0].name);
  };

  // Submit importar
  document.getElementById('cbFormImport').onsubmit = importar;

  // Ações nas sessões
  document.querySelectorAll('[data-action="abrir"]').forEach(btn => {
    btn.onclick = () => abrirSessao(Number(btn.dataset.id));
  });
  document.querySelectorAll('[data-action="excluir"]').forEach(btn => {
    btn.onclick = () => excluirSessao(Number(btn.dataset.id));
  });
}

function mostrarNomeArquivo(nome) {
  const el = document.getElementById('cbArquivoNome');
  if (el) el.textContent = nome;
}

function fecharModalImport() {
  document.getElementById('cbModalImport').classList.add('hidden');
  document.getElementById('cbFormImport').reset();
  mostrarNomeArquivo('Nenhum arquivo selecionado');
}

// ─── Importar arquivo ─────────────────────────────────────────────────────────

async function importar(e) {
  e.preventDefault();
  const btn  = document.getElementById('cbBtnImportar');
  const tipo = document.getElementById('cbTipo').value;
  const conta = document.getElementById('cbConta').value.trim();
  const file = document.getElementById('cbArquivoInput').files[0];

  if (!file) { showMsg('Selecione um arquivo para importar.', 'error'); return; }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importando...';

  const setImportMsg = (msg, tipo = 'info') => {
    const fb = document.getElementById('cbImportFeedback');
    const msgEl = document.getElementById('cbImportMsg');
    if (fb && msgEl) {
      fb.classList.remove('hidden');
      msgEl.className = `module-feedback module-feedback--${tipo}`;
      msgEl.textContent = msg;
    }
  };

  try {
    setImportMsg('Lendo arquivo...');
    const conteudo = await lerArquivo(file);
    setImportMsg('Processando transações...');

    const result = await api.importarConciliacao({
      conteudo, tipo, nome: file.name, conta
    });

    fecharModalImport();
    showMsg(`${result.total} transações importadas com sucesso.`, 'success');
    await carregarSessoes();
    renderLista();
    if (result.conciliacao_id) abrirSessao(result.conciliacao_id);
  } catch (error) {
    console.error('Erro ao importar:', error);
    setImportMsg(buildFriendlyError(error), 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-upload"></i> Importar';
  }
}

function lerArquivo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
    reader.readAsText(file, 'latin1');
  });
}

// ─── Tela: detalhe da sessão ──────────────────────────────────────────────────

async function abrirSessao(id) {
  state.sessaoId    = id;
  state.filtroStatus = '';
  try {
    renderDetalheLoading();
    await carregarItens();
    renderDetalhe();
  } catch (error) {
    console.error('Erro ao abrir sessão:', error);
    showMsg(buildFriendlyError(error), 'error');
  }
}

function renderDetalheLoading() {
  const c = container();
  if (c) c.innerHTML = `<div class="module-card"><div class="module-feedback module-feedback--info">Carregando transações...</div></div>`;
}

function renderDetalhe() {
  const c = container();
  if (!c) return;

  const sessao   = state.sessoes.find(s => s.id === state.sessaoId) || {};
  const total    = Number(sessao.total_itens || state.itens.length);
  const conc     = Number(sessao.itens_conciliados || 0);
  const ign      = Number(sessao.itens_ignorados   || 0);
  const pend     = total - conc - ign;
  const creditos = state.itens.filter(i => i.tipo === 'credito').reduce((a, i) => a + Number(i.valor), 0);
  const debitos  = state.itens.filter(i => i.tipo === 'debito').reduce((a, i)  => a + Number(i.valor), 0);

  c.innerHTML = `
    <div class="module-card">
      <div id="cbFeedback" class="module-feedback hidden"></div>

      <div class="module-card__header">
        <div>
          <button class="btn btn-light" id="cbBtnVoltar" style="margin-bottom:6px">
            <i class="fa-solid fa-arrow-left"></i> Voltar
          </button>
          <h3>${esc(sessao.nome || 'Extrato')}</h3>
          <p>${formatDate(sessao.data_inicio)} – ${formatDate(sessao.data_fim)}
            &nbsp;·&nbsp; ${esc(sessao.conta || '')}</p>
        </div>
      </div>

      <!-- Stats -->
      <div class="cb-stats-grid">
        <article class="mini-stat cb-stat--credito">
          <span>Créditos</span>
          <strong>${toCurrency(creditos)}</strong>
          <small>${state.itens.filter(i => i.tipo === 'credito').length} transações</small>
        </article>
        <article class="mini-stat cb-stat--debito">
          <span>Débitos</span>
          <strong>${toCurrency(debitos)}</strong>
          <small>${state.itens.filter(i => i.tipo === 'debito').length} transações</small>
        </article>
        <article class="mini-stat cb-stat--pendente">
          <span>Pendentes</span>
          <strong>${pend}</strong>
          <small>aguardando ação</small>
        </article>
        <article class="mini-stat cb-stat--ok">
          <span>Conciliados</span>
          <strong>${conc + ign}</strong>
          <small>${conc} lançados · ${ign} ignorados</small>
        </article>
      </div>

      <!-- Filtro de status -->
      <div class="cb-filtro-status">
        ${['', 'pendente', 'conciliado', 'ignorado'].map(s => `
          <button class="cb-filtro-btn ${state.filtroStatus === s ? 'cb-filtro-btn--ativo' : ''}" data-status="${s}">
            ${s === '' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>`).join('')}
      </div>

      <!-- Tabela -->
      ${renderTabelaItens()}

    </div>

    ${renderModalLancamento()}
  `;

  bindDetalhe();
}

function renderTabelaItens() {
  if (!state.itens.length) {
    return `<div class="empty-state cb-empty">
      <i class="fa-solid fa-check-double"></i>
      <p>Nenhuma transação encontrada com este filtro.</p>
    </div>`;
  }

  return `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th>Tipo</th>
            <th class="text-right">Valor</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${state.itens.map(renderLinhaItem).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderLinhaItem(item) {
  const isCredito = item.tipo === 'credito';
  const isPend    = item.status === 'pendente';

  const badgeStatus = item.status === 'conciliado'
    ? '<span class="badge badge--success">Conciliado</span>'
    : item.status === 'ignorado'
      ? '<span class="badge">Ignorado</span>'
      : '<span class="badge badge--warning">Pendente</span>';

  const acoes = isPend ? `
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn btn-light" style="padding:4px 10px;font-size:12px;color:var(--success)"
        data-action="lancar" data-id="${item.id}" title="Criar lançamento financeiro">
        <i class="fa-solid fa-plus"></i> Lançar
      </button>
      <button class="btn btn-light" style="padding:4px 10px;font-size:12px;color:var(--text-muted)"
        data-action="ignorar" data-id="${item.id}" title="Ignorar transação">
        <i class="fa-solid fa-ban"></i>
      </button>
    </div>` : (item.lancamento_id
      ? `<span style="font-size:11px;color:var(--text-muted)">Lançamento #${item.lancamento_id}</span>`
      : '');

  return `
    <tr>
      <td style="white-space:nowrap">${formatDate(item.data)}</td>
      <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(item.descricao)}">${esc(item.descricao)}</td>
      <td><span class="badge ${isCredito ? 'badge--success' : 'badge--danger'}">${isCredito ? 'Crédito' : 'Débito'}</span></td>
      <td class="text-right" style="color:${isCredito ? 'var(--success)' : 'var(--danger)'}">
        <strong>${toCurrency(item.valor)}</strong>
      </td>
      <td>${badgeStatus}</td>
      <td>${acoes}</td>
    </tr>`;
}

function renderModalLancamento() {
  return `
    <div class="modal-overlay hidden" id="cbModalLanc">
      <div class="modal-card" style="max-width:420px;width:100%">
        <div class="modal-card__header">
          <h3>Criar Lançamento Financeiro</h3>
          <button class="modal-close" id="cbBtnFecharLanc" type="button">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <form id="cbFormLanc" class="form-grid" autocomplete="off">
          <div class="form-field form-field--span-2">
            <label>Categoria <span style="color:var(--danger)">*</span></label>
            <input id="cbLancCategoria" class="input" placeholder="Ex: Receita bancária, Despesa operacional..." required/>
          </div>
          <div class="form-field form-field--span-2">
            <label>Observação</label>
            <input id="cbLancObs" class="input" placeholder="Opcional..."/>
          </div>
          <input type="hidden" id="cbLancItemId"/>
          <div class="form-field form-field--span-2" style="display:flex;gap:10px;justify-content:flex-end">
            <button type="button" class="btn btn-light" id="cbBtnCancelarLanc">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="cbBtnSalvarLanc">
              <i class="fa-solid fa-floppy-disk"></i> Criar lançamento
            </button>
          </div>
        </form>
      </div>
    </div>`;
}

function bindDetalhe() {
  document.getElementById('cbBtnVoltar').onclick = async () => {
    await carregarSessoes();
    renderLista();
  };

  // Filtro de status
  document.querySelectorAll('.cb-filtro-btn').forEach(btn => {
    btn.onclick = async () => {
      state.filtroStatus = btn.dataset.status;
      await carregarItens();
      renderDetalhe();
    };
  });

  // Ações da tabela
  document.querySelectorAll('[data-action="ignorar"]').forEach(btn => {
    btn.onclick = () => ignorarItem(Number(btn.dataset.id));
  });
  document.querySelectorAll('[data-action="lancar"]').forEach(btn => {
    btn.onclick = () => abrirModalLanc(Number(btn.dataset.id));
  });

  // Modal de lançamento
  document.getElementById('cbBtnFecharLanc').onclick = fecharModalLanc;
  document.getElementById('cbBtnCancelarLanc').onclick = fecharModalLanc;
  document.getElementById('cbModalLanc').onclick = (e) => { if (e.target.id === 'cbModalLanc') fecharModalLanc(); };
  document.getElementById('cbFormLanc').onsubmit = salvarLancamento;
}

// ─── Operações ────────────────────────────────────────────────────────────────

async function ignorarItem(id) {
  const ok = await confirmarAcao('Ignorar esta transação? Ela não gerará lançamento.', 'Ignorar', 'warning');
  if (!ok) return;
  try {
    await api.ignorarConciliacaoItem(id);
    showMsg('Transação ignorada.', 'success');
    await carregarItens();
    renderDetalhe();
  } catch (error) {
    console.error('Erro ao ignorar:', error);
    showMsg(buildFriendlyError(error), 'error');
  }
}

function abrirModalLanc(itemId) {
  document.getElementById('cbLancItemId').value = itemId;
  document.getElementById('cbLancCategoria').value = '';
  document.getElementById('cbLancObs').value = '';
  document.getElementById('cbModalLanc').classList.remove('hidden');
  document.getElementById('cbLancCategoria').focus();
}

function fecharModalLanc() {
  document.getElementById('cbModalLanc').classList.add('hidden');
}

async function salvarLancamento(e) {
  e.preventDefault();
  const btn = document.getElementById('cbBtnSalvarLanc');
  const itemId   = Number(document.getElementById('cbLancItemId').value);
  const categoria = document.getElementById('cbLancCategoria').value.trim();
  const observacao = document.getElementById('cbLancObs').value.trim();

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando...';

  try {
    await api.criarLancamentoConciliacao(itemId, { categoria, observacao });
    fecharModalLanc();
    showMsg('Lançamento criado com sucesso.', 'success');
    await carregarItens();
    await carregarSessoes();
    renderDetalhe();
  } catch (error) {
    console.error('Erro ao criar lançamento:', error);
    showMsg(buildFriendlyError(error), 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Criar lançamento';
  }
}

async function excluirSessao(id) {
  const ok = await confirmarAcao('Excluir este extrato e todas as suas transações? Esta ação não pode ser desfeita.', 'Excluir', 'danger');
  if (!ok) return;
  try {
    await api.deleteConciliacao(id);
    showMsg('Extrato excluído.', 'success');
    await carregarSessoes();
    renderLista();
  } catch (error) {
    console.error('Erro ao excluir:', error);
    showMsg(buildFriendlyError(error), 'error');
  }
}
