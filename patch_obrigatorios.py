#!/usr/bin/env python3
# Alinha marcador visual (asterisco) x validação (required). Rode da RAIZ do workspace.
import io, os, sys
PUB = "artifacts/api-server/public/"
AST = ' <span class="text-ruby">*</span>'

# (arquivo, old, new) — validate-all-then-apply
E = []
def add_aster(form, label_inner):
    old = f"<label>{label_inner}</label>"
    new = f"<label>{label_inner}{AST}</label>"
    E.append((PUB+form, old, new))
def add_required(form, tag_old):
    E.append((PUB+form, tag_old, tag_old[:-1] + " required>"))

# 1) asteriscos em campos single REALMENTE obrigatórios (required já presente)
for lbl in ["Título do material","Finalidade da arte","Conteúdo que deve estar presente na arte","Prazo desejado para entrega"]:
    add_aster("form-artes-divulgacao.html", lbl)
for lbl in ["Título do material","Finalidade do material","Descrição do que precisa ser atualizado"]:
    add_aster("form-atualizacao-material.html", lbl)

# 2) required onde havia asterisco sem enforce
add_required("form-assinatura-email.html", '<input type="text" id="cargo" placeholder="Seu cargo">')

# 3) uploads CH obrigatórios -> required (FormCore/local validam input[required])
for form in ["form-ch-aniversariantes.html","form-ch-linha-do-tempo.html","form-ch-atualizacao-pessoas.html"]:
    add_required(form, '<input type="file" id="arquivoApoio">')
add_required("form-ch-atualizacao-books.html", '<input type="file" id="arquivoApoio" multiple>')

# 4) pessoas: label "(opcional)" -> asterisco (arquivo agora é obrigatório)
E.append((PUB+"form-ch-atualizacao-pessoas.html",
          "<label>Arquivos com atualização de contrato (opcional)</label>",
          f"<label>Arquivos com atualização de contrato{AST}</label>"))

# validate-all
pending={}; errs=[]
def get(p):
    if p not in pending: pending[p]=io.open(p,encoding="utf-8").read()
    return pending[p]
for p,old,new in E:
    s=get(p); c=s.count(old)
    if c!=1: errs.append(f"{os.path.basename(p)}: âncora x{c} (esperado 1): {old[:60]!r}")
if errs:
    print("ABORTADO:"); [print("  -",e) for e in errs]; sys.exit(1)
for p,old,new in E:
    pending[p]=pending[p].replace(old,new,1)
for p,c in pending.items(): io.open(p,"w",encoding="utf-8").write(c)
print(f"OK: {len(E)} edições aplicadas em {len(pending)} arquivo(s).")
print("NOTA: artes-divulgacao 'Canal' e 'Público-alvo' são checkbox-groups; required em checkbox é no-op no FormCore — tratar com extraValidate à parte.")
