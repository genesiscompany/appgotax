# Correções para Produção — GoTaxi Platform
**Data:** 28/05/2026  
**Origem:** Varredura de configuração pré-deploy no EasyPanel

---

## 🔴 Crítico — Corrigido

### [1] Nginx com hostname errado — todas as chamadas de API quebrariam em produção

**Arquivo:** `migration/nginx/spa.conf`

Os painéis web (PDV, Admin, Afiliados) são servidos por containers Nginx que proxeam chamadas `/api/*` para o backend. O nome do host estava errado:

```nginx
# ANTES — hostname fictício, não existe no EasyPanel
set $upstream "http://app_api:8080";
set $up2 "http://app_api:8080";

# DEPOIS — nome real do serviço conforme configurado no EasyPanel
set $upstream "http://gotaxi-api:8080";
set $up2 "http://gotaxi-api:8080";
```

**Impacto sem a correção:** as telas dos painéis carregariam normalmente, mas nenhuma ação funcionaria — login, listagem de dados, pedidos etc. retornariam erro de rede silencioso.

---

## 🟠 Alto — Corrigido

### [2] App mobile apontando para o Replit em produção

**Arquivo:** `eas.json` (raiz)

A variável `EXPO_PUBLIC_DOMAIN` nos perfis de build `preview` e `production` continha o endereço do ambiente de desenvolvimento Replit:

```json
// ANTES
"EXPO_PUBLIC_DOMAIN": "gotaxiplus.replit.app"

// DEPOIS
"EXPO_PUBLIC_DOMAIN": "gotaxi.com.br"
```

**Impacto sem a correção:** apps publicados na Play Store apontariam para um servidor que pode ser desligado, causando falha total nos apps dos clientes e motoristas.

---

### [3] Nome de variável de ambiente errado no guia de deploy

**Arquivo:** `DEPLOY-EASYPANEL.md`

O guia orientava configurar `OPENAI_API_KEY` no EasyPanel, mas o código do servidor usa `AI_INTEGRATIONS_OPENAI_API_KEY`:

```
# ANTES (no guia)
OPENAI_API_KEY=sk-proj-...

# DEPOIS (no guia, agora correto)
AI_INTEGRATIONS_OPENAI_API_KEY=sk-proj-...
```

**Impacto sem a correção:** o suporte por IA do sistema não funcionaria mesmo com a chave configurada, pois o código não encontraria a variável com o nome errado.

---

## 🟡 Médio — Corrigido

### [4] User-Agent com domínio Replit hardcoded nas chamadas OpenStreetMap

**Arquivo:** `artifacts/api-server/src/routes/places.ts` (linhas 17 e 173)

As chamadas à API do Nominatim (busca de endereços) enviavam o domínio do Replit no cabeçalho `User-Agent`:

```ts
// ANTES
headers: { "User-Agent": "GoTaxi-App/1.0 (gotaxiplus.replit.app)" }

// DEPOIS — usa o domínio configurado via variável de ambiente
headers: { "User-Agent": `GoTaxi-App/1.0 (${process.env.PUBLIC_DOMAIN ?? "gotaxi.com.br"})` }
```

**Impacto sem a correção:** O Nominatim usa o User-Agent para identificar a aplicação. Manter o domínio antigo pode causar bloqueio da chave se o Replit for desligado.

---

### [5] Arquivo `.dockerignore` ausente na raiz do repositório

**Arquivo criado:** `.dockerignore` (raiz)

O Docker só lê o `.dockerignore` da raiz do repositório. O arquivo existia em `migration/.dockerignore` mas não era utilizado pelo daemon Docker durante o build.

Sem esse arquivo, o Docker enviava para o daemon:
- Todas as pastas `node_modules` (centenas de MB)
- Arquivos `.expo`, `.cache`, logs
- O arquivo `backup_gotaxi.sql` (dados do banco)

**Impacto sem a correção:** builds mais lentos (upload desnecessário de arquivos grandes para o contexto Docker) e potencial exposição do `backup_gotaxi.sql` dentro da imagem.

---

## ✅ Itens Verificados e Confirmados OK

| Item | Arquivo | Status |
|------|---------|--------|
| Dockerfile API — multi-stage, Node 24, esbuild correto | `migration/dockerfiles/Dockerfile.api` | ✅ OK |
| Dockerfile Web — Nginx 1.27, build Vite correto | `migration/dockerfiles/Dockerfile.web` | ✅ OK |
| Build esbuild inclui todas as dependências de runtime | `artifacts/api-server/build.ts` | ✅ OK |
| Saída do Vite (`dist/public`) bate com o caminho do Nginx | `artifacts/pdv/vite.config.ts` | ✅ OK |
| `pnpm-workspace.yaml` inclui `linux` em `supportedArchitectures` | `pnpm-workspace.yaml` | ✅ OK |
| `.env.example` documenta todas as variáveis necessárias | `.env.example` | ✅ OK |
| Plugins Replit no Vite só ativam quando `REPL_ID` está presente | `vite.config.ts` (todos) | ✅ OK |
| Volume de uploads configurado no Dockerfile | `Dockerfile.api` | ✅ OK |
| Chamadas de API nos frontends usam path relativo `/api/` | `artifacts/pdv/src/**` | ✅ OK |
| `PORT` obrigatório — servidor falha explicitamente se não configurado | `artifacts/api-server/src/index.ts` | ✅ OK |

---

*Correções aplicadas diretamente nos arquivos — nenhuma ação manual necessária além do deploy.*
