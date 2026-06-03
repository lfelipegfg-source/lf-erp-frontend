const API_CONFIG = {
  BASE_URL:
    window.LF_ERP_API_URL ||
    localStorage.getItem('lf_erp_api_url') ||
    'https://lf-erp-backend.onrender.com',
  TIMEOUT: 20000,
  STORAGE_KEY: 'lf_erp_auth'
};

function getStoredAuth() {
  try {
    const localAuth = localStorage.getItem(API_CONFIG.STORAGE_KEY);
    const sessionAuth = sessionStorage.getItem(API_CONFIG.STORAGE_KEY);
    const raw = localAuth || sessionAuth;

    if (!raw) return null;

    return JSON.parse(raw);
  } catch (error) {
    console.warn('Não foi possível ler a autenticação salva.', error);
    return null;
  }
}

function getAuthToken() {
  const auth = getStoredAuth();
  return auth?.authToken || auth?.token || null;
}

function getEmpresaNome() {
  const auth = getStoredAuth();

  return (
    auth?.empresa?.nome ||
    auth?.empresa_nome ||
    auth?.user?.empresa ||
    auth?.user?.empresa_nome ||
    null
  );
}

function getEmpresaId() {
  const auth = getStoredAuth();

  return (
    auth?.empresa?.id ||
    auth?.empresaId ||
    auth?.empresa_id ||
    auth?.user?.empresa_id ||
    auth?.user?.empresaId ||
    null
  );
}

function buildHeaders(customHeaders = {}) {
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...customHeaders
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function buildUrl(path, query = {}) {
  const cleanBase = API_CONFIG.BASE_URL.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${cleanBase}${cleanPath}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.append(key, value);
  });

  return url.toString();
}

async function withTimeout(promise, timeout = API_CONFIG.TIMEOUT) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('A requisição demorou demais para responder.'));
    }, timeout);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  let payload = null;

  try {
    payload = isJson ? await response.json() : await response.text();
  } catch (error) {
    payload = null;
  }

  // 🔴 TRATAMENTO DE ERRO PADRONIZADO
  if (!response.ok) {
    const message =
      payload?.erro ||
      payload?.message ||
      (typeof payload === 'string' && payload) ||
      `Erro HTTP ${response.status}`;

    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  // 🟢 NOVO PADRÃO SAAS (AUTOMÁTICO)
  if (payload && typeof payload === 'object') {
    if (payload.sucesso === false) {
      const error = new Error(payload.erro || 'Erro na operação');
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    if (payload.sucesso === true) {
      return payload.dados !== undefined ? payload.dados : payload;
    }
  }

  // fallback (compatibilidade total)
  return payload;
}

async function request(path, options = {}) {
  const { method = 'GET', body, headers = {}, query = {}, timeout = API_CONFIG.TIMEOUT } = options;

  const url = buildUrl(path, query);

  const fetchOptions = {
    method,
    headers: buildHeaders(headers)
  };

  if (body !== undefined && body !== null) {
    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  try {
    const response = await withTimeout(fetch(url, fetchOptions), timeout);
    return parseResponse(response);
  } catch (error) {
    if (typeof window !== 'undefined' && window.showToast) {
      const message = error?.message || 'Erro na requisição.';
      window.showToast(message, 'error');
    }

    throw error;
  }
}

function normalizeLoginResponse(data) {
  const empresaId =
    data?.empresa?.id ||
    data?.empresaId ||
    data?.empresa_id ||
    data?.user?.empresa_id ||
    data?.usuario?.empresa_id ||
    null;

  const empresaNome =
    data?.empresa?.nome ||
    data?.empresa_nome ||
    data?.user?.empresa ||
    data?.user?.empresa_nome ||
    null;

  return {
    authToken: data?.authToken || data?.token || data?.accessToken || data?.access_token || null,
    empresaId,
    empresa:
      empresaNome || empresaId
        ? {
            id: empresaId,
            nome: empresaNome
          }
        : null,
    user: data?.user ||
      data?.usuario || {
        nome: data?.nome || 'Usuário',
        perfil: data?.perfil || 'Usuário',
        empresa: empresaNome,
        empresa_id: empresaId
      }
  };
}

async function login(usuario, senha) {
  const response = await request('/login', {
    method: 'POST',
    body: { usuario, senha }
  });

  return normalizeLoginResponse(response);
}

async function validateSession() {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Sessão não encontrada.');
  }

  return request('/me', {
    method: 'GET'
  });
}

function ensureEmpresa() {
  const empresa = getEmpresaNome();

  if (!empresa) {
    throw new Error('Empresa da sessão não encontrada.');
  }

  return encodeURIComponent(empresa);
}

function ensureEmpresaId() {
  const empresaId = getEmpresaId();

  if (!empresaId) {
    throw new Error('Empresa ID da sessão não encontrada.');
  }

  return empresaId;
}

async function fetchAPI(path, method = 'GET', body = null, query = {}) {
  return request(path, {
    method,
    body,
    query
  });
}

async function getDashboard(params = {}) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request('/dashboard', {
    method: 'GET',
    query: {
      empresa,
      empresa_id: empresaId,
      ...params
    }
  });
}

