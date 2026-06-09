import api from './api.js';
import dashboard from './dashboard.js';
import { showToast } from './feedback.js';
import { initProdutosModule } from './produtos.js';
import { initClientesModule } from './clientes.js';
import { initPDVModule } from './pdv.js';
import { initVendasModule } from './vendas.js';
import { initContasReceberModule } from './contasReceber.js';
import { initContasPagarModule } from './contasPagar.js';
import { initFluxoCaixaModule } from './fluxoCaixa.js';
import { initLancamentosModule } from './lancamentosFinanceiros.js';
import { initAuditoriaFinanceiraModule } from './auditoriaFinanceira.js';
import { initLixeiraModule } from './lixeira.js';
import { initRelatoriosFinanceirosModule } from './relatoriosFinanceiros.js';
import { initFornecedoresModule } from './fornecedores.js';
import { initComprasModule } from './compras.js';
import { initUsuariosModule } from './usuarios.js';
import { initEstoqueModule } from './estoque.js';
import { initConfigModule } from './configuracoes.js';
import { initNfeModule } from './nfe.js';
import { initOrcamentosModule } from './orcamentos.js';
import { initPedidosModule } from './pedidos.js';
import { initComissoesModule } from './comissoes.js';
import { initCaixaModule } from './caixa.js';
import { initDevolucoesModule } from './devolucoes.js';
import { initAlertasModule } from './alertas.js';
import { initConciliacaoModule } from './conciliacaoBancaria.js';
import { initMarketplaceModule } from './marketplace.js';
import { initCrmModule } from './crm.js';
import { initExportacaoContabilModule } from './exportacaoContabil.js';
import { initApiPublicaModule } from './apiPublica.js';
import { initRastreabilidadeModule } from './rastreabilidade.js';
import { initWhatsappModule } from './whatsapp.js';
import { initFidelidadeModule } from './fidelidade.js';
import { initCheckoutLinksModule } from './checkoutLinks.js';
import { initFiliaisModule } from './filiais.js';
import { initBiModule } from './bi.js';
import { login as authLogin, logout as authLogout, getAuth, validateSession, scheduleTokenRefresh } from './auth.js';

const AppState = {
  isAuthenticated: false,
  currentView: 'dashboard',
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  globalFiltersExpanded: false,
  authToken: null,
  user: null,
  empresa: null,
  empresaId: null,
  rememberSession: false,
  loadingCount: 0,
  filters: {
    periodo: '7dias',
    dataInicial: '',
    dataFinal: '',
    busca: ''
  }
};

const STORAGE_KEYS = {
  filters: 'lf_erp_global_filters',
  currentView: 'lf_erp_current_view'
};

const VIEW_CONFIG = {
  cadastros: { title: 'Cadastros', subtitle: 'Produtos, clientes, fornecedores e usuários' },
  movimentacoes: { title: 'Movimentações', subtitle: 'Vendas, compras e estoque' },
  financeiro: { title: 'Financeiro', subtitle: 'Contas, fluxo de caixa e lançamentos' },
  dashboard: { title: 'Dashboard', subtitle: 'Visão geral do sistema' },
  pdv: { title: 'PDV', subtitle: 'Ponto de venda rápido e profissional' },
  produtos: { title: 'Produtos', subtitle: 'Cadastro, edição, estoque e consulta' },
  clientes: { title: 'Clientes', subtitle: 'Cadastro e relacionamento comercial' },
  fornecedores: { title: 'Fornecedores', subtitle: 'Base completa de fornecedores e compras' },
  usuarios: { title: 'Usuários', subtitle: 'Gestão de acessos, perfis e permissões' },
  vendas: { title: 'Vendas', subtitle: 'Consulta e gestão comercial' },
  compras: { title: 'Compras', subtitle: 'Lançamentos e histórico de aquisições' },
  estoque: { title: 'Estoque', subtitle: 'Posição, conferência e movimentações' },
  'contas-receber': {
    title: 'Contas a Receber',
    subtitle: 'Títulos pendentes, vencidos e recebidos'
  },
  'contas-pagar': { title: 'Contas a Pagar', subtitle: 'Despesas, vencimentos e quitações' },
  'fluxo-caixa': { title: 'Fluxo de Caixa', subtitle: 'Entradas, saídas e saldo consolidado' },
  lancamentos: { title: 'Lançamentos', subtitle: 'Receitas e despesas manuais' },
  conciliacao: { title: 'Conciliação Bancária', subtitle: 'Reconciliação de extratos OFX e CSV' },
  relatorios: { title: 'Relatórios', subtitle: 'Relatórios gerenciais e operacionais' },
  orcamentos: { title: 'Orçamentos', subtitle: 'Cotações emitidas — gerencie aprovações e converta em pedidos' },
  pedidos: { title: 'Pedidos', subtitle: 'Pedidos em andamento — confirme, separe e converta em venda' },
  comissoes: { title: 'Comissões', subtitle: 'Comissões de vendedores por venda realizada' },
  caixa: { title: 'Caixa', subtitle: 'Abertura, movimentações e fechamento do caixa físico' },
  devolucoes: { title: 'Devoluções', subtitle: 'Devoluções de vendas — estoque restaurado automaticamente' },
  alertas: { title: 'Alertas de Cobrança', subtitle: 'Lembretes de pagamento por email e WhatsApp' },
  nfe: { title: 'NF-e', subtitle: 'Emissão, consulta e cancelamento de Notas Fiscais Eletrônicas' },
  bi: { title: 'BI Executivo', subtitle: 'Relatórios executivos com gráficos avançados e análises temporais' },
  filiais: { title: 'Multi-filial', subtitle: 'Pontos de venda independentes com comparativo consolidado' },
  'checkout-links': { title: 'Link de Pagamento', subtitle: 'Gere links de cobrança com PIX e Boleto' },
  fidelidade: { title: 'Programa de Fidelidade', subtitle: 'Pontos por compra, ranking e resgate' },
  whatsapp: { title: 'WhatsApp Business', subtitle: 'Cobranças automáticas e mensagens via API' },
  rastreabilidade: { title: 'Rastreabilidade', subtitle: 'Controle de lotes e números de série' },
  'api-publica': { title: 'API & Webhooks', subtitle: 'Integração com sistemas externos via API Key e webhooks' },
  'exportacao-contabil': { title: 'Exportação Contábil', subtitle: 'Arquivos CSV e EFD/SPED para o contador' },
  crm: { title: 'CRM', subtitle: 'Pipeline de oportunidades de venda' },
  marketplace: { title: 'Marketplace', subtitle: 'Integração com Mercado Livre e Shopee' },
  configuracoes: { title: 'Configurações', subtitle: 'Parâmetros e preferências do sistema' }
};

// ── Tema (dark / light) ────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('lf_erp_theme', theme);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    const isDark = theme === 'dark';
    btn.innerHTML = `<i class="fa-solid fa-${isDark ? 'sun' : 'moon'}"></i>`;
    btn.title = isDark ? 'Modo claro' : 'Modo escuro';
  }
}

function initTheme() {
  const saved = localStorage.getItem('lf_erp_theme') || 'light';
  applyTheme(saved);
}

// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initializeApp();
});

async function initializeApp() {
  cacheInitialState();
  bindEvents();
  restoreSavedFilters();
  restoreCurrentViewFromStorage();
  applyDefaultPeriodDates();
  updateFiltersUI();
  renderInitialDashboardState();
  showGlobalLoader('Inicializando sistema...');

  try {
    await restoreAuthSession();
  } catch (error) {
    console.warn('Sessão não restaurada:', error);
    showLoginScreen();
  } finally {
    hideGlobalLoader();
  }
}

function cacheInitialState() {
  const rememberCheckbox = document.getElementById('rememberSession');
  if (rememberCheckbox) {
    AppState.rememberSession = rememberCheckbox.checked;
  }
}

function bindEvents() {
  bindLoginEvents();
  bindSidebarEvents();
  bindNavigationEvents();
  bindFilterEvents();
  bindTopbarEvents();
  bindModalEvents();
}

