# Round 10 — Botão Voltar em todos os forms multi-etapa

Adicionar botão Voltar em todas as etapas intermediárias dos forms
que ainda não o possuem.

---

## Forms a verificar e corrigir:

### `form-eventos.html`
Verificar se steps 2, 3, 4, 5 têm botão Voltar na `.form-nav`.
Padrão esperado em cada step (exceto step 1 e último):

```html
<div class="form-nav">
  <button class="btn btn-secondary" onclick="goStep(N-1)">Voltar</button>
  <button class="btn btn-primary" onclick="goStep(N+1)" id="btnNextN">Próximo</button>
</div>
```

No último step (Enviar):
```html
<div class="form-nav">
  <button class="btn btn-secondary" onclick="goStep(N-1)">Voltar</button>
  <button class="btn btn-primary btn-submit-gold" id="btnSubmit" onclick="submitForm()">Enviar</button>
</div>
```

### `form-apresentacoes.html`
- Step 2: botão Voltar → `goToStep1()` ou equivalente que volta para step1
- Step 3 (se existir): botão Voltar → `goStep(2)`

Adicionar função `goToStep1()` se não existir:
```js
function goToStep1() {
  document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
  document.getElementById('step1').classList.add('active');
  document.getElementById('progressBar').style.width = '33%';
  document.getElementById('stepLabel').textContent = 'Etapa 1 de 3';
  window.scrollTo(0, 0);
}
```

### `form-criacao-pdf.html`
Mesma estrutura: step 2 precisa de Voltar → step1, step 3 → step2.

### `form-pagina-assessores.html`
- `step2seletor` já tem Voltar ✅ (via `voltarParaStep1()`)
- `step2` (formulário): adicionar Voltar que volta para `step2seletor`
  quando `isAtualizacao === true`, ou para `step1` quando `isAtualizacao === false`

```js
// Substituir ou adicionar ao form-nav do step2:
<div class="form-nav" style="justify-content:space-between">
  <button class="btn btn-secondary" onclick="voltarDoStep2()">Voltar</button>
  <!-- botões existentes (preview + enviar) -->
</div>

// Função:
function voltarDoStep2() {
  document.getElementById('step2').classList.remove('active');
  if (isAtualizacao) {
    document.getElementById('step2seletor').classList.add('active');
    document.getElementById('progressBar').style.width = '50%';
    document.getElementById('stepLabel').textContent = 'Etapa 2 de 3';
  } else {
    document.getElementById('step1').classList.add('active');
    document.getElementById('progressBar').style.width = '50%';
    document.getElementById('stepLabel').textContent = 'Etapa 1 de 2';
  }
  window.scrollTo(0, 0);
}
```

### `form-artes-divulgacao.html`, `form-atualizacao-material.html`
Se tiverem mais de uma etapa, verificar e adicionar Voltar da mesma forma.

---

## OBSERVAÇÕES

- Sem build necessário — apenas arquivos HTML
- O botão Voltar nunca deve aparecer no step 1 (primeira etapa)
- Em forms com subtipo escolhido na etapa 1 (assessores, apresentações, PDF),
  voltar ao step 1 reseta a escolha de subtipo visualmente mas não
  precisa limpar a variável JS — o usuário pode reselecionar