async function getEmpresaStatus() {
  return request('/empresa/status', {
    method: 'GET'
  });
}

async function getAlertas() {
  const empresa = ensureEmpresa();
  return request(`/alertas/${empresa}`, { method: 'GET' });
}

async function updateMePerfil(payload) {
  return request('/me/perfil', { method: 'PUT', body: payload });
}

async function getProdutos(params = {}) {
  const empresa = ensureEmpresa();

  return request(`/produtos/${empresa}`, {
    method: 'GET',
    query: {
      ...params
    }
  });
}

async function createProduto(payload) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request('/produtos', {
    method: 'POST',
    body: {
      ...payload,
      empresa,
      empresa_id: empresaId
    }
  });
}

async function updateProduto(id, payload) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request(`/produtos/${id}`, {
    method: 'PUT',
    body: {
      ...payload,
      empresa,
      empresa_id: empresaId
    }
  });
}

async function deleteProduto(id) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request(`/produtos/${id}`, {
    method: 'DELETE',
    query: {
      empresa,
      empresa_id: empresaId
    }
  });
}

// ── GRADES ───────────────────────────────────────────────────────────────────

async function getGradesProduto(produtoId) {
  return request(`/grades/produto/${produtoId}`);
}

async function createGrade(produtoId, data) {
  return request(`/grades/produto/${produtoId}`, { method: 'POST', body: data });
}

async function updateGrade(gradeId, data) {
  return request(`/grades/${gradeId}`, { method: 'PUT', body: data });
}

async function deleteGrade(gradeId) {
  return request(`/grades/${gradeId}`, { method: 'DELETE' });
}

async function toggleGrade(produtoId) {
  return request(`/grades/produto/${produtoId}/toggle`, { method: 'PATCH' });
}

async function getAtributos() {
  return request('/grades/atributos');
}

// ── TABELAS DE PREÇO ─────────────────────────────────────────────────────────

async function getTabelaPrecosDashboard() {
  return request('/tabelas-preco/dashboard', { method: 'GET' });
}

async function resolverPrecoTabela({ produtoId, clienteId = null, gradeId = null, quantidade = 1 }) {
  const q = { produto_id: produtoId, quantidade };
  if (clienteId) q.cliente_id = clienteId;
  if (gradeId) q.grade_id = gradeId;
  return request('/tabelas-preco/resolver', { method: 'GET', query: q });
}

// ── KITS ─────────────────────────────────────────────────────────────────────

async function getKitComponentes(produtoId) {
  return request(`/kits/produto/${produtoId}/componentes`);
}

async function addKitComponente(produtoId, data) {
  return request(`/kits/produto/${produtoId}/componentes`, { method: 'POST', body: data });
}

async function updateKitComponente(produtoId, compId, data) {
  return request(`/kits/produto/${produtoId}/componentes/${compId}`, { method: 'PUT', body: data });
}

async function deleteKitComponente(produtoId, compId) {
  return request(`/kits/produto/${produtoId}/componentes/${compId}`, { method: 'DELETE' });
}

async function toggleKit(produtoId) {
  return request(`/kits/produto/${produtoId}/toggle`, { method: 'PATCH' });
}

async function getEstoqueKit(produtoId) {
  return request(`/kits/produto/${produtoId}/estoque`);
}

// ── IMAGENS ───────────────────────────────────────────────────────────────────

async function getImagensProduto(produtoId) {
  return request(`/imagens/produto/${produtoId}`);
}

async function uploadImagemProduto(produtoId, file) {
  const token = getAuthToken();
  const url   = buildUrl(`/imagens/produto/${produtoId}`);
  const form  = new FormData();
  form.append('imagem', file);

  const res = await withTimeout(
    fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
  );
  return parseResponse(res);
}