function bindLoginEvents() {
  const loginForm = document.getElementById('loginForm');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const loginHelpBtn = document.getElementById('loginHelpBtn');
  const rememberSession = document.getElementById('rememberSession');
  const loginSenha = document.getElementById('loginSenha');

  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  // ── Registro self-service ────────────────────────────────────────────────────
  document.getElementById('abrirRegistroBtn')?.addEventListener('click', () => {
    document.getElementById('loginScreen')?.classList.add('hidden');
    document.getElementById('registroScreen')?.classList.remove('hidden');
  });

  document.getElementById('voltarLoginBtn')?.addEventListener('click', () => {
    document.getElementById('registroScreen')?.classList.add('hidden');
    document.getElementById('loginScreen')?.classList.remove('hidden');
  });

  document.getElementById('registroForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('registroSubmitBtn');
    const msg = document.getElementById('registroMessage');

    const nome_empresa    = document.getElementById('regNomeEmpresa')?.value?.trim() || '';
    const nome_responsavel = document.getElementById('regNome')?.value?.trim() || '';
    const email           = document.getElementById('regEmail')?.value?.trim() || '';
    const usuario         = document.getElementById('regUsuario')?.value?.trim() || '';
    const senha           = document.getElementById('regSenha')?.value || '';

    if (!nome_empresa || !usuario || !senha) {
      if (msg) { msg.textContent = 'Preencha os campos obrigatórios.'; msg.className = 'form-message form-message--error'; }
      return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando conta...'; }
    if (msg) { msg.textContent = ''; msg.className = 'form-message'; }

    try {
      const data = await api.request('/registro', {
        method: 'POST',
        body: { nome_empresa, nome_responsavel, email, usuario, senha }
      });

      // Auto-login com o token retornado
      const authPayload = {
        authToken: data.token,
        empresa: data.empresa,
        empresaId: data.empresa?.id,
        user: { ...data.user, empresa_id: data.empresa?.id, empresa: data.empresa?.nome }
      };
      authLogin(authPayload, true);

      document.getElementById('registroScreen')?.classList.add('hidden');
      applyAuthData(authPayload);
      renderAuthenticatedUser();
      renderTrialBanner();
      showMainScreen();
      await setActiveView('dashboard');
      showToast(`Bem-vindo! Seu trial de 14 dias começou.`, 'success');
      mostrarWizardBoasVindas(data.empresa?.nome);
    } catch (err) {
      if (msg) {
        msg.textContent = err?.message || 'Erro ao criar conta. Tente novamente.';
        msg.className = 'form-message form-message--error';
      }
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Criar minha conta'; }
    }
  });

  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
  }

  if (loginHelpBtn) {
    loginHelpBtn.addEventListener('click', () => {
      openGlobalModal({
        title: 'Ajuda de acesso',
        body: `
          <div class="modal-help-content">
            <p>O login usa o backend real.</p>
            <p>Confira os pontos abaixo se houver falha:</p>
            <ul>
              <li>Backend online</li>
              <li>Endpoint <strong>/login</strong> respondendo</li>
              <li>Usuário e senha corretos</li>
              <li>API URL correta no arquivo <strong>api.js</strong></li>
            </ul>
          </div>
        `,
        footer: `
          <button type="button" class="btn btn-primary" id="closeHelpModalBtn">Entendi</button>
        `
      });

      const closeHelpModalBtn = document.getElementById('closeHelpModalBtn');
      if (closeHelpModalBtn) {
        closeHelpModalBtn.addEventListener('click', closeGlobalModal);
      }
    });
  }

  if (rememberSession) {
    rememberSession.addEventListener('change', (event) => {
      AppState.rememberSession = event.target.checked;
    });
  }

  if (loginSenha) {
    loginSenha.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const loginFormElement = document.getElementById('loginForm');
        if (loginFormElement) {
          loginFormElement.requestSubmit();
        }
      }
    });
  }
}

function bindSidebarEvents() {
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  const mobileSidebarBtn = document.getElementById('mobileSidebarBtn');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const logoutBtn = document.getElementById('logoutBtn');
  const navGroupToggles = document.querySelectorAll('.nav-group__toggle');

  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', toggleSidebarCollapse);
  }

  if (mobileSidebarBtn) {
    mobileSidebarBtn.addEventListener('click', () => {
      if (window.innerWidth > 1200) {
        toggleSidebarCollapse();
      } else {
        openMobileSidebar();
      }
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeMobileSidebar);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  navGroupToggles.forEach((button) => {
    button.addEventListener('click', () => {
      const group = button.closest('.nav-group');
      if (!group) return;
      group.classList.toggle('open');
    });
  });
}

function bindNavigationEvents() {
  const navItems = document.querySelectorAll(
    '.nav-item[data-view], .nav-subitem[data-view], .nav-shortcut[data-view]'
  );

  navItems.forEach((item) => {
    item.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const view = item.getAttribute('data-view');
      if (!view) return;

      await setActiveView(view);
    });
  });
}

function bindFilterEvents() {
  const toggleFiltersBtn = document.getElementById('toggleFiltersBtn');
  const closeGlobalFiltersBtn = document.getElementById('closeGlobalFiltersBtn');
  const globalFiltersContent = document.getElementById('globalFiltersContent');
  const filtroPeriodo = document.getElementById('filtroPeriodo');
  const filtroDataInicial = document.getElementById('filtroDataInicial');
  const filtroDataFinal = document.getElementById('filtroDataFinal');
  const filtroBuscaGlobal = document.getElementById('filtroBuscaGlobal');
  const applyGlobalFiltersBtn = document.getElementById('applyGlobalFiltersBtn');
  const clearGlobalFiltersBtn = document.getElementById('clearGlobalFiltersBtn');

  if (toggleFiltersBtn && globalFiltersContent) {
    toggleFiltersBtn.addEventListener('click', () => {
      globalFiltersContent.classList.toggle('hidden');
    });
  }

  if (closeGlobalFiltersBtn && globalFiltersContent) {
    closeGlobalFiltersBtn.addEventListener('click', () => {
      globalFiltersContent.classList.add('hidden');
    });
  }

  if (filtroPeriodo) {
    filtroPeriodo.addEventListener('change', (event) => {
      AppState.filters.periodo = event.target.value;
      if (event.target.value !== 'personalizado') {
        applyDefaultPeriodDates();
      }
      updateFiltersUI();
    });
  }

  if (filtroDataInicial) {
    filtroDataInicial.addEventListener('change', (event) => {
      AppState.filters.dataInicial = event.target.value;
      saveFiltersToStorage();
    });
  }

  if (filtroDataFinal) {
    filtroDataFinal.addEventListener('change', (event) => {
      AppState.filters.dataFinal = event.target.value;
      saveFiltersToStorage();
    });
  }

  if (filtroBuscaGlobal) {
    filtroBuscaGlobal.addEventListener('input', (event) => {
      AppState.filters.busca = event.target.value;
    });
  }

  if (applyGlobalFiltersBtn) {
    applyGlobalFiltersBtn.addEventListener('click', applyGlobalFilters);
  }

  if (clearGlobalFiltersBtn) {
    clearGlobalFiltersBtn.addEventListener('click', clearGlobalFilters);
  }

  // Botões de período rápido do dashboard
  document.querySelectorAll('[data-quick-period]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const periodo = btn.dataset.quickPeriod;
      AppState.filters.periodo = periodo;
      applyDefaultPeriodDates();
      if (filtroPeriodo) filtroPeriodo.value = periodo;
      updateFiltersUI();
      applyGlobalFilters();
    });
  });
}

// ── Notificações in-app ─────────────────────────────────────────────────────

let _notifCarregadas = false;
let _sseEventSource = null;
let _sseReconnectTimer = null;
let _sseReconnectDelay = 3000;

