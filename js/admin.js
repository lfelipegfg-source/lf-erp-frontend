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
    alert('Acesso restrito a administradores.');
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
          <button class="btn btn-secondary btn-sm" onclick="editarEmpresa(${e.id})"><i class="fa fa-pencil"></i> Editar</button>
          <button class="btn btn-secondary btn-sm" onclick="exportarEmpresa(${e.id}, '${e.nome.replace(/'/g, "\\'")}')"><i class="fa fa-download"></i></button>
        </td>
      </tr>
    `).join('');
  }

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

  // ── Init ─────────────────────────────────────────────
  carregarEmpresas();
  carregarPlanosSelect();

})();