async function setPrincipalImagem(imagemId) {
  return request(`/imagens/${imagemId}/principal`, { method: 'PATCH' });
}

async function updateOrdemImagem(imagemId, ordem) {
  return request(`/imagens/${imagemId}/ordem`, { method: 'PUT', body: { ordem } });
}

async function deletarImagem(imagemId) {
  return request(`/imagens/${imagemId}`, { method: 'DELETE' });
}

async function getClientes(params = {}) {
  const empresa = ensureEmpresa();

  return request(`/clientes/${empresa}`, {
    method: 'GET',
    query: {
      ...params
    }
  });
}

async function createCliente(payload) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request('/clientes', {
    method: 'POST',
    body: {
      ...payload,
      empresa,
      empresa_id: empresaId
    }
  });
}

async function updateCliente(id, payload) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request(`/clientes/${id}`, {
    method: 'PUT',
    body: {
      ...payload,
      empresa,
      empresa_id: empresaId
    }
  });
}

async function deleteCliente(id) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request(`/clientes/${id}`, {
    method: 'DELETE',
    query: {
      empresa,
      empresa_id: empresaId
    }
  });
}

async function getFornecedores(params = {}) {
  const empresa = ensureEmpresa();

  return request(`/fornecedores/${empresa}`, {
    method: 'GET',
    query: {
      ...params
    }
  });
}

async function createFornecedor(payload) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request('/fornecedores', {
    method: 'POST',
    body: {
      ...payload,
      empresa,
      empresa_id: empresaId
    }
  });
}

async function updateFornecedor(id, payload) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request(`/fornecedores/${id}`, {
    method: 'PUT',
    body: {
      ...payload,
      empresa,
      empresa_id: empresaId
    }
  });
}

async function deleteFornecedor(id) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request(`/fornecedores/${id}`, {
    method: 'DELETE',
    query: {
      empresa,
      empresa_id: empresaId
    }
  });
}

async function getUsuarios(params = {}) {
  const empresa = ensureEmpresa();

  return request(`/usuarios/${empresa}`, {
    method: 'GET',
    query: {
      ...params
    }
  });
}

async function createUsuario(payload) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request('/usuarios', {
    method: 'POST',
    body: {
      ...payload,
      empresa,
      empresa_id: empresaId
    }
  });
}

async function updateUsuario(id, payload) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request(`/usuarios/${id}`, {
    method: 'PUT',
    body: {
      ...payload,
      empresa,
      empresa_id: empresaId
    }
  });
}

async function deleteUsuario(id) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request(`/usuarios/${id}`, {
    method: 'DELETE',
    query: {
      empresa,
      empresa_id: empresaId
    }
  });
}

async function getVendas(params = {}) {
  const empresa = ensureEmpresa();

  return request(`/vendas/${empresa}`, {
    method: 'GET',
    query: {
      ...params
    }
  });
}

async function getVendaDetalhe(id) {
  return request(`/vendas/detalhe/${id}`, {
    method: 'GET'
  });
}

async function createVenda(payload) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request('/vendas', {
    method: 'POST',
    body: {
      ...payload,
      empresa,
      empresa_id: empresaId
    }
  });
}

async function updateVenda(id, payload) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request(`/vendas/${id}`, {
    method: 'PUT',
    body: {
      ...payload,
      empresa,
      empresa_id: empresaId
    }
  });
}

async function updateVendaObservacao(id, observacao) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request(`/vendas/${id}/observacao`, {
    method: 'PATCH',
    body: {
      empresa,
      empresa_id: empresaId,
      observacao
    }
  });
}

async function getCompras(params = {}) {
  const empresa = ensureEmpresa();

  return request(`/compras/${empresa}`, {
    method: 'GET',
    query: {
      ...params
    }
  });
}

async function getCompraDetalhe(id) {
  return request(`/compras-detalhe/${id}`, {
    method: 'GET'
  });
}

async function createCompra(payload) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request('/compras', {
    method: 'POST',
    body: {
      ...payload,
      empresa,
      empresa_id: empresaId
    }
  });
}

async function updateCompra(id, payload) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request(`/compras/${id}`, {
    method: 'PUT',
    body: {
      ...payload,
      empresa,
      empresa_id: empresaId
    }
  });
}

