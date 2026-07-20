  // ============================================================================
  // assessor-preview.js — Card do assessor (modal de validacao).
  //   window.renderAssessorPreview(container, dados, opts)
  // Cabecalho: nome (Taviraj, grande) + status + faixa "Validacao interna" a
  // esquerda; foto (maior) a direita, acompanhando a altura do bloco. Abaixo:
  // selos, divisoria, Mini bio, divisoria, redes (badges) e depoimentos.
  //   opts.internos = [{ label, value }]   opts.statusHtml = '<span ...>'
  // Usa SELOS_ASSESSOR (config.js).
  // ============================================================================
  (function () {
    function esc(s) {
      return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    }
    function catSelos() { return (typeof SELOS_ASSESSOR !== "undefined") ? SELOS_ASSESSOR : (window.SELOS_ASSESSOR || []); }
    var EXTLINK_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>';
    var HR = '<div style="height:1px;background:var(--border-light);margin:18px 0"></div>';

    function selosHtml(selos) {
      var cat = catSelos();
      return (selos || []).map(function (id) {
        var s = cat.find(function (x) { return x.id === id; });
        var label = s ? s.label : id;
        return s && s.icon_url
          ? '<img src="' + esc(s.icon_url) + '" loading="lazy" style="height:30px;width:auto;max-width:76px;object-fit:contain" alt="' + esc(label) + '">'
          : '<span style="background:var(--icon-bg);border:1px solid var(--border-light);padding:3px 9px;border-radius:var(--radius-sm,6px);font-size:0.72rem;font-weight:600">' + esc(label) + "</span>";
      }).join("");
    }
    /* Os chips vem do componente compartilhado (utils.js) — o mesmo do resumo
       da solicitacao. Antes cada tela desenhava o seu. */
    function socialHtml(d) {
      var out = [];
      if (d.linkedin)  out.push(SvnChip.html(d.linkedin, null, "linkedin"));
      if (d.instagram) out.push(SvnChip.html(SvnChip.instagramUrl(d.instagram), null, "instagram"));
      if (!out.length) return "";
      return '<div style="display:flex;flex-wrap:wrap;gap:8px">' + out.join("") + "</div>";
    }
    function depoHtml(deps) {
      var v = (deps || []).filter(function (d) { return d && d.nome && d.texto; });
      if (!v.length) return "";
      return '<div style="margin-top:18px"><div style="font-weight:600;font-size:0.92rem;margin-bottom:10px">Depoimentos</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
        v.map(function (d) {
          return '<div style="background:var(--icon-bg);border:1px solid var(--border-light);border-radius:var(--radius-md,8px);padding:12px 14px"><p style="font-size:0.84rem;margin:0 0 8px;line-height:1.45">\u201C' + esc(d.texto) + '\u201D</p><div style="font-weight:600;font-size:0.78rem">\u2014 ' + esc(d.nome) + "</div></div>";
        }).join("") +
        "</div></div>";
    }
    function internosHtml(internos) {
      if (!internos || !internos.length) return "";
      return '<div style="padding:14px 16px;background:var(--icon-bg);border:1px solid var(--border-light);border-radius:var(--radius-md,8px)">' +
        '<div style="font-size:0.64rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-50);margin-bottom:10px">Valida\u00e7\u00e3o interna \u00b7 n\u00e3o publicado</div>' +
        '<div style="display:flex;gap:28px;flex-wrap:wrap">' +
        internos.map(function (f) {
          return '<div><div style="font-size:0.7rem;color:var(--ink-50)">' + esc(f.label) + '</div><div style="font-weight:600;font-size:0.92rem;margin-top:2px">' + (f.value ? esc(f.value) : "\u2014") + "</div></div>";
        }).join("") +
        "</div></div>";
    }

    window.renderAssessorPreview = function (container, dados, opts) {
      if (!container) return;
      dados = dados || {}; opts = opts || {};
      var nome = dados.nome_completo || dados.nome || "Nome do Assessor";
      var bio = dados.miniBio || dados.mini_bio || "";
      var foto = dados.foto_url || dados.foto_perfil || dados.fotoPerfil || "";
      var selos = selosHtml(dados.selos);
      var social = socialHtml(dados);
      var fotoBloco = foto
        ? '<img src="' + esc(foto) + '" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top" alt="Foto do assessor">' +
          '<a href="' + esc(foto) + '" target="_blank" rel="noopener" title="Abrir foto em nova aba" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.55);border-radius:6px;padding:5px 6px;display:inline-flex;text-decoration:none">' + EXTLINK_SVG + "</a>"
        : '<span style="opacity:0.35;font-size:0.78rem">Sem foto</span>';
      container.innerHTML =
        '<div style="border:1px solid var(--border-light);border-radius:var(--radius-xl);background:var(--card-white,#fff);padding:24px">' +
          '<div style="display:flex;gap:24px;align-items:stretch">' +
            '<div style="flex:1;min-width:0">' +
              '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px"><h2 style="margin:0;font-family:\'Taviraj\',serif;font-weight:400;font-size:1.9rem;line-height:1.1">' + esc(nome) + "</h2>" + (opts.statusHtml || "") + "</div>" +
              internosHtml(opts.internos) +
            "</div>" +
            '<div style="position:relative;width:210px;min-height:210px;flex-shrink:0;border-radius:var(--radius-lg,10px);overflow:hidden;background:var(--icon-bg);display:flex;align-items:center;justify-content:center">' + fotoBloco + "</div>" +
          "</div>" +
          (selos ? '<div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">' + selos + "</div>" : "") +
          (bio ? HR + '<div><div style="font-weight:600;font-size:0.92rem;margin-bottom:6px">Mini bio</div><p style="font-size:0.9rem;opacity:0.85;line-height:1.55;margin:0">' + esc(bio) + "</p></div>" : "") +
          (social ? HR + social : "") +
          depoHtml(dados.depoimentos) +
        "</div>";
    };
  })();