function _escNotif(v) { return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function carregarNotificacoes() {
  try {
    const data = await api.request('/notificacoes', { method: 'GET' });
    const lista = data.notificacoes || [];

    const badge = document.getElementById('notifBadge');
    if (badge) {
      if (lista.length > 0) {
        badge.textContent = String(lista.length);
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    const listaEl = document.getElementById('notifLista');
    if (!listaEl) return;

    if (!lista.length) {
      listaEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:.88rem">
        <i class="fa-solid fa-check-circle" style="font-size:1.5rem;color:var(--success,#38a169);margin-bottom:8px;display:block"></i>
        Tudo em ordem!
      </div>`;
      return;
    }

    listaEl.innerHTML = lista.map((n) => {
      const cor = _escNotif(n.cor || 'var(--primary)');
      const icone = _escNotif(n.icone || 'fa-bell');
      return `
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;gap:12px;align-items:flex-start"
        class="notif-item" data-view="${_escNotif(n.link || '')}">
        <div style="width:34px;height:34px;border-radius:10px;background:${cor}22;color:${cor};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fa-solid ${icone}" style="font-size:.85rem"></i>
        </div>
        <div style="min-width:0">
          <div style="font-weight:700;font-size:.88rem;color:var(--text);margin-bottom:2px">${_escNotif(n.titulo)}</div>
          <div style="font-size:.8rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_escNotif(n.texto)}</div>
        </div>
      </div>`;
    }).join('');

    // Clique em item → navega para a view
    listaEl.querySelectorAll('.notif-item[data-view]').forEach((el) => {
      el.addEventListener('click', () => {
        document.getElementById('notifDropdown')?.classList.add('hidden');
        const view = el.dataset.view;
        if (view) setActiveView(view);
      });
    });
  } catch {
    /* silencioso — notificações não podem impedir o carregamento */
  }
}

function _aplicarDadosNotificacoes(dados) {
  const lista = dados.notificacoes || [];

  const badge = document.getElementById('notifBadge');
  if (badge) {
    if (lista.length > 0) {
      badge.textContent = String(lista.length);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  // Se o dropdown estiver aberto, atualiza a lista em tempo real
  const dropdown = document.getElementById('notifDropdown');
  const listaEl = document.getElementById('notifLista');
  if (!dropdown?.classList.contains('hidden') && listaEl) {
    if (!lista.length) {
      listaEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:.88rem">
        <i class="fa-solid fa-check-circle" style="font-size:1.5rem;color:var(--success,#38a169);margin-bottom:8px;display:block"></i>
        Tudo em ordem!
      </div>`;
      return;
    }
    listaEl.innerHTML = lista.map((n) => {
      const cor = _escNotif(n.cor || 'var(--primary)');
      const icone = _escNotif(n.icone || 'fa-bell');
      return `
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;gap:12px;align-items:flex-start"
        class="notif-item" data-view="${_escNotif(n.link || '')}">
        <div style="width:34px;height:34px;border-radius:10px;background:${cor}22;color:${cor};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fa-solid ${icone}" style="font-size:.85rem"></i>
        </div>
        <div style="min-width:0">
          <div style="font-weight:700;font-size:.88rem;color:var(--text);margin-bottom:2px">${_escNotif(n.titulo)}</div>
          <div style="font-size:.8rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_escNotif(n.texto)}</div>
        </div>
      </div>`;
    }).join('');
    listaEl.querySelectorAll('.notif-item[data-view]').forEach((el) => {
      el.addEventListener('click', () => {
        dropdown?.classList.add('hidden');
        const view = el.dataset.view;
        if (view) setActiveView(view);
      });
    });
  }
}

function conectarSSE() {
  desconectarSSE();

  const token   = api.getAuthToken();
  const baseUrl = api.getApiBaseUrl().replace(/\/+$/, '');
  if (!token || !baseUrl) return;

  const url = `${baseUrl}/sse-notificacoes?token=${encodeURIComponent(token)}`;
  const es = new EventSource(url);
  _sseEventSource = es;
  _sseReconnectDelay = 3000;

  es.addEventListener('notificacoes', (e) => {
    try {
      const dados = JSON.parse(e.data);
      _notifCarregadas = true;
      _aplicarDadosNotificacoes(dados);
    } catch { /* silencioso */ }
  });

  es.onerror = () => {
    es.close();
    _sseEventSource = null;
    // Reconexão com backoff exponencial (máx 60s)
    _sseReconnectTimer = setTimeout(() => {
      _sseReconnectDelay = Math.min(_sseReconnectDelay * 2, 60000);
      conectarSSE();
    }, _sseReconnectDelay);
  };
}

function desconectarSSE() {
  if (_sseReconnectTimer) {
    clearTimeout(_sseReconnectTimer);
    _sseReconnectTimer = null;
  }
  if (_sseEventSource) {
    _sseEventSource.close();
    _sseEventSource = null;
  }
}

function bindTopbarEvents() {
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  // Sino de notificações
  const sinoBtn    = document.getElementById('notifSinoBtn');
  const dropdown   = document.getElementById('notifDropdown');
  const marcarBtn  = document.getElementById('notifMarcarLidoBtn');

  sinoBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const aberto = !dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden');
    if (!aberto && !_notifCarregadas) {
      _notifCarregadas = true;
      carregarNotificacoes();
    }
  });

  marcarBtn?.addEventListener('click', () => {
    dropdown.classList.add('hidden');
    const badge = document.getElementById('notifBadge');
    if (badge) badge.classList.add('hidden');
  });

  // Fecha dropdown ao clicar fora
  document.addEventListener('click', (e) => {
    if (!document.getElementById('notifWrapper')?.contains(e.target)) {
      dropdown?.classList.add('hidden');
    }
  });

  const refreshDataBtn = document.getElementById('refreshDataBtn');
  const dashboardExportBtn = document.getElementById('dashboardExportBtn');

  if (refreshDataBtn) {
    refreshDataBtn.addEventListener('click', async () => {
      showToast('Atualizando dados...', 'info');
      await simulateRefresh();
    });
  }

  if (dashboardExportBtn) {
    dashboardExportBtn.addEventListener('click', () => {
      showToast('Exportação será ligada ao módulo de relatórios.', 'info');
    });
  }
}

function bindModalEvents() {
  const closeGlobalModalBtn = document.getElementById('closeGlobalModalBtn');
  const globalModal = document.getElementById('globalModal');

  if (closeGlobalModalBtn) {
    closeGlobalModalBtn.addEventListener('click', closeGlobalModal);
  }

  if (globalModal) {
    globalModal.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.dataset.closeModal === 'true') {
        closeGlobalModal();
      }
    });
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const usuarioInput = document.getElementById('loginUsuario');
  const senhaInput = document.getElementById('loginSenha');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');

  if (!usuarioInput || !senhaInput || !loginSubmitBtn) return;

  const usuario = usuarioInput.value.trim();
  const senha = senhaInput.value.trim();

  if (!usuario || !senha) {
    setLoginMessage('Informe usuário e senha.', 'error');
    return;
  }

  loginSubmitBtn.disabled = true;
  setLoginMessage('Validando acesso...', 'info');
  showGlobalLoader('Validando acesso...');

  try {
    const loginResult = await authLogin(usuario, senha, AppState.rememberSession);
    applyAuthData(loginResult);
    renderAuthenticatedUser();
    showMainScreen();
    scheduleTokenRefresh();
    await setActiveView('dashboard');
    setLoginMessage('', 'info');
    showToast(`Bem-vindo, ${AppState.user?.nome || 'usuário'}!`, 'success');
  } catch (error) {
    console.error('Erro no login:', error);
    const friendlyMessage = buildFriendlyAuthError(error);
    setLoginMessage(friendlyMessage, 'error');
    showToast(friendlyMessage, 'error');
  } finally {
    loginSubmitBtn.disabled = false;
    hideGlobalLoader();
  }
}

function togglePasswordVisibility() {
  const passwordInput = document.getElementById('loginSenha');
  const toggleButton = document.getElementById('togglePasswordBtn');
  const icon = toggleButton?.querySelector('i');

  if (!passwordInput || !icon) return;

  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  icon.className = isPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
}