async function deleteCompra(id) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request(`/compras/${id}`, {
    method: 'DELETE',
    query: {
      empresa,
      empresa_id: empresaId
    }
  });
}

async function getContasReceber(params = {}) {
  const empresa = ensureEmpresa();

  return request(`/contas-receber/${empresa}`, {
    method: 'GET',
    query: {
      ...params
    }
  });
}

async function getHistoricoFinanceiroCliente(clienteId) {
  return request(`/contas-receber/cliente-historico/${clienteId}`, {
    method: 'GET'
  });
}

async function getContaReceberDetalhe(id) {
  return request(`/contas-receber/detalhe/${id}`, {
    method: 'GET'
  });
}

async function getContasReceberClientes() {
  const empresa = ensureEmpresa();

  return request(`/contas-receber-clientes/${empresa}`, {
    method: 'GET'
  });
}

async function baixarContaReceber(id, payload = {}) {
  return request(`/contas-receber/pagar/${id}`, {
    method: 'POST',
    body: payload
  });
}

async function estornarContaReceber(id, payload = {}) {
  return request(`/contas-receber/estornar/${id}`, {
    method: 'POST',
    body: payload
  });
}

async function getOrigemVendaContaReceber(id) {
  return request(`/contas-receber/origem-venda/${id}`, {
    method: 'GET'
  });
}

async function getContasPagar(params = {}) {
  const empresa = ensureEmpresa();

  return request(`/contas-pagar/${empresa}`, {
    method: 'GET',
    query: {
      ...params
    }
  });
}

async function getContaPagarDetalhe(id) {
  return request(`/contas-pagar/detalhe/${id}`, {
    method: 'GET'
  });
}

async function getContasPagarFornecedores() {
  const empresa = ensureEmpresa();

  return request(`/contas-pagar-fornecedores/${empresa}`, {
    method: 'GET'
  });
}

async function pagarContaPagar(id, payload = {}) {
  return request(`/contas-pagar/pagar/${id}`, {
    method: 'POST',
    body: payload
  });
}

async function getOrigemCompraContaPagar(id) {
  return request(`/contas-pagar/origem-compra/${id}`, {
    method: 'GET'
  });
}

async function getFluxoCaixa(params = {}) {
  const empresa = ensureEmpresa();

  return request(`/financeiro/fluxo-caixa/${empresa}`, {
    method: 'GET',
    query: {
      ...params
    }
  });
}

async function getLancamentosFinanceiros(params = {}) {
  const empresa = ensureEmpresa();

  return request(`/financeiro/lancamentos/${empresa}`, {
    method: 'GET',
    query: {
      ...params
    }
  });
}

async function getLancamentoFinanceiroDetalhe(id) {
  return request(`/financeiro/lancamentos-detalhe/${id}`, {
    method: 'GET'
  });
}

async function createLancamentoFinanceiro(payload) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();

  return request('/financeiro/lancamentos', {
    method: 'POST',
    body: {
      ...payload,
      empresa,
      empresa_id: empresaId
    }
  });
}

async function updateLancamentoFinanceiro(id, payload) {
  return request(`/financeiro/lancamentos/${id}`, {
    method: 'PUT',
    body: payload
  });
}

async function pagarLancamentoFinanceiro(id, payload = {}) {
  return request(`/financeiro/lancamentos/pagar/${id}`, {
    method: 'POST',
    body: payload
  });
}

async function deleteLancamentoFinanceiro(id) {
  return request(`/financeiro/lancamentos/${id}`, {
    method: 'DELETE'
  });
}

async function getRelatorios(params = {}) {
  const empresa = ensureEmpresa();

  return request(`/relatorios/${empresa}`, {
    method: 'GET',
    query: {
      ...params
    }
  });
}

async function getRelatorioFinanceiroResumo(params = {}) {
  const empresa = ensureEmpresa();

  return request(`/relatorios/financeiro/resumo/${empresa}`, {
    method: 'GET',
    query: {
      ...params
    }
  });
}

async function getRelatorioFinanceiroContasReceber(params = {}) {
  const empresa = ensureEmpresa();

  return request(`/relatorios/financeiro/contas-receber/${empresa}`, {
    method: 'GET',
    query: {
      ...params
    }
  });
}

async function getRelatorioFinanceiroContasPagar(params = {}) {
  const empresa = ensureEmpresa();

  return request(`/relatorios/financeiro/contas-pagar/${empresa}`, {
    method: 'GET',
    query: {
      ...params
    }
  });
}

