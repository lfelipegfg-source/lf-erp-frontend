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
import { login as authLogin, logout as authLogout, getAuth, validateSession } from './auth.js';

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
  relatorios: { title: 'Relatórios', subtitle: 'Relatórios gerenciais e operacionais' },
  orcamentos: { title: 'Orçamentos', subtitle: 'Cotações emitidas — gerencie aprovações e converta em pedidos' },
  pedidos: { title: 'Pedidos', subtitle: 'Pedidos em andamento — confirme, separe e converta em venda' },
  comissoes: { title: 'Comissões', subtitle: 'Comissões de vendedores por venda realizada' },
  caixa: { title: 'Caixa', subtitle: 'Abertura, movimentações e fechamento do caixa físico' },
  devolucoes: { title: 'Devoluções', subtitle: 'Devoluções de vendas — estoque restaurado automaticamente' },
  alertas: { title: 'Alertas de Cobrança', subtitle: 'Lembretes de pagamento por email e WhatsApp' },
  nfe: { title: 'NF-e', subtitle: 'Emissão, consulta e cancelamento de Notas Fiscais Eletrônicas' },
  configuracoes: { title: 'Configurações', subtitle: 'Parâmetros e preferências do sistema' }
};

document.addEventListener('DOMContentLoaded', () => {
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
    mobileSidebarBtn.addEventListener('click', openMobileSidebar);
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
}

function bindTopbarEvents() {
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
  if (!sidebar) return;

  if (AppState.sidebarCollapsed) {
    const parentView = getParentViewFromChild(AppState.currentView);

    if (parentView) {
      AppState.sidebarCollapsed = false;
      sidebar.classList.remove('collapsed');
      sidebar.classList.add('expanded');
      await setActiveView(parentView);
      return;
    }

    AppState.sidebarCollapsed = false;
    sidebar.classList.remove('collapsed');
    sidebar.classList.add('expanded');
    return;
  }

  AppState.sidebarCollapsed = true;
  sidebar.classList.add('collapsed');
  sidebar.classList.remove('expanded');

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
    cadastros: ['produtos', 'clientes', 'fornecedores', 'usuarios'],
    movimentacoes: ['vendas', 'compras', 'estoque'],
    financeiro: ['contas-receber', 'contas-pagar', 'fluxo-caixa', 'lancamentos']
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
  if (adminLink && AppState.user?.tipo === 'admin') {
    adminLink.style.display = 'block';
  }
}

function renderTrialBanner() {
  const banner = document.getElementById('trialBanner');
  if (!banner) return;

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

// Registro do Service Worker (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
