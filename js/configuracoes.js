import api from './api.js';
import { getAuth } from './auth.js';

const ConfigModule = {
  state: {
    empresa: null,
    dados: null
  },

  init() {
    const auth = getAuth();
    this.state.empresa = auth?.empresa?.nome || auth?.user?.empresa || 'LF ERP';

    this.render();
    this.load();
  },

  async load() {
    try {
      const data = await api.fetchAPI(`/configuracoes/${this.state.empresa}`);
      this.state.dados = data;

      const campoNome = document.getElementById('cfgNomeEmpresa');
      if (campoNome) {
        campoNome.value = data.nome_empresa || '';
      }
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    }
  },

  async save() {
    try {
      const nome = document.getElementById('cfgNomeEmpresa').value;

      await api.fetchAPI(`/configuracoes`, 'PUT', {
        empresa: this.state.empresa,
        nome_empresa: nome
      });

      alert('Configurações salvas com sucesso');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar configurações');
    }
  },

  async resetDados() {
    const confirmar = window.prompt(
      'ATENÇÃO: isso apagará os dados operacionais da empresa atual.\n\nDigite RESETAR para confirmar:'
    );

    if (confirmar !== 'RESETAR') {
      alert('Reset cancelado.');
      return;
    }

    try {
      const btn = document.getElementById('resetDadosBtn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Resetando...';
      }

      await api.fetchAPI('/reset-dados', 'POST', {});

      alert('Dados resetados com sucesso. Atualize o sistema para conferir.');
      window.location.reload();
    } catch (err) {
      console.error('Erro ao resetar dados:', err);
      alert(err.message || 'Erro ao resetar dados.');
    } finally {
      const btn = document.getElementById('resetDadosBtn');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Resetar dados do piloto';
      }
    }
  },

  render() {
    const c = document.getElementById('configuracoesContainer');
    if (!c) return;

    c.innerHTML = `
      <section class="module-card">
        <div class="module-card__header">
          <div>
            <h3>Configurações</h3>
            <p>Dados da empresa e preferências do sistema</p>
          </div>
        </div>

        <div class="form-grid" style="max-width: 600px;">
          <div class="form-field">
            <label>Nome da empresa</label>
            <input id="cfgNomeEmpresa" />
          </div>

          <div>
            <button id="salvarConfigBtn" class="btn btn-primary">
              Salvar
            </button>
          </div>
        </div>

        <hr style="margin: 28px 0; border: none; border-top: 1px solid var(--border);" />

        <div class="module-card" style="background: var(--danger-soft); border-color: rgba(220,38,38,0.25);">
          <div class="module-card__header">
            <div>
              <h3 style="color: var(--danger);">Área de teste do piloto</h3>
              <p>
                Use esta opção apenas em ambiente local para apagar dados operacionais
                e iniciar o piloto novamente.
              </p>
            </div>
          </div>

          <button id="resetDadosBtn" class="btn btn-danger">
            Resetar dados do piloto
          </button>
        </div>
      </section>
    `;

    setTimeout(() => {
      document.getElementById('salvarConfigBtn')?.addEventListener('click', () => this.save());

      document.getElementById('resetDadosBtn')?.addEventListener('click', () => this.resetDados());
    }, 0);
  }
};

export function initConfigModule() {
  ConfigModule.init();
}

export default ConfigModule;
