#!/bin/bash
# fix-paralelizar-uploads.sh — torna upload de assets 3x mais rápido
# Aplica concorrência limitada (3 simultâneos) em vez de sequencial.

set -e
cd artifacts/api-server/public

python3 << 'PYEOF'
path = 'admin-assets.html'
with open(path) as f: c = f.read()

old = """  async function uploadFiles(files) {
    if (!files || !files.length) return;
    const arr = Array.from(files);
    const progressWrap = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('uploadProgressBar');
    progressWrap.style.display = 'block';
    let done = 0;
    const results = [];
    for (const file of arr) {
      if (file.size > 5 * 1024 * 1024) { showToast(`${file.name}: arquivo muito grande (máx. 5MB)`, 'error'); done++; progressBar.style.width = (done/arr.length*100)+'%'; continue; }
      const fd = new FormData(); fd.append('file', file);
      try {
        const r = await fetch('/api/admin/assets/upload', { method: 'POST', body: fd });
        const d = await r.json();
        if (!r.ok) { showToast(`${file.name}: ${d.error || 'Erro'}`, 'error'); } else { results.push(d); }
      } catch (err) { console.error('[admin-assets/upload]', file.name, err); showToast(`${file.name}: erro de rede.`, 'error'); }
      done++;
      progressBar.style.width = (done/arr.length*100)+'%';
    }"""

new = """  async function uploadFiles(files) {
    if (!files || !files.length) return;
    const arr = Array.from(files);
    const progressWrap = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('uploadProgressBar');
    progressWrap.style.display = 'block';
    let done = 0;
    const results = [];

    // Upload com concorrência limitada (3 simultâneos)
    const uploadOne = async (file) => {
      if (file.size > 5 * 1024 * 1024) {
        showToast(`${file.name}: arquivo muito grande (máx. 5MB)`, 'error');
        return null;
      }
      const fd = new FormData(); fd.append('file', file);
      try {
        const r = await fetch('/api/admin/assets/upload', { method: 'POST', body: fd });
        const d = await r.json();
        if (!r.ok) {
          showToast(`${file.name}: ${d.error || 'Erro'}`, 'error');
          return null;
        }
        return d;
      } catch (err) {
        console.error('[admin-assets/upload]', file.name, err);
        showToast(`${file.name}: erro de rede.`, 'error');
        return null;
      }
    };

    const CONCURRENCY = 3;
    for (let i = 0; i < arr.length; i += CONCURRENCY) {
      const batch = arr.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(uploadOne));
      for (const r of batchResults) {
        done++;
        if (r) results.push(r);
      }
      progressBar.style.width = (done/arr.length*100)+'%';
    }"""

if old in c:
    c = c.replace(old, new)
    with open(path, 'w') as f: f.write(c)
    print("✓ admin-assets.html: upload paralelizado (concorrência 3)")
else:
    print("✗ Bloco original não encontrado — verifique manualmente")
PYEOF

echo ""
echo "→ Verificação:"
grep -c "CONCURRENCY = 3" admin-assets.html && echo "  ✓ paralelização aplicada"
echo ""
echo "✅ Teste subindo 5+ arquivos de uma vez em /admin-assets."
echo "   Esperado: upload 3x mais rápido."
