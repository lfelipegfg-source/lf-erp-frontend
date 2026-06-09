import api from './api.js';
import { getAuth } from './auth.js';
import { showToast, confirmarAcao } from './feedback.js';

const FornecedoresModule = {
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
      container: document.getElementById('fornecedoresContainer'),
      table: document.getElementById('fornecedoresTable'),
      search: document.getElementById('fornecedoresSearch'),
      modal: document.getElementById('fornecedorModal'),
      form: document.getElementById('fornecedorForm'),
      nome: document.getElementById('fornecedorNome'),
      telefone: document.getElementById('fornecedorTelefone'),
      cnpj: document.getElementById('fornecedorCnpj'),
      email: document.getElementById('fornecedorEmail'),
      endereco: document.getElementById('fornecedorEndereco'),
      observacao: document.getElementById('fornecedorObservacao'),
      feedback: document.getElementById('fornecedoresFeedback'),
      modalTitle: document.getElementById('fornecedorModalTitle')
    };
  },

  bind() {
    if (this.state.eventsBound) return;
    this.state.eventsBound = true;

    document.addEventListener('input', (e) => {
      if (e.target.id === 'fornecedoresSearch') {
        this.search(e.target.value);
      }

      if (e.target.id === 'fornecedorTelefone') {
        e.target.value = maskPhone(e.target.value);
      }

      if (e.target.id === 'fornecedorCnpj') {
        e.target.value = maskCNPJ(e.target.value);
      }
    });

    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      if (btn.id === 'novoFornecedorBtn') {
        this.openModal(false);
      }

      if (btn.id === 'cancelFornecedor' || btn.id === 'cancelFornecedorFooter') {
        this.closeModal();
      }

      if (btn.dataset.action === 'edit-fornecedor') {
        this.edit(btn.dataset.id);
      }

      if (btn.dataset.action === 'delete-fornecedor') {
        await this.delete(btn.dataset.id);
      }
    });

    document.addEventListener('submit', async (e) => {
      if (e.target.id === 'fornecedorForm') {
        e.preventDefault();
        await this.save();
      }
    });
  },

  async load() {
    this.resolveEmpresa();
    this.state.loading = true;
    this.setFeedback('Carregando fornecedores...', 'info');
    this.setLoading(true);


    try {
      const data = await api.getFornecedores();
      this.state.items = Array.isArray(data) ? data : [];
      this.state.filteredItems = [...this.state.items];

      this.render();
      this.cache();
      this.renderTable();
      this.setFeedback('', '');
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
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
    const c = document.getElementById('fornecedoresContainer');
    if (!c) return;

    c.innerHTML = `
      <section class="module-card">
        <div id="fornecedoresFeedback" class="module-feedback"></div>

        <div class="module-card__header">
          <div>
            <h3>Fornecedores</h3>
            <p>Base completa de fornecedores e apoio às compras</p>
          </div>

          <div class="module-card__actions">
            <button class="btn btn-primary" id="novoFornecedorBtn">
              <i class="fa-solid fa-plus"></i>
              Novo Fornecedor
            </button>
          </div>
        </div>

        <div class="module-toolbar">
          <div class="module-toolbar__search">
            <i class="fa-solid fa-search"></i>
            <input
              id="fornecedoresSearch"
              placeholder="Buscar por nome, telefone ou e-mail..."
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
                <th>CNPJ</th>
                <th>E-mail</th>
                <th>Endereço</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody id="fornecedoresTable"></tbody>
          </table>
        </div>
      </section>

      <div class="modal-overlay hidden" id="fornecedorModal">
        <div class="modal-card">
          <div class="modal-card__header">
            <div>
              <h3 id="fornecedorModalTitle">${this.state.editingId ? 'Editar fornecedor' : 'Novo fornecedor'}</h3>
              <p>Cadastre os dados do fornecedor no sistema</p>
            </div>

            <button type="button" class="icon-button" id="cancelFornecedor" aria-label="Fechar">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <form id="fornecedorForm" class="form-grid">
            <div class="form-field form-field--span-2">
              <label for="fornecedorNome">Nome</label>
              <input id="fornecedorNome" required />
            </div>

            <div class="form-field">
              <label for="fornecedorCnpj">CNPJ</label>
              <input id="fornecedorCnpj" placeholder="00.000.000/0000-00" />
            </div>

            <div class="form-field">
              <label for="fornecedorTelefone">Telefone</label>
              <input id="fornecedorTelefone" placeholder="(88) 99999-9999" />
            </div>

            <div class="form-field">
              <label for="fornecedorEmail">E-mail</label>
              <input id="fornecedorEmail" type="email" />
            </div>

            <div class="form-field form-field--span-2">
              <label for="fornecedorEndereco">Endereço</label>
              <input id="fornecedorEndereco" />
            </div>

            <div class="form-field form-field--span-2">
              <label for="fornecedorObservacao">Observação</label>
              <textarea id="fornecedorObservacao" rows="3"></textarea>
            </div>

            <div class="modal-card__footer">
              <button type="button" class="btn btn-light" id="cancelFornecedorFooter">
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
            <div class="empty-state" style="padding:36px 24px">
              <i class="fa-solid fa-truck"></i>
              <strong>Nenhum fornecedor encontrado</strong>
              <p>Tente ajustar a busca ou cadastre um novo fornecedor.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    this.el.table.innerHTML = this.state.filteredItems
      .map(
        (fornecedor) => `
      <tr>
        <td>
          <div class="table-primary">
            <strong>${escapeHtml(fornecedor.nome || '-')}</strong>
            <small style="display:block; color: var(--text-muted); margin-top:4px;">
              ID: ${fornecedor.id}
            </small>
          </div>
        </td>

        <td>${escapeHtml(fornecedor.telefone || '-')}</td>
        <td>${escapeHtml(fornecedor.cnpj || '-')}</td>
        <td>${escapeHtml(fornecedor.email || '-')}</td>
        <td>${escapeHtml(fornecedor.endereco || '-')}</td>

        <td class="text-right">
          <div class="table-actions">
            <button class="btn-inline" data-action="edit-fornecedor" data-id="${fornecedor.id}">
              Editar
            </button>
            <button class="btn-inline btn-inline--danger" data-action="delete-fornecedor" data-id="${fornecedor.id}">
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

    this.state.filteredItems = this.state.items.filter((fornecedor) => {
      const nome = String(fornecedor.nome || '').toLowerCase();
      const telefone = String(fornecedor.telefone || '').toLowerCase();
      const email = String(fornecedor.email || '').toLowerCase();
      const endereco = String(fornecedor.endereco || '').toLowerCase();

      return (
        nome.includes(normalized) ||
        telefone.includes(normalized) ||
        email.includes(normalized) ||
        endereco.includes(normalized)
      );
    });

    this.renderTable();
  },

  getCurrentSearchValue() {
    const existingInput = document.getElementById('fornecedoresSearch');
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
        this.el.modalTitle.textContent = 'Novo fornecedor';
      }
    } else if (this.el.modalTitle) {
      this.el.modalTitle.textContent = 'Editar fornecedor';
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
    const fornecedor = this.state.items.find((item) => String(item.id) === String(id));
    if (!fornecedor) return;

    this.state.editingId = Number(id);
    this.openModal(true);

    this.cache();

    if (this.el.nome) this.el.nome.value = fornecedor.nome || '';
    if (this.el.telefone) this.el.telefone.value = fornecedor.telefone || '';
    if (this.el.email) this.el.email.value = fornecedor.email || '';
    if (this.el.endereco) this.el.endereco.value = fornecedor.endereco || '';
    if (this.el.cnpj) this.el.cnpj.value = fornecedor.cnpj || '';
    if (this.el.observacao) this.el.observacao.value = fornecedor.observacao || '';
  },

  async save() {
    this.cache();

    const payload = {
      empresa: this.state.empresa,
      nome: this.el.nome?.value?.trim() || '',
      telefone: this.el.telefone?.value?.trim() || '',
      cnpj: this.el.cnpj?.value?.trim() || '',
      email: this.el.email?.value?.trim() || '',
      endereco: this.el.endereco?.value?.trim() || '',
      observacao: this.el.observacao?.value?.trim() || ''
    };

    if (!payload.nome) {
      this.setFeedback('Informe o nome do fornecedor.', 'error');
      return;
    }

    try {
      const message = this.state.editingId ? 'Atualizando fornecedor...' : 'Salvando fornecedor...';

      this.setFeedback(message, 'info');

      showToast(message, 'info');

      if (this.state.editingId) {
        await api.updateFornecedor(this.state.editingId, payload);
      } else {
        await api.createFornecedor(payload);
      }

      this.closeModal();
      await this.load();
      this.showMessage('Fornecedor salvo com sucesso.', 'success');
    } catch (error) {
      console.error('Erro ao salvar fornecedor:', error);
      const message = this.buildFriendlyError(error);
      this.setFeedback(message, 'error');
    }
  },

  async delete(id) {
    const ok = await confirmarAcao('Excluir este fornecedor? Esta ação não pode ser desfeita.', 'Excluir', 'danger');
    if (!ok) return;

    try {
      this.setFeedback('Excluindo fornecedor...', 'info');

      showToast('Excluindo fornecedor...', 'info');

      await api.deleteFornecedor(id);

      await this.load();
      this.showMessage('Fornecedor excluído com sucesso.', 'success');
    } catch (error) {
      console.error('Erro ao excluir fornecedor:', error);
      const message = this.buildFriendlyError(error);
      this.setFeedback(message, 'error');
    }
  },

  setFeedback(message, type = '') {
    const feedback = document.getElementById('fornecedoresFeedback');
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

    const btnNovo = document.getElementById('novoFornecedorBtn');
    if (btnNovo) btnNovo.disabled = value;

    if (btnNovo) {
      btnNovo.innerHTML = value
        ? '<i class="fa-solid fa-spinner fa-spin"></i> Carregando...'
        : '<i class="fa-solid fa-plus"></i> Novo Fornecedor';
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
  }
};

function maskPhone(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15);
}

function maskCNPJ(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .slice(0, 18);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function initFornecedoresModule() {
  FornecedoresModule.init();
  await FornecedoresModule.load();
}
