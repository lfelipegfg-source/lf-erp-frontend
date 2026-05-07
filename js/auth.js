import api from './api.js';

const AUTH_STORAGE_KEY = 'lf_erp_auth';

export function saveAuth(data, remember = false) {
  const empresaId =
    data?.empresa?.id || data?.empresaId || data?.empresa_id || data?.user?.empresa_id || null;

  const empresaNome =
    data?.empresa?.nome ||
    data?.empresa_nome ||
    data?.user?.empresa ||
    data?.user?.empresa_nome ||
    null;

  const payload = {
    authToken: data?.authToken || data?.token || null,
    empresaId,
    empresa: {
      id: empresaId,
      nome: empresaNome
    },
    user: {
      ...(data?.user || {}),
      empresa_id: empresaId,
      empresa: empresaNome
    }
  };

  if (remember) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } else {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export function getAuth() {
  try {
    const local = localStorage.getItem(AUTH_STORAGE_KEY);
    const session = sessionStorage.getItem(AUTH_STORAGE_KEY);
    const raw = local || session;

    if (!raw) return null;

    return JSON.parse(raw);
  } catch (error) {
    console.warn('Erro ao recuperar sessão', error);
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

export function isAuthenticated() {
  const auth = getAuth();
  return !!auth?.authToken;
}

export async function login(usuario, senha, remember = false) {
  const response = await api.login(usuario, senha);

  if (!response?.authToken && !response?.token) {
    throw new Error('Token não recebido do backend.');
  }

  saveAuth(response, remember);
  return response;
}

export async function validateSession() {
  try {
    return await api.validateSession();
  } catch (error) {
    clearAuth();
    throw error;
  }
}

export function logout() {
  clearAuth();
}