async function getRelatorioFinanceiroFluxoCaixa(params = {}) {
  const empresa = ensureEmpresa();

  return request(`/relatorios/financeiro/fluxo-caixa/${empresa}`, {
    method: 'GET',
    query: {
      ...params
    }
  });
}

async function getRelatorioFinanceiroLucratividade(params = {}) {
  const empresa = ensureEmpresa();

  return request(`/relatorios/financeiro/lucratividade/${empresa}`, {
    method: 'GET',
    query: {
      ...params
    }
  });
}

async function getRelatorioVendasPorGrade(params = {}) {
  const empresa = ensureEmpresa();

  return request(`/relatorios/vendas/por-grade/${empresa}`, {
    method: 'GET',
    query: { ...params }
  });
}

async function getRelatorioDRE(params = {}) {
  const empresa = ensureEmpresa();

  return request(`/relatorios/dre/${empresa}`, {
    method: 'GET',
    query: { ...params }
  });
}

// ── NF-e ─────────────────────────────────────────────────────────────────────

async function getNfeConfig() {
  return request('/nfe/config', { method: 'GET' });
}

async function salvarNfeConfig(payload) {
  return request('/nfe/config', { method: 'PUT', body: payload });
}

async function emitirNfe(vendaId) {
  return request(`/nfe/emitir/${vendaId}`, { method: 'POST', body: {} });
}

async function consultarNfe(ref) {
  return request(`/nfe/consultar/${encodeURIComponent(ref)}`, { method: 'GET' });
}

async function cancelarNfe(nfeId, justificativa) {
  return request(`/nfe/cancelar/${nfeId}`, { method: 'POST', body: { justificativa } });
}

async function getNfeLista(params = {}) {
  return request('/nfe/lista', { method: 'GET', query: params });
}

async function downloadNfePdf(ref) {
  const token = getAuthToken();
  const url = buildUrl(`/nfe/pdf/${encodeURIComponent(ref)}`);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('DANFE não disponível');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

async function downloadNfeXml(ref) {
  const token = getAuthToken();
  const url = buildUrl(`/nfe/xml/${encodeURIComponent(ref)}`);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('XML não disponível');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ── ORÇAMENTOS ───────────────────────────────────────────────────────────────

async function getOrcamentos(params = {}) {
  return request('/orcamentos', { method: 'GET', query: params });
}

async function getOrcamento(id) {
  return request(`/orcamentos/${id}`, { method: 'GET' });
}

async function createOrcamento(payload) {
  const empresa = getEmpresaNome();
  const empresaId = getEmpresaId();
  return request('/orcamentos', { method: 'POST', body: { ...payload, empresa, empresa_id: empresaId } });
}

async function enviarOrcamento(id) {
  return request(`/orcamentos/${id}/enviar`, { method: 'POST', body: {} });
}

async function aprovarOrcamento(id) {
  return request(`/orcamentos/${id}/aprovar`, { method: 'POST', body: {} });
}

async function recusarOrcamento(id) {
  return request(`/orcamentos/${id}/recusar`, { method: 'POST', body: {} });
}

async function converterOrcamentoPedido(id, payload = {}) {
  return request(`/orcamentos/${id}/converter`, { method: 'POST', body: payload });
}

async function deleteOrcamento(id) {
  return request(`/orcamentos/${id}`, { method: 'DELETE' });
}

// ── PORTAL DO CLIENTE (admin) ─────────────────────────────────────────────────

async function configurarPortalCliente(clienteId, senha) {
  return request(`/portal/admin/clientes/${clienteId}/senha`, { method: 'POST', body: { senha } });
}

async function togglePortalCliente(clienteId) {
  return request(`/portal/admin/clientes/${clienteId}/toggle`, { method: 'PATCH' });
}

// ── PEDIDOS ──────────────────────────────────────────────────────────────────

async function getPedidos(params = {}) {
  return request('/pedidos', { method: 'GET', query: params });
}

async function getPedido(id) {
  return request(`/pedidos/${id}`, { method: 'GET' });
}

async function confirmarPedido(id) {
  return request(`/pedidos/${id}/confirmar`, { method: 'POST', body: {} });
}

async function separacaoPedido(id) {
  return request(`/pedidos/${id}/separacao`, { method: 'POST', body: {} });
}

async function cancelarPedido(id) {
  return request(`/pedidos/${id}/cancelar`, { method: 'POST', body: {} });
}

async function converterPedidoVenda(id, payload = {}) {
  return request(`/pedidos/${id}/converter-venda`, { method: 'POST', body: payload });
}

function setApiBaseUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Informe uma URL válida para a API.');
  }

  localStorage.setItem('lf_erp_api_url', url.trim());
  API_CONFIG.BASE_URL = url.trim();
}

