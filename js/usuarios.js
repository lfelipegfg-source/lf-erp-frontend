import api from './api.js';
import { getAuth } from './auth.js';

const UsuariosModule = {
  state: {
    items: [],
    filteredItems: [],
    empresa: null,
    editingId: null,
    initialized: false,
    eventsBound: false,
    loading: false
  },

  init() {
    this.resolveEmpresa();

    if (!this.state.initialized) {
      this.state.initialized = true;
      this.render();
      this.cache();
      this.bind();
    } else {
      this.cache();
    }
  },

  resolveEmpresa() {
    const auth = getAuth();
    this.state.empresa = auth?.empresa?.nome || auth?.user?.empresa || 'LF ERP';
  },

  cache() {
    this.el = {
      container: document.getElementById('usuariosContainer'),
      table: document.getElementById('usuariosTable'),
      search: document.getElementById('usuariosSearch'),
      modal: document.getElementById('usuarioModal'),
      form: document.getElementById('usuarioForm'),
      nome: document.getElementById('usuarioNome'),
      usuario: document.getElementById('usuarioLogin'),
      senha: document.getElementById('usuarioSenha'),
      tipo: document.getElementById('usuarioTipo'),
      feedback: document.getElementById('usuariosFeedback'),
      modalTitle: document.getElementById('usuarioModalTitle')
    };
  },

  bind() {
    if (this.state.eventsBound) return;
    this.state.eventsBound = true;

    document.addEventListener('input', (e) => {
      if (e.target.id === 'usuariosSearch') {
        this.search(e.target.value);
      }
      if (e.target.id === 'usuarioSenha') {
        this.atualizarMedidorSenha(e.target.value);
      }
    });

    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      if (btn.id === 'novoUsuarioBtn') {
        this.openModal(false);
      }

      if (btn.id === 'cancelUsuario' || btn.id === 'cancelUsuarioFooter') {
        this.closeModal();
      }

      if (btn.dataset.action === 'edit-usuario') {
        this.edit(btn.dataset.id);
      }

      if (btn.dataset.action === 'delete-usuario') {
        await this.delete(btn.dataset.id);
      }
    });

    document.addEventListener('submit', async (e) => {
      if (e.target.id === 'usuarioForm') {
        e.preventDefault();
        await this.save();
      }
    });
  },

  async load() {
    this.resolveEmpresa();
    this.state.loading = true;
    this.setFeedback('Carregando usuários...', 'info');

    try {
      const data = await fetchAPI(`/usuarios/${encodeURIComponent(this.state.empresa)}`);
      this.state.items = Array.isArray(data) ? data : [];
      this.state.filteredItems = [...this.state.items];

      this.render();
      this.cache();
      this.renderTable();
      this.setFeedback('', '');
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      this.state.items = [];
      this.state.filteredItems = [];

      this.render();
      this.cache();
      this.renderTable();
      this.setFeedback(error.message || 'Erro ao carregar usuários.', 'error');
    } finally {
      this.state.loading = false;
    }
  },

  render() {
    const c = document.getElementById('usuariosContainer');
    if (!c) return;

    c.innerHTML = `
      <section class="module-card">
        <div id="usuariosFeedback" class="module-feedback"></div>

        <div class="module-card__header">
          <div>
            <h3>Usuários</h3>
            <p>Gestão de acessos, perfis e permissões do sistema</p>
          </div>

          <div class="module-card__actions">
            <button class="btn btn-primary" id="novoUsuarioBtn">
              <i class="fa-solid fa-plus"></i>
              Novo Usuário
            </button>
          </div>
        </div>

        <div class="module-toolbar">
          <div class="module-toolbar__search">
            <i class="fa-solid fa-search"></i>
            <input
              id="usuariosSearch"
              placeholder="Buscar por nome, login ou perfil..."
              value="${escapeHtml(this.getCurrentSearchValue())}"
            />
          </div>

          <div class="module-toolbar__stats">
            <div class="mini-stat">
              <span>Total</span>
              <strong>${this.state.filteredItems.length}</strong>
            </div>
          </div>
        </div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Login</th>
                <th>Perfil</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody id="usuariosTable"></tbody>
          </table>
        </div>
      </section>

      <div class="modal-overlay hidden" id="usuarioModal">
        <div class="modal-card">
          <div class="modal-card__header">
            <div>
              <h3 id="usuarioModalTitle">${this.state.editingId ? 'Editar usuário' : 'Novo usuário'}</h3>
              <p>Cadastre o acesso do colaborador ao sistema</p>
            </div>

            <button type="button" class="icon-button" id="cancelUsuario" aria-label="Fechar">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <form id="usuarioForm" class="form-grid">
            <div class="form-field form-field--span-2">
              <label for="usuarioNome">Nome</label>
              <input id="usuarioNome" required />
            </div>

            <div class="form-field">
              <label for="usuarioLogin">Login</label>
              <input id="usuarioLogin" required />
            </div>

            <div class="form-field">
              <label for="usuarioSenha">Senha</label>
              <input
                id="usuarioSenha"
                type="password"
                placeholder="${this.state.editingId ? 'Deixe em branco para manter a senha atual' : 'Informe a senha inicial'}"
              />
              <div id="senhaMedidor" class="senha-medidor hidden">
                <div class="senha-barra"><div id="senhaBarra" class="senha-barra__fill"></div></div>
                <span id="senhaLabel" class="senha-label"></span>
              </div>
            </div>

            <div class="form-field">
              <label for="usuarioTipo">Perfil</label>
              <select id="usuarioTipo" class="filter-input" required>
                <option value="admin">Admin</option>
                <option value="gerente">Gerente</option>
                <option value="funcionario">Funcionário</option>
              </select>
            </div>

            <div class="modal-card__footer">
              <button type="button" class="btn btn-light" id="cancelUsuarioFooter">
                Cancelar
              </button>
              <button type="submit" class="btn btn-primary">
                Salvar
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  renderTable() {
    if (!this.el.table) return;

    if (!this.state.filteredItems.length) {
      this.el.table.innerHTML = `
        <tr>
          <td colspan="4">
            <div class="module-feedback module-feedback--info" style="margin: 12px;">
              Nenhum usuário encontrado.
            </div>
          </td>
        </tr>
      `;
      return;
    }

    this.el.table.innerHTML = this.state.filteredItems
      .map(
        (u) => `
      <tr>
        <td>
          <div class="table-primary">
            <strong>${escapeHtml(u.nome || '-')}</strong>
            <small style="display:block; color: var(--text-muted); margin-top:4px;">
              ID: ${u.id}
            </small>
          </div>
        </td>

        <td>${escapeHtml(u.usuario || '-')}</td>

        <td>${formatTipo(u.tipo)}</td>

        <td class="text-right">
          <div class="table-actions">
            <button class="btn-inline" data-action="edit-usuario" data-id="${u.id}">
              Editar
            </button>
            <button class="btn-inline btn-inline--danger" data-action="delete-usuario" data-id="${u.id}">
              Excluir
            </button>
          </div>
        </td>
      </tr>
    `
      )
      .join('');
  },

  search(term) {
    const normalized = String(term || '')
      .trim()
      .toLowerCase();

    this.state.filteredItems = this.state.items.filter((item) => {
      const nome = String(item.nome || '').toLowerCase();
      const usuario = String(item.usuario || '').toLowerCase();
      const tipo = String(item.tipo || '').toLowerCase();

      return nome.includes(normalized) || usuario.includes(normalized) || tipo.includes(normalized);
    });

    this.renderTable();
  },

  getCurrentSearchValue() {
    const existingInput = document.getElementById('usuariosSearch');
    return existingInput?.value || '';
  },

  openModal(isEdit = false) {
    this.cache();

    if (!this.el.modal) return;

    this.el.modal.classList.remove('hidden');

    if (!isEdit) {
      this.state.editingId = null;
      this.el.form?.reset();

      if (this.el.tipo) {
        this.el.tipo.value = 'funcionario';
      }

      if (this.el.modalTitle) {
        this.el.modalTitle.textContent = 'Novo usuário';
      }
    } else if (this.el.modalTitle) {
      this.el.modalTitle.textContent = 'Editar usuário';
    }
  },

  atualizarMedidorSenha(senha) {
    const medidor = document.getElementById('senhaMedidor');
    const barra   = document.getElementById('senhaBarra');
    const label   = document.getElementById('senhaLabel');
    if (!medidor || !barra || !label) return;

    if (!senha) {
      medidor.classList.add('hidden');
      return;
    }

    medidor.classList.remove('hidden');

    const tem8    = senha.length >= 8;
    const temMaiu = /[A-Z]/.test(senha);
    const temNum  = /[0-9]/.test(senha);
    const temEsp  = /[^A-Za-z0-9]/.test(senha);
    const pontos  = [tem8, temMaiu, temNum, temEsp].filter(Boolean).length;

    barra.className = 'senha-barra__fill';
    if (pontos <= 1) {
      barra.classList.add('senha-barra__fill--fraco');
      label.textContent = 'Fraca';
      label.style.color = 'var(--danger, #e53e3e)';
    } else if (pontos === 2) {
      barra.classList.add('senha-barra__fill--medio');
      label.textContent = 'Média';
      label.style.color = '#d69e2e';
    } else {
      barra.classList.add('senha-barra__fill--forte');
      label.textContent = 'Forte';
      label.style.color = 'var(--success, #38a169)';
    }
  },

  closeModal() {
    this.cache();

    if (this.el.modal) {
      this.el.modal.classList.add('hidden');
    }

    this.state.editingId = null;
    this.el.form?.reset();
  },

  edit(id) {
    const usuario = this.state.items.find((item) => String(item.id) === String(id));
    if (!usuario) return;

    this.state.editingId = Number(id);
    this.openModal(true);

    this.cache();

    if (this.el.nome) this.el.nome.value = usuario.nome || '';
    if (this.el.usuario) this.el.usuario.value = usuario.usuario || '';
    if (this.el.senha) this.el.senha.value = '';
    if (this.el.tipo) this.el.tipo.value = usuario.tipo || 'funcionario';
  },

  async save() {
    this.cache();

    const payload = {
      empresa: this.state.empresa,
      nome: this.el.nome?.value?.trim() || '',
      usuario: this.el.usuario?.value?.trim() || '',
      tipo: this.el.tipo?.value || 'funcionario'
    };

    const senha = this.el.senha?.value?.trim() || '';
    if (senha) {
      payload.senha = senha;
    }

    if (!payload.nome || !payload.usuario || !payload.tipo) {
      this.setFeedback('Preencha os campos obrigatórios.', 'error');
      return;
    }

    if (!this.state.editingId && !payload.senha) {
      this.setFeedback('Informe a senha para o novo usuário.', 'error');
      return;
    }

    if (payload.senha) {
      const s = payload.senha;
      if (s.length < 8 || !/[A-Z]/.test(s) || !/[0-9]/.test(s)) {
        this.setFeedback('Senha fraca: use 8+ caracteres, 1 maiúscula e 1 número.', 'error');
        return;
      }
    }

    try {
      this.setFeedback(
        this.state.editingId ? 'Atualizando usuário...' : 'Salvando usuário...',
        'info'
      );

      if (this.state.editingId) {
        await fetchAPI(`/usuarios/${this.state.editingId}`, 'PUT', payload);
      } else {
        await fetchAPI(`/usuarios`, 'POST', payload);
      }

      this.closeModal();
      await this.load();
      this.setFeedback('Usuário salvo com sucesso.', 'success');
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      this.setFeedback(error.message || 'Erro ao salvar usuário.', 'error');
    }
  },

  async delete(id) {
    if (!confirm('Deseja realmente excluir este usuário?')) return;

    try {
      this.setFeedback('Excluindo usuário...', 'info');

      await fetchAPI(`/usuarios/${id}?empresa=${encodeURIComponent(this.state.empresa)}`, 'DELETE');

      await this.load();
      this.setFeedback('Usuário excluído com sucesso.', 'success');
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      this.setFeedback(error.message || 'Erro ao excluir usuário.', 'error');
    }
  },

  setFeedback(message, type = '') {
    const feedback = document.getElementById('usuariosFeedback');
    if (!feedback) return;

    feedback.className = 'module-feedback';

    if (!message) {
      feedback.innerHTML = '';
      return;
    }

    if (type === 'success') {
      feedback.classList.add('module-feedback--success');
    } else if (type === 'error') {
      feedback.classList.add('module-feedback--error');
    } else {
      feedback.classList.add('module-feedback--info');
    }

    feedback.textContent = message;
  }
};

function formatTipo(tipo) {
  const mapa = {
    admin: 'Admin',
    gerente: 'Gerente',
    funcionario: 'Funcionário'
  };

  return mapa[tipo] || tipo || '-';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function fetchAPI(path, method = 'GET', body) {
  const auth = getAuth();
  const token = auth?.authToken || auth?.token || '';
  const baseUrl = api.getApiBaseUrl();

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  let payload = null;

  try {
    payload = isJson ? await response.json() : await response.text();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      (typeof payload === 'object' && payload?.message) ||
      (typeof payload === 'object' && payload?.error) ||
      (typeof payload === 'string' && payload) ||
      'Erro na API de usuários';

    throw new Error(message);
  }

  return payload;
}

export async function initUsuariosModule() {
  UsuariosModule.init();
  await UsuariosModule.load();
}
