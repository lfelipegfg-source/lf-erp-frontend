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

  async trocarSenha() {
    const atual = document.getElementById('cfgSenhaAtual')?.value;
    const nova = document.getElementById('cfgSenhaNova')?.value;
    const confirmar = document.getElementById('cfgSenhaConfirmar')?.value;
    const btn = document.getElementById('cfgTrocarSenhaBtn');

    if (!atual || !nova || !confirmar) {
      return alert('Preencha todos os campos de senha');
    }

    if (nova !== confirmar) {
      return alert('A nova senha e a confirmação não conferem');
    }

    if (nova.length < 6) {
      return alert('A nova senha deve ter pelo menos 6 caracteres');
    }

    try {
      if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
      await api.fetchAPI('/me/senha', 'PUT', { senha_atual: atual, nova_senha: nova, confirmar_senha: confirmar });
      alert('Senha alterada com sucesso!');
      document.getElementById('cfgSenhaAtual').value = '';
      document.getElementById('cfgSenhaNova').value = '';
      document.getElementById('cfgSenhaConfirmar').value = '';
    } catch (err) {
      alert(err.message || 'Erro ao alterar senha');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Alterar senha'; }
    }
  },

  async carregarHistorico() {
    const container = document.getElementById('cfgHistoricoAcesso');
    if (!container) return;
    try {
      const dados = await api.fetchAPI('/me/historico-acesso');
      if (!dados.length) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Nenhum registro encontrado.</p>';
        return;
      }
      const acaoBadge = (a) => {
        const map = {
          login: '<span style="background:var(--success-soft);color:var(--success);padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600">login</span>',
          logout: '<span style="background:var(--surface-3);color:var(--text-muted);padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600">logout</span>',
          login_falha: '<span style="background:var(--danger-soft);color:var(--danger);padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600">falha</span>',
          troca_senha: '<span style="background:var(--warning-soft);color:var(--warning);padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600">senha</span>'
        };
        return map[a] || `<span style="padding:2px 8px;border-radius:20px;font-size:11px">${a}</span>`;
      };
      container.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="border-bottom:1px solid var(--border)">
              <th style="text-align:left;padding:6px 10px;font-weight:600;color:var(--text-muted);font-size:11px;text-transform:uppercase">Data/hora</th>
              <th style="text-align:left;padding:6px 10px;font-weight:600;color:var(--text-muted);font-size:11px;text-transform:uppercase">Ação</th>
              <th style="text-align:left;padding:6px 10px;font-weight:600;color:var(--text-muted);font-size:11px;text-transform:uppercase">IP</th>
            </tr>
          </thead>
          <tbody>
            ${dados.map(l => `
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:7px 10px">${new Date(l.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td style="padding:7px 10px">${acaoBadge(l.acao)}</td>
                <td style="padding:7px 10px;color:var(--text-muted)">${l.ip || '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
    } catch (err) {
      container.innerHTML = '<p style="color:var(--danger);font-size:13px">Erro ao carregar histórico.</p>';
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
            <button id="salvarConfigBtn" class="btn btn-primary">Salvar</button>
          </div>
        </div>

        <hr style="margin: 28px 0; border: none; border-top: 1px solid var(--border);" />

        <div class="module-card__header" style="margin-bottom:16px">
          <div>
            <h3>Segurança — Alterar senha</h3>
            <p>Informe sua senha atual para definir uma nova</p>
          </div>
        </div>
        <div class="form-grid" style="max-width: 420px;">
          <div class="form-field">
            <label>Senha atual</label>
            <input id="cfgSenhaAtual" type="password" placeholder="••••••••" />
          </div>
          <div class="form-field">
            <label>Nova senha</label>
            <input id="cfgSenhaNova" type="password" placeholder="Mínimo 6 caracteres" />
          </div>
          <div class="form-field">
            <label>Confirmar nova senha</label>
            <input id="cfgSenhaConfirmar" type="password" placeholder="Repita a nova senha" />
          </div>
          <div>
            <button id="cfgTrocarSenhaBtn" class="btn btn-primary">Alterar senha</button>
          </div>
        </div>

        <hr style="margin: 28px 0; border: none; border-top: 1px solid var(--border);" />

        <div class="module-card__header" style="margin-bottom:12px">
          <div>
            <h3>Histórico de acesso</h3>
            <p>Últimos 20 acessos da sua conta</p>
          </div>
          <button id="cfgCarregarHistoricoBtn" class="btn btn-secondary btn-sm">
            <i class="fa fa-refresh"></i> Carregar
          </button>
        </div>
        <div id="cfgHistoricoAcesso" style="min-height:48px"></div>

        <hr style="margin: 28px 0; border: none; border-top: 1px solid var(--border);" />

        <div class="module-card" style="background: var(--danger-soft); border-color: rgba(220,38,38,0.25);">
          <div class="module-card__header">
            <div>
              <h3 style="color: var(--danger);">Área de teste do piloto</h3>
              <p>Use esta opção apenas em ambiente local para apagar dados operacionais e iniciar o piloto novamente.</p>
            </div>
          </div>
          <button id="resetDadosBtn" class="btn btn-danger">Resetar dados do piloto</button>
        </div>
      </section>
    `;

    setTimeout(() => {
      document.getElementById('salvarConfigBtn')?.addEventListener('click', () => this.save());
      document.getElementById('cfgTrocarSenhaBtn')?.addEventListener('click', () => this.trocarSenha());
      document.getElementById('cfgCarregarHistoricoBtn')?.addEventListener('click', () => this.carregarHistorico());
      document.getElementById('resetDadosBtn')?.addEventListener('click', () => this.resetDados());
    }, 0);
  }
};

export function initConfigModule() {
  ConfigModule.init();
}

export default ConfigModule;
