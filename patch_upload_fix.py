#!/usr/bin/env python3
# Fix sistêmico do feedback de upload: listener delegado em upload-feedback.js + bump de cache
# + neutraliza o handler custom do books (evita render duplicado). Rode da RAIZ do workspace.
import io, os, re, sys
PUB = "artifacts/api-server/public/"
OLD_VER, NEW_VER = "20260603", "20260615e"

DELEG = '''

/* Safety-net: feedback de upload por delegação no document (à prova de timing).
   Cobre qualquer input[type=file] com id cujo feedback seja o elemento `<id>Name`.
   Defere a binds explícitos (FileUpload.bind marca dataset.uploadBound='1') para não duplicar. */
document.addEventListener('change', function (e) {
  var input = e.target;
  if (!input || input.tagName !== 'INPUT' || input.type !== 'file' || !input.id) return;
  if (input.dataset.uploadBound === '1') return;
  var nameEl = document.getElementById(input.id + 'Name');
  if (!nameEl || typeof FileUpload === 'undefined') return;
  var files = input.files;
  if (!files || !files.length) { FileUpload.clear(nameEl); return; }
  if (files.length === 1) { FileUpload.success(nameEl, files[0]); }
  else {
    nameEl.innerHTML = '<div class="upload-feedback upload-feedback--success">' +
      '<span class="upload-feedback__name">' + files.length + ' arquivos selecionados</span></div>';
  }
});
'''

BOOKS_OLD = '''function bindUploads() {
      const inp = document.getElementById('arquivoApoio');
      const nameEl = document.getElementById('arquivoApoioName');
      inp.addEventListener('change', function () {
        if (inp.files.length === 1 && window.FileUpload && FileUpload.success) { FileUpload.success(nameEl, inp.files[0]); }
        else if (inp.files.length > 1) { nameEl.innerHTML = '<div class="upload-feedback upload-feedback--success"><span class="upload-feedback__name">' + inp.files.length + ' arquivos selecionados</span></div>'; }
        else { nameEl.innerHTML = ''; }
      });
    }'''
BOOKS_NEW = '''function bindUploads() {
      // Feedback de upload (single/múltiplo) é tratado globalmente por upload-feedback.js (delegação).
    }'''

pending = {}
def get(p):
    if p not in pending: pending[p] = io.open(p, encoding="utf-8").read()
    return pending[p]
def put(p, c): pending[p] = c

errs=[]

# 1) upload-feedback.js: append delegação (idempotente)
uf_p = PUB+"upload-feedback.js"; uf = get(uf_p)
anchor = "if (options.onChange) options.onChange(f, nameEl, input);\n    });\n  }\n};"
if "feedback de upload por delegação" in uf:
    print("(delegação já presente)")
elif uf.count(anchor)!=1:
    errs.append(f"upload-feedback.js: anchor final x{uf.count(anchor)}")
else:
    put(uf_p, uf.replace(anchor, anchor+DELEG, 1))

# 2) books: neutraliza handler custom
bk_p = PUB+"form-ch-atualizacao-books.html"; bk = get(bk_p)
if BOOKS_OLD not in bk:
    if "tratado globalmente por upload-feedback.js" not in bk:
        errs.append("books: handler custom não casou (markup mudou?)")
else:
    put(bk_p, bk.replace(BOOKS_OLD, BOOKS_NEW, 1))

# 3) bump de cache em todos os HTMLs (compondo sobre edits pendentes)
bumped=0
for f in os.listdir(PUB):
    if not f.endswith(".html"): continue
    p=PUB+f; s=get(p); s2=s.replace(f"upload-feedback.js?v={OLD_VER}", f"upload-feedback.js?v={NEW_VER}")
    if s2!=s: put(p, s2); bumped+=1

if errs:
    print("ABORTADO:"); [print("  -",e) for e in errs]; sys.exit(1)
for p,c in pending.items(): io.open(p,"w",encoding="utf-8").write(c)
print(f"OK: delegação + books neutralizado + cache bump em {bumped} HTML(s) -> {NEW_VER}")
