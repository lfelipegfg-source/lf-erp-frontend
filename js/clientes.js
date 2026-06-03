import api from './api.js';
import { getAuth } from './auth.js';
import { showToast } from './feedback.js';
import { exportCSV } from './exportUtils.js';

const ClientesModule = {
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
      container: document.getElementById('clientesContainer'),
      table: document.getElementById('clientesTable'),
      search: document.getElementById('clientesSearch'),
      modal: document.getElementById('clienteModal'),
      form: document.getElementById('clienteForm'),
      nome: document.getElementById('clienteNome'),
      telefone: document.getElementById('clienteTelefone'),
      cpf: document.getElementById('clienteCpf'),
      nascimento: document.getElementById('clienteNascimento'),
      endereco: document.getElementById('clienteEndereco'),
      feedback: document.getElementById('clientesFeedback'),
      modalTitle: document.getElementById('clienteModalTitle')
    };
  },

  bind() {
    if (this.state.eventsBound) return;
    this.state.eventsBound = true;

    document.addEventListener('input', (e) => {
      if (e.target.id === 'clientesSearch') {
        this.search(e.target.value);
      }

      if (e.target.id === 'clienteCpf') {
        e.target.value = maskCPF(e.target.value);
      }

      if (e.target.id === 'clienteTelefone') {
        e.target.value = maskPhone(e.target.value);
      }
    });

    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      if (btn.id === 'exportarClientesBtn') {
        const lista = this.state.filteredItems.length
          ? this.state.filteredItems
          : this.state.items;
        exportCSV(lista.map((c) => ({
          'Nome':        c.nome || '',
          'Telefone':    c.telefone || '',
          'CPF/CNPJ':    c.cpf || c.cpf_cnpj || '',
          'Nascimento':  c.nascimento || '',
          'Endereco':    c.endereco || '',
          'Portal':      c.portal_ativo ? 'Sim' : 'Nao'
        })), 'clientes');
        return;
      }

      if (btn.id === 'novoClienteBtn') {
        this.openModal(false);
      }

      if (btn.id === 'cancelCliente' || btn.id === 'cancelClienteFooter') {
        this.closeModal();
      }

      if (btn.dataset.action === 'edit-cliente') {
        this.edit(btn.dataset.id);
      }

      if (btn.dataset.action === 'portal-cliente') {
        await this.configurarPortal(btn.dataset.id, btn.dataset.nome);
      }

      if (btn.dataset.action === 'delete-cliente') {
        await this.delete(btn.dataset.id);
      }
    });

    document.addEventListener('submit', async (e) => {
      if (e.target.id === 'clienteForm') {
        e.preventDefault();
        await this.save();
      }
    });
  },

  async load() {
    this.resolveEmpresa();
    this.state.loading = true;
    this.setFeedback('Carregando clientes...', 'info');
    this.setLoading(true);


    try {
      const data = await api.getClientes();
      this.state.items = Array.isArray(data) ? data : [];
      this.state.filteredItems = [...this.state.items];

      this.render();
      this.cache();
      this.renderTable();
      this.setFeedback('', '');
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.state.items = [];
      this.state.filteredItems = [];

      this.render();
      this.cache();
      this.renderTable();
      const message = this.buildFriendlyError(error);
      this.setFeedback(message, 'error');
    } finally {
      this.state.loading = false;
      this.setLoading(false);
    }
  },

  render() {
    const c = document.getElementById('clientesContainer');
    if (!c) return;

    c.innerHTML = `
      <section class="module-card">
        <div id="clientesFeedback" class="module-feedback"></div>

        <div class="module-card__header">
          <div>
            <h3>Clientes</h3>
            <p>Cadastro e relacionamento comercial</p>
          </div>

          <div class="module-card__actions">
            <button class="btn btn-light" id="exportarClientesBtn">
              <i class="fa-solid fa-file-csv"></i> Exportar CSV
            </button>
            <button class="btn btn-primary" id="novoClienteBtn">
              <i class="fa-solid fa-plus"></i>
              Novo Cliente
            </button>
          </div>
        </div>

        <div class="module-toolbar">
          <div class="module-toolbar__search">
            <i class="fa-solid fa-search"></i>
            <input
              id="clientesSearch"
              placeholder="Buscar por nome, CPF ou telefone..."
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
                <th>Telefone</th>
                <th>CPF</th>
                <th>Nascimento</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody id="clientesTable"></tbody>
          </table>
        </div>
      </section>

      <div class="modal-overlay hidden" id="clienteModal">
        <div class="modal-card">
          <div class="modal-card__header">
            <div>
              <h3 id="clienteModalTitle">${this.state.editingId ? 'Editar cliente' : 'Novo cliente'}</h3>
              <p>Cadastre os dados do cliente no sistema</p>
            </div>

            <button type="button" class="icon-button" id="cancelCliente" aria-label="Fechar">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <form id="clienteForm" class="form-grid">
            <div class="form-field form-field--span-2">
              <label for="clienteNome">Nome</label>
              <input id="clienteNome" required />
            </div>

            <div class="form-field">
              <label for="clienteTelefone">Telefone</label>
              <input id="clienteTelefone" placeholder="(88) 99999-9999" />
            </div>

            <div class="form-field">
              <label for="clienteCpf">CPF</label>
              <input id="clienteCpf" placeholder="000.000.000-00" />
            </div>

            <div class="form-field">
              <label for="clienteNascimento">Nascimento</label>
              <input id="clienteNascimento" type="date" />
            </div>

            <div class="form-field form-field--span-2">
              <label for="clienteEndereco">Endereço</label>
              <input id="clienteEndereco" />
            </div>

            <div class="modal-card__footer">
              <button type="button" class="btn btn-light" id="cancelClienteFooter">
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
          <td colspan="5">
            <div class="module-feedback module-feedback--info" style="margin: 12px;">
              Nenhum cliente encontrado.
            </div>
          </td>
        </tr>
      `;
      return;
    }

    this.el.table.innerHTML = this.state.filteredItems
      .map(
        (cliente) => `
      <tr>
        <td>
          <div class="table-primary">
            <strong>${escapeHtml(cliente.nome || '-')}</strong>
            <small style="display:block; color: var(--text-muted); margin-top:4px;">
              ID: ${cliente.id}
            </small>
          </div>
        </td>

        <td>${escapeHtml(cliente.telefone || '-')}</td>
        <td>${escapeHtml(cliente.cpf || '-')}</td>
        <td>${formatDate(cliente.nascimento)}</td>

        <td class="text-right">
          <div class="table-actions">
            <button class="btn-inline" data-action="edit-cliente" data-id="${cliente.id}">
              Editar
            </button>
            <button class="btn-inline ${cliente.portal_ativo ? 'btn-inline--active' : ''}" data-action="portal-cliente" data-id="${cliente.id}" data-nome="${escapeHtml(cliente.nome || '')}">
              <i class="fa-solid fa-globe"></i> Portal
            </button>
            <button class="btn-inline btn-inline--danger" data-action="delete-cliente" data-id="${cliente.id}">
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

    this.state.filteredItems = this.state.items.filter((cliente) => {
      const nome = String(cliente.nome || '').toLowerCase();
      const cpf = String(cliente.cpf || '').toLowerCase();
      const telefone = String(cliente.telefone || '').toLowerCase();

      return nome.includes(normalized) || cpf.includes(normalized) || telefone.includes(normalized);
    });

    this.renderTable();
  },

  getCurrentSearchValue() {
    const existingInput = document.getElementById('clientesSearch');
    return existingInput?.value || '';
  },

  openModal(isEdit = false) {
    this.cache();

    if (!this.el.modal) return;

    this.el.modal.classList.remove('hidden');

    if (!isEdit) {
      this.state.editingId = null;
      this.el.form?.reset();

      if (this.el.modalTitle) {
        this.el.modalTitle.textContent = 'Novo cliente';
      }
    } else if (this.el.modalTitle) {
      this.el.modalTitle.textContent = 'Editar cliente';
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
    const cliente = this.state.items.find((item) => String(item.id) === String(id));
    if (!cliente) return;

    this.state.editingId = Number(id);
    this.openModal(true);

    this.cache();

    if (this.el.nome) this.el.nome.value = cliente.nome || '';
    if (this.el.telefone) this.el.telefone.value = cliente.telefone || '';
    if (this.el.cpf) this.el.cpf.value = cliente.cpf || '';
    if (this.el.nascimento) this.el.nascimento.value = normalizeDateInput(cliente.nascimento);
    if (this.el.endereco) this.el.endereco.value = cliente.endereco || '';
  },

  async save() {
    this.cache();

    const payload = {
      empresa: this.state.empresa,
      nome: this.el.nome?.value?.trim() || '',
      telefone: this.el.telefone?.value?.trim() || '',
      cpf: this.el.cpf?.value?.trim() || '',
      nascimento: this.el.nascimento?.value || '',
      endereco: this.el.endereco?.value?.trim() || ''
    };

    if (!payload.nome) {
      this.setFeedback('Informe o nome do cliente.', 'error');
      return;
    }

    try {
      const message = this.state.editingId ? 'Atualizando cliente...' : 'Salvando cliente...';

      this.setFeedback(message, 'info');

      showToast(message, 'info');

      if (this.state.editingId) {
        await api.updateCliente(this.state.editingId, payload);
      } else {
        await api.createCliente(payload);
      }

      this.closeModal();
      await this.load();
      this.showMessage('Cliente salvo com sucesso.', 'success');
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      const message = this.buildFriendlyError(error);
      this.setFeedback(message, 'error');
    }
  },

  async delete(id) {
    if (!confirm('Deseja realmente excluir este cliente?')) return;

    try {
      this.setFeedback('Excluindo cliente...', 'info');

      showToast('Excluindo cliente...', 'info');

      await api.deleteCliente(id);

      await this.load();
      this.showMessage('Cliente excluído com sucesso.', 'success');
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      const message = this.buildFriendlyError(error);
      this.setFeedback(message, 'error');
    }
  },

  setFeedback(message, type = '') {
    const feedback = document.getElementById('clientesFeedback');
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
  },

  showMessage(message, type = 'info') {
    this.setFeedback(message, type);

    showToast(message, type);
  },

  setLoading(value) {
    this.state.loading = value;
    this.cache();

    if (this.el.search) this.el.search.disabled = value;

    const btnNovo = document.getElementById('novoClienteBtn');
    if (btnNovo) btnNovo.disabled = value;

    if (btnNovo) {
      btnNovo.innerHTML = value
        ? '<i class="fa-solid fa-spinner fa-spin"></i> Carregando...'
        : '<i class="fa-solid fa-plus"></i> Novo Cliente';
    }
  },

  buildFriendlyError(error) {
    const message = error?.message || '';

    if (message.includes('Failed to fetch')) {
      return 'Não foi possível conectar ao backend.';
    }

    if (error?.status === 403) {
      return 'Acesso negado ou limite do plano atingido.';
    }

    return message || 'Não foi possível concluir a operação.';
  },

  async configurarPortal(clienteId, clienteNome) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
      <div style="background:var(--surface);border-radius:16px;padding:24px;max-width:420px;width:100%;box-shadow:0 24px 50px rgba(0,0,0,.2)">
        <h3 style="margin:0 0 6px;font-size:16px;font-weight:700">Portal do Cliente</h3>
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 16px">${clienteNome} — defina uma senha de acesso ao portal. Mínimo 4 caracteres.</p>
        <div style="margin-bottom:12px">
          <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px;text-transform:uppercase">Nova senha</label>
          <input type="password" id="_portalSenha" placeholder="Mínimo 4 caracteres" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;box-sizing:border-box" />
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">
          O cliente acessa em: <strong>/portal.html</strong> com seu CPF/CNPJ + esta senha.
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button id="_portalCancelar" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--surface-3);font-size:13px;cursor:pointer">Cancelar</button>
          <button id="_portalSalvar" style="padding:8px 16px;border-radius:8px;border:none;background:var(--primary);color:#fff;font-size:13px;font-weight:600;cursor:pointer">Salvar senha</button>
        </div>
        <div id="_portalFeedback" style="margin-top:10px;font-size:13px;display:none"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#_portalCancelar').onclick = () => document.body.removeChild(overlay);
    overlay.querySelector('#_portalSalvar').onclick = async () => {
      const senha = overlay.querySelector('#_portalSenha').value;
      const feedback = overlay.querySelector('#_portalFeedback');
      const saveBtn = overlay.querySelector('#_portalSalvar');

      if (!senha || senha.length < 4) {
        feedback.style.cssText = 'margin-top:10px;font-size:13px;display:block;color:var(--danger)';
        feedback.textContent = 'A senha deve ter ao menos 4 caracteres.';
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvando...';

      try {
        await api.configurarPortalCliente(Number(clienteId), senha);
        feedback.style.cssText = 'margin-top:10px;font-size:13px;display:block;color:var(--success)';
        feedback.textContent = 'Senha configurada! Portal ativado para o cliente.';
        saveBtn.textContent = 'Salvo ✓';
        setTimeout(() => { document.body.removeChild(overlay); this.load(); }, 1500);
      } catch (err) {
        feedback.style.cssText = 'margin-top:10px;font-size:13px;display:block;color:var(--danger)';
        feedback.textContent = err.message || 'Erro ao configurar portal.';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar senha';
      }
    };
  }
};

function maskCPF(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPhone(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15);
}

function formatDate(value) {
  if (!value) return '-';

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('pt-BR');
}

function normalizeDateInput(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function initClientesModule() {
  ClientesModule.init();
  await ClientesModule.load();
}
