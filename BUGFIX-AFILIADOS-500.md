# Correção: Erro 500 no Login de Afiliados

## Contexto

O portal de afiliados (`artifacts/afiliados-hub`) ao tentar fazer login retornava HTTP 500 com `{ "error": "server_error" }` em determinados cenários.

---

## Causa Raiz

### Bug 1 — Conflito de UNIQUE no campo `codigo` (crash não tratado)

**Arquivos afetados:**
- `artifacts/api-server/src/routes/afiliados.ts` — rota `POST /api/afiliados/login`
- `artifacts/api-server/src/routes/cliente.ts` — rota `GET /api/cliente/afiliados/perfil`

A tabela `afiliados` possui duas constraints UNIQUE:
```sql
"afiliados_usuario_id_key" UNIQUE (usuario_id)
"afiliados_codigo_key"     UNIQUE (codigo)
```

Quando um usuário fazia login pela primeira vez, o código criava o perfil de afiliado com:

```sql
INSERT INTO afiliados (usuario_id, codigo)
VALUES ($1, $2)
ON CONFLICT (usuario_id) DO UPDATE SET usuario_id = afiliados.usuario_id
RETURNING *
```

O problema: o `ON CONFLICT` tratava apenas colisão em `usuario_id`. Se o campo `codigo` gerado (`BELLAS0002`, por exemplo) já existisse para outro usuário, o PostgreSQL lançava erro `23505 (unique_violation)` que não era capturado — resultando em crash 500 não tratado.

Além disso, o `DO UPDATE SET usuario_id = afiliados.usuario_id` era um no-op (atualizava a coluna com o mesmo valor), não servindo para nada funcional.

### Bug 2 — Módulos nativos Windows ausentes (bloqueio de ambiente)

O `pnpm-lock.yaml` foi gerado no Replit (Linux) e o `pnpm-workspace.yaml` continha overrides que **explicitamente excluíam** todos os binários nativos win32:

```yaml
overrides:
  esbuild>@esbuild/win32-x64: '-'
  lightningcss>lightningcss-win32-x64-msvc: '-'
  rollup>@rollup/rollup-win32-x64-msvc: '-'
  rollup>@rollup/rollup-win32-x64-gnu: '-'
  '@tailwindcss/oxide>@tailwindcss/oxide-win32-x64-msvc': '-'
```

Isso impedia o Vite de iniciar em Windows com erro `Cannot find module @rollup/rollup-win32-x64-msvc`.

---

## Solução

### Fix 1 — Tratamento robusto do INSERT de afiliado

Substituído o INSERT frágil por um loop com até 3 tentativas:

1. Tenta inserir com `ON CONFLICT (usuario_id) DO NOTHING`
2. Se nenhuma linha foi inserida (race condition — outro processo já criou), faz SELECT para buscar a linha existente
3. Se o erro for `23505` (código `codigo` duplicado), gera um sufixo aleatório e tenta novamente

**`artifacts/api-server/src/routes/afiliados.ts`** e **`artifacts/api-server/src/routes/cliente.ts`:**

```ts
// Antes (frágil)
afiliadoRows = (await db.execute(sql`
  INSERT INTO afiliados (usuario_id, codigo)
  VALUES (${user.id}, ${codigo})
  ON CONFLICT (usuario_id) DO UPDATE SET usuario_id = afiliados.usuario_id
  RETURNING *
`)).rows;

// Depois (robusto)
for (let attempt = 0; attempt < 3 && !afiliadoRows.length; attempt++) {
  const base = gerarCodigo(user.nome, user.id);
  const codigo = attempt === 0 ? base : `${base}${Math.floor(Math.random() * 900) + 100}`;
  try {
    const inserted = (await db.execute(sql`
      INSERT INTO afiliados (usuario_id, codigo)
      VALUES (${user.id}, ${codigo})
      ON CONFLICT (usuario_id) DO NOTHING
      RETURNING *
    `)).rows;
    if (inserted.length) {
      afiliadoRows = inserted as any[];
    } else {
      // Linha já existe (race condition) — busca
      afiliadoRows = (await db.execute(sql`
        SELECT * FROM afiliados WHERE usuario_id = ${user.id}
      `)).rows as any[];
    }
  } catch (e: any) {
    if (e.code === "23505" && attempt < 2) continue; // codigo conflict, retry
    throw e;
  }
}
```

### Fix 2 — Binários nativos Windows no pnpm

Removidas as linhas de exclusão win32 do `pnpm-workspace.yaml`:

```yaml
# Removido:
esbuild>@esbuild/win32-x64: '-'
lightningcss>lightningcss-win32-x64-msvc: '-'
rollup>@rollup/rollup-win32-x64-msvc: '-'
rollup>@rollup/rollup-win32-x64-gnu: '-'
'@tailwindcss/oxide>@tailwindcss/oxide-win32-x64-msvc': '-'
```

Adicionado `supportedArchitectures` ao `pnpm-workspace.yaml` e `.npmrc`:

```yaml
# pnpm-workspace.yaml
supportedArchitectures:
  os:
    - win32
    - linux
  cpu:
    - x64
```

```ini
# .npmrc
supported-architectures-os[]=win32
supported-architectures-os[]=linux
supported-architectures-cpu[]=x64
```

Após deletar o `pnpm-lock.yaml` e rodar `pnpm install --ignore-scripts`, os 5 módulos nativos Windows foram instalados:
- `@esbuild/win32-x64@0.27.3`
- `@rollup/rollup-win32-x64-gnu@4.60.4`
- `@rollup/rollup-win32-x64-msvc@4.60.4`
- `@tailwindcss/oxide-win32-x64-msvc@4.3.0`
- `lightningcss-win32-x64-msvc@1.32.0`

---

## Resultado

| Situação | Antes | Depois |
|----------|-------|--------|
| Login com usuário novo (sem perfil afiliado) | 500 se `codigo` colidisse | ✅ Cria com retry automático |
| Login com usuário já cadastrado (race condition) | 500 potencial | ✅ Faz SELECT de fallback |
| Vite em Windows | Falha ao iniciar | ✅ Inicia normalmente |
| Login `bella@pizzaria.com` / `123456` | Potencial 500 | ✅ Retorna token + perfil |

---

## Credenciais de Teste (ambiente local)

| Email | Senha |
|-------|-------|
| `bella@pizzaria.com` | `123456` |
| `sumanicure@gotaxi.com.br` | `123456` |
| `admin@gotaxi.com` | (bcrypt — redefinir via banco) |
