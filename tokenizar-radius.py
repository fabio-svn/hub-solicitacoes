#!/usr/bin/env python3
"""
Fase E — tokeniza border-radius para a escala --radius-* do style.css.

Uso (de qualquer diretorio):
    python3 tokenizar-radius.py
    python3 tokenizar-radius.py caminho/para/public   # opcional

O script encontra sozinho a pasta com os arquivos (procura por style.css).
Depois:  git diff  (revise)  e  git commit.

Seguro:
- So troca border-radius de VALOR UNICO (preserva cantos assimetricos "8px 8px 0 0").
- Idempotente: rodar de novo nao causa dano.
- Os tokens --radius-* precisam ja existir no style.css.
"""
import re, glob, os, sys

MAP = {
    '2px':'xs','3px':'xs','4px':'xs',
    '5px':'sm','6px':'sm','7px':'sm',
    '8px':'md','9px':'md',
    '10px':'lg',
    '12px':'xl','14px':'xl',
    '16px':'2xl','18px':'2xl','20px':'2xl',
    '24px':'3xl',
    '999px':'pill','50%':'round',
}

def find_target(argv):
    if len(argv) > 1 and os.path.isdir(argv[1]):
        return argv[1]
    here = os.path.dirname(os.path.abspath(__file__))
    for cand in ('.', 'artifacts/api-server/public',
                 os.path.join(here, 'artifacts/api-server/public'), here):
        if os.path.isfile(os.path.join(cand, 'style.css')):
            return cand
    for base in ('.', here):
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in ('node_modules', 'dist', '.git', '.next')]
            if 'style.css' in files:
                return root
    return None

def tokenize(text):
    total = 0
    for val in sorted(MAP, key=len, reverse=True):
        tok = MAP[val]
        pat = r'(border-radius:\s*)' + re.escape(val) + r'(?=\s*[;}!)"\'])'
        text, n = re.subn(pat, r'\1var(--radius-' + tok + ')', text)
        total += n
    return text, total

def main():
    target = find_target(sys.argv)
    if not target:
        print("Nao encontrei 'style.css'. Rode dentro do repo ou passe o caminho:")
        print("    python3 tokenizar-radius.py caminho/para/public")
        sys.exit(1)
    print("Diretorio-alvo:", os.path.abspath(target), "\n")
    files = (glob.glob(os.path.join(target, '*.css')) +
             glob.glob(os.path.join(target, '*.html')) +
             glob.glob(os.path.join(target, '*.js')))
    if not files:
        print("Nenhum .css/.html/.js encontrado nesse diretorio."); sys.exit(1)
    grand = touched = 0
    for f in files:
        c = open(f, encoding='utf-8').read()
        new, n = tokenize(c)
        if n:
            open(f, 'w', encoding='utf-8').write(new)
            print("  %s: %d trocas" % (os.path.basename(f), n)); grand += n; touched += 1
    print("\nTOTAL: %d trocas em %d arquivos." % (grand, touched))
    if grand == 0:
        print("(Nada a trocar - ou ja tokenizado, ou tokens --radius ausentes no style.css.)")

if __name__ == '__main__':
    main()
