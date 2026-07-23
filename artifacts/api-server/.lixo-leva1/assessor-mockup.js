// ============================================================================
// assessor-mockup.js — Componente compartilhado da PRÉVIA da página do assessor.
// Renderiza o mockup a partir de um objeto `dados` (não de campos de form), para
// que a validação (Capital Humano) e o próprio formulário usem a MESMA fonte.
// Depende de window.SELOS_ASSESSOR (definido em config.js).
//
//   window.renderAssessorMockup(dados) -> string HTML
//
// dados: {
//   nome_completo|nome, miniBio|mini_bio, linkedin, instagram,
//   selos: string[] (ids), depoimentos: [{nome, texto}], foto_url|foto_perfil
// }
// ============================================================================
(function () {
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function selosHtml(selos) {
    var cat = window.SELOS_ASSESSOR || [];
    return (selos || []).map(function (id) {
      var selo = cat.find(function (s) { return s.id === id; });
      var label = selo ? selo.label : id;
      return selo && selo.icon_url
        ? '<img src="' + esc(selo.icon_url) + '" loading="lazy" style="height:32px;width:auto;max-width:80px;object-fit:contain" alt="' + esc(label) + '">'
        : '<span style="background:var(--icon-bg);border:1px solid var(--border-light);padding:4px 10px;border-radius:var(--radius-sm);font-size:0.75rem;font-weight:600">' + esc(label) + "</span>";
    }).join("");
  }

  function socialHtml(dados) {
    var out = [];
    if (dados.linkedin) {
      out.push('<a href="' + esc(dados.linkedin) + '" target="_blank" style="display:inline-flex;width:28px;height:28px;background:#0A66C2;border-radius:var(--radius-sm);align-items:center;justify-content:center;text-decoration:none"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12" fill="white"/><circle cx="4" cy="4" r="2" fill="white"/></svg></a>');
    }
    var ig = dados.instagram;
    if (ig) {
      ig = String(ig).trim();
      var href = ig.indexOf("http") === 0 ? ig : "https://instagram.com/" + ig.replace(/^@/, "");
      out.push('<a href="' + esc(href) + '" target="_blank" style="display:inline-flex;width:28px;height:28px;background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);border-radius:var(--radius-sm);align-items:center;justify-content:center;text-decoration:none"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.5" fill="white" stroke="none"/></svg></a>');
    }
    return out.join("");
  }

  function depoHtml(depoimentos) {
    var valid = (depoimentos || []).filter(function (d) { return d && d.nome && d.texto; });
    if (!valid.length) return "";
    return '<div style="margin-top:24px"><h3 style="font-weight:600;margin-bottom:12px;font-size:0.95rem">Depoimentos</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      valid.map(function (d) {
        return '<div style="background:var(--icon-bg);border:1px solid var(--border-light);border-radius:var(--radius-md);padding:12px"><p style="font-size:0.875rem;margin-bottom:8px">' + esc(d.texto) + '</p><div style="font-weight:600;font-size:0.8rem">' + esc(d.nome) + "</div></div>";
      }).join("") +
      "</div></div>";
  }

  window.renderAssessorMockup = function (dados) {
    dados = dados || {};
    var nome = dados.nome_completo || dados.nome || "Nome do Assessor";
    var bio = dados.miniBio || dados.mini_bio || "";
    var foto = dados.foto_url || dados.foto_perfil || dados.fotoPerfil || "";
    var photoHtml = foto
      ? '<img src="' + esc(foto) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover" alt="Foto de perfil">'
      : '<span style="opacity:0.3;font-size:0.85rem">Sem foto</span>';
    return (
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">' +
        "<div>" +
          '<div style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:6px">' + selosHtml(dados.selos) + "</div>" +
          '<h2 style="margin-bottom:8px">' + esc(nome) + "</h2>" +
          '<p style="font-size:0.95rem;opacity:0.8;margin-bottom:16px">' + (bio ? esc(bio) : '<span style="opacity:0.4">Sem bio</span>') + "</p>" +
          '<div style="display:flex;gap:8px;margin-bottom:16px">' + socialHtml(dados) + "</div>" +
          '<div style="display:flex;gap:8px">' +
            '<span class="btn btn-dark" style="font-size:0.8rem;padding:8px 20px;border-radius:var(--radius-md);pointer-events:none">Abrir conta</span>' +
            '<span class="btn btn-secondary" style="font-size:0.8rem;padding:8px 20px;border-radius:var(--radius-md);pointer-events:none">Falar com assessor</span>' +
          "</div>" +
        "</div>" +
        "<div>" +
          '<div style="width:100%;height:320px;border-radius:var(--radius-xl);background:var(--icon-bg);display:flex;align-items:center;justify-content:center;overflow:hidden">' + photoHtml + "</div>" +
        "</div>" +
      "</div>" +
      depoHtml(dados.depoimentos) +
      '<p style="text-align:center;margin-top:20px;font-size:0.75rem;opacity:0.35">Simulação visual. O layout final pode variar conforme o site institucional.</p>'
    );
  };
})();
