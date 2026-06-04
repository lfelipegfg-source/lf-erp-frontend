import { getAuth } from './auth.js';
import { showToast } from './feedback.js';

const API_BASE = window.LF_ERP_API_URL || localStorage.getItem('lf_erp_api_url') || 'https://lf-erp-backend.onrender.com';

function getToken() {
  try {
    const raw = localStorage.getItem('lf_erp_auth') || sessionStorage.getItem('lf_erp_auth');
    const auth = raw ? JSON.parse(raw) : null;
    return auth?.authToken || auth?.token || null;
  } catch { return null; }
}

async function downloadArquivo(endpoint, params, nomeArquivo) {
  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.append(k, v); });

  const token = getToken();
  const resp = await fetch(url.toString(), {
    headers: { Authorization: token ? `Bearer ${token}` : '' }
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.erro || `Erro ${resp.status}`);
  }

  const blob = await resp.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function mesAnoParaRange(mesAno) {
  if (!mesAno) return { inicio: '', fim: '' };
  const [ano, mes] = mesAno.split('-');
  const ultimo = new Date(Number(ano), Number(mes), 0).getDate();
  return { inicio: `${ano}-${mes}-01`, fim: `${ano}-${mes}-${String(ultimo).padStart(2,'0')}` };
}

function sufixo(mesAno) {
  if (!mesAno) return '';
  return mesAno.replace('-', '');
}

