# 🚀 Guia de Migração GoTaxi: Replit → VPS com Easypanel

> **IMPORTANTE:** Este guia **NÃO altera nada** no seu projeto original. Você vai apenas:
> 1. Copiar a pasta `migration/` para o seu repositório GitHub
> 2. Criar serviços novos no Easypanel apontando para essa pasta
> 3. Atualizar uma única variável de ambiente no app mobile e refazer o build EAS
>
> Seu Replit continua funcionando normalmente.

---

## 📦 Sumário

1. [Visão geral da arquitetura](#1-visão-geral)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Passo 1 — Subir os arquivos de migração no GitHub](#3-passo-1)
4. [Passo 2 — Criar o PostgreSQL no Easypanel](#4-passo-2)
5. [Passo 3 — Restaurar o backup do banco](#5-passo-3)
6. [Passo 4 — Criar o serviço da API](#6-passo-4)
7. [Passo 5 — Criar os 3 painéis web (PDV, Admin, Afiliados)](#7-passo-5)
8. [Passo 6 — Configurar DNS e HTTPS](#8-passo-6)
9. [Passo 7 — Rebuild dos apps mobile (Play Store)](#9-passo-7)
10. [Passo 8 — Testes finais](#10-passo-8)
11. [Troubleshooting](#11-troubleshooting)
12. [Custos estimados e dimensionamento da VPS](#12-custos)

---

<a id="1-visão-geral"></a>
## 1. Visão geral da arquitetura

```
┌─────────────────── VPS com Easypanel ────────────────────┐
│                                                            │
│  🐘 PostgreSQL 16  ◄────┐                                  │
│                         │                                  │
│  🟢 api-server  ────────┤  api.gotaxi.com.br               │
│     (Node + Express)    │  porta 8080 → 443                │
│                         │                                  │
│  🌐 pdv-web ────────────┤  pdv.gotaxi.com.br               │
│     (Nginx + React)     │                                  │
│                         │                                  │
│  🌐 admin-web ──────────┤  admin.gotaxi.com.br             │
│     (Nginx + React)     │                                  │
│                         │                                  │
│  🌐 afiliados-web ──────┘  afiliados.gotaxi.com.br         │
│     (Nginx + React)                                        │
└────────────────────────────────────────────────────────────┘
              ▲                       ▲
              │ HTTPS                 │ HTTPS
              │                       │
       📱 App Cliente            📱 App Pro
       (Play Store)              (Play Store)
       saas-mobile               gotaxi-pro
```

**O que muda:**
- O backend e os painéis web saem do Replit e vão para sua VPS.
- O banco PostgreSQL fica dentro da VPS (mais barato e mais rápido).
- Os apps mobile **continuam na Play Store**, só apontam para o novo endereço da API.

**O que NÃO muda:**
- Seu código-fonte original
- Seu Replit (continua funcionando como ambiente de dev)
- Estrutura do banco de dados

---

<a id="2-pré-requisitos"></a>
## 2. Pré-requisitos

✅ **Você já tem:**
- VPS com Easypanel instalado e rodando
- Repositório GitHub: `genesiscompany/goplus`
- Domínio: `gotaxi.com.br`
- App publicado na Play Store

🔑 **Você vai precisar reunir essas chaves antes de começar:**

| Variável | Onde obter | Obrigatório? |
|---|---|---|
| `JWT_SECRET` | Gere qualquer string aleatória de 64+ caracteres ([gere aqui](https://generate-secret.vercel.app/64)) | ✅ Sim |
| `GOOGLE_MAPS_KEY` | [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials (chave para o cliente, restrita por domínio) | ✅ Sim |
| `GOOGLE_MAPS_SERVER_KEY` | Mesma origem, mas chave **sem restrição de domínio** (uso server-side) | ✅ Sim |
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) — para o chat IA | ✅ Sim |
| `DATABASE_URL` | Gerado automaticamente pelo Easypanel ao criar o Postgres | ✅ Sim |
| `EXPO_PUBLIC_DOMAIN` | `gotaxi.com.br` (sem https, sem barra) | ✅ Sim |
| `NODE_ENV` | `production` | ✅ Sim |

> 💡 **Dica:** Crie um arquivo `.env.producao.txt` localmente no seu PC e cole essas chaves nele. Use só pra consultar — não suba pro Git.

---

<a id="3-passo-1"></a>
## 3. Passo 1 — Subir os arquivos de migração no GitHub

A pasta `/app/migration/` (que vamos te entregar) contém:

```
migration/
├── dockerfiles/
│   ├── Dockerfile.api      ← Backend Node/Express
│   └── Dockerfile.web      ← Frontends Vite (PDV, Admin, Afiliados)
├── nginx/
│   └── spa.conf            ← Config Nginx para SPAs
├── easypanel-templates/
│   ├── 01-postgres.md
│   ├── 02-api-server.md
│   ├── 03-pdv.md
│   ├── 04-admin.md
│   └── 05-afiliados.md
├── .dockerignore
└── GUIA-MIGRACAO.md        ← Este arquivo
```

**O que fazer:**

```bash
# No seu PC, dentro do clone do repositório goplus
git checkout -b migration-easypanel

# Copie a pasta /app/migration aqui dentro
cp -r ~/Downloads/migration ./migration
cp ./migration/.dockerignore ./.dockerignore   # opcional na raiz

git add migration/ .dockerignore
git commit -m "feat: arquivos de migração para Easypanel"
git push origin migration-easypanel
```

Depois faça merge para `main` no GitHub (ou crie um PR e revise).

> ⚠️ **Não delete nada do seu repositório.** Apenas adicione esses arquivos novos.

---

<a id="4-passo-2"></a>
## 4. Passo 2 — Criar o PostgreSQL no Easypanel

1. Entre no painel do Easypanel
2. Clique em **+ Create Service** → **Database** → **PostgreSQL**
3. Configure:
   - **Service Name:** `gotaxi-db`
   - **Version:** `16` (mesma versão do Replit)
   - **Database Name:** `gotaxi`
   - **Username:** `gotaxi`
   - **Password:** *gere uma senha forte e salve* (ex: usar [1Password](https://1password.com) ou similar)
4. Clique em **Create**
5. Anote a **Connection String** que aparece — ela tem o formato:
   ```
   postgres://gotaxi:SENHA@gotaxi-db:5432/gotaxi
   ```
   > 💡 No Easypanel, dentro da rede interna do projeto, o host é o **nome do serviço** (`gotaxi-db`), não `localhost`.

6. **(Opcional mas recomendado)** Habilite os backups automáticos:
   - Vá em **Backups** → **Schedule** → diário às 4h da manhã
   - Configure destino: S3, Backblaze B2 ou Easypanel Storage

---

<a id="5-passo-3"></a>
## 5. Passo 3 — Restaurar o backup do banco

Seu repositório tem `backup_gotaxi.sql` (200KB) com toda a estrutura + dados.

### Opção A — Via Easypanel UI (mais fácil)

1. No serviço `gotaxi-db`, clique em **Console** (terminal embutido)
2. Cole o backup via clipboard e rode:

```bash
psql -U gotaxi -d gotaxi < /tmp/backup_gotaxi.sql
```

### Opção B — Via SSH na VPS

```bash
# 1. Suba o backup pra VPS via scp
scp backup_gotaxi.sql root@SEU_IP_VPS:/tmp/

# 2. SSH na VPS
ssh root@SEU_IP_VPS

# 3. Descubra o nome do container Postgres
docker ps | grep gotaxi-db

# 4. Restaure dentro do container
docker exec -i NOME_DO_CONTAINER psql -U gotaxi -d gotaxi < /tmp/backup_gotaxi.sql
```

### Verificar se deu certo:

```bash
docker exec -it NOME_DO_CONTAINER psql -U gotaxi -d gotaxi -c "\dt"
```
Deve listar dezenas de tabelas (`empresas`, `usuarios`, `corridas`, etc.).

---

<a id="6-passo-4"></a>
## 6. Passo 4 — Criar o serviço da API

1. **+ Create Service** → **App** → **Github**
2. Configurações:

| Campo | Valor |
|---|---|
| **Service Name** | `gotaxi-api` |
| **Repository** | `genesiscompany/goplus` |
| **Branch** | `main` |
| **Build Type** | `Dockerfile` |
| **Build Path** | `/` (raiz) |
| **Dockerfile Path** | `migration/dockerfiles/Dockerfile.api` |
| **Port** | `8080` |

3. **Environment Variables** (aba Environment):

```env
NODE_ENV=production
PORT=8080
DATABASE_URL=postgres://gotaxi:SUA_SENHA@gotaxi-db:5432/gotaxi
JWT_SECRET=cole_aqui_sua_string_aleatoria_de_64_chars
GOOGLE_MAPS_KEY=sua_chave_google_maps_cliente
GOOGLE_MAPS_SERVER_KEY=sua_chave_google_maps_server
OPENAI_API_KEY=sk-proj-...
PUBLIC_DOMAIN=https://gotaxi.com.br
```

4. **Volumes** (aba Volumes) — para uploads persistentes:

| Mount Path | Volume |
|---|---|
| `/app/public/uploads` | `gotaxi-uploads` (Easypanel cria automaticamente) |

5. **Domain** (aba Domains):
   - Adicione: `api.gotaxi.com.br`
   - Marque: **Enable HTTPS** (Let's Encrypt automático)
   - **Path:** `/`
   - **Port:** `8080`

6. Clique em **Deploy**. Acompanhe os logs — o primeiro build leva ~3-5 min.

✅ **Verifique:** abra `https://api.gotaxi.com.br/api/health` (ou `/`) — deve responder.

---

<a id="7-passo-5"></a>
## 7. Passo 5 — Criar os 3 painéis web (PDV, Admin, Afiliados)

**Repita 3 vezes o processo abaixo**, mudando apenas o nome:

### 7.1 — PDV

| Campo | Valor |
|---|---|
| **Service Name** | `gotaxi-pdv` |
| **Repository** | `genesiscompany/goplus` |
| **Branch** | `main` |
| **Build Type** | `Dockerfile` |
| **Dockerfile Path** | `migration/dockerfiles/Dockerfile.web` |
| **Build Args** | `WORKSPACE=pdv` <br> `GOOGLE_MAPS_KEY=sua_chave` |
| **Port** | `80` |
| **Domain** | `pdv.gotaxi.com.br` (HTTPS habilitado) |

### 7.2 — Admin

Igual ao PDV, mudando:
- **Service Name:** `gotaxi-admin`
- **Build Args:** `WORKSPACE=admin`
- **Domain:** `admin.gotaxi.com.br`

### 7.3 — Afiliados Hub

- **Service Name:** `gotaxi-afiliados`
- **Build Args:** `WORKSPACE=afiliados-hub`
- **Domain:** `afiliados.gotaxi.com.br`

> 💡 Os apps web fazem chamada para a API. Verifique no código (`artifacts/pdv/src/`, etc.) se a URL da API é configurada via variável tipo `VITE_API_URL` — se sim, adicione como **Build Arg** também:
> ```
> VITE_API_URL=https://api.gotaxi.com.br
> ```

---

<a id="8-passo-6"></a>
## 8. Passo 6 — Configurar DNS e HTTPS

No painel do seu provedor de domínio (Registro.br, Hostinger, Cloudflare, etc.):

Aponte os 4 subdomínios para o IP da sua VPS:

| Tipo | Nome | Valor |
|---|---|---|
| A | `api` | `IP_DA_SUA_VPS` |
| A | `pdv` | `IP_DA_SUA_VPS` |
| A | `admin` | `IP_DA_SUA_VPS` |
| A | `afiliados` | `IP_DA_SUA_VPS` |

> ⏱️ Propagação DNS leva de 5 minutos a 2 horas. Use [dnschecker.org](https://dnschecker.org) para verificar.

Após a propagação, o **Easypanel gera certificados HTTPS automaticamente** via Let's Encrypt. Você verá um cadeado verde nos 4 endereços.

---

<a id="9-passo-7"></a>
## 9. Passo 7 — Rebuild dos apps mobile (Play Store)

Aqui você tem 2 apps Expo:
- **App Cliente** (`artifacts/saas-mobile`)
- **App Pro / Motorista** (`gotaxi-pro/`)

### 9.1 — Atualizar a URL da API

Edite os arquivos `eas.json` de cada app:

**Arquivo: `eas.json` (raiz)**
```json
{
  "build": {
    "preview": {
      "env": {
        "EXPO_PUBLIC_DOMAIN": "gotaxi.com.br"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_DOMAIN": "gotaxi.com.br"
      }
    }
  }
}
```

> 🔍 No código dos apps procure por `EXPO_PUBLIC_DOMAIN`, `EXPO_PUBLIC_API_URL` ou `api.gotaxi.com.br` e ajuste se necessário. No `gotaxi-pro/constants/api.ts` é onde fica a URL base.

### 9.2 — Incrementar versão

No `app.json` de cada app, suba o `version` e o `versionCode`:

```json
{
  "expo": {
    "version": "1.0.1",
    "android": {
      "versionCode": 2
    }
  }
}
```

### 9.3 — Build e submit

```bash
# No seu PC, dentro do repo
pnpm install
npm install -g eas-cli
eas login

# App Cliente
cd artifacts/saas-mobile
eas build --platform android --profile production
eas submit --platform android --latest

# App Pro
cd ../../gotaxi-pro
eas build --platform android --profile production
eas submit --platform android --latest
```

⏱️ Build EAS leva ~20 minutos. Depois publica automaticamente na Play Store (revisão do Google: 1-3 dias).

---

<a id="10-passo-8"></a>
## 10. Passo 8 — Testes finais

### Checklist completa

- [ ] `https://api.gotaxi.com.br/api/health` retorna OK
- [ ] `https://pdv.gotaxi.com.br` carrega o painel PDV
- [ ] `https://admin.gotaxi.com.br` carrega o admin
- [ ] `https://afiliados.gotaxi.com.br` carrega o hub de afiliados
- [ ] Consegue fazer login no PDV com um usuário existente do banco restaurado
- [ ] App mobile (depois do rebuild) conecta na nova API
- [ ] Upload de imagem no PDV funciona e persiste após restart do container
- [ ] Backup automático do Postgres está agendado
- [ ] Logs estão limpos (sem erros recorrentes)

### Comandos úteis no terminal da VPS

```bash
# Ver logs da API em tempo real
docker logs -f $(docker ps | grep gotaxi-api | awk '{print $1}')

# Conectar no banco
docker exec -it $(docker ps | grep gotaxi-db | awk '{print $1}') psql -U gotaxi -d gotaxi

# Ver uso de recursos
docker stats
```

---

<a id="11-troubleshooting"></a>
## 11. Troubleshooting

### ❌ "Cannot find module '@workspace/db'" durante o build

Causa: O `pnpm install` no Docker não pegou os workspaces. Verifique se `pnpm-workspace.yaml` está sendo copiado **antes** do `pnpm install` no Dockerfile.

### ❌ API sobe mas dá erro "DATABASE_URL must be set"

Causa: A env var não foi propagada. Vá em **Environment** no Easypanel, salve novamente, e clique em **Restart**.

### ❌ "Error: connect ECONNREFUSED gotaxi-db:5432"

Causa: O Postgres ainda não terminou de subir, ou o nome do serviço está diferente. Verifique se o `DATABASE_URL` usa o **nome do service no Easypanel** como host.

### ❌ Build do PDV falha com "BASE_PATH environment variable is required"

Causa: O `vite.config.ts` exige `BASE_PATH` no build. O `Dockerfile.web` já passa `BASE_PATH=/` por padrão — se ainda falhar, adicione como Build Arg no Easypanel:
```
BASE_PATH=/
PORT=3000
```

### ❌ Uploads somem ao reiniciar o container

Causa: Volume não montado. Confira que o volume `gotaxi-uploads` está montado em `/app/public/uploads` na aba **Volumes** do serviço `gotaxi-api`.

### ❌ HTTPS não funciona / "ERR_CERT_AUTHORITY_INVALID"

Causa: DNS ainda propagando ou Easypanel não conseguiu emitir o cert. Aguarde 10 min. Se persistir, vá em **Domains** → **Renew Certificate**.

### ❌ App mobile dá "Network Error" após o rebuild

Causa: A URL antiga ficou cacheada. Verifique:
1. `eas.json` tem `EXPO_PUBLIC_DOMAIN=gotaxi.com.br`
2. O código dos apps usa essa env var (procure `process.env.EXPO_PUBLIC_DOMAIN`)
3. CORS no backend permite o domínio do app (verifique `artifacts/api-server/src/app.ts` — atualmente `app.use(cors())` libera tudo, então OK)

### ⚠️ Quero voltar atrás (rollback)

Como **não alteramos nada no Replit**, basta:
1. Pausar/deletar os serviços no Easypanel
2. Apontar o DNS de volta pro Replit (ou pro CNAME do Expo)
3. Reverter o `eas.json` para `gotaxiplus.replit.app` e rebuildar o app

Seu projeto continua intacto. **Risco zero.**

---

<a id="12-custos"></a>
## 12. Custos estimados e dimensionamento da VPS

### Dimensionamento recomendado

Para o seu volume (multi-tenant, multiplos painéis + API + Postgres + uploads):

| Plano | CPU | RAM | Disco | Adequação |
|---|---|---|---|---|
| **Mínimo** | 2 vCPU | 4 GB | 50 GB SSD | Funciona com poucos empresas/usuários simultâneos |
| **Recomendado** | 4 vCPU | 8 GB | 100 GB SSD | Confortável até ~1k usuários ativos |
| **Folga** | 6 vCPU | 16 GB | 200 GB SSD | Crescimento sem dor de cabeça |

### Comparativo de custos

| Provedor | Plano recomendado | Custo/mês |
|---|---|---|
| Hostinger VPS | KVM 4 | R$ 80–110 |
| Hetzner | CPX31 | ~€ 14 (R$ 80) |
| DigitalOcean | Premium 4vCPU/8GB | US$ 48 (R$ 240) |
| Contabo | VPS L | R$ 50 (mais barato, menos performance) |

> 💡 Replit Reserved VM custa ~US$ 20/mês para um único projeto. Migrando para VPS própria com Easypanel você roda **5 serviços** pelo mesmo preço ou menos.

### Custos externos contínuos

- **OpenAI API:** depende do uso do chat (~US$ 5–50/mês para uso moderado)
- **Google Maps:** US$ 200 de crédito grátis/mês, suficiente para a maioria dos casos
- **Domínio:** ~R$ 40/ano (.com.br)

---

## 🎉 Pronto!

Sua aplicação GoTaxi está rodando 100% na sua VPS, com:
- ✅ Independência do Replit (sem cobrança recorrente lá)
- ✅ Backup automático do banco
- ✅ HTTPS em todos os domínios
- ✅ Uploads persistentes
- ✅ Apps mobile na Play Store consumindo sua nova API
- ✅ Possibilidade de rollback a qualquer momento

### Próximos passos sugeridos

1. **Monitoramento:** instale [Uptime Kuma](https://github.com/louislam/uptime-kuma) (também via Easypanel) e monitore os 4 endpoints
2. **Logs centralizados:** considere [Dozzle](https://dozzle.dev/) para visualizar logs de todos os containers
3. **CI/CD:** Easypanel já faz auto-deploy a cada push no `main` — habilite na aba **Source**
4. **CDN para uploads:** se o volume crescer, migre `/uploads` para Cloudflare R2 ou Backblaze B2

---

**Dúvidas?** Volte aqui que eu te ajudo a debugar qualquer etapa. 💪
