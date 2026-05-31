import api from './api.js';
import { getAuth } from './auth.js';
import { showToast } from './feedback.js';

const ConfigModule = {
  state: {
    empresa: null,
    dados: null
  },

  init() {
    const auth = getAuth();
    this.state.empresa = auth?.empresa?.nome || auth?.user?.empresa || 'LF ERP';
    this.state.user = auth?.user || {};

    this.render();
    this.load();
  },

  async salvarPerfil() {
    const nome = document.getElementById('cfgNomeCompleto')?.value?.trim();
    const cpf = document.getElementById('cfgCpf')?.value?.trim();
    const nascimento = document.getElementById('cfgNascimento')?.value?.trim();
    const btn = document.getElementById('cfgSalvarPerfilBtn');

    try {
      if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
      await api.updateMePerfil({ nome_completo: nome || null, cpf: cpf || null, nascimento: nascimento || null });
      showToast('Perfil atualizado com sucesso!', 'success');
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar perfil', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Salvar perfil'; }
    }
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

      showToast('Configurações salvas com sucesso', 'success');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      showToast('Erro ao salvar configurações', 'error');
    }
  },

  async resetDados() {
    const confirmar = window.prompt(
      'ATENÇÃO: isso apagará os dados operacionais da empresa atual.\n\nDigite RESETAR para confirmar:'
    );

    if (confirmar !== 'RESETAR') {
      showToast('Reset cancelado.', 'info');
      return;
    }

    try {
      const btn = document.getElementById('resetDadosBtn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Resetando...';
      }

      await api.fetchAPI('/reset-dados', 'POST', {});

      showToast('Dados resetados com sucesso.', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error('Erro ao resetar dados:', err);
      showToast(err.message || 'Erro ao resetar dados.', 'error');
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
      return showToast('Preencha todos os campos de senha', 'error');
    }

    if (nova !== confirmar) {
      return showToast('A nova senha e a confirmação não conferem', 'error');
    }

    if (nova.length < 6) {
      return showToast('A nova senha deve ter pelo menos 6 caracteres', 'error');
    }

    try {
      if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
      await api.fetchAPI('/me/senha', 'PUT', { senha_atual: atual, nova_senha: nova, confirmar_senha: confirmar });
      showToast('Senha alterada com sucesso!', 'success');
      document.getElementById('cfgSenhaAtual').value = '';
      document.getElementById('cfgSenhaNova').value = '';
      document.getElementById('cfgSenhaConfirmar').value = '';
    } catch (err) {
      showToast(err.message || 'Erro ao alterar senha', 'error');
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
            <h3>Meu Perfil</h3>
            <p>Atualize suas informações pessoais</p>
          </div>
        </div>
        <div class="form-grid" style="max-width: 420px;">
          <div class="form-field">
            <label>Nome completo</label>
            <input id="cfgNomeCompleto" value="${this.state.user?.nome_completo || ''}" placeholder="Seu nome" />
          </div>
          <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-field">
              <label>CPF</label>
              <input id="cfgCpf" value="${this.state.user?.cpf || ''}" placeholder="000.000.000-00" />
            </div>
            <div class="form-field">
              <label>Nascimento</label>
              <input id="cfgNascimento" type="date" value="${this.state.user?.nascimento || ''}" />
            </div>
          </div>
          <div>
            <button id="cfgSalvarPerfilBtn" class="btn btn-primary">Salvar perfil</button>
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
      document.getElementById('cfgSalvarPerfilBtn')?.addEventListener('click', () => this.salvarPerfil());
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