const ExportacaoModule = {
  state: { initialized: false },

  init() {
    if (!this.state.initialized) {
      this.injectStyles();
      this.render();
      this.bindEvents();
      this.state.initialized = true;
    }
    // Preenche mês atual
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2,'0')}`;
    const el = document.getElementById('expMesAno');
    if (el && !el.value) el.value = mesAtual;
  },

  render() {
    const c = document.getElementById('exportacaoContabilContainer');
    if (!c) return;

    const EXPORTS = [
      {
        id: 'vendas',
        icon: 'fa-cart-shopping',
        titulo: 'Vendas',
        desc: 'Todas as vendas do período com totais, cliente e forma de pagamento.',
        endpoint: '/exportacao/vendas',
        ext: 'csv'
      },
      {
        id: 'compras',
        icon: 'fa-truck',
        titulo: 'Compras',
        desc: 'Entradas de estoque (compras de fornecedores) com totais e status.',
        endpoint: '/exportacao/compras',
        ext: 'csv'
      },
      {
        id: 'contas-receber',
        icon: 'fa-arrow-trend-up',
        titulo: 'Contas a Receber',
        desc: 'Títulos de recebimento: vencimento, cliente, valor, status e pagamentos.',
        endpoint: '/exportacao/contas-receber',
        ext: 'csv'
      },
      {
        id: 'contas-pagar',
        icon: 'fa-arrow-trend-down',
        titulo: 'Contas a Pagar',
        desc: 'Títulos de pagamento: vencimento, fornecedor, valor, status e pagamentos.',
        endpoint: '/exportacao/contas-pagar',
        ext: 'csv'
      },
      {
        id: 'lancamentos',
        icon: 'fa-list-check',
        titulo: 'Lançamentos Financeiros',
        desc: 'Receitas e despesas avulsas registradas no período.',
        endpoint: '/exportacao/lancamentos',
        ext: 'csv'
      },
      {
        id: 'dre',
        icon: 'fa-chart-bar',
        titulo: 'DRE Simplificada',
        desc: 'Demonstração do resultado: receita bruta, CMV, despesas e lucro operacional.',
        endpoint: '/exportacao/dre',
        ext: 'csv'
      },
      {
        id: 'efd',
        icon: 'fa-file-code',
        titulo: 'EFD / SPED (rascunho)',
        desc: 'Arquivo TXT no leiaute EFD com participantes e NF-e emitidas. Rascunho para entrega ao contador.',
        endpoint: '/exportacao/efd',
        ext: 'txt',
        destaque: true
      }
    ];

    c.innerHTML = `
      <!-- Cabeçalho período -->
      <div class="exp-periodo-bar">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <label style="font-size:13px;font-weight:600;color:var(--text-muted);">Período:</label>
          <input id="expMesAno" type="month" class="filter-input" style="width:160px;">
          <span style="font-size:12px;color:var(--text-muted);">ou intervalo personalizado:</span>
          <input id="expInicio" type="date" class="filter-input" style="width:150px;" placeholder="Início">
          <input id="expFim"    type="date" class="filter-input" style="width:150px;" placeholder="Fim">
        </div>
        <button class="btn btn-primary btn-sm" id="expBaixarTudoBtn">
          <i class="fa fa-download"></i> Baixar todos (exceto EFD)
        </button>
      </div>

      <!-- Grid de exportações -->
      <div class="exp-grid">
        ${EXPORTS.map((e) => `
          <div class="exp-card ${e.destaque ? 'exp-card--destaque' : ''}">
            <div class="exp-card-icon"><i class="fa ${e.icon}"></i></div>
            <div class="exp-card-body">
              <div class="exp-card-title">${e.titulo} <span class="exp-ext">.${e.ext}</span></div>
              <div class="exp-card-desc">${e.desc}</div>
            </div>
            <button class="btn btn-secondary btn-sm exp-dl-btn" data-endpoint="${e.endpoint}" data-ext="${e.ext}" data-id="${e.id}">
              <i class="fa fa-download"></i> Baixar
            </button>
          </div>
        `).join('')}
      </div>

      <!-- Nota de rodapé -->
      <div class="exp-nota">
        <i class="fa fa-circle-info"></i>
        Os arquivos CSV são compatíveis com Excel, Google Sheets e sistemas contábeis. Separador: ponto e vírgula (;). Codificação: UTF-8.
        O arquivo EFD é um rascunho estruturado no padrão SPED — deve ser revisado e complementado pelo contador antes de envio à SEFAZ.
      </div>
    `;
  },

  bindEvents() {
    document.getElementById('exportacaoContabilContainer')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-endpoint]');
      if (!btn) return;
      await this.baixar(btn.dataset.endpoint, btn.dataset.ext, btn.dataset.id, btn);
    });

    document.getElementById('expBaixarTudoBtn')?.addEventListener('click', async () => {
      const endpoints = [
        { endpoint: '/exportacao/vendas',         ext: 'csv', id: 'vendas' },
        { endpoint: '/exportacao/compras',         ext: 'csv', id: 'compras' },
        { endpoint: '/exportacao/contas-receber',  ext: 'csv', id: 'contas-receber' },
        { endpoint: '/exportacao/contas-pagar',    ext: 'csv', id: 'contas-pagar' },
        { endpoint: '/exportacao/lancamentos',     ext: 'csv', id: 'lancamentos' },
        { endpoint: '/exportacao/dre',             ext: 'csv', id: 'dre' }
      ];
      const btn = document.getElementById('expBaixarTudoBtn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Gerando...';
      let erros = 0;
      for (const item of endpoints) {
        try { await this.baixar(item.endpoint, item.ext, item.id, null); }
        catch { erros++; }
        await new Promise((r) => setTimeout(r, 400));
      }
      btn.disabled = false;
      btn.innerHTML = '<i class="fa fa-download"></i> Baixar todos (exceto EFD)';
      if (erros === 0) showToast('Todos os arquivos gerados!', 'success');
      else showToast(`${erros} arquivo(s) com erro. Verifique o período.`, 'error');
    });
  },

  getPeriodo() {
    const mesAno  = document.getElementById('expMesAno')?.value;
    const inicio  = document.getElementById('expInicio')?.value;
    const fim     = document.getElementById('expFim')?.value;

    if (inicio && fim) return { inicio, fim };
    if (mesAno) return mesAnoParaRange(mesAno);
    return { inicio: '', fim: '' };
  },

  async baixar(endpoint, ext, id, btn) {
    const { inicio, fim } = this.getPeriodo();
    if (!inicio) { showToast('Selecione um período antes de baixar', 'error'); return; }

    const mesAno = document.getElementById('expMesAno')?.value;
    const suf    = mesAno ? sufixo(mesAno) : inicio.replace(/-/g, '').substring(0, 6);
    const nome   = `${id.replace('-', '_')}_${suf}.${ext}`;

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>'; }
    try {
      await downloadArquivo(endpoint, { inicio, fim }, nome);
    } catch (err) {
      showToast(`Erro ao gerar ${id}: ${err.message}`, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-download"></i> Baixar'; }
    }
  },

  injectStyles() {
    if (document.getElementById('exp-styles')) return;
    const s = document.createElement('style');
    s.id = 'exp-styles';
    s.textContent = `
      .exp-periodo-bar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px 20px; margin-bottom:20px; }
      .exp-grid { display:flex; flex-direction:column; gap:10px; }
      .exp-card { display:flex; align-items:center; gap:16px; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px 20px; transition:.15s; }
      .exp-card:hover { border-color:var(--primary); }
      .exp-card--destaque { border-color:#8b5cf6; background:linear-gradient(135deg,var(--surface) 80%,#8b5cf610); }
      .exp-card-icon { width:40px; height:40px; border-radius:10px; background:var(--surface-2); display:flex; align-items:center; justify-content:center; font-size:18px; color:var(--primary); flex-shrink:0; }
      .exp-card--destaque .exp-card-icon { color:#8b5cf6; }
      .exp-card-body { flex:1; }
      .exp-card-title { font-size:14px; font-weight:600; display:flex; align-items:center; gap:6px; }
      .exp-card-desc { font-size:12px; color:var(--text-muted); margin-top:3px; }
      .exp-ext { font-size:11px; font-weight:600; background:var(--surface-3); color:var(--text-muted); padding:2px 6px; border-radius:4px; }
      .exp-nota { margin-top:20px; padding:14px 16px; background:var(--surface-2); border-radius:10px; font-size:12px; color:var(--text-muted); line-height:1.6; display:flex; gap:8px; align-items:flex-start; }
      .exp-nota i { margin-top:2px; flex-shrink:0; }
    `;
    document.head.appendChild(s);
  }
};

export async function initExportacaoContabilModule() {
  return ExportacaoModule.init();
}

export default ExportacaoModule;
