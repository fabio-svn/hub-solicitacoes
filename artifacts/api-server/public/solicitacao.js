    const CLICKUP_ICON = getClickupIcon();

    function isTipoAutomacao(tipo) {
      return TIPOS_AUTOMACAO.includes(tipo);
    }

    const params = new URLSearchParams(window.location.search);
    const solicitacaoId = params.get('id');

    /* ── util ─────────────────────────────────── */
    function dataRelativa(dateStr) {
      if (!dateStr) return '—';
      const d = new Date(dateStr);
      const agora = new Date();
      const diff = agora - d;
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(diff / 3600000);
      const dias = Math.floor(diff / 86400000);
      if (mins < 1) return 'agora mesmo';
      if (mins < 60) return `há ${mins} min`;
      if (hrs < 24) {
        const h = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return `hoje às ${h}`;
      }
      if (dias === 1) return 'ontem';
      if (dias < 7) return `há ${dias} dias`;
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function toggleKebabMenu() {
      const m = document.getElementById('solKebabMenu');
      if (!m) return;
      m.hidden = !m.hidden;
    }
    document.addEventListener('click', function(e) {
      const m = document.getElementById('solKebabMenu');
      if (!m || m.hidden) return;
      if (!e.target.closest('.sol-actions-kebab')) m.hidden = true;
    });

    /* ── init ─────────────────────────────────── */
    async function init() {
      await _configReady;
      await Auth.init();
      if (!Auth.isAuthenticated()) {
        window.location.href = '/auth/login?redirect=/solicitacao.html?id=' + solicitacaoId;
        return;
      }
      Shell.render({ activeRoute: 'solicitacao', contentEl: document.getElementById('shellPageContent') });
      if (!solicitacaoId) { window.location.href = '/dashboard.html'; return; }
      await loadSolicitacao();
    }

    async function loadSolicitacao() {
      try {
        const res = await fetch('/api/solicitacoes/' + solicitacaoId);
        if (!res.ok) { window.location.href = '/dashboard.html'; return; }
        const item = await res.json();
        if (item.status === 'em-aprovacao' && typeof Auth !== 'undefined' && Auth.marcarComoLido) {
          Auth.marcarComoLido(item.id);
        }
        renderPage(item);
        syncStatus(item);
      } catch (e) {
        console.error('[Solicitação] erro ao carregar:', e);
        window.location.href = '/dashboard.html';
      }
    }

    let _syncing = false;

    async function syncStatus(item) {
      if (_syncing) return;
      _syncing = true;
      try {
        const r = await fetch('/api/solicitacoes/' + solicitacaoId + '/status');
        if (!r.ok) return;
        const d = await r.json();
        const prazoMudou = d.prazo_alterado_em && d.prazo_alterado_em !== item.prazo_alterado_em;
        const statusMudou = d.updated && d.status && d.status !== item.status;
        // sincroniza os campos de prazo silenciosamente
        if (d.prazo) item.prazo = d.prazo;
        if (d.prazo_anterior) item.prazo_anterior = d.prazo_anterior;
        if (d.prazo_motivo !== undefined) item.prazo_motivo = d.prazo_motivo;
        if (d.prazo_alterado_em) item.prazo_alterado_em = d.prazo_alterado_em;
        if (statusMudou) item.status = d.status;
        if (statusMudou || prazoMudou) {
          renderPage(item);
          if (prazoMudou && window.showToast) showToast('O prazo desta solicitação foi atualizado.', 'info');
        }
      } catch {}
      finally { _syncing = false; }
    }

    function cleanResponsavel(nome) {
      if (!nome) return '';
      const t = String(nome).trim();
      if (/^assignee\s+clickup\b/i.test(t)) return '';
      return t;
    }

    function nomeFromEmail(email) {
      if (!email) return '';
      const lp = String(email).split('@')[0];
      return lp.split(/[._-]+/).filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }

    function renderFacts(item, dados) {
      const facts = document.getElementById('solFacts');
      if (!facts) return;
      if (isTipoAutomacao(item.tipo_solicitacao)) { facts.style.display = 'none'; return; }
      // display fica com o CSS: no celular a barra de fatos vira lista (display:block).
      facts.style.display = '';

      const DIAS_ABBR = ['dom','seg','ter','qua','qui','sex','sáb'];

      // ── Prazo ──
      const cellPrazo = document.getElementById('factPrazo');
      const cellPrazoRel = document.getElementById('factPrazoRel');
      const cellPrazoAlt = document.getElementById('factPrazoAlterado');
      if (item.prazo) {
        const pd = new Date(item.prazo);
        const fmt = String(pd.getDate()).padStart(2,'0') + '/' + String(pd.getMonth()+1).padStart(2,'0') + '/' + pd.getFullYear();
        const finalizado = ['concluido','publicado','cancelado','reprovado'].includes(item.status);
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        const alvo = new Date(pd); alvo.setHours(0,0,0,0);
        const diff = Math.round((alvo - hoje) / 86400000);
        let bg, fg, br, rel;
        if (finalizado) { bg='var(--ink-05)'; fg='var(--ink-70)'; br='var(--ink-12)'; rel=''; }
        // Ja aprovado e so aguardando publicacao: vencido e pendencia, nao alarme.
        else if (diff < 0) {
          const prazoVencidoSuave = ['aprovado','em-aprovacao','validado'].includes(item.status);
          bg = prazoVencidoSuave ? 'rgba(234,88,12,0.08)' : 'rgba(220,38,38,0.08)';
          fg = prazoVencidoSuave ? 'var(--warning)' : 'var(--danger-strong)';
          br = prazoVencidoSuave ? 'rgba(234,88,12,0.25)' : 'rgba(220,38,38,0.25)';
          rel = 'atrasado há ' + Math.abs(diff) + (Math.abs(diff)===1?' dia':' dias');
        }
        else if (diff === 0) { bg='rgba(220,38,38,0.08)'; fg='var(--danger-strong)'; br='rgba(220,38,38,0.25)'; rel='é hoje'; }
        else if (diff <= 2) { bg='rgba(234,88,12,0.08)'; fg='var(--warning)'; br='rgba(234,88,12,0.25)'; rel='em ' + diff + (diff===1?' dia':' dias'); }
        else { bg='rgba(22,163,74,0.08)'; fg='var(--success)'; br='rgba(22,163,74,0.22)'; rel='em ' + diff + ' dias'; }
        cellPrazo.style.background = bg; cellPrazo.style.borderColor = br;
        cellPrazo.querySelector('.fact-label').style.color = fg;
        const val = cellPrazo.querySelector('.fact-value');
        val.style.color = fg;
        val.textContent = fmt + ' · ' + DIAS_ABBR[pd.getDay()];
        if (rel) { cellPrazoRel.textContent = rel; cellPrazoRel.style.color = fg; cellPrazoRel.style.display = 'block'; }
        else { cellPrazoRel.style.display = 'none'; }
        if (item.prazo_alterado_em) {
          const antes = item.prazo_anterior ? new Date(item.prazo_anterior) : null;
          const antesFmt = antes ? (String(antes.getDate()).padStart(2,'0') + '/' + String(antes.getMonth()+1).padStart(2,'0') + '/' + antes.getFullYear()) : '';
          const motivo = (item.prazo_motivo && String(item.prazo_motivo).trim()) ? String(item.prazo_motivo).trim() : 'Sem justificativa informada';
          const altData = document.getElementById('factPrazoAltData');
          if (antesFmt) { altData.textContent = 'Prazo anterior: ' + antesFmt; altData.style.display = 'block'; }
          else { altData.style.display = 'none'; }
          document.getElementById('factPrazoAltMotivo').textContent = motivo;
          cellPrazoAlt.style.display = 'block';
        } else { cellPrazoAlt.style.display = 'none'; }
        cellPrazo.style.display = '';
      } else {
        cellPrazo.style.display = 'none';
      }

      // ── Responsável ──
      const cellResp = document.getElementById('factResp');
      const respNome = cleanResponsavel(item.responsavel);
      if (respNome) {
        document.getElementById('factRespValue').textContent = respNome;
        cellResp.style.display = '';
      } else {
        cellResp.style.display = 'none';
      }

      // ── Solicitante (nome, com fallback derivado do e-mail) ──
      const elSolic = document.getElementById('factSolicValue');
      const nomeSolic = (item.solicitante_nome && String(item.solicitante_nome).trim())
        || nomeFromEmail(item.user_email)
        || (item.user_email || '—');
      elSolic.textContent = nomeSolic;
      if (item.user_email) elSolic.title = item.user_email;

      // Quando solicitante e responsavel sao a mesma pessoa, um card basta.
      const cellSolic = document.getElementById('factSolic');
      if (cellSolic) {
        const norm = (x) => String(x || '').trim().toLowerCase();
        const mesmaPessoa = respNome && norm(respNome) === norm(nomeSolic);
        cellSolic.style.display = mesmaPessoa ? 'none' : '';
      }

      // ── Aberto em ──
      const dt = new Date(item.created_at);
      document.getElementById('factAbertoValue').textContent =
        String(dt.getDate()).padStart(2,'0') + '/' + String(dt.getMonth()+1).padStart(2,'0') + '/' + dt.getFullYear() +
        ' · ' + dt.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    }

    /* ── renderPage ───────────────────────────── */
    function renderPage(item) {
      const isAutomation = isTipoAutomacao(item.tipo_solicitacao);
      if (isAutomation) {
        document.getElementById('solMeta').style.display = 'none';
        const f = document.getElementById('solFacts'); if (f) f.style.display = 'none';
        document.getElementById('dadosCard').style.display = 'none';
      }
      document.getElementById('skeletonLoader').style.display = 'none';
      document.getElementById('pageContent').style.display = 'block';

      let dados = {};
      try { dados = typeof item.dados === 'string' ? JSON.parse(item.dados) : (item.dados || {}); } catch {}

      const titulo = dados.nomeEvento || dados.tituloEvento || dados.titulo || dados.nome_completo || dados.nomeCompleto ||
        (TIPO_SOLICITACAO_LABELS[item.tipo_solicitacao] || item.tipo_solicitacao);
      const tipoLabel = TIPO_SOLICITACAO_LABELS[item.tipo_solicitacao] || item.tipo_solicitacao;
      const statusObj = getStatusVisual(item);

      // ── Layout clean para todos os tipos de automação ──────────────
      if (isTipoAutomacao(item.tipo_solicitacao)) {
        const isAdm = isCurrentUserAdmin();
        const isStaff = isCurrentUserStaff();

        const tEl = document.getElementById('solTitulo');
        tEl.textContent = tipoLabel;
        document.title = tipoLabel + ' — Hub SVN';

        document.getElementById('solMeta').style.display = 'none';
        const _fAut = document.getElementById('solFacts'); if (_fAut) _fAut.style.display = 'none';

        const isConcluido = item.status === 'concluido';
        const dtAut = new Date(item.updated_at || item.created_at);
        const dtFormatted = dtAut.toLocaleDateString('pt-BR', {
          day: 'numeric', month: 'long', year: 'numeric'
        }) + ' — ' + dtAut.toLocaleTimeString('pt-BR', {
          hour: '2-digit', minute: '2-digit'
        });
        const dtAutRel = dataRelativa(item.updated_at || item.created_at);
        const headerRight = document.getElementById('solHeaderRight');
        headerRight.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;text-align:right">
            <span style="color:${isConcluido ? '#0A9060' : '#92400e'};font-weight:600;font-size:0.9rem;font-family:'Nunito Sans', sans-serif">${isConcluido ? 'Material disponível' : 'Em processamento'}</span>
            <span style="font-size:0.75rem;opacity:0.45;font-family:'Nunito Sans', sans-serif" title="${dtFormatted}">Atualizado: ${dtAutRel}</span>
            ${isAdm ? `<div class="sol-actions-kebab">
              <button class="kebab-btn" onclick="toggleKebabMenu()" aria-label="Mais ações">⋯</button>
              <div class="kebab-menu" id="solKebabMenu" hidden>
                <button class="kebab-item kebab-danger" onclick="abrirModalExcluir(${item.id})">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                  Deletar solicitação
                </button>
              </div>
            </div>` : ''}
          </div>`;

        renderFluxo(item);
        renderEntregaAutomacao(item);
        renderDados(dados, item);

        document.getElementById('solRodape').innerHTML = `<span>ID interno: ${item.id}</span>`;
        return;
      }
      // ───────────────────────────────────────────────────────────────

      document.getElementById('solTitulo').textContent = titulo;
      document.title = titulo + ' — Hub SVN';
      const elEye = document.getElementById('solEyebrow');
      if (elEye) {
        if (titulo !== tipoLabel) { elEye.textContent = tipoLabel; elEye.style.display = 'block'; }
        else { elEye.style.display = 'none'; }
      }

      // Meta enxuta: setor / natureza (sem repetir o tipo; solicitante e data vão na barra de fatos)
      const metaParts = [];
      if (dados.setor) metaParts.push(esc(dados.setor));
      if (dados.natureza) metaParts.push(dados.natureza === 'presencial' ? 'Presencial' : 'Online');
      document.getElementById('solMeta').innerHTML = metaParts
        .map((p, i) => (i ? '<span class="sol-meta-sep"></span>' : '') + '<span>' + p + '</span>')
        .join('');

      renderFacts(item, dados);

      renderFluxo(item);
      if (isTipoAutomacao(item.tipo_solicitacao)) {
        renderEntregaAutomacao(item);
      } else {
        renderAprovacao(item, dados);
      }
      pesquisaSeAplicavel(item);
      renderDados(dados, item);

      const isAdm = isCurrentUserAdmin();
      const isStaff = isCurrentUserStaff();
      if (isAdm || isStaff) mostrarAtividade();
      document.getElementById('solRodape').innerHTML =
        `<span>ID interno: ${item.id}</span>` +
        (dados.idSolicitacao ? `<span>Código: ${esc(dados.idSolicitacao)}</span>` : '') +
        (!isStaff && item.clickup_task_id ? `<span>ClickUp: ${esc(item.clickup_task_id)}</span>` : '');

      const headerRight = document.getElementById('solHeaderRight');

      const statusBadge = statusBadgeHtml(statusObj, { classe: 'sol-status-badge', id: 'solStatus' });

      // Paginas de assessor nao usam mais ClickUp — o fluxo e a validacao interna.
      const TIPOS_SEM_CLICKUP = ['pagina-assessores-dados', 'pagina-assessores-atualizacao'];
      const mostraClickup = isStaff && item.clickup_url && !TIPOS_SEM_CLICKUP.includes(item.tipo_solicitacao);
      const clickupBtn = (mostraClickup ? `
          <a href="${esc(item.clickup_url)}" target="_blank" rel="noopener" title="Abrir no ClickUp"
             style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:var(--radius-md);background:rgba(137,48,253,0.08);text-decoration:none;transition:background 0.15s"
             onmouseover="this.style.background='rgba(137,48,253,0.15)'" onmouseout="this.style.background='rgba(137,48,253,0.08)'">
            ${CLICKUP_ICON}
          </a>` : '');

      const avaliacaoBtn = (isAdm ? (() => {
        const nota = item.avaliacao && item.avaliacao.nota;
        if (nota) {
          const cor = nota >= 4 ? '#16a34a' : nota >= 3 ? '#ea580c' : 'var(--danger)';
          const corBg = nota >= 4 ? 'rgba(22,163,74,0.12)' : nota >= 3 ? 'rgba(234,88,12,0.12)' : 'rgba(220,38,38,0.12)';
          return `<button onclick="verAvaliacao(${item.id})" id="btnVerAvaliacao" title="Ver avaliação: ${nota}/5"
              style="display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 11px;border-radius:var(--radius-md);border:none;background:${corBg};color:${cor};cursor:pointer;transition:filter 0.15s"
              onmouseover="this.style.filter='brightness(0.94)'" onmouseout="this.style.filter='none'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="${cor}" stroke="${cor}" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <span style="font-size:13px;font-weight:600;line-height:1">${nota}<span style="font-size:11px;font-weight:400;opacity:0.65">/5</span></span>
            </button>`;
        }
        if (item.status === 'concluido') {
          return `<span title="Concluída — aguardando avaliação do solicitante"
              style="display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 10px;border-radius:var(--radius-md);background:transparent;opacity:0.4;cursor:default">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <span style="font-size:12px">Sem nota</span>
            </span>`;
        }
        return '';
      })() : '');

      // Menu ⋯ : Cancelar (solicitante) + Deletar (admin)
      const podeCancelar = item.canCancel && item.status !== 'cancelado' && item.status !== 'reprovado';
      let kebabItems = '';
      if (podeCancelar) {
        kebabItems += `<button class="kebab-item kebab-danger" onclick="abrirCancelarModal()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            Cancelar solicitação
          </button>`;
      }
      if (isAdm) {
        kebabItems += `<button class="kebab-item kebab-danger" onclick="abrirModalExcluir(${item.id})">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            Deletar solicitação
          </button>`;
      }
      const kebabHtml = kebabItems
        ? `<div class="sol-actions-kebab"><button class="kebab-btn" onclick="toggleKebabMenu()" aria-label="Mais ações">⋯</button><div class="kebab-menu" id="solKebabMenu" hidden>${kebabItems}</div></div>`
        : '';

      headerRight.innerHTML = statusBadge + clickupBtn + avaliacaoBtn + kebabHtml;

      montarStickyBar(titulo, statusObj);
    }

    /* ── renderFluxo (horizontal rail) ─────────── */
    /* O rotulo da etapa atual fica sobre fundo claro, mas sObj.text e a cor do
       texto DENTRO do badge (fundo escuro) — "#FFFFFF" em 15 dos 23 status, o que
       deixava o rotulo invisivel. Escolhe entre bg e text o tom mais escuro; se
       nenhum servir, cai no carbon-black. */
    function corLegivelSobreClaro(sObj) {
      const lum = (hex) => {
        const m = String(hex || '').trim().match(/^#([0-9a-f]{6})$/i);
        if (!m) return null;
        const n = parseInt(m[1], 16);
        const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
          const x = v / 255;
          return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      const cands = [sObj && sObj.text, sObj && sObj.bg]
        .map(h => ({ hex: h, l: lum(h) }))
        .filter(o => o.l !== null && o.l < 0.45);   // precisa contrastar com fundo claro
      if (!cands.length) return 'var(--carbon-black)';
      cands.sort((a, b) => a.l - b.l);
      return cands[0].hex;
    }

    function renderFluxo(item) {
      const card = document.getElementById('fluxoCard');
      if (isTipoAutomacao(item.tipo_solicitacao)) { card.style.display = 'none'; return; }
      const tipoKey = item.tipo_solicitacao === 'eventos' ? 'eventos' : '_default';
      // Paginas de assessor sem pedido de pagina sao so registro: fluxo enxuto (Concluído).
      let chaveFluxo = item.tipo_solicitacao;
      if (
        (item.tipo_solicitacao === 'pagina-assessores-dados' ||
         item.tipo_solicitacao === 'pagina-assessores-atualizacao') &&
        item.querPagina === 'nao'
      ) {
        chaveFluxo = item.tipo_solicitacao + '--registro';
      }
      const fluxo = (typeof FLUXOS_ETAPAS !== 'undefined')
        ? (FLUXOS_ETAPAS[chaveFluxo] || FLUXOS_ETAPAS[item.tipo_solicitacao] || FLUXOS_ETAPAS[tipoKey] || [])
        : [];
      const etapasVis = fluxo.filter(e => e.visivel);
      let excepcional = fluxo.find(e => !e.visivel && e.id === item.status);
      if (!excepcional && (item.status === 'cancelado' || item.status === 'reprovado')) {
        excepcional = { id: item.status, label: getStatus(item.status).label, visivel: false };
      }
      const idxAtual = etapasVis.findIndex(e => e.id === item.status);

      if (etapasVis.length === 0 && !excepcional) { card.style.display = 'none'; return; }

      if (excepcional) {
        const sObj = getStatus(item.status);
        if (item.status === 'cancelado') {
          card.innerHTML = `
            <div style="display:flex;align-items:flex-start;gap:10px;padding:14px 16px;background:rgba(200,40,40,0.07);border:1px solid rgba(200,40,40,0.22);border-radius:var(--radius-lg)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C82828" stroke-width="1.5" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              <div>
                <div style="font-size:0.9rem;font-weight:700;color:#C82828">Solicitação cancelada</div>
                <div style="font-size:0.8rem;opacity:0.6;margin-top:2px">Esta solicitação foi cancelada e não está mais em andamento.</div>
              </div>
            </div>`;
          return;
        }
        card.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;padding:8px 0">
            <div style="width:10px;height:10px;border-radius:var(--radius-round);background:${sObj.text || 'var(--danger)'};flex-shrink:0"></div>
            <span style="font-size:0.875rem;font-weight:700;color:${sObj.text || 'var(--danger)'}">${excepcional.label}</span>
          </div>`;
        return;
      }

      const stepsHtml = etapasVis.map((etapa, idx) => {
        const isConcluida = idx < idxAtual || idxAtual < 0 && item.status === 'concluido';
        const isAtual = idx === idxAtual;
        const isFutura = !isConcluida && !isAtual;
        const sObj = getStatus(etapa.id);
        const isFirst = idx === 0;
        const isLast = idx === etapasVis.length - 1;

        const circClass = isConcluida ? 'done' : isAtual ? 'current' : '';
        const circStyle = isAtual
          ? `style="--current-color:${sObj.text || '#3B82F6'};--current-bg:${sObj.bg || '#DBEAFE'}"`
          : '';
        const iconInner = isConcluida
          ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>`
          : isAtual
            ? `<div style="width:7px;height:7px;border-radius:var(--radius-round);background:${sObj.text || '#3B82F6'}"></div>`
            : '';

        const lineLeftClass = idx === 0 ? 'invisible' : isConcluida || (isAtual && idx <= idxAtual) ? 'done' : '';
        const lineRightClass = isLast ? 'invisible' : isConcluida ? 'done' : '';

        const lblClass = isConcluida ? 'done' : isAtual ? 'current' : '';
        const lblStyle = isAtual ? `style="--current-color:${corLegivelSobreClaro(sObj)}"` : '';

        return `
          <div class="status-step">
            <div class="status-step-track">
              <div class="status-step-line ${lineLeftClass}"></div>
              <div class="status-step-circle ${circClass}" ${circStyle}>${iconInner}</div>
              <div class="status-step-line ${lineRightClass}"></div>
            </div>
            <div class="status-step-label ${lblClass}" ${lblStyle}>${esc(etapa.label)}</div>
          </div>`;
      }).join('');

      // FLUXO-RESUMO: no celular o rail vertical custava ~200px para dizer o que
      // cabe em uma linha. O rail completo continua a um toque de distancia.
      // Status fora do fluxo (idxAtual < 0) nao vira contador: o rail ja mostra
      // todas as etapas apagadas, e "Etapa 3 de 3" seria mentira.
      const etapaAtual = idxAtual >= 0 ? etapasVis[idxAtual] : null;
      const foraDoFluxo = idxAtual < 0;
      const concluidoFora = foraDoFluxo && item.status === 'concluido';
      const passo = concluidoFora ? etapasVis.length : idxAtual + 1;
      const pct = foraDoFluxo ? (concluidoFora ? 100 : 0) : Math.round((passo / etapasVis.length) * 100);
      const sObjAtual = getStatus(etapaAtual ? etapaAtual.id : item.status);
      const corAtual = corLegivelSobreClaro(sObjAtual);
      const contadorHtml = (foraDoFluxo && !concluidoFora)
        ? ''
        : `<b>Etapa ${passo} de ${etapasVis.length}</b><span class="fluxo-resumo-sep">\u00b7</span>`;
      const resumoHtml = `
        <button type="button" class="fluxo-resumo" id="fluxoResumo" onclick="toggleFluxo()" aria-expanded="false" aria-controls="fluxoCard">
          <span class="fluxo-resumo-txt">${contadorHtml}<span style="color:${corAtual};font-weight:700">${esc(etapaAtual ? etapaAtual.label : (sObjAtual.label || 'Em andamento'))}</span></span>
          <span class="fluxo-bar"><span class="fluxo-bar-fill" style="width:${pct}%;background:${corAtual}"></span></span>
          <svg class="fluxo-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>`;

      card.innerHTML = `
        <p class="fluxo-eyebrow" style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;opacity:0.38;margin-bottom:14px">Andamento</p>
        ${resumoHtml}
        <div class="status-rail-scroll"><div class="status-rail">${stepsHtml}</div></div>`;
    }

    /* ── Sistema de Aprovação v2 — storage de rodadas ── */
    const APROVACAO_KEY = id => 'aprovacao_v2_' + id;

    function getRodadas(solId) {
      try {
        const raw = localStorage.getItem(APROVACAO_KEY(solId));
        return raw ? JSON.parse(raw) : [];
      } catch { return []; }
    }

    function saveRodadas(solId, rodadas) {
      try {
        localStorage.setItem(APROVACAO_KEY(solId), JSON.stringify(rodadas));
      } catch {}
    }

    function getLinksHash(links) {
      return links.map(l => l.url).sort().join('|');
    }

    function resolveRodadaAtual(solId, linksAtuais) {
      const rodadas = getRodadas(solId);
      if (rodadas.length === 0) {
        const nova = { numero: 1, links: linksAtuais, decisao: null, mensagens: [], data: new Date().toISOString() };
        saveRodadas(solId, [nova]);
        return { rodadas: [nova], rodadaAtual: nova, isNova: true };
      }
      const ultima = rodadas[rodadas.length - 1];
      const hashAtual  = getLinksHash(linksAtuais);
      const hashUltima = getLinksHash(ultima.links || []);

      if (ultima.decisao !== null && hashAtual !== hashUltima) {
        const nova = { numero: rodadas.length + 1, links: linksAtuais, decisao: null, mensagens: [], data: new Date().toISOString() };
        rodadas.push(nova);
        saveRodadas(solId, rodadas);
        return { rodadas, rodadaAtual: nova, isNova: true };
      }

      if (ultima.decisao !== null) {
        return { rodadas, rodadaAtual: ultima, isNova: false };
      }

      return { rodadas, rodadaAtual: ultima, isNova: false };
    }

    /* ── renderEntregaAutomacao ── */
    async function renderEntregaAutomacao(item) {
      const card = document.getElementById('aprovacaoCard');

      if (!isTipoAutomacao(item.tipo_solicitacao)) return;

      let links = [];
      let entregaStatus = item.status;
      try {
        const res = await fetch('/api/solicitacoes/' + item.id + '/entrega');
        if (res.ok) {
          const data = await res.json();
          links = data.links || [];
          if (data.status) entregaStatus = data.status;
        }
      } catch {}

      if (links.length === 0) {
        card.style.display = 'block';

        if (entregaStatus === 'erro') {
          card.innerHTML = `
            <div class="form-card" style="padding:20px 24px">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:36px;height:36px;border-radius:var(--radius-round);background:rgba(220,38,38,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <div>
                  <div style="font-weight:700;font-size:0.92rem;color:var(--danger)">Erro na geração</div>
                  <div style="font-size:0.78rem;opacity:0.55;margin-top:2px">
                    Houve um problema ao gerar o material. Entre em contato com o time de Marketing.
                  </div>
                </div>
              </div>
            </div>`;
          return;
        }

        card.innerHTML = `
          <div class="form-card" style="padding:20px 24px">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:36px;height:36px;border-radius:var(--radius-round);background:var(--ink-08);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div>
                <div style="font-weight:700;font-size:0.92rem">Processando...</div>
                <div style="font-size:0.78rem;opacity:0.42;margin-top:2px">
                  Seu material está sendo gerado. A página irá atualizar automaticamente.
                </div>
              </div>
            </div>
          </div>`;
        let _pollCount = 0;
        const _pollTimer = setInterval(async () => {
          if (++_pollCount > 30) { clearInterval(_pollTimer); return; }
          try {
            const r = await fetch('/api/solicitacoes/' + item.id + '/entrega');
            if (!r.ok) return;
            const d = await r.json();
            if (d.status === 'erro') {
              clearInterval(_pollTimer);
              await renderEntregaAutomacao(item);
              return;
            }
            if (d.links && d.links.length > 0) {
              clearInterval(_pollTimer);
              await renderEntregaAutomacao(item);
            }
          } catch {}
        }, 4000);
        return;
      }

      card.style.display = 'block';

      const _dlIco = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
      const _altText = esc(TIPO_SOLICITACAO_LABELS[item.tipo_solicitacao] || item.tipo_solicitacao);

      if (links.length === 1) {
        const l = links[0];
        const url = l.url || '';
        const lower = url.toLowerCase().split('?')[0];
        const isPdf = lower.endsWith('.pdf');
        const isImage = /\.(png|jpe?g|webp|gif|svg)$/.test(lower);
        const ext = isPdf ? 'pdf' : (lower.match(/\.([a-z0-9]{2,5})$/)?.[1] || 'png');

        let previewHtml;
        if (isPdf) {
          previewHtml = `
            <div class="assinatura-preview-card" style="background:var(--bg-light);padding:0;overflow:hidden">
              <iframe src="${esc(url)}#toolbar=0&navpanes=0"
                      style="width:100%;height:600px;border:none;display:block;background:white"
                      title="${_altText}"></iframe>
            </div>`;
        } else if (isImage) {
          previewHtml = `
            <div class="assinatura-preview-card">
              <img src="${esc(url)}" alt="${_altText}" />
            </div>`;
        } else {
          previewHtml = `
            <div class="assinatura-preview-card" style="background:var(--bg-light);padding:40px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ink-40)" stroke-width="1.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span style="font-size:0.85rem;color:var(--ink-50)">Pré-visualização indisponível</span>
            </div>`;
        }

        card.innerHTML = `
          ${previewHtml}
          <a href="${esc(url)}" download="${esc(item.tipo_solicitacao)}-${item.id}.${ext}"
             class="btn btn-submit-gold btn-download-page">
            ${_dlIco}
            Fazer download
          </a>`;
      } else {
        const botoesHtml = links.map(l => `
          <a href="${esc(l.url)}" target="_blank" rel="noopener" download
             class="btn btn-submit-gold btn-download-assinatura btn-download-large">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            ${esc(l.label)}
          </a>
        `).join('');
        card.innerHTML = `
          <div class="form-card" style="padding:20px 24px">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
              <div style="width:36px;height:36px;border-radius:var(--radius-round);background:rgba(10,144,96,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0A9060" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <div style="font-weight:700;font-size:0.92rem">Material pronto para download</div>
                <div style="font-size:0.78rem;opacity:0.42;margin-top:2px">Clique para baixar</div>
              </div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap">${botoesHtml}</div>
          </div>`;
      }
    }

    /* ── renderAprovacao v2 ── */

    /* A pesquisa de satisfacao vivia so dentro do chat de aprovacao, entao
       aparecia para uma fatia pequena dos tipos — o painel mostrava 157
       concluidas e nenhuma nota. Aqui ela passa a valer para qualquer
       solicitacao concluida em que alguem do time trabalhou.

       Fica DE FORA a automacao: o sistema gera sozinho, nao ha atendimento a
       avaliar, e perguntar a cada pedido gera fadiga — alem de inflar a media
       e esconder os casos que importam. */
    function pesquisaSeAplicavel(item) {
      if (!item) return;
      var status = String(item.status || '');
      if (status !== 'concluido' && status !== 'publicado') return;
      if (isTipoAutomacao(item.tipo_solicitacao)) return;
      if (item.avaliacao && item.avaliacao.nota) return;
      // so quem abriu a solicitacao avalia
      try {
        var meu = (typeof Auth !== 'undefined' && Auth.getUserEmail && Auth.getUserEmail()) || '';
        if (!meu || String(item.user_email || '').toLowerCase() !== meu.toLowerCase()) return;
      } catch (_) { return; }
      if (typeof renderPesquisaSatisfacao === 'function') renderPesquisaSatisfacao(item.id);
    }

    async function renderAprovacao(item, dados) {
      const card = document.getElementById('aprovacaoCard');

      const tiposComAprovacao = [
        'eventos', 'artes-divulgacao', 'atualizacao-material',
        'conteudo-pdf-informativo',
        'apresentacao-nova', 'apresentacao-atualizar',
      ];
      if (!tiposComAprovacao.includes(item.tipo_solicitacao)) {
        card.style.display = 'none';
        return;
      }

      const temHistorico = getRodadas(item.id).length > 0;
      const isAprovacao = item.status === 'em-aprovacao';
      // Histórico somente-leitura para decisões finais
      const isHistoricoLeitura = (item.status === 'concluido' || item.status === 'reprovado') && temHistorico;

      // Chat só fica disponível em "Em aprovação" (com link de entrega). Em revisão e demais → escondido.
      if (!isAprovacao && !isHistoricoLeitura) {
        card.style.display = 'none';
        return;
      }

      // Em aprovação exige link no campo "Entrega" antes de liberar o chat
      if (isAprovacao) {
        let temLinks = false;
        try {
          const res = await fetch('/api/solicitacoes/' + item.id + '/entrega');
          if (res.ok) {
            const data = await res.json();
            temLinks = data.links && data.links.length > 0;
          }
        } catch {}
        if (!temLinks) {
          card.style.display = 'none';
          return;
        }
      }

      card.style.display = 'block';

      const storageKey = 'aprovacao_visto_' + item.id;
      const jaVisto = localStorage.getItem(storageKey) === '1';
      const mostrarDestaque = item.status === 'em-aprovacao' && !jaVisto;

      card.innerHTML = `
        <div class="form-card" id="aprovacaoCardInner" style="overflow:hidden;padding:0;transition:box-shadow 0.4s ease;${
          mostrarDestaque ? 'box-shadow:0 0 0 2px var(--ruby-red),0 8px 32px rgba(172,54,49,0.18);' : ''
        }">
          <div id="aprovacaoHeader" style="padding:20px 24px;cursor:pointer;display:flex;align-items:center;gap:12px">
            <div style="width:36px;height:36px;border-radius:var(--radius-round);background:rgba(172,54,49,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#AC3631" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:0.92rem;display:flex;align-items:center;gap:8px;line-height:1.2">
                Materiais para aprovação
                ${mostrarDestaque ? '<span style="background:var(--ruby-red);color:white;font-size:0.62rem;font-weight:800;padding:2px 8px;border-radius:var(--radius-pill);letter-spacing:0.03em;animation:badgePop 0.4s ease forwards;flex-shrink:0">NOVO</span>' : ''}
              </div>
              <div style="font-size:0.78rem;opacity:0.42;margin-top:2px" id="aprovacaoSubtitle">
                ${item.status === 'em-aprovacao' ? 'Os materiais estão prontos para sua análise' : 'Histórico de aprovação'}
              </div>
            </div>
            <svg id="aprovacaoChevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3;transition:transform 0.28s cubic-bezier(.4,0,.2,1);flex-shrink:0"><polyline points="6 9 12 15 18 9"/></svg>
          </div>

          <div id="aprovacaoBody" style="max-height:0;overflow:hidden;transition:max-height 0.35s ease">
            <div style="border-top:1px solid var(--ink-08)">
              <div id="chatLoading" style="padding:24px;text-align:center;opacity:0.4;font-size:0.85rem">
                Carregando…
              </div>
              <div id="chatUI" style="display:none">
                <div id="historicoRodadas" style="padding:0 16px;padding-top:16px"></div>
                <div class="chat-wrap" id="chatWrap"></div>
                <div class="chat-attachments" id="chatAttachments" style="display:none"></div>
                <div class="chat-input-area" id="chatInputArea">
                  <input type="file" id="chatFileInput" multiple style="display:none" onchange="onChatFilesSelected(this)">
                  <button class="chat-attach-btn" id="chatAttachBtn" disabled title="Anexar arquivo" onclick="document.getElementById('chatFileInput').click()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  </button>
                  <textarea id="chatInput" placeholder="Digite sua mensagem..." rows="1" disabled
                    oninput="autoResizeTextarea(this)"
                    onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();enviarMensagemUsuario()}"
                  ></textarea>
                  <button class="chat-send-btn" id="chatSendBtn" disabled onclick="enviarMensagemUsuario()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>`;

      let aberto = false;
      let carregado = false;

      document.getElementById('aprovacaoHeader').onclick = async () => {
        aberto = !aberto;
        const body = document.getElementById('aprovacaoBody');
        const chevron = document.getElementById('aprovacaoChevron');
        chevron.style.transform = aberto ? 'rotate(180deg)' : 'rotate(0deg)';

        if (aberto) {
          body.style.maxHeight = '900px';
          localStorage.setItem(storageKey, '1');
          if (mostrarDestaque) {
            document.getElementById('aprovacaoCardInner').style.boxShadow = '';
          }
          if (!carregado) {
            carregado = true;
            await iniciarChat(item);
          }
        } else {
          body.style.maxHeight = '0';
        }
      };
    }

    /* ── iniciarChat ── */
    async function iniciarChat(item) {
      const nomeUsuario = Auth.getUserName() || item.user_name || 'você';

      let linksAtuais = [];
      try {
        const res = await fetch('/api/solicitacoes/' + item.id + '/entrega');
        if (res.ok) {
          const data = await res.json();
          linksAtuais = data.links || [];
        }
      } catch {}

      document.getElementById('chatLoading').style.display = 'none';
      document.getElementById('chatUI').style.display = 'block';

      const { rodadas, rodadaAtual, isNova } = resolveRodadaAtual(item.id, linksAtuais);

      // Guard: status não é em-aprovacao e não há histórico
      if (item.status !== 'em-aprovacao' && rodadas.length === 0) {
        await mensagemSistema('Esta solicitação não está aguardando aprovação no momento.');
        document.getElementById('chatInputArea').style.display = 'none';
        return;
      }

      renderHistoricoRodadas(rodadas.slice(0, -1));

      const jaDecidido = rodadaAtual.decisao !== null;

      if (jaDecidido) {
        renderTranscript(rodadaAtual, nomeUsuario);
        document.getElementById('chatInputArea').style.display = 'none';
        // Se foi aprovado e ainda não há avaliação registrada, reexibe a pesquisa para avaliar quando quiser.
        const jaAvaliado = !!(item.avaliacao && item.avaliacao.nota);
        if (rodadaAtual.decisao === 'aprovado' && !jaAvaliado) {
          renderPesquisaSatisfacao(item.id);
        }
        return;
      }

      // Badge da rodada atual (apenas chat ativo — renderTranscript cuida do decidido)
      const chatWrap = document.getElementById('chatWrap');
      if (chatWrap && rodadas.length > 0) {
        const badgeRodada = document.createElement('div');
        badgeRodada.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        `;
        badgeRodada.innerHTML = `
          <span style="
            background: var(--icon-bg);
            border: 1px solid var(--ink-10);
            border-radius: var(--radius-pill);
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.05em;
            color: var(--ink-40);
            padding: 3px 12px;
            text-transform: uppercase;
          ">Rodada ${rodadaAtual.numero}</span>`;
        chatWrap.appendChild(badgeRodada);
      }

      const plural = linksAtuais.length > 1;

      window._chatState = {
        solId: item.id,
        rodadaAtual,
        rodadas,
        nomeUsuario,
        fase: 'apresentacao',
        mensagensAlteracao: [],
        arquivos: [],
        plural,
      };

      await mensagemSistema(gerarMensagemBoasVindas(nomeUsuario, rodadaAtual, isNova, linksAtuais.length));

      if (linksAtuais.length === 0) {
        await mensagemSistema('Os arquivos desta solicitação serão entregues diretamente pelo time de Marketing. Aguarde o contato.');
        document.getElementById('chatInputArea').style.display = 'none';
        return;
      }

      const apresentacaoLinks = plural ? pick([
        'Aqui estão os arquivos disponíveis:',
        'Esses são os materiais para sua análise:',
        'Confira os arquivos abaixo:',
      ]) : pick([
        'Aqui está o arquivo disponível:',
        'Esse é o material para sua análise:',
        'Confira o arquivo abaixo:',
      ]);

      const chamadaDecisao = plural ? pick([
        'Por favor, analise os materiais e selecione uma das opções:',
        'Após revisar os arquivos, selecione uma das opções abaixo:',
        'O que você acha dos materiais? Selecione uma opção:',
      ]) : pick([
        'Por favor, analise o material e selecione uma das opções:',
        'Após revisar o arquivo, selecione uma das opções abaixo:',
        'O que você acha do material? Selecione uma opção:',
      ]);

      await delay(800);
      await mensagemSistema(renderLinksMsg(linksAtuais, apresentacaoLinks));
      await delay(1000);
      await mensagemSistema(chamadaDecisao, false, renderBotoesDecisao());
      window._chatState.fase = 'decisao';
    }

    function gerarMensagemBoasVindas(nome, rodada, isNova, numLinks) {
      const primeiroNome = nome.split(' ')[0];
      const singular = (numLinks || 1) === 1;
      if (rodada.numero === 1) {
        return singular
          ? `Olá, <strong>${esc(primeiroNome)}</strong>! O material da sua solicitação está pronto! 🎉`
          : `Olá, <strong>${esc(primeiroNome)}</strong>! Os materiais da sua solicitação estão prontos. 🎉`;
      }
      return singular
        ? `Olá, <strong>${esc(primeiroNome)}</strong>! O material foi revisado e uma nova versão está disponível! 😊 Veja o que foi atualizado abaixo.`
        : `Olá, <strong>${esc(primeiroNome)}</strong>! Os materiais foram revisados e uma nova versão está disponível! 😊 Veja o que foi atualizado abaixo.`;
    }

    function renderLinksMsg(links, introText) {
      const btns = links.map(l =>
        `<a href="${esc(l.url)}" target="_blank" rel="noopener" class="chat-link-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          ${esc(l.label)}
        </a>`
      ).join('');
      const intro = introText || (links.length === 1 ? 'Aqui está o arquivo disponível:' : 'Aqui estão os arquivos disponíveis:');
      return `${intro}<br><div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">${btns}</div>`;
    }

    function renderBotoesDecisao() {
      return `<div class="chat-action-btns">
        <button class="btn btn-aprovar" onclick="acaoAprovar()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg>
          Aprovado
        </button>
        <button class="btn btn-alterar" onclick="acaoSolicitarAlteracao()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Solicitar alterações
        </button>
      </div>`;
    }

    /* ── ações de interação ── */
    async function acaoAprovar() {
      if (window._chatState?.fase !== 'decisao') return;
      window._chatState.fase = 'finalizado';
      desabilitarInput();
      removerBotoesDecisao();

      adicionarMensagemUsuario('Aprovado ✓');
      await delay(900);
      const plural = window._chatState?.plural ?? false;
      await mensagemSistema(plural ? pick([
        'Ótimo! Sua aprovação foi registrada. O time de marketing será notificado. 🎉',
        'Aprovação registrada! O time de marketing já foi notificado. 🎉',
        'Perfeito! Obrigado pela aprovação dos materiais. O time de marketing foi notificado. 🎉',
      ]) : pick([
        'Ótimo! Sua aprovação foi registrada. O time de marketing será notificado. 🎉',
        'Aprovação registrada! O time de marketing já foi notificado. 🎉',
        'Perfeito! Obrigado pela aprovação do material. O time de marketing foi notificado. 🎉',
      ]));

      let sucesso = false;
      try {
        const res = await fetch(
          '/api/solicitacoes/' + window._chatState.solId + '/aprovacao',
          { method: 'POST' }
        );
        sucesso = res.ok;
      } catch {}

      if (!sucesso) {
        await mensagemSistema(
          'Houve um erro ao registrar sua aprovação. Tente novamente ou entre em contato com o time de marketing.',
          true
        );
        window._chatState.fase = 'decisao';
        const chatWrap = document.getElementById('chatWrap');
        if (chatWrap) {
          const div = document.createElement('div');
          div.innerHTML = renderBotoesDecisao();
          chatWrap.appendChild(div.firstElementChild);
          scrollChatBottom();
        }
        return;
      }

      const rodadas = getRodadas(window._chatState.solId);
      const ultima = rodadas[rodadas.length - 1];
      ultima.decisao = 'aprovado';
      ultima.dataDecisao = new Date().toISOString();
      saveRodadas(window._chatState.solId, rodadas);

      document.getElementById('chatInputArea').style.display = 'none';

      await delay(1500);
      renderPesquisaSatisfacao(window._chatState.solId);
    }

    async function acaoSolicitarAlteracao() {
      if (window._chatState?.fase !== 'decisao') return;
      window._chatState.fase = 'alteracao_input';
      removerBotoesDecisao();

      adicionarMensagemUsuario('Solicitar alterações');
      await delay(900);
      const plural = window._chatState?.plural ?? false;
      await mensagemSistema(plural ? pick([
        'Claro! Descreva o que precisa ser alterado nos materiais. Pode enviar em várias mensagens — quando terminar, é só me dizer.',
        'Entendido! O que você gostaria de alterar nos arquivos? Pode detalhar à vontade — quando terminar, é só confirmar.',
        'Tudo bem! Descreva os ajustes necessários. Pode enviar em partes — quando quiser, finalizamos juntos.',
      ]) : pick([
        'Claro! Descreva o que precisa ser alterado. Pode enviar em várias mensagens — quando terminar, é só me dizer.',
        'Entendido! O que você gostaria de alterar? Pode detalhar à vontade — quando terminar, é só confirmar.',
        'Tudo bem! Descreva o ajuste necessário. Pode enviar em partes — quando quiser, finalizamos juntos.',
      ]));

      habilitarInput('Descreva a alteração...');
    }

    async function enviarMensagemUsuario() {
      const input = document.getElementById('chatInput');
      const texto = input.value.trim();
      if (!texto || !window._chatState) return;

      const fase = window._chatState.fase;
      if (fase !== 'alteracao_input') return;

      input.value = '';
      input.style.height = 'auto';
      desabilitarInput();

      adicionarMensagemUsuario(texto);
      window._chatState.mensagensAlteracao.push(texto);

      await delay(1000);
      await mensagemSistema(
        `Anotado! Gostaria de acrescentar mais alguma coisa?`,
        false,
        `<div class="chat-action-btns" style="margin-top:6px">
          <button class="btn btn-aprovar" style="background:#2563eb" onclick="acaoTemMais()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Sim, tenho mais
          </button>
          <button class="btn btn-alterar" style="background:#7c3aed" onclick="acaoFinalizarAlteracao()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg>
            Não, pode enviar
          </button>
        </div>`
      );
      window._chatState.fase = 'alteracao_confirmacao';
    }

    async function acaoTemMais() {
      if (window._chatState?.fase !== 'alteracao_confirmacao') return;
      window._chatState.fase = 'alteracao_input';
      removerBotoesDecisao();
      await delay(300);
      habilitarInput('Acrescente mais detalhes...');
    }

    async function acaoFinalizarAlteracao() {
      if (window._chatState?.fase !== 'alteracao_confirmacao') return;
      window._chatState.fase = 'finalizado';
      removerBotoesDecisao();
      desabilitarInput();

      adicionarMensagemUsuario('Não, pode enviar.');
      await delay(900);
      await mensagemSistema('Perfeito! Enviando sua solicitação de alteração...');

      const mensagens = window._chatState.mensagensAlteracao;
      const mensagemFormatada = mensagens.length === 1
        ? mensagens[0]
        : mensagens.map((m, i) => `${i + 1}. ${m}`).join('\n');

      let sucesso = false;
      try {
        const fd = new FormData();
        fd.append('mensagem', mensagemFormatada);
        (window._chatState.arquivos || []).forEach(function(f) { fd.append('arquivos', f, f.name); });
        const res = await fetch('/api/solicitacoes/' + window._chatState.solId + '/alteracao', {
          method: 'POST',
          body: fd,
        });
        sucesso = res.ok;
      } catch {}

      await delay(600);
      if (sucesso) {
        await mensagemSistema('Alteração enviada com sucesso! O time de marketing foi notificado e entrará em contato em breve. ✉️');
      } else {
        await mensagemSistema('Houve um erro ao enviar. Por favor, tente novamente ou entre em contato com o time de marketing.', true);
        window._chatState.fase = 'alteracao_input';
        habilitarInput('Tente novamente...');
        return;
      }

      const rodadas = getRodadas(window._chatState.solId);
      const ultima = rodadas[rodadas.length - 1];
      ultima.decisao = 'alteracao';
      ultima.mensagens = mensagens;
      ultima.dataDecisao = new Date().toISOString();
      saveRodadas(window._chatState.solId, rodadas);

      window._chatState.arquivos = [];
      renderChatAttachments();
      document.getElementById('chatInputArea').style.display = 'none';
    }

    /* ── Pesquisa de Satisfação ── */
    async function renderPesquisaSatisfacao(solId) {
      if (document.getElementById('pesquisaSatisfacao')) return;
      const notas = [1,2,3,4,5];
      const html = `
        <div id="pesquisaSatisfacao" style="
          background: rgba(255,255,255,0.7);
          border: 1px solid var(--ink-10);
          border-radius: var(--radius-xl);
          padding: 16px 20px;
          margin-top: 16px;
          font-family: inherit;
        ">
          <p style="font-size:0.9rem;font-weight:600;color:var(--carbon-black);margin:0 0 10px">
            Em uma escala de 1 a 5, como você avalia o material entregue?
          </p>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
            ${notas.map(n => `
              <button
                class="nota-btn"
                data-nota="${n}"
                onclick="selecionarNota(${n})"
                style="
                  width:36px;height:36px;border-radius:var(--radius-md);
                  border:2px solid var(--ink-20);
                  background:transparent;font-size:0.85rem;
                  font-weight:700;color:var(--carbon-black);
                  cursor:pointer;transition:all 0.15s;
                "
              >${n}</button>
            `).join('')}
          </div>
          <div id="pesquisaComentarioWrap" style="display:none;margin-top:6px">
            <textarea
              id="pesquisaComentario"
              placeholder="Comentário opcional (máx. 500 caracteres)"
              maxlength="500"
              style="
                width:100%;border-radius:var(--radius-md);border:1px solid var(--ink-20);
                padding:8px 12px;font-family:inherit;font-size:0.85rem;
                resize:vertical;min-height:64px;background:var(--paper-white);
                box-sizing:border-box;
              "
            ></textarea>
            <div style="display:flex;gap:8px;margin-top:8px">
              <button onclick="enviarAvaliacao(${solId})" style="
                background:var(--ruby-red);color:#fff;border:none;
                border-radius:var(--radius-md);padding:7px 18px;font-size:0.85rem;
                font-weight:600;cursor:pointer;
              ">Enviar avaliação</button>
              <button onclick="document.getElementById('pesquisaSatisfacao').remove()" style="
                background:transparent;color:var(--ink-50);border:none;
                font-size:0.82rem;cursor:pointer;text-decoration:underline;
              ">Pular</button>
            </div>
          </div>
        </div>`;
      /* PESQUISA-SEM-CHAT: isto desenhava so dentro de #chatWrap, que existe
         apenas quando o card de aprovacao e montado. Nas solicitacoes sem
         mini-chat o pesquisaSeAplicavel() rodava, chamava esta funcao, o
         getElementById voltava null e nada acontecia — sem erro. Resultado: essas
         solicitacoes nunca pediram avaliacao, e a media so refletia os tipos com
         aprovacao. */
      const alvo = document.getElementById('chatWrap') || document.getElementById('pesquisaCard');
      if (alvo) alvo.insertAdjacentHTML('beforeend', html);
    }

    function selecionarNota(nota) {
      document.querySelectorAll('.nota-btn').forEach(btn => {
        const n = parseInt(btn.dataset.nota);
        btn.style.background = n === nota ? 'var(--ruby-red)' : 'transparent';
        btn.style.color = n === nota ? '#fff' : 'var(--carbon-black)';
        btn.style.borderColor = n === nota ? 'var(--ruby-red)' : 'var(--ink-20)';
      });
      document.querySelector('.nota-btn[data-nota="' + nota + '"]').dataset.selecionado = '1';
      window._notaSelecionada = nota;
      document.getElementById('pesquisaComentarioWrap').style.display = 'block';
    }

    async function enviarAvaliacao(solId) {
      const nota = window._notaSelecionada;
      if (!nota) return;
      const comentario = (document.getElementById('pesquisaComentario')?.value || '').trim();
      let ok = false;
      try {
        const res = await fetch('/api/solicitacoes/' + solId + '/avaliacao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nota, comentario }),
        });
        ok = res.ok;
      } catch {}
      if (!ok) {
        if (window.showToast) showToast('Não foi possível registrar sua avaliação. Tente novamente.', 'error');
        return;
      }
      const el = document.getElementById('pesquisaSatisfacao');
      if (el) el.outerHTML = `
        <div style="
          text-align:center;padding:14px;color:var(--ink-50);
          font-size:0.85rem;margin-top:12px;
        ">Obrigado pelo feedback! 💛</div>`;
    }

    async function verAvaliacao(solId) {
      const btn = document.getElementById('btnVerAvaliacao');
      if (btn) { btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; }

      try {
        const res = await fetch('/api/solicitacoes/' + solId + '/avaliacao');
        const data = await res.json();

        const modal = document.getElementById('avaliacaoModal');
        const content = document.getElementById('avaliacaoModalContent');

        if (!data.avaliacao) {
          content.innerHTML = `
            <div style="text-align:center;padding:16px 0">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;opacity:0.25"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <p style="font-size:0.9rem;opacity:0.5">Nenhuma avaliação registrada para esta solicitação.</p>
            </div>`;
        } else {
          const av = data.avaliacao;
          const { nota, comentario } = av;
          const dataAv = av.data;
          const dataFmt = dataAv ? new Date(dataAv).toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' }) : '';
          const horaFmt = dataAv ? new Date(dataAv).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : '';
          const notaCor = nota >= 4 ? '#16a34a' : nota >= 3 ? '#ea580c' : 'var(--danger)';
          const notaLabel = nota >= 4 ? 'Excelente' : nota >= 3 ? 'Regular' : 'Precisa melhorar';
          const estrelas = Array.from({length: 5}, (_, i) =>
            `<svg width="18" height="18" viewBox="0 0 24 24" fill="${i < nota ? '#f59e0b' : 'none'}" stroke="${i < nota ? '#f59e0b' : 'var(--ink-20)'}" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
          ).join('');

          content.innerHTML = `
            <div style="text-align:center;padding:8px 0 20px">
              <div style="font-size:3rem;font-weight:700;color:${notaCor};line-height:1">${nota}</div>
              <div style="font-size:0.82rem;font-weight:600;color:${notaCor};margin-bottom:10px">${notaLabel}</div>
              <div style="display:flex;justify-content:center;gap:2px;flex-wrap:wrap">${estrelas}</div>
              <div style="font-size:0.75rem;opacity:0.35;margin-top:8px">de 10</div>
            </div>
            ${comentario ? `
              <div style="background:var(--icon-bg);border-radius:var(--radius-lg);padding:14px 16px;margin-bottom:16px">
                <div style="font-size:0.72rem;font-weight:700;opacity:0.4;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Comentário</div>
                <p style="font-size:0.875rem;line-height:1.55;margin:0">${esc(comentario)}</p>
              </div>
            ` : `<p style="text-align:center;font-size:0.82rem;opacity:0.4;margin-bottom:16px">Sem comentário adicional.</p>`}
            ${dataFmt ? `<p style="text-align:center;font-size:0.75rem;opacity:0.35">Avaliado em ${dataFmt} às ${horaFmt}</p>` : ''}`;
        }

        Modal.open('avaliacaoModal');
      } catch {}

      if (btn) { btn.style.opacity = ''; btn.style.pointerEvents = ''; }
    }

    function fecharModalAvaliacao(e) {
      if (!e || e.target === document.getElementById('avaliacaoModal')) {
        Modal.close('avaliacaoModal');
      }
    }

    let _deleteTargetId = null;

    function abrirCancelarModal() {
      const erro = document.getElementById('cancelarErro'); if (erro) erro.style.display = 'none';
      const ta = document.getElementById('cancelarJustificativa'); if (ta) ta.value = '';
      Modal.open('cancelarModal');
      setTimeout(() => { const t = document.getElementById('cancelarJustificativa'); if (t) t.focus(); }, 60);
    }
    function fecharCancelarModal(e) { Modal.close('cancelarModal', e); }
    async function confirmarCancelamento() {
      const ta = document.getElementById('cancelarJustificativa');
      const erro = document.getElementById('cancelarErro');
      const justificativa = (ta.value || '').trim();
      if (justificativa.length < 3) { erro.textContent = 'Descreva o motivo do cancelamento.'; erro.style.display = 'block'; return; }
      const btn = document.getElementById('cancelarConfirmBtn');
      btn.disabled = true; btn.textContent = 'Cancelando...';
      try {
        const res = await fetch('/api/solicitacoes/' + solicitacaoId + '/cancelar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ justificativa })
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok) {
          fecharCancelarModal();
          if (typeof showToast === 'function') showToast('Cancelamento registrado. O time foi avisado no ClickUp.', 'success');
          setTimeout(() => location.reload(), 900);
        } else {
          erro.textContent = d.error || 'Não foi possível cancelar.'; erro.style.display = 'block';
          btn.disabled = false; btn.textContent = 'Confirmar cancelamento';
        }
      } catch (e) {
        erro.textContent = 'Erro de conexão. Tente novamente.'; erro.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Confirmar cancelamento';
      }
    }

    function abrirModalExcluir(id) {
      _deleteTargetId = id;
      Modal.open('deleteModal');
    }

    function cancelarExcluir() {
      _deleteTargetId = null;
      Modal.close('deleteModal');
      const btn = document.getElementById('btnConfirmarExcluir');
      if (btn) { btn.disabled = false; btn.textContent = 'Excluir permanentemente'; }
    }

    async function confirmarExcluir() {
      if (!_deleteTargetId) return;
      const btn = document.getElementById('btnConfirmarExcluir');
      btn.disabled = true;
      btn.textContent = 'Excluindo...';
      try {
        const res = await fetch('/api/solicitacoes/' + _deleteTargetId, { method: 'DELETE' });
        if (res.ok) {
          window.location.href = '/dashboard.html';
        } else {
          const data = await res.json().catch(() => ({}));
          btn.disabled = false;
          btn.textContent = 'Excluir permanentemente';
          showToast(data.error || 'Erro ao excluir. Tente novamente.', 'error');
        }
      } catch {
        btn.disabled = false;
        btn.textContent = 'Excluir permanentemente';
        showToast('Erro de conexão', 'error');
      }
      _deleteTargetId = null;
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        cancelarExcluir();
        Modal.close('avaliacaoModal');
      }
    });

    /* ── utilitários do chat ── */
    function delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    function pick(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function autoResizeTextarea(el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }

    function scrollChatBottom() {
      const wrap = document.getElementById('chatWrap');
      if (wrap) wrap.scrollTop = wrap.scrollHeight;
    }

    function habilitarInput(placeholder) {
      const input = document.getElementById('chatInput');
      const btn = document.getElementById('chatSendBtn');
      const att = document.getElementById('chatAttachBtn');
      if (input) { input.disabled = false; input.placeholder = placeholder || 'Digite sua mensagem...'; input.focus(); }
      if (btn) btn.disabled = false;
      if (att) att.disabled = false;
    }

    function desabilitarInput() {
      const input = document.getElementById('chatInput');
      const btn = document.getElementById('chatSendBtn');
      const att = document.getElementById('chatAttachBtn');
      if (input) input.disabled = true;
      if (btn) btn.disabled = true;
      if (att) att.disabled = true;
    }

    function onChatFilesSelected(input) {
      if (!window._chatState) return;
      const novos = Array.from(input.files || []);
      const atuais = window._chatState.arquivos || (window._chatState.arquivos = []);
      const LIMITE = 10, MAX_MB = 50;
      for (const f of novos) {
        if (atuais.length >= LIMITE) {
          if (window.showToast) showToast('Máximo de ' + LIMITE + ' arquivos por solicitação.', 'error');
          break;
        }
        if (f.size > MAX_MB * 1024 * 1024) {
          if (window.showToast) showToast('"' + f.name + '" passa de ' + MAX_MB + 'MB e não foi anexado.', 'error');
          continue;
        }
        atuais.push(f);
      }
      input.value = '';
      renderChatAttachments();
    }

    function removerAnexoChat(idx) {
      const arr = window._chatState && window._chatState.arquivos;
      if (!arr) return;
      arr.splice(idx, 1);
      renderChatAttachments();
    }

    function renderChatAttachments() {
      const cont = document.getElementById('chatAttachments');
      if (!cont) return;
      const arr = (window._chatState && window._chatState.arquivos) || [];
      if (!arr.length) { cont.style.display = 'none'; cont.innerHTML = ''; return; }
      cont.style.display = 'flex';
      cont.innerHTML = arr.map(function(f, i) {
        return '<span class="chat-attach-chip"><span title="' + esc(f.name) + '">' + esc(f.name) + '</span>' +
          '<button type="button" aria-label="Remover anexo" onclick="removerAnexoChat(' + i + ')">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button></span>';
      }).join('');
    }

    function removerBotoesDecisao() {
      document.querySelectorAll('.chat-action-btns').forEach(el => el.remove());
    }

    function adicionarMensagemUsuario(texto) {
      const wrap = document.getElementById('chatWrap');
      if (!wrap) return;
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const div = document.createElement('div');
      div.className = 'chat-msg usuario';
      div.innerHTML = `
        <div class="chat-msg-col">
          <div class="chat-bubble">${esc(texto)}</div>
          <span class="chat-time">${hora}</span>
        </div>`;
      wrap.appendChild(div);
      scrollChatBottom();
    }

    const SVN_AVATAR_HTML = `
      <div class="chat-avatar">
        <img src="${URL_LOGO_BRANCA}" alt="SVN" />
      </div>`;

    // `html`/`extraHtml` sao injetados via innerHTML. SEMPRE escape dados de usuario/banco
    // com esc() antes de interpolar (ver callers: esc(nome), esc(l.url), esc(l.label), esc(m)).
    async function mensagemSistema(html, isError = false, extraHtml = '') {
      const wrap = document.getElementById('chatWrap');
      if (!wrap) return;

      const typing = document.createElement('div');
      typing.className = 'chat-msg sistema';
      typing.innerHTML = `
        ${SVN_AVATAR_HTML}
        <div class="chat-typing"><span></span><span></span><span></span></div>`;
      wrap.appendChild(typing);
      scrollChatBottom();

      await delay(1200);
      wrap.removeChild(typing);

      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const div = document.createElement('div');
      div.className = 'chat-msg sistema';
      div.innerHTML = `
        ${SVN_AVATAR_HTML}
        <div class="chat-msg-col">
          <div class="chat-bubble" style="${isError ? 'color:var(--ruby-red)' : ''}">${html}</div>
          ${extraHtml ? `<div style="padding:0 4px;margin-top:4px">${extraHtml}</div>` : ''}
          <span class="chat-time">${hora}</span>
        </div>`;
      wrap.appendChild(div);
      scrollChatBottom();
    }

    function renderTranscript(rodada, nomeUsuario) {
      const wrap = document.getElementById('chatWrap');
      if (!wrap) return;

      const primeiroNome = nomeUsuario.split(' ')[0];
      const numLinks = rodada.links?.length || 1;
      const singular = numLinks === 1;
      const msgInicial = rodada.numero === 1
        ? (singular
            ? `Olá, <strong>${esc(primeiroNome)}</strong>! O material da sua solicitação está pronto! 🎉`
            : `Olá, <strong>${esc(primeiroNome)}</strong>! Os materiais da sua solicitação estão prontos. 🎉`)
        : (singular
            ? `Olá, <strong>${esc(primeiroNome)}</strong>! O material foi revisado e uma nova versão está disponível! 😊 Veja o que foi atualizado abaixo.`
            : `Olá, <strong>${esc(primeiroNome)}</strong>! Os materiais foram revisados e uma nova versão está disponível! 😊 Veja o que foi atualizado abaixo.`);

      const hora = rodada.data
        ? new Date(rodada.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : '--:--';

      const avatarHtml = `<div class="chat-avatar"><img src="${URL_LOGO_BRANCA}" alt="SVN" /></div>`;
      const badgeHtml = `
        <div style="display:flex;align-items:center;justify-content:center;margin-bottom:8px">
          <span style="background:var(--icon-bg);border:1px solid var(--ink-10);border-radius:var(--radius-pill);font-size:0.72rem;font-weight:700;letter-spacing:0.05em;color:var(--ink-40);padding:3px 12px;text-transform:uppercase">Rodada ${rodada.numero}</span>
        </div>`;
      wrap.innerHTML = `
        ${badgeHtml}
        <div class="chat-msg sistema">
          ${avatarHtml}
          <div class="chat-msg-col">
            <div class="chat-bubble">${msgInicial}</div>
            <span class="chat-time">${hora}</span>
          </div>
        </div>
        <div class="chat-msg sistema">
          ${avatarHtml}
          <div class="chat-msg-col">
            <div class="chat-bubble">${renderLinksMsg(rodada.links || [])}</div>
          </div>
        </div>
        ${rodada.decisao === 'aprovado'
          ? `<div class="chat-msg usuario"><div class="chat-msg-col"><div class="chat-bubble">Aprovado ✓</div></div></div>
             <div class="chat-msg sistema">${avatarHtml}<div class="chat-msg-col"><div class="chat-bubble" style="color:#065f46">${singular ? 'Aprovação do material registrada com sucesso! ✓' : 'Aprovação dos materiais registrada com sucesso! ✓'}</div></div></div>`
          : rodada.mensagens?.length
            ? rodada.mensagens.map(m => `<div class="chat-msg usuario"><div class="chat-msg-col"><div class="chat-bubble">${esc(m)}</div></div></div>`).join('') +
              `<div class="chat-msg sistema">${avatarHtml}<div class="chat-msg-col"><div class="chat-bubble">Alteração enviada ao time de marketing. ✉️</div></div></div>`
            : ''
        }`;

      const sub = document.getElementById('aprovacaoSubtitle');
      if (sub) {
        sub.textContent = rodada.decisao === 'aprovado'
          ? `Aprovado em ${new Date(rodada.dataDecisao || rodada.data).toLocaleDateString('pt-BR')}`
          : `Alteração solicitada em ${new Date(rodada.dataDecisao || rodada.data).toLocaleDateString('pt-BR')}`;
      }
    }

    function renderHistoricoRodadas(rodadasAnteriores) {
      const container = document.getElementById('historicoRodadas');
      if (!container || rodadasAnteriores.length === 0) return;

      container.innerHTML = rodadasAnteriores.map(rodada => {
        const decisaoLabel = rodada.decisao === 'aprovado' ? '✓ Aprovado' : '✏️ Alteração solicitada';
        const dataLabel = rodada.dataDecisao
          ? new Date(rodada.dataDecisao).toLocaleDateString('pt-BR')
          : '';
        return `
          <div class="rodada-historico">
            <div class="rodada-historico-header" onclick="toggleHistoricoRodada(this)">
              <span>Rodada ${rodada.numero} — ${decisaoLabel}${dataLabel ? ' · ' + dataLabel : ''}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="transition:transform 0.2s"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="rodada-historico-body">
              <div style="padding:12px 16px;font-size:0.82rem;opacity:0.7">
                ${rodada.links?.map(l => `<a href="${esc(l.url)}" target="_blank" style="color:var(--carbon-black);font-weight:600">${esc(l.label)}</a>`).join(' · ') || 'Sem links'}
                ${rodada.decisao === 'alteracao' && rodada.mensagens?.length
                  ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--ink-08)">${rodada.mensagens.map((m, i) => `<div style="margin-bottom:4px">${rodada.mensagens.length > 1 ? (i+1)+'. ' : ''}${esc(m)}</div>`).join('')}</div>`
                  : ''}
              </div>
            </div>
          </div>`;
      }).join('');
    }

    function toggleHistoricoRodada(header) {
      const body = header.nextElementSibling;
      const chevron = header.querySelector('svg');
      const isOpen = body.style.maxHeight && body.style.maxHeight !== '0px';
      body.style.maxHeight = isOpen ? '0' : body.scrollHeight + 'px';
      if (chevron) chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
    }

    /* URLs viram link clicável e enxuto; resto continua texto. */
    /* Tira os parametros de rastreio do ROTULO (o href continua inteiro).
       Um link de LinkedIn vindo do app traz utm_source/utm_content/utm_medium e
       estourava duas linhas na tela. */
    function limparRastreio(url) {
      try {
        const u = new URL(url);
        const lixo = [];
        u.searchParams.forEach((_, k) => {
          if (/^(utm_|fbclid|gclid|mc_|ref$|source$)/i.test(k)) lixo.push(k);
        });
        lixo.forEach(k => u.searchParams.delete(k));
        let out = u.host.replace(/^www\./i, '') + u.pathname.replace(/\/+$/, '');
        const resto = u.searchParams.toString();
        if (resto) out += '?' + resto;
        return out || url;
      } catch { return url; }
    }

    /* Chips vem de window.SvnChip (utils.js), compartilhado com o modal
       de validacao. As tabelas de icone e a escolha de tipo vivem la. */
    const CAMPOS_SOCIAIS = ['linkedin', 'instagram', 'facebook', 'youtube', 'twitter', 'x', 'tiktok', 'site', 'website'];

    function chipDeLink(url, texto, key) {
      return SvnChip.html(url, texto, key);
    }

    function rotuloDeLink(url) { return SvnChip.rotulo(url); }

    function fieldValueHtml(val, key) {
      const s = String(val).trim();

      // TEL-MAILTO: no celular telefone e e-mail viram um toque so.
      if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(s)) {
        return `<a class="dados-link" href="mailto:${esc(s)}">${esc(s)}</a>`;
      }
      if (/telefone|whatsapp|celular|contato/i.test(String(key))) {
        const dig = s.replace(/\D/g, '');
        if (dig.length >= 10 && dig.length <= 13) {
          const e164 = dig.length <= 11 ? '+55' + dig : '+' + dig;
          return `<a class="dados-link" href="tel:${e164}">${esc(s)}</a>`;
        }
      }

      // @usuario do Instagram vira link, como o LinkedIn ja era
      if (/^@[A-Za-z0-9._]{2,30}$/.test(s)) {
        const user = s.slice(1);
        return chipDeLink('https://instagram.com/' + user, s, 'instagram');
      }

      if (/^https?:\/\/\S+$/i.test(s)) {
        // imagem: mostra a miniatura. Sem quebras de linha no HTML —
        // .dados-value usa white-space:pre-wrap e a indentacao viraria espaco.
        if (/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(s)) {
          return `<a class="dados-thumb" href="${esc(s)}" target="_blank" rel="noopener noreferrer" title="Abrir em tamanho real"><img src="${esc(s)}" alt="Pré-visualização" loading="lazy"></a>`;
        }
        return chipDeLink(s, rotuloDeLink(s), key);
      }
      return esc(String(val));
    }

    /* ── renderDados ──────────────────────────── */
    /* MOBILE-DADOS-JS: identidade (foto + nome), chips para Sim/Nao e listas
       curtas, rotulo e valor na mesma linha quando o valor e curto, e o excedente
       recolhido atras de "Ver todos os dados". */
    function renderDados(dados, item) {
        if (TIPOS_AUTOMACAO.includes(item.tipo_solicitacao)) {
        const dadosCard = document.getElementById('dadosCard');
        if (dadosCard) dadosCard.style.display = 'none';
        return;
      }
      const container = document.getElementById('dadosContent');
      const palProcessed = new Set();
      const gridFields = [];
      let socialChips = '';
      let socialCount = 0;
      let boolChips = '';
      let boolCount = 0;
      let identidadeBlock = '';
      let palestrantesBlock = '';
      let hasContent = false;

      const LIMITE_MOBILE = 6;
      const pular = new Set();
      const ehImagem = (v) => typeof v === 'string' && /^https?:\/\/\S+\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(v.trim());

      // Foto + nome viram um bloco so: dois campos a menos e o rosto ancora o topo.
      const kFoto = ['foto_perfil', 'fotoPerfil'].find(k => ehImagem(dados[k]));
      const kNome = ['nome_completo', 'nomeCompleto'].find(k => dados[k] && String(dados[k]).trim());
      if (kFoto && kNome) {
        const urlFoto = String(dados[kFoto]).trim();
        const nome = String(dados[kNome]).trim();
        const lblNome = (typeof DRAWER_FIELD_LABELS_FLAT !== 'undefined' && DRAWER_FIELD_LABELS_FLAT[kNome]) || 'Nome completo';
        identidadeBlock = `<div class="dados-identidade"><a class="dados-avatar" href="${esc(urlFoto)}" target="_blank" rel="noopener noreferrer" title="Abrir em tamanho real"><img src="${esc(urlFoto)}" alt="" loading="lazy"></a><div class="dados-identidade-txt"><div class="dados-label">${esc(lblNome)}</div><div class="dados-value dados-nome">${esc(nome)}</div></div></div>`;
        pular.add(kFoto);
        pular.add(kNome);
        hasContent = true;
      }

      const chipSimNao = (rotulo, sim) => sim
        ? `<span class="dados-chip"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>${esc(rotulo)}</span>`
        : `<span class="dados-chip dados-chip--nao"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="5" y1="12" x2="19" y2="12"/></svg>${esc(rotulo)}</span>`;

      const ehCurto = (v) => {
        const s = String(v);
        return s.length <= 32 && !/\n/.test(s) && !/^https?:\/\//i.test(s) && !/^@[A-Za-z0-9._]{2,30}$/.test(s);
      };

      // Identificacao primeiro, depois contato, depois conteudo.
      const FIELD_PRIORITY = ['nome_completo','nomeCompleto','foto_perfil','fotoPerfil','codigo_assessor','unidade','contrato_social','eh_assessor','quer_pagina','telefone','email','linkedin','instagram','selos','mini_bio','depoimentos','nomeEvento','tituloEvento','dataEvento','horario','origem','tipoEvento','publico','localEvento','unidadeSVN','localNome','localEndereco','estado','cidade','convidados','descricao','objetivos'];
      const _entries = Object.entries(dados).sort((a, b) => {
        const ra = FIELD_PRIORITY.indexOf(a[0]); const rb = FIELD_PRIORITY.indexOf(b[0]);
        return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb);
      });
      for (const [key, value] of _entries) {
        if (value === null || value === undefined || value === '') continue;
        if (pular.has(key)) continue;
        if (key === 'rateio' && dados.natureza === 'online') continue;
        if (/^palFoto\d$/.test(key)) continue;
        if (typeof DRAWER_FIELD_LABELS !== 'undefined' && DRAWER_FIELD_LABELS[key]?.skip) continue;

        const label = (typeof DRAWER_FIELD_LABELS_FLAT !== 'undefined' && DRAWER_FIELD_LABELS_FLAT[key])
          || String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, c => c.toUpperCase());

        if (key === 'temPalestrante') {
          gridFields.push(`<div class="dados-field"><div class="dados-label">${esc(label)}</div><div class="dados-value">${esc(String(value))}</div></div>`);
          hasContent = true;
          continue;
        }

        const palMatch = key.match(/^pal(Svn|Nome|Cargo)(\d)$/);
        if (palMatch) {
          const n = palMatch[2];
          if (palProcessed.has('pal_' + n)) continue;
          palProcessed.add('pal_' + n);
          const nome = String(dados['palNome' + n] || '').trim();
          const cargo = String(dados['palCargo' + n] || '').trim();
          const svn = String(dados['palSvn' + n] || '').trim();
          if (!nome) continue;
          const svnBadge = svn.toLowerCase() === 'sim'
            ? '<span style="background:var(--ruby-red);color:var(--paper-white);font-size:0.6rem;padding:2px 7px;border-radius:var(--radius-pill);font-weight:700;margin-left:6px">SVN</span>' : '';
          palestrantesBlock += `
            <div style="display:flex;flex-direction:column;gap:2px">
              <div class="dados-label">Palestrante ${n}</div>
              <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px">
                <span class="dados-value">${esc(nome)}</span>${svnBadge}
              </div>
              ${cargo ? `<div style="font-size:0.8rem;opacity:0.55">${esc(cargo)}</div>` : ''}
            </div>`;
          hasContent = true;
          continue;
        }

        if (Array.isArray(value)) {
          if (value.length === 0) continue;
          if (typeof value[0] === 'object') {
            const depoBlock = value.filter(d => d && d.texto).map(d => `
              <div style="background:var(--icon-bg);border-radius:var(--radius-md);padding:10px 12px;margin-top:6px;font-size:0.85rem">
                <div style="font-style:italic;opacity:0.8;margin-bottom:3px">"${esc(d.texto)}"</div>
                ${d.nome ? `<div style="font-weight:600;font-size:0.78rem">${esc(d.nome)}</div>` : ''}
              </div>`).join('');
            if (depoBlock) {
              gridFields.push(`<div class="dados-field dados-grid-wide"><div class="dados-label">${esc(label)}</div>${depoBlock}</div>`);
              hasContent = true;
            }
          } else {
            const itens = value.map(v => String(humanizeValue(key, v))).filter(t => t && t.trim());
            if (!itens.length) continue;
            // Lista curta (selos, canais) vira chip: "Ancord, CEA, CFP" em texto
            // corrido nao mostra que sao itens distintos.
            const viraChip = itens.every(t => t.length <= 24 && !/^https?:\/\//i.test(t));
            if (viraChip) {
              gridFields.push(`<div class="dados-field dados-grid-wide"><div class="dados-label">${esc(label)}</div><div class="dados-chips">${itens.map(t => `<span class="dados-chip">${esc(t)}</span>`).join('')}</div></div>`);
            } else {
              const val = itens.join(', ');
              const largura = (val.length > 70 || /\n/.test(val)) ? ' dados-grid-wide' : '';
              gridFields.push(`<div class="dados-field${largura}"><div class="dados-label">${esc(label)}</div><div class="dados-value">${fieldValueHtml(val, key)}</div></div>`);
            }
            hasContent = true;
          }
          continue;
        }
        if (typeof value === 'object') continue;
        // rede social vai para o bloco agrupado do fim, sem rotulo
        if (CAMPOS_SOCIAIS.some(s => String(key).toLowerCase().includes(s))) {
          const bruto = String(value).trim();
          if (bruto) {
            const href = /^https?:\/\//i.test(bruto)
              ? bruto
              : (bruto.startsWith('@') ? 'https://instagram.com/' + bruto.slice(1) : 'https://' + bruto);
            socialChips += chipDeLink(href, rotuloDeLink(href), key);
            socialCount++;
            hasContent = true;
          }
          continue;
        }
        const val = String(humanizeValue(key, value));
        // Sim/Nao vira chip: dois blocos de rotulo+valor para um bit de informacao
        // era o que mais esticava a lista no celular.
        if (/^(sim|n[aã]o)$/i.test(val.trim())) {
          boolChips += chipSimNao(label, /^sim$/i.test(val.trim()));
          boolCount++;
          hasContent = true;
          continue;
        }
        const largura = (val.length > 70 || /\n/.test(val)) ? ' dados-grid-wide' : '';
        const inline = (!largura && ehCurto(val)) ? ' dados-field--inline' : '';
        gridFields.push(`<div class="dados-field${largura}${inline}"><div class="dados-label">${esc(label)}</div><div class="dados-value">${fieldValueHtml(val, key)}</div></div>`);
        hasContent = true;
      }

      if (!hasContent) {
        container.innerHTML = '<p style="opacity:0.45;font-size:0.85rem">Sem dados adicionais registrados.</p>';
        return;
      }

      const excede = gridFields.length > LIMITE_MOBILE;
      const oculto = excede ? ' dados-oculto' : '';
      const blocos = gridFields
        .map((h, i) => (i >= LIMITE_MOBILE ? h.replace('class="dados-field', 'class="dados-field dados-oculto') : h))
        .join('');

      let html = `<div class="dados-grid">${identidadeBlock}${blocos}`;
      if (boolChips) {
        html += `<div class="dados-grid-wide dados-chips dados-chips-bool${oculto}">${boolChips}</div>`;
      }
      if (socialChips) {
        html += `<div class="dados-grid-wide dados-chips-social${oculto}">${socialChips}</div>`;
      }
      if (palestrantesBlock) {
        html += `<div class="dados-grid-wide${oculto}" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;padding:14px;background:var(--icon-bg);border-radius:var(--radius-lg)">
          ${palestrantesBlock}
        </div>`;
      }
      if (excede) {
        const restantes = (gridFields.length - LIMITE_MOBILE) + boolCount + socialCount + (palestrantesBlock ? 1 : 0);
        html += `<button type="button" class="dados-mais" id="dadosMaisBtn" onclick="abrirTodosDados()">Ver mais ${restantes} ${restantes === 1 ? 'campo' : 'campos'}</button>`;
      }
      html += '</div>';
      container.innerHTML = html;
    }

    function abrirTodosDados() {
      const c = document.getElementById('dadosContent');
      if (c) c.classList.add('dados-tudo');
      const b = document.getElementById('dadosMaisBtn');
      if (b) b.remove();
    }

    function toggleFluxo() {
      const card = document.getElementById('fluxoCard');
      if (!card) return;
      const aberto = card.classList.toggle('fluxo-aberto');
      const btn = document.getElementById('fluxoResumo');
      if (btn) btn.setAttribute('aria-expanded', String(aberto));
    }

    /* Barra fixa: ao rolar ate os dados perdia-se a referencia de qual
       solicitacao esta aberta e em que status ela esta. */
    function montarStickyBar(titulo, statusObj) {
      const bar = document.getElementById('solSticky');
      if (!bar) return;
      const t = document.getElementById('solStickyTitulo');
      const b = document.getElementById('solStickyBadge');
      if (t) t.textContent = titulo || '';
      if (b) {
        b.textContent = (statusObj && statusObj.label) || '';
        b.style.background = (statusObj && statusObj.bg) || '#f1f5f9';
        b.style.color = (statusObj && statusObj.text) || '#475569';
      }
      const alvo = document.querySelector('.sol-header');
      if (!alvo || typeof IntersectionObserver === 'undefined') return;
      new IntersectionObserver(([e]) => {
        bar.classList.toggle('visivel', !e.isIntersecting);
      }, { rootMargin: '-64px 0px 0px 0px', threshold: 0 }).observe(alvo);
    }

    /* ── Atividade (log de eventos) ── */
    let _atividadeAberta = false;
    let _atividadeCarregada = false;

    function toggleAtividade() {
      _atividadeAberta = !_atividadeAberta;
      const body = document.getElementById('atividadeBody');
      const chevron = document.getElementById('atividadeChevron');
      chevron.style.transform = _atividadeAberta ? 'rotate(180deg)' : 'rotate(0deg)';
      body.style.maxHeight = _atividadeAberta ? '800px' : '0';
      if (_atividadeAberta && !_atividadeCarregada) {
        _atividadeCarregada = true;
        carregarAtividade();
      }
    }

    async function carregarAtividade() {
      try {
        const res = await fetch('/api/solicitacoes/' + solicitacaoId + '/eventos');
        if (!res.ok) throw new Error('status ' + res.status);
        const data = await res.json();
        renderAtividade(data.data || []);
      } catch (e) {
        document.getElementById('atividadeContent').innerHTML =
          '<p style="color:var(--ruby-red);font-size:0.82rem;opacity:0.7">Erro ao carregar eventos.</p>';
      }
    }

    const ATIVIDADE_ORIGEM_LABEL = {
      clickup: 'ClickUp',
      n8n: 'E-mail',
      'art-generator': 'Geração',
      r2: 'Arquivo',
      usuario: 'Solicitante',
      'capital-humano': 'Capital Humano',
      admin: 'Admin',
      sistema: 'Sistema',
    };
    const ATIVIDADE_TIPO_COLOR = {
      info: { bg: 'rgba(34,197,94,0.1)', dot: '#16a34a' },
      warning: { bg: 'rgba(251,191,36,0.12)', dot: '#d97706' },
      error: { bg: 'rgba(220,38,38,0.1)', dot: 'var(--danger)' },
    };

    function renderAtividade(eventos) {
      const el = document.getElementById('atividadeContent');
      if (!eventos.length) {
        el.innerHTML = '<p style="font-size:0.82rem;opacity:0.4;text-align:center;padding:12px 0">Nenhum evento registrado.</p>';
        return;
      }
      el.innerHTML = eventos.map(ev => {
        const cor = ATIVIDADE_TIPO_COLOR[ev.tipo] || ATIVIDADE_TIPO_COLOR.info;
        const origemLabel = ATIVIDADE_ORIGEM_LABEL[ev.origem] || ev.origem;
        const dataFmt = new Date(ev.created_at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
        const detalhesHtml = ev.detalhes && Object.keys(ev.detalhes).length
          ? `<details style="margin-top:6px"><summary style="font-size:0.72rem;opacity:0.45;cursor:pointer;user-select:none">Detalhes</summary>
              <pre style="font-size:0.7rem;opacity:0.55;white-space:pre-wrap;word-break:break-all;margin:6px 0 0;background:var(--icon-bg);padding:8px;border-radius:var(--radius-sm)">${esc(JSON.stringify(ev.detalhes, null, 2))}</pre>
             </details>` : '';
        return `<div style="display:flex;gap:10px;margin-bottom:10px;padding:10px 12px;border-radius:var(--radius-md);background:${cor.bg}">
          <div style="width:8px;height:8px;border-radius:var(--radius-round);background:${cor.dot};flex-shrink:0;margin-top:5px"></div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-size:0.82rem;font-weight:600;line-height:1.4">${esc(ev.mensagem)}</span>
              <span style="font-size:0.7rem;opacity:0.45;white-space:nowrap">${esc(origemLabel)}</span>
            </div>
            <div style="font-size:0.72rem;opacity:0.38;margin-top:2px">${dataFmt}${ev.user_email ? ' · ' + esc(ev.user_email) : ''}</div>
            ${detalhesHtml}
          </div>
        </div>`;
      }).join('');
    }

    function mostrarAtividade() {
      document.getElementById('atividadeSection').style.display = 'block';
    }

    init();
