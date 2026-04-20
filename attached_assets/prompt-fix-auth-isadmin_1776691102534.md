# Correção — Auth.isAdmin() em auth.js

---

## `auth.js` — Adicionar método `isAdmin()`

Localizar o objeto `Auth` e verificar se `isAdmin` existe.
Se não existir, adicionar o método:

```js
// Dentro do objeto Auth, adicionar após os métodos existentes:

isAdmin() {
  const user = this._user || this.getUser?.() || null;
  if (!user) return false;
  return user.role === 'admin' || user.role === 'gestor';
},
```

### Verificar como o usuário é armazenado

O método precisa acessar o usuário logado. Dependendo da implementação:

```js
// Se Auth usa this._user:
isAdmin() {
  return this._user?.role === 'admin' || this._user?.role === 'gestor';
},

// Se Auth usa uma função getUserName() que lê de sessionStorage/localStorage:
isAdmin() {
  try {
    const raw = sessionStorage.getItem('svn_user') || localStorage.getItem('svn_user');
    if (!raw) return false;
    const user = JSON.parse(raw);
    return user?.role === 'admin' || user?.role === 'gestor';
  } catch { return false; }
},
```

Usar o padrão que já existe no arquivo para acessar dados do usuário.

---

## OBSERVAÇÕES

- Sem build necessário — apenas `auth.js`
- O botão ClickUp no dashboard já está condicionado a `Auth.isAdmin()`
  e `item.clickup_url` — funciona assim que o método existir
- Verificar também se `Auth.isAdmin` é chamado como função (`Auth.isAdmin()`)
  ou como propriedade (`Auth.isAdmin`) e ajustar conforme necessário
