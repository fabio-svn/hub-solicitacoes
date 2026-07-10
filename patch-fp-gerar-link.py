#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Form Convite Financial Planning: duas opcoes ao inves de so "gerar convite".
  * Toggle no topo: "Gerar convite" (atual) | "Gerar apenas o link".
  * No modo link: esconde telefone/nome/cargo (so codigo + contrato); o botao
    vira "Gerar link" e monta a URL do Financial Planning (client-side, com copiar/abrir).
  Link: https://<dominio>/financial-planning/?A_ID=A<codigo>
    contrato -> dominio: connect->svnconnect, capital->svncapital, invest->svninvestimentos.

Alvo: public/form-convite-fp.html. Idempotente, backup .bak-fplink.
"""
import io, os, sys

def _resolve(cands):
    for c in cands:
        p = os.path.normpath(c)
        if os.path.exists(p): return p
    return None

HT = _resolve(["artifacts/api-server/public/form-convite-fp.html", "public/form-convite-fp.html"])

def once(src, old, new, label):
    if src.count(old) != 1:
        sys.exit("ABORTADO [%s]: ancora %d vezes (esperado 1)." % (label, src.count(old)))
    return src.replace(old, new, 1)

# A) intro id + toggle + id no campo telefone
A_OLD = '''      <div class="alert-card alert-info">
        <div class="alert-title">Convite personalizado</div>
        <div class="alert-text">Preencha os dados para gerar o convite de Financial Planning personalizado. O material gerado ficará disponível ao final da solicitação.</div>
      </div>

      <div class="field">
        <label>Telefone <span class="text-ruby">*</span></label>'''
A_NEW = '''      <div class="alert-card alert-info">
        <div class="alert-title">Convite personalizado</div>
        <div class="alert-text" id="fpIntroText">Preencha os dados para gerar o convite de Financial Planning personalizado. O material gerado ficará disponível ao final da solicitação.</div>
      </div>

      <div class="field">
        <label>O que você precisa?</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap" id="fpModoBtns">
          <button type="button" class="filter-chip active" data-modo="convite" onclick="setModoFP('convite')">Gerar convite</button>
          <button type="button" class="filter-chip" data-modo="link" onclick="setModoFP('link')">Gerar apenas o link</button>
        </div>
      </div>

      <div class="field" id="field-telefone">
        <label>Telefone <span class="text-ruby">*</span></label>'''

# B) id no campo nome
B_OLD = '''      <div class="field">
        <label>Nome para assinatura <span class="text-ruby">*</span></label>'''
B_NEW = '''      <div class="field" id="field-nomeAssinatura">
        <label>Nome para assinatura <span class="text-ruby">*</span></label>'''

# C) id no campo cargo
C_OLD = '''      <div class="field">
        <label>Cargo <span class="text-ruby">*</span></label>'''
C_NEW = '''      <div class="field" id="field-cargo">
        <label>Cargo <span class="text-ruby">*</span></label>'''

# D) area de resultado do link + botao dispatcher
D_OLD = '''        <div id="submitError" class="alert-card alert-danger" style="display:none;margin-bottom:16px"></div>
        <div id="formStatusArea" style="display:none;margin-top:16px"></div>
        <div class="form-nav" style="justify-content:flex-end">
          <button class="btn btn-primary btn-submit-gold" id="btnSubmit" onclick="submitForm()">Enviar</button>
        </div>'''
D_NEW = '''        <div id="submitError" class="alert-card alert-danger" style="display:none;margin-bottom:16px"></div>
        <div id="fpLinkResult" class="alert-card alert-info" style="display:none;margin-bottom:16px"></div>
        <div id="formStatusArea" style="display:none;margin-top:16px"></div>
        <div class="form-nav" style="justify-content:flex-end">
          <button class="btn btn-primary btn-submit-gold" id="btnSubmit" onclick="onFormActionFP()">Enviar</button>
        </div>'''

# E) funcoes JS (antes de submitForm)
E_OLD = '''    async function submitForm() {'''
E_NEW = '''    var modoFP = 'convite';

    function dominioFP(contrato) {
      var s = String(contrato || '').toLowerCase();
      if (s.indexOf('connect') >= 0) return 'svnconnect.com.br';
      if (s.indexOf('capital') >= 0) return 'svncapital.com.br';
      if (s.indexOf('invest') >= 0) return 'svninvestimentos.com.br';
      return null;
    }

    function setModoFP(m) {
      modoFP = m;
      document.querySelectorAll('#fpModoBtns .filter-chip').forEach(function (b) { b.classList.toggle('active', b.dataset.modo === m); });
      var soLink = m === 'link';
      ['field-telefone', 'field-nomeAssinatura', 'field-cargo'].forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = soLink ? 'none' : ''; });
      var btn = document.getElementById('btnSubmit');
      if (btn) btn.textContent = soLink ? 'Gerar link' : 'Enviar';
      var intro = document.getElementById('fpIntroText');
      if (intro) intro.textContent = soLink
        ? 'Informe o código do assessor e o contrato social para gerar o link do Financial Planning.'
        : 'Preencha os dados para gerar o convite de Financial Planning personalizado. O material gerado ficará disponível ao final da solicitação.';
      var box = document.getElementById('fpLinkResult'); if (box) box.style.display = 'none';
      var err = document.getElementById('submitError'); if (err) err.style.display = 'none';
    }

    function onFormActionFP() {
      if (modoFP === 'link') gerarLinkFP();
      else submitForm();
    }

    function gerarLinkFP() {
      var err = document.getElementById('submitError');
      var codigo = (document.getElementById('codigoAssessor').value || '').trim();
      var contrato = document.getElementById('contratoSocial').value || '';
      if (!codigo || !contrato) {
        err.textContent = 'Preencha o código do assessor e o contrato social para gerar o link.';
        err.style.display = 'block'; return;
      }
      var dom = dominioFP(contrato);
      if (!dom) {
        err.textContent = 'Não reconheci o contrato social para montar o link.';
        err.style.display = 'block'; return;
      }
      err.style.display = 'none';
      var aid = 'A' + codigo.replace(/^[Aa]/, '');
      var url = 'https://' + dom + '/financial-planning/?A_ID=' + encodeURIComponent(aid);
      var box = document.getElementById('fpLinkResult');
      box.innerHTML =
        '<div class="alert-title">Link do Financial Planning</div>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px">' +
          '<input type="text" readonly value="' + url + '" id="fpLinkInput" style="flex:1;min-width:220px;padding:8px 10px;border:1px solid var(--border-light);border-radius:var(--radius-md);font-size:0.85rem;background:#fff" onclick="this.select()">' +
          '<button type="button" class="btn btn-secondary" style="padding:6px 12px;font-size:0.82rem" onclick="copiarLinkFP(this)">Copiar</button>' +
          '<a href="' + url + '" target="_blank" rel="noopener" class="btn btn-secondary" style="padding:6px 12px;font-size:0.82rem">Abrir</a>' +
        '</div>';
      box.style.display = 'block';
    }

    function copiarLinkFP(btn) {
      var inp = document.getElementById('fpLinkInput');
      if (!inp) return;
      inp.select();
      function ok() { var t = btn.textContent; btn.textContent = 'Copiado!'; setTimeout(function () { btn.textContent = t; }, 1500); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(inp.value).then(ok).catch(function () { try { document.execCommand('copy'); ok(); } catch (e) {} });
      } else { try { document.execCommand('copy'); ok(); } catch (e) {} }
    }

    async function submitForm() {'''


def main():
    if HT is None:
        sys.exit("ABORTADO: form-convite-fp.html nao encontrado.")
    src = io.open(HT, encoding="utf-8").read()
    if "setModoFP" in src and "fpModoBtns" in src:
        print("JA APLICADO.")
        return
    bp = HT + ".bak-fplink"
    if not os.path.exists(bp):
        io.open(bp, "w", encoding="utf-8").write(src)
    src = once(src, A_OLD, A_NEW, "toggle+telefone")
    src = once(src, B_OLD, B_NEW, "nome id")
    src = once(src, C_OLD, C_NEW, "cargo id")
    src = once(src, D_OLD, D_NEW, "botao+result")
    src = once(src, E_OLD, E_NEW, "funcoes")
    io.open(HT, "w", encoding="utf-8").write(src)
    print("OK — opcao de gerar link adicionada (backup: %s.bak-fplink)" % HT)


if __name__ == "__main__":
    main()