async function toggleSidebarCollapse() {
  const sidebar = document.getElementById('sidebar');
  const mainScreen = document.getElementById('mainScreen');
  if (!sidebar) return;

  if (AppState.sidebarCollapsed) {
    const parentView = getParentViewFromChild(AppState.currentView);

    if (parentView) {
      AppState.sidebarCollapsed = false;
      sidebar.classList.remove('collapsed');
      sidebar.classList.add('expanded');
      mainScreen?.classList.remove('sidebar-collapsed');
      await setActiveView(parentView);
      return;
    }

    AppState.sidebarCollapsed = false;
    sidebar.classList.remove('collapsed');
    sidebar.classList.add('expanded');
    mainScreen?.classList.remove('sidebar-collapsed');
    return;
  }

  AppState.sidebarCollapsed = true;
  sidebar.classList.add('collapsed');
  sidebar.classList.remove('expanded');
  mainScreen?.classList.add('sidebar-collapsed');

  document.querySelectorAll('.nav-group').forEach((group) => {
    group.classList.remove('open');
  });
}

function openMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (!sidebar || !overlay) return;

  AppState.sidebarMobileOpen = true;
  sidebar.classList.add('mobile-open');
  overlay.classList.remove('hidden');
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (!sidebar || !overlay) return;

  AppState.sidebarMobileOpen = false;
  sidebar.classList.remove('mobile-open');
  overlay.classList.add('hidden');
}

async function setActiveView(view) {
  AppState.currentView = view;
  saveCurrentViewToStorage();

  const sections = document.querySelectorAll('.view-section');
  sections.forEach((section) => {
    section.classList.toggle('active', section.getAttribute('data-view') === view);
  });

  updateNavigationState(view);

  const config = VIEW_CONFIG[view] || {
    title: 'LF ERP',
    subtitle: 'Sistema de gestão empresarial'
  };

  const pageTitle = document.getElementById('pageTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');

  if (pageTitle) pageTitle.textContent = config.title;
  if (pageSubtitle) pageSubtitle.textContent = config.subtitle;

  if (window.innerWidth <= 900) {
    closeMobileSidebar();
  }

  await loadCurrentView(view);
}

async function loadCurrentView(view) {
  if (view === 'dashboard') {
    await loadDashboardReal();
  } else if (view === 'produtos') {
    await loadProdutosReal();
  } else if (view === 'clientes') {
    await loadClientesReal();
  } else if (view === 'pdv') {
    await loadPDVReal();
  } else if (view === 'vendas') {
    await loadVendasReal();
  } else if (view === 'compras') {
    await loadComprasReal();
  } else if (view === 'estoque') {
    await loadEstoqueReal();
  } else if (view === 'contas-receber') {
    await loadContasReceberReal();
  } else if (view === 'contas-pagar') {
    await loadContasPagarReal();
  } else if (view === 'fluxo-caixa') {
    await loadFluxoCaixaReal();
  } else if (view === 'lancamentos') {
    await loadLancamentosReal();
  } else if (view === 'conciliacao') {
    await loadConciliacaoReal();
  } else if (view === 'auditoria-financeira') {
    await loadAuditoriaFinanceiraReal();
  } else if (view === 'lixeira') {
    await loadLixeiraReal();
  } else if (view === 'relatorios') {
    await loadRelatoriosFinanceirosReal();
  } else if (view === 'fornecedores') {
    await loadFornecedoresReal();
  } else if (view === 'usuarios') {
    await loadUsuariosReal();
  } else if (view === 'alertas') {
    await loadAlertasReal();
  } else if (view === 'devolucoes') {
    await loadDevolucoesReal();
  } else if (view === 'caixa') {
    await loadCaixaReal();
  } else if (view === 'comissoes') {
    await loadComissoesReal();
  } else if (view === 'orcamentos') {
    await loadOrcamentosReal();
  } else if (view === 'pedidos') {
    await loadPedidosReal();
  } else if (view === 'nfe') {
    await loadNfeReal();
  } else if (view === 'filiais') {
    await loadFiliaisReal();
  } else if (view === 'bi') {
    await loadBiReal();
  } else if (view === 'checkout-links') {
    await loadCheckoutLinksReal();
  } else if (view === 'fidelidade') {
    await loadFidelidadeReal();
  } else if (view === 'whatsapp') {
    await loadWhatsappReal();
  } else if (view === 'rastreabilidade') {
    await loadRastreabilidadeReal();
  } else if (view === 'api-publica') {
    await loadApiPublicaReal();
  } else if (view === 'exportacao-contabil') {
    await loadExportacaoContabilReal();
  } else if (view === 'crm') {
    await loadCrmReal();
  } else if (view === 'marketplace') {
    await loadMarketplaceReal();
  } else if (view === 'configuracoes') {
    await loadConfigReal();
  } else {
    renderViewFeedback(view);
  }
}

function updateNavigationState(view) {
  const navItems = document.querySelectorAll('.nav-item, .nav-subitem');
  const navGroups = document.querySelectorAll('.nav-group');
  const navGroupToggles = document.querySelectorAll('.nav-group__toggle');

  navItems.forEach((item) => item.classList.remove('active'));
  navGroups.forEach((group) => group.classList.remove('active'));
  navGroupToggles.forEach((toggle) => toggle.classList.remove('active'));

  const activeItem = document.querySelector(
    `.nav-item[data-view="${view}"], .nav-subitem[data-view="${view}"]`
  );
  if (!activeItem) return;

  activeItem.classList.add('active');

  const parentGroup = activeItem.closest('.nav-group');
  if (parentGroup) {
    parentGroup.classList.add('active');

    const toggle = parentGroup.querySelector('.nav-group__toggle');
    if (toggle) {
      toggle.classList.add('active');
    }
  }
}

function getParentViewFromChild(view) {
  const groups = {
    cadastros:     ['produtos', 'clientes', 'fornecedores', 'usuarios'],
    movimentacoes: ['vendas', 'compras', 'estoque', 'devolucoes', 'caixa'],
    financeiro:    ['contas-receber', 'contas-pagar', 'fluxo-caixa', 'lancamentos', 'conciliacao', 'auditoria-financeira'],
    fiscal:        ['nfe', 'orcamentos', 'pedidos'],
    relatorios:    ['relatorios', 'bi', 'exportacao-contabil'],
    comercial:     ['crm', 'comissoes', 'fidelidade', 'alertas'],
    integracoes:   ['whatsapp', 'marketplace', 'api-publica', 'checkout-links'],
    operacoes:     ['filiais', 'rastreabilidade'],
  };

  for (const [parent, children] of Object.entries(groups)) {
    if (children.includes(view)) {
      return parent;
    }
  }

  return null;
}

function toggleGlobalFilters() {
  const filtersContent = document.getElementById('globalFiltersContent');
  if (!filtersContent) return;
  filtersContent.classList.toggle('hidden');
}

function updateFiltersUI() {
  const filtroPeriodo = document.getElementById('filtroPeriodo');
  const filtroDataInicial = document.getElementById('filtroDataInicial');
  const filtroDataFinal = document.getElementById('filtroDataFinal');
  const filtroBuscaGlobal = document.getElementById('filtroBuscaGlobal');

  if (filtroPeriodo) filtroPeriodo.value = AppState.filters.periodo;
  if (filtroDataInicial) filtroDataInicial.value = AppState.filters.dataInicial;
  if (filtroDataFinal) filtroDataFinal.value = AppState.filters.dataFinal;
  if (filtroBuscaGlobal) filtroBuscaGlobal.value = AppState.filters.busca;

  const isCustom = AppState.filters.periodo === 'personalizado';
  if (filtroDataInicial) filtroDataInicial.disabled = !isCustom;
  if (filtroDataFinal) filtroDataFinal.disabled = !isCustom;

  const globalFilterSummary = document.getElementById('globalFilterSummary');
  if (globalFilterSummary) {
    globalFilterSummary.textContent = `Período: ${getPeriodLabel()}`;
  }
}

