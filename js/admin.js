// =============== ADMIN PANEL — LF ERP ===============

(function () {
  'use strict';

  // ── Auth guard ──────────────────────────────────────
  const auth = getStoredAuth();
  if (!auth || !auth.authToken) {
    window.location.href = './index.html';
    return;
  }
  if (auth.user?.tipo !== 'admin') {
    window.location.href = './index.html';
    return;
  }

  document.getElementById('adminUserName').textContent = auth.user?.usuario || 'Admin';

  // ── State ────────────────────────────────────────────
  let planosCache = [];

  // ── Toast ────────────────────────────────────────────
  function showToast(msg, type = '') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `show ${type}`;
    setTimeout(() => { el.className = ''; }, 3000);
  }

  // ── API helper ───────────────────────────────────────
  async function api(path, opts = {}) {
    const url = buildUrl(path, opts.query || {});
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers: buildHeaders(),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
    return data;
  }

  // ── Tabs ─────────────────────────────────────────────
  window.switchTab = function (tab) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    event.currentTarget.classList.add('active');

    if (tab === 'empresas') carregarEmpresas();
    if (tab === 'planos') carregarPlanos();
  };

  // ── Logout ───────────────────────────────────────────
  window.adminLogout = async function () {
    try { await api('/logout', { method: 'POST' }); } catch (_) {}
    localStorage.removeItem('lf_erp_auth');
    sessionStorage.removeItem('lf_erp_auth');
    window.location.href = './index.html';
  };

  // ── Modal helpers ─────────────────────────────────────
  window.closeModal = function (id) {
    document.getElementById(id).classList.add('hidden');
  };

  function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
  }

  // ══════════════════════════════════════════════════════
  //  EMPRESAS
  // ══════════════════════════════════════════════════════

  async function carregarEmpresas() {
    try {
      const empresas = await api('/admin/empresas');
      renderStats(empresas);
      renderEmpresas(empresas);
    } catch (e) {
      document.getElementById('empresasBody').innerHTML =
        `<tr class="loading-row"><td colspan="7">Erro ao carregar: ${e.message}</td></tr>`;
    }
  }

  function renderStats(empresas) {
    const total = empresas.length;
    const ativos = empresas.filter(e => e.assinatura_status === 'ativo').length;
    const trial = empresas.filter(e => e.assinatura_status === 'trial').length;
    const bloqueados = empresas.filter(e => e.bloqueada).length;

    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-card"><div class="stat-card__value">${total}</div><div class="stat-card__label">Total de empresas</div></div>
      <div class="stat-card"><div class="stat-card__value" style="color:var(--success)">${ativos}</div><div class="stat-card__label">Assinaturas ativas</div></div>
      <div class="stat-card"><div class="stat-card__value" style="color:var(--warning)">${trial}</div><div class="stat-card__label">Em trial</div></div>
      <div class="stat-card"><div class="stat-card__value" style="color:var(--danger)">${bloqueados}</div><div class="stat-card__label">Bloqueadas</div></div>
    `;
  }

  function badgeEmpresa(e) {
    if (e.bloqueada) return '<span class="badge badge-bloqueado"><i class="fa fa-ban"></i> Bloqueada</span>';
    const s = e.assinatura_status || 'trial';
    const map = {
      ativo: '<span class="badge badge-ativo"><i class="fa fa-check-circle"></i> Ativo</span>',
      trial: '<span class="badge badge-trial"><i class="fa fa-clock"></i> Trial</span>',
      inativo: '<span class="badge badge-inativo">Inativo</span>',
      cancelado: '<span class="badge badge-inativo">Cancelado</span>',
      expirado: '<span class="badge badge-expirado">Expirado</span>'
    };
    return map[s] || `<span class="badge badge-inativo">${s}</span>`;
  }

  function renderEmpresas(empresas) {
    const tbody = document.getElementById('empresasBody');
    if (!empresas.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa fa-building"></i><p>Nenhuma empresa cadastrada</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = empresas.map(e => `
      <tr>
        <td><strong>${e.nome}</strong>${e.email ? `<br><small style="color:var(--text-muted)">${e.email}</small>` : ''}</td>
        <td>${badgeEmpresa(e)}</td>
        <td>${e.plano_nome || '<span style="color:var(--text-muted)">—</span>'}</td>
        <td>${e.trial_fim ? formatDate(e.trial_fim) : '—'}</td>
        <td style="text-align:center">${e.total_usuarios}</td>
        <td style="text-align:center">${e.total_vendas}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="verDetalheEmpresa(${e.id}, '${e.nome.replace(/'/g, "\\'")}')"><i class="fa fa-eye"></i></button>
          <button class="btn btn-secondary btn-sm" onclick="editarEmpresa(${e.id})"><i class="fa fa-pencil"></i> Editar</button>
          <button class="btn btn-secondary btn-sm" onclick="exportarEmpresa(${e.id}, '${e.nome.replace(/'/g, "\\'")}')"><i class="fa fa-download"></i></button>
        </td>
      </tr>
    `).join('');
  }

  window.verDetalheEmpresa = async function (id, nome) {
    document.getElementById('modalDetalheTitulo').textContent = nome;
    document.getElementById('modalDetalheConteudo').innerHTML =
      '<div style="text-align:center;padding:24px;color:var(--text-muted)"><i class="fa fa-spinner fa-spin"></i> Carregando...</div>';
    openModal('modalDetalheEmpresa');

    try {
      const d = await api(`/admin/empresas/${id}`);
      const e = d.empresa;

      document.getElementById('modalDetalheConteudo').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
          <div><span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:600">Status</span><br>${badgeEmpresa(e)}</div>
          <div><span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:600">Plano</span><br>${e.plano_nome || '—'}</div>
          <div><span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:600">Trial até</span><br>${formatDate(e.trial_fim)}</div>
          <div><span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:600">Criada em</span><br>${formatDate(e.criado_em)}</div>
          <div><span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:600">Total vendas</span><br><strong>${d.resumo_vendas.total}</strong> (R$ ${Number(d.resumo_vendas.valor_total).toFixed(2)})</div>
          <div><span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:600">Usuários</span><br><strong>${d.usuarios.length}</strong></div>
        </div>

        <p style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Usuários</p>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px">
          ${d.usuarios.map(u => `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:6px 8px">${u.nome_completo || u.usuario}</td>
            <td style="padding:6px 8px;color:var(--text-muted)">${u.usuario}</td>
            <td style="padding:6px 8px"><span class="badge badge-${u.tipo === 'admin' ? 'bloqueado' : u.tipo === 'gerente' ? 'trial' : 'ativo'}">${u.tipo}</span></td>
          </tr>`).join('')}
        </table>

        <p style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Últimos acessos</p>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          ${d.ultimos_acessos.map(l => `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:5px 8px;color:var(--text-muted)">${formatDateTime(l.criado_em)}</td>
            <td style="padding:5px 8px">${l.usuario_nome || '—'}</td>
            <td style="padding:5px 8px;color:var(--text-muted)">${l.acao}</td>
            <td style="padding:5px 8px;color:var(--text-muted)">${l.ip || '—'}</td>
          </tr>`).join('')}
        </table>
      `;
    } catch (err) {
      document.getElementById('modalDetalheConteudo').innerHTML =
        `<p style="color:var(--danger)">Erro ao carregar: ${err.message}</p>`;
    }
  };

  window.openModalEmpresa = async function () {
    await carregarPlanosSelect();
    document.getElementById('empresaEditId').value = '';
    document.getElementById('modalEmpresaTitulo').textContent = 'Nova Empresa';
    document.getElementById('empresaNome').value = '';
    document.getElementById('empresaEmail').value = '';
    document.getElementById('empresaTelefone').value = '';
    document.getElementById('empresaTrialDias').value = '30';
    document.getElementById('empresaStatusFields').classList.add('hidden');
    openModal('modalEmpresa');
  };

  window.editarEmpresa = async function (id) {
    await carregarPlanosSelect();
    try {
      const empresas = await api('/admin/empresas');
      const e = empresas.find(x => x.id === id);
      if (!e) return;

      document.getElementById('empresaEditId').value = id;
      document.getElementById('modalEmpresaTitulo').textContent = `Editar: ${e.nome}`;
      document.getElementById('empresaNome').value = e.nome;
      document.getElementById('empresaNome').disabled = true;
      document.getElementById('empresaEmail').value = e.email || '';
      document.getElementById('empresaTelefone').value = e.telefone || '';
      document.getElementById('empresaPlano').value = e.plano_id || '';
      document.getElementById('empresaStatus').value = e.assinatura_status || 'trial';
      document.getElementById('empresaTrialFim').value = e.trial_fim ? e.trial_fim.slice(0, 10) : '';
      document.getElementById('empresaBloqueada').value = e.bloqueada ? 'true' : 'false';
      document.getElementById('empresaMotivoBloqueio').value = e.motivo_bloqueio || '';
      document.getElementById('empresaStatusFields').classList.remove('hidden');
      openModal('modalEmpresa');
    } catch (err) {
      showToast('Erro ao carregar empresa: ' + err.message, 'error');
    }
  };

  window.salvarEmpresa = async function () {
    const id = document.getElementById('empresaEditId').value;
    const nome = document.getElementById('empresaNome').value.trim();

    if (!id && !nome) return showToast('Nome é obrigatório', 'error');

    try {
      if (id) {
        await api(`/admin/empresas/${id}/status`, {
          method: 'PUT',
          body: {
            plano_id: document.getElementById('empresaPlano').value || null,
            assinatura_status: document.getElementById('empresaStatus').value,
            trial_fim: document.getElementById('empresaTrialFim').value || null,
            bloqueada: document.getElementById('empresaBloqueada').value === 'true',
            motivo_bloqueio: document.getElementById('empresaMotivoBloqueio').value || null
          }
        });
      } else {
        await api('/admin/empresas', {
          method: 'POST',
          body: {
            nome,
            email: document.getElementById('empresaEmail').value || null,
            telefone: document.getElementById('empresaTelefone').value || null,
            plano_id: document.getElementById('empresaPlano').value || null,
            trial_dias: Number(document.getElementById('empresaTrialDias').value) || 30
          }
        });
      }

      closeModal('modalEmpresa');
      document.getElementById('empresaNome').disabled = false;
      showToast(id ? 'Empresa atualizada!' : 'Empresa criada!', 'success');
      carregarEmpresas();
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };

  window.exportarEmpresa = async function (id, nome) {
    try {
      showToast('Exportando dados...');
      const data = await api(`/admin/empresas/${id}/exportar`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lferp-export-${nome.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Exportado com sucesso!', 'success');
    } catch (err) {
      showToast('Erro ao exportar: ' + err.message, 'error');
    }
  };

  // ══════════════════════════════════════════════════════
  //  PLANOS
  // ══════════════════════════════════════════════════════

  async function carregarPlanos() {
    try {
      planosCache = await api('/admin/planos');
      renderPlanos(planosCache);
    } catch (e) {
      document.getElementById('planosBody').innerHTML =
        `<tr class="loading-row"><td colspan="8">Erro: ${e.message}</td></tr>`;
    }
  }

  async function carregarPlanosSelect() {
    if (!planosCache.length) planosCache = await api('/admin/planos').catch(() => []);
    const sel = document.getElementById('empresaPlano');
    sel.innerHTML = '<option value="">Sem plano</option>' +
      planosCache.map(p => `<option value="${p.id}">${p.nome} (${p.codigo})</option>`).join('');
  }

  function limiteStr(v) {
    const n = Number(v || 0);
    return n === 0 ? '<span style="color:var(--text-muted)">∞</span>' : n;
  }

  function renderPlanos(planos) {
    const tbody = document.getElementById('planosBody');
    if (!planos.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa fa-tags"></i><p>Nenhum plano cadastrado</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = planos.map(p => `
      <tr>
        <td><code style="background:var(--surface-3);padding:2px 7px;border-radius:5px;font-size:12px">${p.codigo}</code></td>
        <td><strong>${p.nome}</strong></td>
        <td>R$ ${Number(p.preco_mensal || 0).toFixed(2)}</td>
        <td style="text-align:center">${limiteStr(p.limite_usuarios)}</td>
        <td style="text-align:center">${limiteStr(p.limite_produtos)}</td>
        <td style="text-align:center">${limiteStr(p.limite_clientes)}</td>
        <td style="text-align:center">${limiteStr(p.limite_vendas_mes)}</td>
        <td><button class="btn btn-secondary btn-sm" onclick="editarPlano(${p.id})"><i class="fa fa-pencil"></i> Editar</button></td>
      </tr>
    `).join('');
  }

  window.openModalPlano = function () {
    document.getElementById('planoEditId').value = '';
    document.getElementById('modalPlanoTitulo').textContent = 'Novo Plano';
    document.getElementById('planoCodigo').value = '';
    document.getElementById('planoCodigo').disabled = false;
    document.getElementById('planoNome').value = '';
    document.getElementById('planoPreco').value = '';
    document.getElementById('planoLimUsuarios').value = '';
    document.getElementById('planoLimProdutos').value = '';
    document.getElementById('planoLimClientes').value = '';
    document.getElementById('planoLimVendas').value = '';
    openModal('modalPlano');
  };

  window.editarPlano = function (id) {
    const p = planosCache.find(x => x.id === id);
    if (!p) return;
    document.getElementById('planoEditId').value = id;
    document.getElementById('modalPlanoTitulo').textContent = `Editar: ${p.nome}`;
    document.getElementById('planoCodigo').value = p.codigo;
    document.getElementById('planoCodigo').disabled = true;
    document.getElementById('planoNome').value = p.nome;
    document.getElementById('planoPreco').value = p.preco_mensal || '';
    document.getElementById('planoLimUsuarios').value = p.limite_usuarios || '';
    document.getElementById('planoLimProdutos').value = p.limite_produtos || '';
    document.getElementById('planoLimClientes').value = p.limite_clientes || '';
    document.getElementById('planoLimVendas').value = p.limite_vendas_mes || '';
    openModal('modalPlano');
  };

  window.salvarPlano = async function () {
    const id = document.getElementById('planoEditId').value;
    const codigo = document.getElementById('planoCodigo').value.trim();
    const nome = document.getElementById('planoNome').value.trim();
    if (!nome || (!id && !codigo)) return showToast('Código e nome são obrigatórios', 'error');

    const body = {
      codigo, nome,
      preco_mensal: document.getElementById('planoPreco').value || 0,
      limite_usuarios: document.getElementById('planoLimUsuarios').value || 0,
      limite_produtos: document.getElementById('planoLimProdutos').value || 0,
      limite_clientes: document.getElementById('planoLimClientes').value || 0,
      limite_vendas_mes: document.getElementById('planoLimVendas').value || 0
    };

    try {
      if (id) {
        await api(`/admin/planos/${id}`, { method: 'PUT', body });
      } else {
        await api('/admin/planos', { method: 'POST', body });
      }
      closeModal('modalPlano');
      showToast(id ? 'Plano atualizado!' : 'Plano criado!', 'success');
      planosCache = [];
      carregarPlanos();
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };

  // ══════════════════════════════════════════════════════
  //  LOGS
  // ══════════════════════════════════════════════════════

  window.carregarLogs = async function () {
    document.getElementById('logsBody').innerHTML =
      `<tr class="loading-row"><td colspan="6"><i class="fa fa-spinner fa-spin"></i> Buscando...</td></tr>`;
    try {
      const logs = await api('/admin/logs', {
        query: {
          empresa: document.getElementById('logEmpresa').value,
          modulo: document.getElementById('logModulo').value,
          acao: document.getElementById('logAcao').value,
          dataInicial: document.getElementById('logDataInicial').value,
          dataFinal: document.getElementById('logDataFinal').value
        }
      });
      renderLogs(logs);
    } catch (e) {
      document.getElementById('logsBody').innerHTML =
        `<tr class="loading-row"><td colspan="6">Erro: ${e.message}</td></tr>`;
    }
  };

  function renderLogs(logs) {
    const tbody = document.getElementById('logsBody');
    if (!logs.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa fa-search"></i><p>Nenhum log encontrado</p></div></td></tr>`;
      return;
    }

    const acaoBadge = (a) => {
      if (a === 'login') return `<span class="badge badge-ativo">${a}</span>`;
      if (a === 'login_falha') return `<span class="badge badge-bloqueado">${a}</span>`;
      if (a === 'logout') return `<span class="badge badge-inativo">${a}</span>`;
      if (a === 'soft_delete') return `<span class="badge badge-bloqueado">${a}</span>`;
      return `<span class="badge badge-trial">${a}</span>`;
    };

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td style="white-space:nowrap;font-size:12px">${formatDateTime(l.criado_em)}</td>
        <td>${l.empresa || '<span style="color:var(--text-muted)">—</span>'}</td>
        <td>${l.usuario_nome || '<span style="color:var(--text-muted)">—</span>'}</td>
        <td><code style="font-size:12px">${l.modulo}</code></td>
        <td>${acaoBadge(l.acao)}</td>
        <td style="font-size:12px;color:var(--text-muted)">${l.ip || '—'}</td>
      </tr>
    `).join('');
  }

  // ── Utils ────────────────────────────────────────────
  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('pt-BR');
  }

  function formatDateTime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  // ══════════════════════════════════════════════════════
  //  BILLING DE ASSINATURAS
  // ══════════════════════════════════════════════════════

  window.carregarBilling = async function () {
    const corpo = document.getElementById('billingCorpo');
    if (!corpo) return;
    corpo.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted)"><i class="fa fa-spinner fa-spin"></i> Carregando...</div>';

    try {
      const [configRes, empresasRes] = await Promise.all([
        api('/admin/billing/config'),
        api('/admin/empresas')
      ]);

      const sandbox = configRes.asaas_sandbox !== false;
      const temChave = configRes.asaas_api_key && configRes.asaas_api_key !== '****';

      corpo.innerHTML = `
        <!-- Config Asaas do SaaS -->
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:24px">
          <h4 style="margin:0 0 12px;font-size:14px;font-weight:700">
            <i class="fa fa-gear"></i> Configuração Asaas (SaaS Owner)
          </h4>
          ${!temChave ? `<div class="badge badge-expirado" style="margin-bottom:12px">
            <i class="fa fa-exclamation-triangle"></i> API Key não configurada — cobranças em modo demo
          </div>` : ''}
          <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end;max-width:500px">
            <div>
              <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">API KEY ASAAS</label>
              <input id="billingApiKey" type="password" placeholder="${temChave ? '****  (configurada)' : '$aact_...'}"
                style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;box-sizing:border-box" />
            </div>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;white-space:nowrap">
              <input type="checkbox" id="billingAsaasSandbox" ${sandbox ? 'checked' : ''} /> Sandbox
            </label>
          </div>
          <button onclick="salvarBillingConfig()" class="btn btn-primary btn-sm" style="margin-top:10px">
            <i class="fa fa-save"></i> Salvar configuração
          </button>
        </div>

        <!-- Tabela de empresas para cobrança -->
        <h4 style="margin:0 0 12px;font-size:14px;font-weight:700">Empresas — Cobranças</h4>
        <div class="table-responsive">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="border-bottom:2px solid var(--border)">
                <th style="text-align:left;padding:8px 10px">Empresa</th>
                <th style="text-align:left;padding:8px 10px">Status</th>
                <th style="text-align:left;padding:8px 10px">Plano</th>
                <th style="text-align:right;padding:8px 10px">Valor</th>
                <th style="text-align:left;padding:8px 10px">Trial/Vencimento</th>
                <th style="text-align:center;padding:8px 10px">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${empresasRes.map(e => {
                const preco = Number(e.plano_preco_mensal || 0);
                return `
                  <tr style="border-bottom:1px solid var(--border)" id="billingRow_${e.id}">
                    <td style="padding:8px 10px">
                      <strong>${e.nome}</strong>
                      ${e.email ? `<br><small style="color:var(--text-muted)">${e.email}</small>` : ''}
                    </td>
                    <td style="padding:8px 10px">${badgeEmpresa(e)}</td>
                    <td style="padding:8px 10px">${e.plano_nome || '—'}</td>
                    <td style="padding:8px 10px;text-align:right">${preco > 0 ? `R$ ${preco.toFixed(2)}` : '—'}</td>
                    <td style="padding:8px 10px;font-size:12px">${e.trial_fim ? formatDate(e.trial_fim) : '—'}</td>
                    <td style="padding:8px 10px;text-align:center">
                      <button class="btn btn-secondary btn-sm"
                        onclick="gerarCobrancaEmpresa(${e.id}, '${e.nome.replace(/'/g,"\\'")}', ${preco})">
                        <i class="fa fa-barcode"></i> Cobrar
                      </button>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (e) {
      if (corpo) corpo.innerHTML = `<div class="empty-state">Erro: ${e.message}</div>`;
    }
  };

  window.salvarBillingConfig = async function () {
    try {
      await api('/admin/billing/config', {
        method: 'PUT',
        body: {
          asaas_api_key: document.getElementById('billingApiKey')?.value?.trim() || null,
          asaas_sandbox: document.getElementById('billingAsaasSandbox')?.checked ?? true
        }
      });
      showToast('Configuração salva!', 'success');
      document.getElementById('billingApiKey').value = '';
    } catch (e) {
      showToast(`Erro: ${e.message}`, 'error');
    }
  };

  window.gerarCobrancaEmpresa = async function (empresaId, nome, preco) {
    if (!preco || preco <= 0) {
      showToast('Empresa sem plano com preço configurado.', 'error');
      return;
    }

    const vencimento = prompt(`Vencimento da cobrança para "${nome}" (YYYY-MM-DD):`, addDias(new Date().toISOString().slice(0,10), 5));
    if (!vencimento) return;

    try {
      const r = await api(`/admin/billing/cobrar/${empresaId}`, {
        method: 'POST',
        body: { valor: preco, vencimento }
      });
      showToast(r.mensagem || 'Cobrança gerada!', 'success');
      if (r.boleto?.invoiceUrl) window.open(r.boleto.invoiceUrl, '_blank');
    } catch (e) {
      showToast(`Erro: ${e.message}`, 'error');
    }
  };

  function addDias(dateStr, dias) {
    const d = new Date(`${dateStr}T12:00:00`);
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  }

  // ── Init ─────────────────────────────────────────────
  carregarEmpresas();
  carregarPlanosSelect();

})();