function getApiBaseUrl() {
  return API_CONFIG.BASE_URL;
}

function clearApiBaseUrl() {
  localStorage.removeItem('lf_erp_api_url');
  API_CONFIG.BASE_URL = 'https://lf-erp-backend.onrender.com';
}

const api = {
  config: API_CONFIG,
  request,
  fetchAPI,
  login,
  validateSession,
  getDashboard,
  getEmpresaStatus,
  getAlertas,
  updateMePerfil,

  getProdutos,
  createProduto,
  updateProduto,
  deleteProduto,

  getGradesProduto,
  createGrade,
  updateGrade,
  deleteGrade,
  toggleGrade,
  getAtributos,
  getTabelaPrecosDashboard,
  resolverPrecoTabela,

  getKitComponentes,
  addKitComponente,
  updateKitComponente,
  deleteKitComponente,
  toggleKit,
  getEstoqueKit,

  getImagensProduto,
  uploadImagemProduto,
  setPrincipalImagem,
  updateOrdemImagem,
  deletarImagem,

  getClientes,
  createCliente,
  updateCliente,
  deleteCliente,

  getFornecedores,
  createFornecedor,
  updateFornecedor,
  deleteFornecedor,

  getUsuarios,
  createUsuario,
  updateUsuario,
  deleteUsuario,

  getVendas,
  getVendaDetalhe,
  createVenda,
  updateVenda,
  updateVendaObservacao,

  getCompras,
  getCompraDetalhe,
  createCompra,
  updateCompra,
  deleteCompra,

  getContasReceber,
  getHistoricoFinanceiroCliente,
  getContaReceberDetalhe,
  getContasReceberClientes,
  baixarContaReceber,
  estornarContaReceber,
  getOrigemVendaContaReceber,

  getContasPagar,
  getContaPagarDetalhe,
  getContasPagarFornecedores,
  pagarContaPagar,
  getOrigemCompraContaPagar,

  getFluxoCaixa,

  getLancamentosFinanceiros,
  getLancamentoFinanceiroDetalhe,
  createLancamentoFinanceiro,
  updateLancamentoFinanceiro,
  pagarLancamentoFinanceiro,
  deleteLancamentoFinanceiro,

  getRelatorios,
  getRelatorioFinanceiroResumo,
  getRelatorioFinanceiroContasReceber,
  getRelatorioFinanceiroContasPagar,
  getRelatorioFinanceiroFluxoCaixa,
  getRelatorioFinanceiroLucratividade,
  getRelatorioVendasPorGrade,
  getRelatorioDRE,

  getNfeConfig,
  salvarNfeConfig,
  emitirNfe,
  consultarNfe,
  cancelarNfe,
  getNfeLista,
  downloadNfePdf,
  downloadNfeXml,

  getOrcamentos,
  getOrcamento,
  createOrcamento,
  enviarOrcamento,
  aprovarOrcamento,
  recusarOrcamento,
  converterOrcamentoPedido,
  deleteOrcamento,
  configurarPortalCliente,
  togglePortalCliente,

  getPedidos,
  getPedido,
  confirmarPedido,
  separacaoPedido,
  cancelarPedido,
  converterPedidoVenda,

  getAuthToken,
  getEmpresaId,
  getEmpresaNome,
  ensureEmpresa,
  ensureEmpresaId,
  getApiBaseUrl,
  setApiBaseUrl,
  clearApiBaseUrl,

  formatPlanError
};

window.LfErpApi = api;

function formatPlanError(error) {
  const message = error?.message || '';

  const isPlanError =
    error?.status === 403 &&
    (message.toLowerCase().includes('limite') ||
      message.toLowerCase().includes('plano') ||
      message.toLowerCase().includes('assinatura') ||
      message.toLowerCase().includes('trial') ||
      message.toLowerCase().includes('bloqueada'));

  if (!isPlanError) {
    return message || 'Não foi possível concluir a operação.';
  }

  return `${message} Para continuar, avalie alterar o plano da empresa.`;
}

export default api;