function applyDefaultPeriodDates() {
  const today = new Date();
  let start = new Date(today);
  let end = new Date(today);

  switch (AppState.filters.periodo) {
    case 'hoje':
      break;
    case 'ontem':
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
      break;
    case '7dias':
      start.setDate(today.getDate() - 6);
      break;
    case '30dias':
      start.setDate(today.getDate() - 29);
      break;
    case 'mesAtual':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case 'mesAnterior':
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case 'personalizado':
      saveFiltersToStorage();
      return;
    default:
      start.setDate(today.getDate() - 6);
      break;
  }

  AppState.filters.dataInicial = formatDateInput(start);
  AppState.filters.dataFinal = formatDateInput(end);
  saveFiltersToStorage();
}

async function applyGlobalFilters() {
  saveFiltersToStorage();
  showToast('Filtros aplicados com sucesso.', 'success');

  if (!AppState.isAuthenticated) {
    renderInitialDashboardState();
    return;
  }

  await loadCurrentView(AppState.currentView);
}

function clearGlobalFilters() {
  AppState.filters = {
    periodo: '7dias',
    dataInicial: '',
    dataFinal: '',
    busca: ''
  };

  applyDefaultPeriodDates();
  updateFiltersUI();
  showToast('Filtros limpos.', 'info');
}

function saveFiltersToStorage() {
  localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify(AppState.filters));
}

function restoreSavedFilters() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.filters);
    if (!saved) return;

    const parsed = JSON.parse(saved);

    AppState.filters = {
      ...AppState.filters,
      ...parsed
    };
  } catch (error) {
    console.warn('Não foi possível restaurar filtros salvos.', error);
  }
}

function saveCurrentViewToStorage() {
  localStorage.setItem(STORAGE_KEYS.currentView, AppState.currentView);
}

function restoreCurrentViewFromStorage() {
  const savedView = localStorage.getItem(STORAGE_KEYS.currentView);
  if (savedView) {
    AppState.currentView = savedView;
  }
}

async function restoreAuthSession() {
  const auth = getAuth();

  if (!auth?.authToken) {
    showLoginScreen();
    return;
  }

  applyAuthData(auth);

  try {
    const meData = await validateSession();
    if (meData) {
      AppState.user = { ...AppState.user, ...meData };
      AppState.assinatura = {
        status: meData.assinatura_status || null,
        trial_fim: meData.trial_fim || null,
        dias_restantes_trial: meData.dias_restantes_trial ?? null,
        bloqueada: Boolean(meData.bloqueada),
        plano_nome: meData.plano_nome || null
      };
    }
    renderAuthenticatedUser();
    renderTrialBanner();
    showMainScreen();
    scheduleTokenRefresh();
    await setActiveView(AppState.currentView || 'dashboard');
    showToast('Sessão restaurada com sucesso.', 'success');
  } catch (error) {
    handleLogout(false);
    throw error;
  }
}

function applyAuthData(data) {
  AppState.isAuthenticated = true;
  AppState.authToken = data.authToken || data.token || null;

  AppState.user = data.user || {
    nome: 'Usuário',
    perfil: 'Operador',
    usuario: 'usuario'
  };

  AppState.empresa = data.empresa || {
    nome: data?.user?.empresa || 'Empresa Logada'
  };

  AppState.empresaId = data.empresaId || data.empresa_id || data.user?.empresa_id || null;
}

function renderAuthenticatedUser() {
  const sidebarCompanyName = document.getElementById('sidebarCompanyName');
  const topbarCompanyName = document.getElementById('topbarCompanyName');
  const sidebarUserName = document.getElementById('sidebarUserName');
  const sidebarUserRole = document.getElementById('sidebarUserRole');
  const sidebarUserAvatar = document.getElementById('sidebarUserAvatar');

  const companyName = AppState.empresa?.nome || AppState.user?.empresa || 'Empresa Logada';

  const userName =
    AppState.user?.nome || AppState.user?.name || AppState.user?.usuario || 'Usuário';

  const userRole =
    AppState.user?.perfil || AppState.user?.role || AppState.user?.tipo || 'Perfil não informado';

  if (sidebarCompanyName) sidebarCompanyName.textContent = companyName;
  if (topbarCompanyName) topbarCompanyName.textContent = companyName;
  if (sidebarUserName) sidebarUserName.textContent = userName;
  if (sidebarUserRole) sidebarUserRole.textContent = userRole;
  if (sidebarUserAvatar) sidebarUserAvatar.textContent = getInitials(userName);

  const adminLink = document.getElementById('adminNavLink');
  if (adminLink && AppState.user?.is_saas_owner) {
    adminLink.style.display = 'block';
  }

  const lixeiraBtn = document.getElementById('lixeiraNavBtn');
  if (lixeiraBtn) {
    const tipo = AppState.user?.tipo;
    if (tipo === 'admin' || tipo === 'gerente' || AppState.user?.is_saas_owner) {
      lixeiraBtn.classList.remove('hidden');
    }
  }
}

function renderTrialBanner() {
  const banner = document.getElementById('trialBanner');
  if (!banner) return;

  if (AppState.user?.is_saas_owner) { banner.style.display = 'none'; return; }

  const a = AppState.assinatura;
  if (!a) { banner.style.display = 'none'; return; }

  if (a.bloqueada) {
    banner.style.cssText = 'display:block;padding:10px 20px;font-size:13px;font-weight:600;text-align:center;background:var(--danger);color:#fff';
    banner.innerHTML = 'Sua conta está bloqueada. Entre em contato com o suporte.';
    return;
  }

  if (a.status === 'trial' && a.dias_restantes_trial !== null) {
    const dias = a.dias_restantes_trial;
    if (dias < 0) {
      banner.style.cssText = 'display:block;padding:10px 20px;font-size:13px;font-weight:600;text-align:center;background:var(--danger);color:#fff';
      banner.innerHTML = 'Seu período de teste expirou. Entre em contato para ativar sua assinatura.';
    } else if (dias <= 7) {
      const cor = dias <= 2 ? 'var(--danger)' : 'var(--warning)';
      banner.style.cssText = `display:block;padding:10px 20px;font-size:13px;font-weight:600;text-align:center;background:${cor};color:#fff`;
      banner.innerHTML = dias === 0
        ? 'Seu trial expira hoje. Contate o suporte para ativar.'
        : `Seu trial expira em <strong>${dias} dia(s)</strong>. Fale com o suporte para continuar usando.`;
    } else {
      banner.style.display = 'none';
    }
    return;
  }

  banner.style.display = 'none';
}

function showMainScreen() {
  const loginScreen = document.getElementById('loginScreen');
  const mainScreen = document.getElementById('mainScreen');

  if (loginScreen) loginScreen.classList.add('hidden');
  if (mainScreen) mainScreen.classList.remove('hidden');

  // Conecta SSE para notificações em tempo real (sem polling)
  _notifCarregadas = false;
  conectarSSE();
}

function showLoginScreen() {
  const loginScreen = document.getElementById('loginScreen');
  const mainScreen = document.getElementById('mainScreen');

  if (loginScreen) loginScreen.classList.remove('hidden');
  if (mainScreen) mainScreen.classList.add('hidden');
}

function handleLogout(showMessage = true) {
  AppState.isAuthenticated = false;
  AppState.authToken = null;
  AppState.user = null;
  AppState.empresa = null;
  AppState.empresaId = null;
  AppState.currentView = 'dashboard';

  localStorage.removeItem(STORAGE_KEYS.currentView);

  desconectarSSE();
  authLogout();
  showLoginScreen();
  clearLoginInputs();
  closeMobileSidebar();
  setLoginMessage('', 'info');
  renderInitialDashboardState();

  if (showMessage) {
    showToast('Sessão encerrada com sucesso.', 'success');
  }
}

function clearLoginInputs() {
  const loginUsuario = document.getElementById('loginUsuario');
  const loginSenha = document.getElementById('loginSenha');

  if (loginUsuario) loginUsuario.value = '';
  if (loginSenha) loginSenha.value = '';
}

function setLoginMessage(message, type = 'info') {
  const loginMessage = document.getElementById('loginMessage');
  if (!loginMessage) return;

  loginMessage.textContent = message;
  loginMessage.className = `form-message ${type}`;
}

