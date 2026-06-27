import api from './api.js';
import { getAuth } from './auth.js';
import { showToast } from './feedback.js';

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const ConfigModule = {
  state: {
    empresa: null,
    dados: null,
    eventsBound: false
  },

  init() {
    this.state.eventsBound = false;
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
      const [data, meData] = await Promise.all([
        api.fetchAPI(`/configuracoes/${this.state.empresa}`),
        api.validateSession().catch(() => null)
      ]);

      if (meData) {
        this.state.user = { ...this.state.user, ...meData };
        const nomeCampo = document.getElementById('cfgNomeCompleto');
        const cpfCampo = document.getElementById('cfgCpf');
        const nascCampo = document.getElementById('cfgNascimento');
        if (nomeCampo) nomeCampo.value = meData.nome_completo || '';
        if (cpfCampo) cpfCampo.value = meData.cpf || '';
        if (nascCampo) nascCampo.value = meData.nascimento || '';
      }

      this.state.dados = data;

      const campoNome = document.getElementById('cfgNomeEmpresa');
      if (campoNome) campoNome.value = data.nome_empresa || '';

      // Carregar config PIX
      try {
        const pixCfg = await api.getPixConfig();
        if (document.getElementById('cfgPixClientId')) {
          document.getElementById('cfgPixClientId').value   = pixCfg.pix_client_id  || '';
          document.getElementById('cfgPixChave').value      = pixCfg.pix_chave       || '';
          document.getElementById('cfgPixSandbox').checked  = pixCfg.pix_sandbox !== false;
          if (pixCfg.pix_certificado === 'configurado')
            document.getElementById('cfgPixCertificado').placeholder = '✓ Certificado configurado (deixe vazio para manter)';
        }
      } catch (_) { /* silencioso — PIX é opcional */ }

      await this.carregarAsaas();
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    }
  },

  async exportarDados() {
    const btn = document.getElementById('exportarDadosBtn');
    try {
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...'; }

      const token = api.getAuthToken();
      const baseUrl = api.getApiBaseUrl();
      const url = `${baseUrl}/empresa/exportar-dados`;

      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.erro || `Erro ${res.status}`);
      }

      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') || '';
      const match = cd.match(/filename="(.+?)"/);
      const filename = match ? match[1] : `lferp-dados-${new Date().toISOString().slice(0,10)}.json`;

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);

      showToast('Dados exportados com sucesso!', 'success');
    } catch (err) {
      showToast(err.message || 'Erro ao exportar dados', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-download"></i> Baixar meus dados'; }
    }
  },

  async carregarAsaas() {
    try {
      const data = await api.request('/pagamentos/boleto/config', { method: 'GET' });
      const keyEl  = document.getElementById('cfgAsaasApiKey');
      const sbEl   = document.getElementById('cfgAsaasSandbox');
      if (keyEl && data.asaas_api_key) keyEl.placeholder = '****  (configurada — deixe vazio para manter)';
      if (sbEl) sbEl.checked = data.asaas_sandbox !== false;
    } catch { /* silencioso — Asaas opcional */ }
  },

  async salvarAsaas() {
    const btn = document.getElementById('cfgSalvarAsaasBtn');
    try {
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...'; }
      await api.request('/pagamentos/boleto/config', {
        method: 'PUT',
        body: {
          empresa:        this.state.empresa,
          asaas_api_key:  document.getElementById('cfgAsaasApiKey')?.value?.trim()  || null,
          asaas_sandbox:  document.getElementById('cfgAsaasSandbox')?.checked ?? true
        }
      });
      showToast('Configuração Asaas salva!', 'success');
      if (document.getElementById('cfgAsaasApiKey')) document.getElementById('cfgAsaasApiKey').value = '';
    } catch (err) {
      showToast(err.message || 'Erro ao salvar configuração Asaas', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar configuração Asaas'; }
    }
  },

  async salvarPix() {
    const btn = document.getElementById('cfgSalvarPixBtn');
    try {
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...'; }
      await api.savePixConfig({
        pix_client_id:     document.getElementById('cfgPixClientId')?.value?.trim()    || '',
        pix_client_secret: document.getElementById('cfgPixClientSecret')?.value?.trim() || '',
        pix_certificado:   document.getElementById('cfgPixCertificado')?.value?.trim()  || '',
        pix_chave:         document.getElementById('cfgPixChave')?.value?.trim()         || '',
        pix_sandbox:       document.getElementById('cfgPixSandbox')?.checked ?? true
      });
      showToast('Configuração PIX salva com sucesso!', 'success');
      document.getElementById('cfgPixClientSecret').value = '';
      const certEl = document.getElementById('cfgPixCertificado');
      if (certEl) { certEl.value = ''; certEl.placeholder = '✓ Certificado configurado (deixe vazio para manter)'; }
    } catch (err) {
      showToast(err.message || 'Erro ao salvar configuração PIX', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar configuração PIX'; }
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
          login:       '<span class="badge badge--success">login</span>',
          logout:      '<span class="badge badge--neutral">logout</span>',
          login_falha: '<span class="badge badge--danger">falha</span>',
          troca_senha: '<span class="badge badge--warning">senha</span>'
        };
        return map[a] || `<span class="badge">${esc(a)}</span>`;
      };
      container.innerHTML = `
        <table class="historico-table">
          <thead>
            <tr>
              <th>Data/hora</th>
              <th>Ação</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            ${dados.map(l => `
              <tr>
                <td>${new Date(l.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td>${acaoBadge(l.acao)}</td>
                <td class="text-muted">${esc(l.ip || '—')}</td>
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
            <input id="cfgNomeCompleto" value="${esc(this.state.user?.nome_completo || '')}" placeholder="Seu nome" />
          </div>
          <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-field">
              <label>CPF</label>
              <input id="cfgCpf" value="${esc(this.state.user?.cpf || '')}" placeholder="000.000.000-00" />
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

        <hr style="margin: 28px 0; border: none; border-top: 1px solid var(--border);" />

        <div class="module-card__header" style="margin-bottom:16px">
          <div>
            <h3><i class="fa-brands fa-pix" style="color:#32bcad;margin-right:6px"></i>PIX — Configuração EFÍ</h3>
            <p>Configure as credenciais da EFÍ (Gerencianet) para gerar cobranças PIX automaticamente</p>
          </div>
        </div>

        <div class="pix-config-info">
          <i class="fa-solid fa-circle-info"></i>
          <div>
            <strong>Como obter as credenciais</strong>
            <ol style="margin:6px 0 0;padding-left:18px;font-size:.85rem;color:var(--text-soft)">
              <li>Acesse <strong>efipay.com.br</strong> e abra uma conta gratuita</li>
              <li>Vá em <strong>API → Criar aplicação</strong> → copie Client ID e Client Secret</li>
              <li>Baixe o certificado <strong>.p12</strong> e carregue abaixo (como Base64)</li>
              <li>Registre sua <strong>chave PIX</strong> (CPF, CNPJ, e-mail ou aleatória)</li>
              <li>Desative o sandbox quando tudo estiver pronto</li>
            </ol>
          </div>
        </div>

        <div class="form-grid" style="max-width:600px" id="cfgPixForm">
          <div class="form-field">
            <label>Client ID</label>
            <input id="cfgPixClientId" class="input" placeholder="Client_Id_..." />
          </div>
          <div class="form-field">
            <label>Client Secret</label>
            <input id="cfgPixClientSecret" class="input" type="password" placeholder="Client_Secret_..." />
          </div>
          <div class="form-field form-field--span-2">
            <label>Chave PIX</label>
            <input id="cfgPixChave" class="input" placeholder="CPF, CNPJ, e-mail ou chave aleatória" />
          </div>
          <div class="form-field form-field--span-2">
            <label>Certificado (.p12 em Base64) <span style="color:var(--text-muted);font-weight:400">— opcional para sandbox</span></label>
            <textarea id="cfgPixCertificado" class="input" rows="3"
              placeholder="Cole aqui o conteúdo Base64 do certificado .p12 baixado da EFÍ..."></textarea>
            <small style="color:var(--text-muted);font-size:.78rem">
              Para converter: <code>base64 -i certificado.p12</code> (Linux/Mac) ou use uma ferramenta online segura.
            </small>
          </div>
          <div class="form-field">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
              <input type="checkbox" id="cfgPixSandbox" style="width:16px;height:16px" checked />
              <span>Modo Sandbox (testes) — desative para produção real</span>
            </label>
          </div>
          <div class="form-field">
            <button id="cfgSalvarPixBtn" class="btn btn-primary">
              <i class="fa-solid fa-floppy-disk"></i> Salvar configuração PIX
            </button>
          </div>
        </div>

        <hr style="margin: 28px 0; border: none; border-top: 1px solid var(--border);" />

        <!-- Asaas — Boleto Bancário -->
        <div style="margin-bottom:8px">
          <h4 style="font-size:1rem;font-weight:800;margin-bottom:4px">
            <i class="fa-solid fa-barcode" style="color:var(--primary);margin-right:6px"></i>
            Boleto Bancário — Asaas
          </h4>
          <p style="font-size:.88rem;color:var(--text-muted)">
            Emita boletos bancários diretamente do sistema. Crie uma conta gratuita em
            <strong>asaas.com</strong> e cole a API Key abaixo.
          </p>
        </div>

        <div class="pix-config-info" style="margin-bottom:16px">
          <i class="fa-solid fa-circle-info"></i>
          <div>
            <strong>Como configurar</strong>
            <ol style="margin:6px 0 0;padding-left:18px;font-size:.85rem;color:var(--text-soft)">
              <li>Acesse <strong>asaas.com</strong> e crie uma conta (gratuita)</li>
              <li>Vá em <strong>Configurações → Integrações → API Key</strong> e copie a chave</li>
              <li>Cole a chave abaixo e salve em modo Sandbox para testar</li>
              <li>Desative o Sandbox quando estiver pronto para produção real</li>
            </ol>
          </div>
        </div>

        <div class="form-grid" style="max-width:600px">
          <div class="form-field form-field--span-2">
            <label>API Key Asaas</label>
            <input id="cfgAsaasApiKey" class="input" type="password"
              placeholder="$aact_..." autocomplete="new-password" />
          </div>
          <div class="form-field">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
              <input type="checkbox" id="cfgAsaasSandbox" style="width:16px;height:16px" checked />
              <span>Modo Sandbox (testes) — desative para produção real</span>
            </label>
          </div>
          <div class="form-field">
            <button id="cfgSalvarAsaasBtn" class="btn btn-primary">
              <i class="fa-solid fa-floppy-disk"></i> Salvar configuração Asaas
            </button>
          </div>
        </div>

        <hr style="margin: 28px 0; border: none; border-top: 1px solid var(--border);" />

        <!-- LGPD — Exportação de dados -->
        <div class="module-card" style="margin-bottom:16px">
          <div class="module-card__header">
            <div>
              <h3><i class="fa-solid fa-file-arrow-down" style="color:var(--primary);margin-right:6px"></i>Exportar meus dados (LGPD)</h3>
              <p>Conforme a Lei 13.709/2018 (LGPD), você pode baixar todos os dados da sua empresa a qualquer momento.</p>
            </div>
          </div>
          <p style="font-size:.88rem;color:var(--text-muted);margin-bottom:12px">
            O arquivo JSON incluirá: clientes, produtos, vendas, compras, contas a receber/pagar, movimentações de estoque e lançamentos financeiros.
          </p>
          <button id="exportarDadosBtn" class="btn btn-light">
            <i class="fa-solid fa-download"></i> Baixar meus dados
          </button>
        </div>

      </section>
    `;

    if (!this.state.eventsBound) {
      this.state.eventsBound = true;
      setTimeout(() => {
        document.getElementById('salvarConfigBtn')?.addEventListener('click', () => this.save());
        document.getElementById('cfgSalvarPerfilBtn')?.addEventListener('click', () => this.salvarPerfil());
        document.getElementById('cfgTrocarSenhaBtn')?.addEventListener('click', () => this.trocarSenha());
        document.getElementById('cfgCarregarHistoricoBtn')?.addEventListener('click', () => this.carregarHistorico());
        document.getElementById('cfgSalvarPixBtn')?.addEventListener('click', () => this.salvarPix());
        document.getElementById('cfgSalvarAsaasBtn')?.addEventListener('click', () => this.salvarAsaas());
        document.getElementById('exportarDadosBtn')?.addEventListener('click', () => this.exportarDados());
      }, 0);
    }
  }
};

export function initConfigModule() {
  ConfigModule.init();
}

export default ConfigModule;
