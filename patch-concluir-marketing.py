#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Restringe a conclusao ("publicado") ao MARKETING: apenas admin e gestor.
Capital Humano continua validando (aprovar / ajustes / reprovar), mas nao conclui —
concluir significa "ja esta no ar no site", e quem publica e o marketing.

Backend: 403 se a role nao for admin/gestor (a guarda vale mesmo que alguem
chame a API direto — nao basta esconder o botao).
Front: o botao "Marcar como concluído" so aparece para admin/gestor; para as
demais roles mostra o estado, sem acao.

Idempotente, backups .bak-concluir.
"""
import io, os, sys, glob

def _r(cs):
    for c in cs:
        p=os.path.normpath(c)
        if os.path.exists(p): return p
    return None
VAL=_r(["artifacts/api-server/public/validacao-assessores.html","public/validacao-assessores.html"])
ROTAS = glob.glob("artifacts/api-server/src/routes/*.ts") + glob.glob("src/routes/*.ts")
APR = next((p for p in ROTAS if 'assessor-aprovacoes/:id/decisao' in io.open(p,encoding="utf-8").read()), None)
if not VAL or not APR: sys.exit("arquivos nao encontrados")

# ── backend: guarda de role ──
a=io.open(APR,encoding="utf-8").read()
if "PUBLICA_ROLES" in a:
    print("[backend] JA APLICADO.")
else:
    if 'publicado: "publicado"' not in a:
        sys.exit("ABORTADO: rode antes o patch-assessor-fluxo.py")
    OLD = '''    if (novoStatus === "publicado") {
      if (!pub || pub.status !== "aprovado") {'''
    if a.count(OLD)!=1: sys.exit("ABORTADO [backend]: ancora do bloco publicado")
    NEW = '''    if (novoStatus === "publicado") {
      // Concluir = "ja esta publicado no site". Quem publica e o marketing.
      // Capital Humano valida, mas nao conclui.
      const PUBLICA_ROLES = ["gestor", "admin"];
      if (!PUBLICA_ROLES.includes(role)) {
        res.status(403).json({ error: "Apenas o marketing pode concluir uma página." });
        return;
      }
      if (!pub || pub.status !== "aprovado") {'''
    b=APR+".bak-concluir"
    if not os.path.exists(b): io.open(b,"w",encoding="utf-8").write(a)
    io.open(APR,"w",encoding="utf-8").write(a.replace(OLD,NEW,1))
    print("[backend] OK — publicado restrito a gestor/admin")

# ── front: botao so para marketing ──
v=io.open(VAL,encoding="utf-8").read()
if "podePublicar" in v:
    print("[front] JA APLICADO.")
else:
    if "Marcar como concluído" not in v:
        sys.exit("ABORTADO: rode antes o patch-assessor-fluxo.py")
    OLD = """      } else if (resumo.status === 'aprovado') {"""
    if v.count(OLD)!=1: sys.exit("ABORTADO [front]: ancora do rodape")
    NEW = """      } else if (resumo.status === 'aprovado' && podePublicar()) {"""
    v2 = v.replace(OLD,NEW,1)

    # helper de role, junto das outras constantes do topo do script
    ANC = "    const CONTRATO_LABELS = "
    if v2.count(ANC) != 1: sys.exit("ABORTADO [front]: ancora das constantes")
    HELPER = """    // Concluir (= publicado no site) e do marketing: gestor e admin.
    // Capital Humano valida, mas nao conclui.
    function podePublicar() {
      const r = (typeof Auth !== 'undefined' && Auth.getUserRole) ? Auth.getUserRole() : '';
      return r === 'gestor' || r === 'admin';
    }
    const CONTRATO_LABELS = """
    v2 = v2.replace(ANC, HELPER, 1)
    b=VAL+".bak-concluir"
    if not os.path.exists(b): io.open(b,"w",encoding="utf-8").write(v)
    io.open(VAL,"w",encoding="utf-8").write(v2)
    print("[front] OK — botao so para gestor/admin")

print("\nStop -> Run + bash check.sh")