function showGlobalLoader(message = 'Carregando sistema...') {
  AppState.loadingCount += 1;

  const globalLoading = document.getElementById('globalLoading');
  const loadingText = globalLoading?.querySelector('p');

  if (globalLoading) globalLoading.classList.remove('hidden');
  if (loadingText) loadingText.textContent = message;
}

function hideGlobalLoader() {
  AppState.loadingCount = Math.max(0, AppState.loadingCount - 1);

  if (AppState.loadingCount > 0) return;

  const globalLoading = document.getElementById('globalLoading');
  if (globalLoading) globalLoading.classList.add('hidden');
}

function openGlobalModal({ title = 'Aviso', body = '', footer = '' } = {}) {
  const modal = document.getElementById('globalModal');
  const modalTitle = document.getElementById('globalModalTitle');
  const modalBody = document.getElementById('globalModalBody');
  const modalFooter = document.getElementById('globalModalFooter');

  if (!modal || !modalTitle || !modalBody || !modalFooter) return;

  modalTitle.textContent = title;
  modalBody.innerHTML = body;
  modalFooter.innerHTML = footer;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeGlobalModal() {
  const modal = document.getElementById('globalModal');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}


async function loadDashboardReal() {
  showGlobalLoader('Carregando dashboard...');

  try {
    await dashboard.loadDashboard({
      filters: AppState.filters,
      state: {
        user: AppState.user,
        empresa: AppState.empresa,
        filters: AppState.filters
      }
    });
  } catch (error) {
    console.error('Erro ao carregar dashboard real:', error);
    dashboard.resetDashboard('Não foi possível carregar o dashboard real.');
    showToast('Falha ao carregar dashboard real.', 'warning');
  } finally {
    hideGlobalLoader();
  }
}

async function loadProdutosReal() {
  showGlobalLoader('Carregando produtos...');

  try {
    await initProdutosModule();
    showToast('Produtos carregados com sucesso.', 'success');
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
    showToast('Falha ao carregar módulo de produtos.', 'error');
    renderModuleError(
      'produtosContainer',
      'Produtos',
      'Não foi possível carregar o módulo de produtos.'
    );
  } finally {
    hideGlobalLoader();
  }
}

async function loadClientesReal() {
  showGlobalLoader('Carregando clientes...');

  try {
    await initClientesModule();
    showToast('Clientes carregados com sucesso.', 'success');
  } catch (error) {
    console.error('Erro ao carregar clientes:', error);
    showToast('Falha ao carregar módulo de clientes.', 'error');
    renderModuleError(
      'clientesContainer',
      'Clientes',
      'Não foi possível carregar o módulo de clientes.'
    );
  } finally {
    hideGlobalLoader();
  }
}

async function loadPDVReal() {
  showGlobalLoader('Carregando PDV...');

  try {
    await initPDVModule();
    showToast('PDV carregado com sucesso.', 'success');
  } catch (error) {
    console.error('Erro ao carregar PDV:', error);
    showToast('Falha ao carregar módulo de PDV.', 'error');
    renderModuleError('pdvContainer', 'PDV', 'Não foi possível carregar o módulo de PDV.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadVendasReal() {
  showGlobalLoader('Carregando vendas...');

  try {
    await initVendasModule();
    showToast('Vendas carregadas com sucesso.', 'success');
  } catch (error) {
    console.error('Erro ao carregar vendas:', error);
    showToast('Falha ao carregar módulo de vendas.', 'error');
    renderModuleError('vendasContainer', 'Vendas', 'Não foi possível carregar o módulo de vendas.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadComprasReal() {
  showGlobalLoader('Carregando compras...');

  try {
    await initComprasModule();
    showToast('Compras carregadas com sucesso.', 'success');
  } catch (error) {
    console.error('Erro ao carregar compras:', error);
    showToast('Falha ao carregar módulo de compras.', 'error');
    renderModuleError(
      'comprasContainer',
      'Compras',
      'Não foi possível carregar o módulo de compras.'
    );
  } finally {
    hideGlobalLoader();
  }
}

async function loadContasReceberReal() {
  showGlobalLoader('Carregando contas a receber...');

  try {
    await initContasReceberModule();
    showToast('Contas a receber carregadas.', 'success');
  } catch (error) {
    console.error('Erro ao carregar contas a receber:', error);
    showToast('Erro ao carregar contas a receber.', 'error');
    renderModuleError(
      'contasReceberContainer',
      'Contas a Receber',
      'Não foi possível carregar contas a receber.'
    );
  } finally {
    hideGlobalLoader();
  }
}

async function loadContasPagarReal() {
  showGlobalLoader('Carregando contas a pagar...');

  try {
    await initContasPagarModule();
    showToast('Contas a pagar carregadas com sucesso.', 'success');
  } catch (error) {
    console.error('Erro ao carregar contas a pagar:', error);
    showToast('Falha ao carregar módulo de contas a pagar.', 'error');
    renderModuleError(
      'contasPagarContainer',
      'Contas a Pagar',
      'Não foi possível carregar contas a pagar.'
    );
  } finally {
    hideGlobalLoader();
  }
}

async function loadFluxoCaixaReal() {
  showGlobalLoader('Carregando fluxo de caixa...');

  try {
    await initFluxoCaixaModule();
    showToast('Fluxo de caixa carregado com sucesso.', 'success');
  } catch (error) {
    console.error('Erro ao carregar fluxo de caixa:', error);
    showToast('Falha ao carregar módulo de fluxo de caixa.', 'error');
    renderModuleError(
      'fluxoCaixaContainer',
      'Fluxo de Caixa',
      'Não foi possível carregar o fluxo de caixa.'
    );
  } finally {
    hideGlobalLoader();
  }
}

async function loadLancamentosReal() {
  showGlobalLoader('Carregando lançamentos...');

  try {
    await initLancamentosModule();
    showToast('Lançamentos carregados', 'success');
  } catch (error) {
    console.error('Erro ao carregar lançamentos:', error);
    showToast('Erro ao carregar lançamentos', 'error');
    renderModuleError(
      'lancamentosContainer',
      'Lançamentos',
      'Não foi possível carregar lançamentos financeiros.'
    );
  } finally {
    hideGlobalLoader();
  }
}

async function loadConciliacaoReal() {
  showGlobalLoader('Carregando conciliação bancária...');
  try {
    await initConciliacaoModule();
  } catch (error) {
    console.error('Erro ao carregar conciliação:', error);
    showToast('Erro ao carregar conciliação bancária', 'error');
    renderModuleError(
      'conciliacaoContainer',
      'Conciliação Bancária',
      'Não foi possível carregar o módulo de conciliação.'
    );
  } finally {
    hideGlobalLoader();
  }
}

async function loadLixeiraReal() {
  showGlobalLoader('Carregando lixeira...');
  try {
    await initLixeiraModule();
  } catch (error) {
    console.error('Erro ao carregar lixeira:', error);
    showToast('Erro ao carregar lixeira', 'error');
    renderModuleError('lixeiraContainer', 'Lixeira', 'Não foi possível carregar a lixeira.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadAuditoriaFinanceiraReal() {
  showGlobalLoader('Carregando auditoria financeira...');
  try {
    await initAuditoriaFinanceiraModule();
  } catch (error) {
    console.error('Erro ao carregar auditoria financeira:', error);
    showToast('Erro ao carregar auditoria financeira', 'error');
    renderModuleError(
      'auditoriaFinanceiraContainer',
      'Auditoria Financeira',
      'Não foi possível carregar o histórico de auditoria.'
    );
  } finally {
    hideGlobalLoader();
  }
}

async function loadRelatoriosFinanceirosReal() {
  showGlobalLoader('Carregando relatórios financeiros...');

  try {
    await initRelatoriosFinanceirosModule();
    showToast('Relatórios financeiros carregados com sucesso.', 'success');
  } catch (error) {
    console.error('Erro ao carregar relatórios financeiros:', error);
    showToast('Falha ao carregar relatórios financeiros.', 'error');
    renderModuleError(
      'relatoriosContainer',
      'Relatórios Financeiros',
      'Não foi possível carregar relatórios financeiros.'
    );
  } finally {
    hideGlobalLoader();
  }
}

async function loadFornecedoresReal() {
  showGlobalLoader('Carregando fornecedores...');

  try {
    await initFornecedoresModule();
    showToast('Fornecedores carregados com sucesso.', 'success');
  } catch (error) {
    console.error('Erro ao carregar fornecedores:', error);
    showToast('Falha ao carregar módulo de fornecedores.', 'error');
    renderModuleError(
      'fornecedoresContainer',
      'Fornecedores',
      'Não foi possível carregar fornecedores.'
    );
  } finally {
    hideGlobalLoader();
  }
}

async function loadEstoqueReal() {
  showGlobalLoader('Carregando estoque...');

  try {
    await initEstoqueModule();
    showToast('Estoque carregado com sucesso.', 'success');
  } catch (error) {
    console.error('Erro ao carregar estoque:', error);
    showToast('Falha ao carregar módulo de estoque.', 'error');
    renderModuleError('estoqueContainer', 'Estoque', 'Não foi possível carregar estoque.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadUsuariosReal() {
  showGlobalLoader('Carregando usuários...');

  try {
    await initUsuariosModule();
    showToast('Usuários carregados com sucesso.', 'success');
  } catch (error) {
    console.error('Erro ao carregar usuários:', error);
    showToast('Falha ao carregar módulo de usuários.', 'error');
    renderModuleError('usuariosContainer', 'Usuários', 'Não foi possível carregar usuários.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadAlertasReal() {
  showGlobalLoader('Carregando alertas...');
  try {
    await initAlertasModule();
    showToast('Alertas carregados.', 'success');
  } catch (error) {
    console.error('Erro ao carregar alertas:', error);
    showToast('Falha ao carregar alertas.', 'error');
    renderModuleError('alertasContainer', 'Alertas', 'Não foi possível carregar alertas.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadDevolucoesReal() {
  showGlobalLoader('Carregando devoluções...');
  try {
    await initDevolucoesModule();
    showToast('Devoluções carregadas.', 'success');
  } catch (error) {
    console.error('Erro ao carregar devoluções:', error);
    showToast('Falha ao carregar devoluções.', 'error');
    renderModuleError('devolucoesContainer', 'Devoluções', 'Não foi possível carregar devoluções.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadCaixaReal() {
  showGlobalLoader('Carregando caixa...');
  try {
    await initCaixaModule();
    showToast('Caixa carregado.', 'success');
  } catch (error) {
    console.error('Erro ao carregar caixa:', error);
    showToast('Falha ao carregar caixa.', 'error');
    renderModuleError('caixaContainer', 'Caixa', 'Não foi possível carregar o caixa.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadComissoesReal() {
  showGlobalLoader('Carregando comissões...');
  try {
    await initComissoesModule();
    showToast('Comissões carregadas.', 'success');
  } catch (error) {
    console.error('Erro ao carregar comissões:', error);
    showToast('Falha ao carregar comissões.', 'error');
    renderModuleError('comissoesContainer', 'Comissões', 'Não foi possível carregar comissões.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadOrcamentosReal() {
  showGlobalLoader('Carregando orçamentos...');
  try {
    await initOrcamentosModule();
    showToast('Orçamentos carregados.', 'success');
  } catch (error) {
    console.error('Erro ao carregar orçamentos:', error);
    showToast('Falha ao carregar orçamentos.', 'error');
    renderModuleError('orcamentosContainer', 'Orçamentos', 'Não foi possível carregar orçamentos.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadPedidosReal() {
  showGlobalLoader('Carregando pedidos...');
  try {
    await initPedidosModule();
    showToast('Pedidos carregados.', 'success');
  } catch (error) {
    console.error('Erro ao carregar pedidos:', error);
    showToast('Falha ao carregar pedidos.', 'error');
    renderModuleError('pedidosContainer', 'Pedidos', 'Não foi possível carregar pedidos.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadNfeReal() {
  showGlobalLoader('Carregando NF-e...');

  try {
    await initNfeModule();
    showToast('Módulo NF-e carregado.', 'success');
  } catch (error) {
    console.error('Erro ao carregar NF-e:', error);
    showToast('Falha ao carregar módulo NF-e.', 'error');
    renderModuleError('nfeContainer', 'NF-e', 'Não foi possível carregar o módulo NF-e.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadFiliaisReal() {
  showGlobalLoader('Carregando filiais...');
  try {
    await initFiliaisModule();
  } catch (error) {
    console.error('Erro ao carregar filiais:', error);
    renderModuleError('filiaisContainer', 'Multi-filial', 'Nao foi possivel carregar o modulo.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadCheckoutLinksReal() {
  showGlobalLoader('Carregando links de pagamento...');
  try {
    await initCheckoutLinksModule();
  } catch (error) {
    console.error('Erro ao carregar checkout links:', error);
    renderModuleError('checkoutLinksContainer', 'Link de Pagamento', 'Nao foi possivel carregar o modulo.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadFidelidadeReal() {
  showGlobalLoader('Carregando fidelidade...');
  try {
    await initFidelidadeModule();
  } catch (error) {
    console.error('Erro ao carregar fidelidade:', error);
    renderModuleError('fidelidadeContainer', 'Fidelidade', 'Nao foi possivel carregar o modulo.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadWhatsappReal() {
  showGlobalLoader('Carregando WhatsApp...');
  try {
    await initWhatsappModule();
  } catch (error) {
    console.error('Erro ao carregar WhatsApp:', error);
    renderModuleError('whatsappContainer', 'WhatsApp Business', 'Nao foi possivel carregar o modulo.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadRastreabilidadeReal() {
  showGlobalLoader('Carregando rastreabilidade...');
  try {
    await initRastreabilidadeModule();
  } catch (error) {
    console.error('Erro ao carregar rastreabilidade:', error);
    renderModuleError('rastreabilidadeContainer', 'Rastreabilidade', 'Nao foi possivel carregar o modulo.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadApiPublicaReal() {
  showGlobalLoader('Carregando API & Webhooks...');
  try {
    await initApiPublicaModule();
  } catch (error) {
    console.error('Erro ao carregar API Publica:', error);
    renderModuleError('apiPublicaContainer', 'API & Webhooks', 'Nao foi possivel carregar o modulo.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadExportacaoContabilReal() {
  showGlobalLoader('Carregando exportação contábil...');
  try {
    await initExportacaoContabilModule();
  } catch (error) {
    console.error('Erro ao carregar exportação contábil:', error);
    renderModuleError('exportacaoContabilContainer', 'Exportação Contábil', 'Não foi possível carregar o módulo.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadCrmReal() {
  showGlobalLoader('Carregando CRM...');
  try {
    await initCrmModule();
  } catch (error) {
    console.error('Erro ao carregar CRM:', error);
    renderModuleError('crmContainer', 'CRM', 'Não foi possível carregar o módulo CRM.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadBiReal() {
  showGlobalLoader('Carregando BI...');
  try {
    await initBiModule();
  } catch (error) {
    console.error('Erro ao carregar BI:', error);
    renderModuleError('biContainer', 'BI — Relatórios Executivos', 'Não foi possível carregar o módulo.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadMarketplaceReal() {
  showGlobalLoader('Carregando marketplace...');
  try {
    await initMarketplaceModule();
  } catch (error) {
    console.error('Erro ao carregar marketplace:', error);
    renderModuleError('marketplaceContainer', 'Marketplace', 'Não foi possível carregar o módulo Marketplace.');
  } finally {
    hideGlobalLoader();
  }
}

async function loadConfigReal() {
  showGlobalLoader('Carregando configurações...');

  try {
    await initConfigModule();
    showToast('Configurações carregadas', 'success');
  } catch (error) {
    console.error('Erro ao carregar configurações:', error);
    showToast('Erro ao carregar configurações', 'error');
    renderModuleError(
      'configuracoesContainer',
      'Configurações',
      'Não foi possível carregar configurações.'
    );
  } finally {
    hideGlobalLoader();
  }
}

function renderInitialDashboardState() {
  dashboard.resetDashboard('Faça login para carregar o dashboard.');
}

function renderViewFeedback(view) {
  const placeholders = {
    produtos: 'produtosContainer',
    clientes: 'clientesContainer',
    fornecedores: 'fornecedoresContainer',
    vendas: 'vendasContainer',
    compras: 'comprasContainer',
    'contas-receber': 'contasReceberContainer',
    'contas-pagar': 'contasPagarContainer',
    'fluxo-caixa': 'fluxoCaixaContainer',
    lancamentos: 'lancamentosContainer',
    conciliacao: 'conciliacaoContainer',
    'auditoria-financeira': 'auditoriaFinanceiraContainer',
    lixeira: 'lixeiraContainer',
    pdv: 'pdvContainer',
    usuarios: 'usuariosContainer',
    estoque: 'estoqueContainer',
    relatorios: 'relatoriosContainer',
    configuracoes: 'configuracoesContainer'
  };

  const containerId = placeholders[view];
  if (!containerId) return;

  const container = document.getElementById(containerId);
  if (!container) return;

  const config = VIEW_CONFIG[view];

  container.innerHTML = `
    <div class="module-placeholder__content">
      <h3>${config?.title || 'Módulo'}</h3>
      <p>${config?.subtitle || 'Área do sistema'}</p>

      <div class="module-placeholder__meta">
        <span><strong>Empresa:</strong> ${AppState.empresa?.nome || AppState.user?.empresa || '-'}</span>
        <span><strong>Período:</strong> ${getPeriodLabel()}</span>
      </div>

      <div class="module-placeholder__note">
        Módulo ainda não possui carregamento definido no roteador.
      </div>
    </div>
  `;
}

function renderModuleError(containerId, title, message) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="module-placeholder__content">
      <h3>${title}</h3>
      <p>${message}</p>
      <div class="module-placeholder__note">
        Verifique a integração com o backend e tente novamente.
      </div>
    </div>
  `;
}

async function simulateRefresh() {
  if (!AppState.isAuthenticated) {
    await wait(500);
    renderInitialDashboardState();
    showToast('Dados atualizados.', 'success');
    return;
  }

  await loadCurrentView(AppState.currentView);
  showToast('Dados atualizados.', 'success');
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getPeriodLabel() {
  const labels = {
    hoje: 'Hoje',
    ontem: 'Ontem',
    '7dias': 'Últimos 7 dias',
    '30dias': 'Últimos 30 dias',
    mesAtual: 'Mês atual',
    mesAnterior: 'Mês anterior',
    personalizado: 'Personalizado'
  };

  return labels[AppState.filters.periodo] || 'Período';
}

function getInitials(name) {
  return (
    String(name)
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'LF'
  );
}

function buildFriendlyAuthError(error) {
  const status = error?.status;
  const codigo = error?.payload?.codigo || '';
  const message = error?.message || 'Falha ao autenticar.';

  if (codigo === 'CREDENCIAIS_INVALIDAS') return 'Usuário ou senha inválidos.';
  if (codigo === 'EMPRESA_BLOQUEADA')     return 'Empresa bloqueada. Entre em contato com o suporte.';
  if (codigo === 'ASSINATURA_INATIVA')    return 'Assinatura inativa. Regularize o acesso para continuar.';
  if (codigo === 'TRIAL_EXPIRADO')        return 'Período de teste expirado. Escolha um plano para continuar.';
  if (codigo === 'TOKEN_EXPIRADO')        return 'Sua sessão expirou. Faça login novamente.';

  if (status === 429) return message || 'Muitas tentativas. Aguarde alguns minutos.';
  if (status === 401) return 'Usuário ou senha inválidos.';
  if (status === 403) return 'Acesso negado. Verifique suas credenciais.';

  if (message.includes('Failed to fetch') || message.includes('NetworkError'))
    return 'Não foi possível conectar ao servidor. Verifique sua conexão.';
  if (message.includes('demorou demais'))
    return 'O servidor demorou demais para responder. Tente novamente.';

  return message;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Wizard de boas-vindas (exibido após registro) ─────────────────────────────

function mostrarWizardBoasVindas(nomeEmpresa) {
  if (document.getElementById('wizardBoasVindas')) return;

  const wizard = document.createElement('div');
  wizard.id = 'wizardBoasVindas';
  wizard.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px';

  const steps = [
    {
      icon: 'fa-rocket',
      titulo: `Bem-vindo ao LF ERP!`,
      texto: `Sua conta <strong>${nomeEmpresa || ''}</strong> foi criada com sucesso. Você tem <strong>14 dias</strong> para explorar tudo gratuitamente.`,
      btn: 'Configurar minha empresa'
    },
    {
      icon: 'fa-box',
      titulo: 'Adicione seu primeiro produto',
      texto: 'Cadastre produtos no menu <strong>Cadastros → Produtos</strong> para começar a vender. Você pode importar depois também.',
      btn: 'Ir para Produtos'
    },
    {
      icon: 'fa-cash-register',
      titulo: 'PDV pronto para usar',
      texto: 'Use o <strong>PDV</strong> para registrar vendas rapidamente. Funciona no celular, tablet e computador.',
      btn: 'Ir para o PDV'
    },
    {
      icon: 'fa-circle-check',
      titulo: 'Tudo pronto!',
      texto: 'Seu sistema está configurado. Explore os módulos no menu lateral. Em caso de dúvida, acesse <strong>Ajuda</strong> a qualquer momento.',
      btn: 'Ir para o Dashboard'
    }
  ];

  let currentStep = 0;

  function renderStep() {
    const s = steps[currentStep];
    const isLast = currentStep === steps.length - 1;
    wizard.innerHTML = `
      <div style="background:var(--surface);border-radius:20px;padding:32px;max-width:480px;width:100%;box-shadow:0 30px 60px rgba(0,0,0,.3);text-align:center">
        <div style="width:64px;height:64px;border-radius:50%;background:var(--primary-soft,rgba(37,99,235,.12));color:var(--primary);font-size:1.8rem;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <i class="fa-solid ${s.icon}"></i>
        </div>
        <h3 style="font-size:1.25rem;font-weight:800;margin:0 0 10px">${s.titulo}</h3>
        <p style="color:var(--text-muted);font-size:.95rem;margin:0 0 24px;line-height:1.6">${s.texto}</p>
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:20px">
          ${steps.map((_, i) => `<div style="width:${i===currentStep?24:8}px;height:8px;border-radius:999px;background:${i===currentStep?'var(--primary)':'var(--border)'};transition:all .2s"></div>`).join('')}
        </div>
        <div style="display:flex;gap:10px;justify-content:center">
          ${currentStep > 0 ? `<button id="_wzVoltar" class="btn-cancel">Voltar</button>` : ''}
          <button id="_wzProximo" class="btn-confirm" style="font-size:14px;padding:10px 24px">
            ${isLast ? `<i class="fa-solid fa-check"></i> ` : ''}${s.btn}
          </button>
        </div>
        <button id="_wzPular" style="margin-top:14px;background:none;border:none;color:var(--text-muted);font-size:13px;cursor:pointer;text-decoration:underline;display:block;margin-inline:auto">Pular tutorial</button>
      </div>`;

    document.getElementById('_wzProximo')?.addEventListener('click', async () => {
      if (currentStep === steps.length - 1) {
        wizard.remove();
        return;
      }
      currentStep++;
      renderStep();
      // Navega para a view relevante ao avançar
      if (currentStep === 1) await setActiveView('produtos');
      if (currentStep === 2) await setActiveView('pdv');
      if (currentStep === 3) await setActiveView('dashboard');
    });

    document.getElementById('_wzVoltar')?.addEventListener('click', () => {
      currentStep--;
      renderStep();
    });

    document.getElementById('_wzPular')?.addEventListener('click', () => wizard.remove());
  }

  renderStep();
  document.body.appendChild(wizard);
}

// Registro do Service Worker (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
