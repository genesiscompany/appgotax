# 🚀 Guia de Deploy no EasyPanel — GoTaxi
### Passo a passo completo para quem nunca fez isso antes

> **Quanto tempo leva?** ≈ 2 horas na primeira vez (com calma).  
> **O que vai funcionar no final?**  
> - ✅ Site/landing page em `gotaxi.com.br`  
> - ✅ API do sistema em `api.gotaxi.com.br`  
> - ✅ Painel PDV em `pdv.gotaxi.com.br`  
> - ✅ Painel Admin em `admin.gotaxi.com.br`  
> - ✅ Hub de Afiliados em `gotaxi.com.br/afiliados/`  
> - ✅ Apps mobile apontando para o novo servidor  

---

## 📋 O que você precisa TER antes de começar

Antes de qualquer coisa, certifique-se que você tem esses 4 itens:

### 1. Uma VPS (servidor na nuvem)
Uma VPS é basicamente um computador que fica ligado 24 horas. Você pode alugar uma.

**Recomendações baratas:**
- **Hostinger VPS** — a partir de R$25/mês — [hostinger.com.br/vps](https://www.hostinger.com.br/vps-hosting)
- **DigitalOcean** — a partir de US$6/mês — [digitalocean.com](https://digitalocean.com)
- **Contabo** — a partir de €4/mês — [contabo.com](https://contabo.com)

**Configuração mínima da VPS:**
- Sistema operacional: **Ubuntu 22.04 LTS** (escolha esse se der opção)
- CPU: 2 vCPUs
- RAM: 2 GB
- Disco: 20 GB

> 💡 Quando criar a VPS, anote o **IP** dela (ex: `123.45.67.89`). Você vai precisar bastante.

---

### 2. Um domínio apontado para sua VPS
Se você já tem o domínio `gotaxi.com.br`, precisa apontar ele para o IP da sua VPS.

**Onde gerenciar:** entre no site onde você registrou o domínio (Registro.br, Hostinger, GoDaddy etc.) e vá na opção de **Zona DNS** ou **Gerenciar DNS**.

Adicione estes registros (substitua `SEU_IP_VPS` pelo IP real):

| Tipo | Nome | Valor | TTL |
|------|------|-------|-----|
| A | `@` | `SEU_IP_VPS` | 3600 |
| A | `api` | `SEU_IP_VPS` | 3600 |
| A | `pdv` | `SEU_IP_VPS` | 3600 |
| A | `admin` | `SEU_IP_VPS` | 3600 |

> ℹ️ **Não precisa de subdomínio para afiliados.** O Hub de Afiliados fica em `gotaxi.com.br/afiliados/`, servido pelo mesmo container da landing page.

> ⏱️ Depois de salvar, espere de 5 minutos a 2 horas para o DNS propagar. Você pode verificar em [dnschecker.org](https://dnschecker.org) — pesquise por `api.gotaxi.com.br` e veja se aparece o IP correto.

---

### 3. Conta no GitHub com o código do projeto
O código já está no repositório `genesiscompany/goplus`. Você só precisa ter acesso a ele.

---

### 4. Suas chaves de API (reúna antes de começar)

Crie um arquivo de texto no seu PC chamado `minhas-chaves-producao.txt` e preencha:

```
JWT_SECRET = (veja como gerar abaixo)
GOOGLE_MAPS_KEY = 
GOOGLE_MAPS_SERVER_KEY = 
AI_INTEGRATIONS_OPENAI_API_KEY = 
DB_PASSWORD = (invente uma senha forte, ex: GoTaxi@2026#Seguro)
```

**Como obter cada uma:**

**JWT_SECRET** (senha interna do sistema):
1. Acesse https://generate-secret.vercel.app/64
2. O site vai gerar uma string longa como `a8f3b2c9d1e4...`
3. Copie e cole no seu arquivo de texto

**GOOGLE_MAPS_KEY e GOOGLE_MAPS_SERVER_KEY:**
1. Acesse https://console.cloud.google.com
2. Crie um projeto (ou use um existente)
3. Vá em **APIs & Services → Credentials → + Create Credentials → API Key**
4. Crie 2 chaves: uma com restrição de domínio (`gotaxi.com.br`) e outra sem restrição
5. A com restrição de domínio = `GOOGLE_MAPS_KEY`
6. A sem restrição = `GOOGLE_MAPS_SERVER_KEY`

**AI_INTEGRATIONS_OPENAI_API_KEY** (suporte por IA — opcional):
1. Acesse https://platform.openai.com/api-keys
2. Clique em **+ Create new secret key**
3. Copie a chave que começa com `sk-proj-...`

> ⚠️ **Guarde esse arquivo num lugar seguro e nunca envie para o GitHub.**

---

## 📦 Parte 1 — Instalar o EasyPanel na VPS

O EasyPanel é um painel visual que você instala no servidor para gerenciar tudo sem precisar digitar comandos complexos.

### Passo 1.1 — Conectar na VPS via SSH

**No Windows:**
1. Abra o **PowerShell** (tecla Windows → pesquise "PowerShell")
2. Digite o comando abaixo (substitua o IP):

```powershell
ssh root@SEU_IP_VPS
```

3. Na primeira vez vai perguntar se confia no servidor. Digite `yes` e Enter.
4. Digite a senha que você definiu ao criar a VPS.

> 💡 Se sua VPS usa chave SSH em vez de senha, o comando é:
> ```powershell
> ssh -i C:\caminho\para\sua\chave.pem root@SEU_IP_VPS
> ```

---

### Passo 1.2 — Instalar o EasyPanel

Depois de conectar, você vai ver um terminal preto com `root@...#`. Cole este comando e aperte Enter:

```bash
curl -sSL https://get.easypanel.io | sh
```

Aguarde. O processo vai instalar Docker e o EasyPanel automaticamente. Leva cerca de 3-5 minutos.

No final você vai ver uma mensagem parecida com:
```
EasyPanel is running at http://SEU_IP_VPS:3000
```

---

### Passo 1.3 — Acessar o EasyPanel pela primeira vez

1. Abra seu navegador
2. Acesse: `http://SEU_IP_VPS:3000`
3. Crie uma conta de administrador (email e senha que você inventar)
4. Faça login

**Você deve ver a tela inicial do EasyPanel com a opção de criar projetos.**

---

## 📦 Parte 2 — Criar o Projeto no EasyPanel

No EasyPanel, um "projeto" é como uma pasta que agrupa todos os serviços relacionados.

### Passo 2.1 — Criar o projeto GoTaxi

1. Na tela inicial do EasyPanel, clique em **+ Create Project**
2. Dê o nome: `gotaxi`
3. Clique em **Create**

Pronto. Agora vamos criar os serviços dentro desse projeto.

---

## 🐘 Parte 3 — Criar o Banco de Dados PostgreSQL

O banco de dados é onde ficam guardados todos os dados do sistema (empresas, usuários, corridas, etc.).

### Passo 3.1 — Criar o serviço de banco

Dentro do projeto `gotaxi`:

1. Clique em **+ Create Service**
2. Escolha **Database**
3. Escolha **PostgreSQL**

Preencha os campos:

| Campo | O que colocar |
|-------|---------------|
| Service Name | `gotaxi-db` |
| Version | `16` |
| Database | `gotaxi` |
| Username | `gotaxi` |
| Password | A senha que você inventou (ex: `GoTaxi@2026#Seguro`) |

4. Clique em **Create**

---

### Passo 3.2 — Copiar a Connection String

Depois de criar, clique no serviço `gotaxi-db` e vá na aba **Connection**.

Você vai ver uma linha como:
```
postgresql://gotaxi:SUA_SENHA@gotaxi-db:5432/gotaxi
```

> ⚠️ Copie essa linha inteira e salve no seu arquivo `minhas-chaves-producao.txt`. Essa é a `DATABASE_URL`.

---

### Passo 3.3 — Restaurar o banco de dados

O projeto já tem um arquivo de backup com toda a estrutura e dados iniciais.

**Opção mais fácil — via terminal do EasyPanel:**

1. No serviço `gotaxi-db`, clique na aba **Console** (ou "Terminal")
2. Um terminal vai abrir na tela
3. Você precisa enviar o arquivo `backup_gotaxi.sql` para o servidor

**Para enviar o arquivo, abra um novo PowerShell no seu PC** e execute:

```powershell
scp "C:\Users\leonr\Downloads\goplus-main\goplus-main\backup_gotaxi.sql" root@SEU_IP_VPS:/tmp/
```

Agora de volta ao terminal do EasyPanel (ou SSH na VPS), descubra o ID do container do banco:

```bash
docker ps | grep gotaxi-db
```

Você vai ver uma linha com um ID como `a1b2c3d4e5f6`. Use esse ID no comando abaixo:

```bash
docker exec -i ID_DO_CONTAINER psql -U gotaxi -d gotaxi < /tmp/backup_gotaxi.sql
```

**Verificar se funcionou:**

```bash
docker exec -it ID_DO_CONTAINER psql -U gotaxi -d gotaxi -c "\dt"
```

Deve aparecer uma lista de tabelas como `empresas`, `usuarios`, `corridas`, etc.

> ✅ Se aparecer a lista de tabelas, o banco foi restaurado com sucesso!

---

## 🌍 Parte 4 — Criar o Serviço da Landing Page (gotaxi.com.br)

A landing page é o site principal (`gotaxi.com.br`). Ela também funciona como **roteador interno**: encaminha `/afiliados/*` para o container de afiliados e `/api/*` para a API.

### Passo 4.1 — Criar o serviço da landing

Dentro do projeto `gotaxi`, **+ Create Service → App → GitHub**:

**Aba Source:**
| Campo | Valor |
|-------|-------|
| Repository | `genesiscompany/goplus` |
| Branch | `main` |
| Auto Deploy | ✅ |

**Aba Build:**
| Campo | Valor |
|-------|-------|
| Service Name | `gotaxi-landing` |
| Build Type | `Dockerfile` |
| Build Path | `/` |
| Dockerfile Path | `migration/dockerfiles/Dockerfile.landing` |
| Port | `3000` |

Não há Build Args necessários para este serviço.

**Aba Domains:**
| Campo | Valor |
|-------|-------|
| Host | `gotaxi.com.br` |
| HTTPS | ✅ habilitado |
| Port | `3000` |

Clique em **Save** e depois **Deploy**.

> 💡 Este container roda nginx (porta 3000) + serve.js (porta 3001 interna). O nginx roteia:
> - `/afiliados/*` → container `gotaxi-afiliados` (interno)
> - `/api/*` e `/uploads/*` → container `gotaxi-api`
> - tudo mais → serve.js (landing page)

---

## 🟢 Parte 5 — Criar o Serviço da API (Backend)

A API é o "cérebro" do sistema — é ela que processa tudo e se comunica com o banco de dados e com os apps.

### Passo 5.1 — Conectar o GitHub ao EasyPanel

Antes de criar o serviço, você precisa conectar sua conta GitHub ao EasyPanel:

1. No EasyPanel, clique no ícone de **configurações** (engrenagem) no canto superior direito
2. Vá em **GitHub**
3. Clique em **Connect GitHub**
4. Autorize o EasyPanel a acessar seu repositório

---

### Passo 5.2 — Criar o serviço da API

Dentro do projeto `gotaxi`:

1. Clique em **+ Create Service**
2. Escolha **App**
3. Escolha **GitHub**

Preencha a aba **Source**:

| Campo | O que colocar |
|-------|---------------|
| Repository | `genesiscompany/goplus` |
| Branch | `main` |
| Auto Deploy | ✅ marcado (vai atualizar automaticamente quando você enviar código novo) |

Preencha a aba **Build**:

| Campo | O que colocar |
|-------|---------------|
| Service Name | `gotaxi-api` |
| Build Type | `Dockerfile` |
| Build Path | `/` (barra simples, representa a raiz do repositório) |
| Dockerfile Path | `migration/dockerfiles/Dockerfile.api` |
| Port | `8080` |

---

### Passo 5.3 — Adicionar as variáveis de ambiente da API

Clique na aba **Environment** (ou "Env Vars"). Adicione cada variável abaixo:

```
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://gotaxi:SUA_SENHA@gotaxi-db:5432/gotaxi
JWT_SECRET=COLE_AQUI_O_JWT_SECRET_QUE_VOCE_GEROU
GOOGLE_MAPS_KEY=COLE_SUA_CHAVE_GOOGLE_MAPS_COM_RESTRICAO
GOOGLE_MAPS_SERVER_KEY=COLE_SUA_CHAVE_GOOGLE_MAPS_SEM_RESTRICAO
AI_INTEGRATIONS_OPENAI_API_KEY=COLE_SUA_CHAVE_OPENAI
PUBLIC_DOMAIN=https://gotaxi.com.br
```

> ⚠️ Substitua cada valor pelos dados reais do seu `minhas-chaves-producao.txt`.  
> Não copie o texto `COLE_AQUI...` — substitua pelo valor real.

---

### Passo 5.4 — Criar volume para uploads de imagens

Clique na aba **Volumes** e adicione:

| Mount Path | Volume Name |
|-----------|-------------|
| `/app/public/uploads` | `gotaxi-uploads` |

> 💡 Isso garante que imagens enviadas pelos usuários (fotos de perfil, cardápio etc.) não se percam quando o servidor reiniciar.

---

### Passo 5.5 — Configurar o domínio da API

Clique na aba **Domains** e adicione:

| Campo | Valor |
|-------|-------|
| Host | `api.gotaxi.com.br` |
| HTTPS | ✅ habilitado |
| Path | `/` |
| Port | `8080` |

---

### Passo 5.6 — Fazer o primeiro deploy

1. Clique em **Save** (salvar)
2. Clique em **Deploy**
3. Vá na aba **Logs** e acompanhe o progresso

O primeiro build leva de **3 a 10 minutos** porque precisa instalar todas as dependências e compilar o código. Nas próximas vezes vai ser bem mais rápido.

**Você vai saber que funcionou quando os logs mostrarem algo como:**
```
✓ Build successful
✓ Container started
Server listening on port 8080
```

**Teste:** abra no navegador `https://api.gotaxi.com.br` — deve aparecer uma resposta JSON.

---

## 🌐 Parte 6 — Criar os 3 Painéis Web

Agora você vai criar 3 serviços web: PDV, Admin e Afiliados Hub. O processo é quase igual para os 3, mudando apenas alguns valores.

### 📱 Painel PDV (para parceiros/estabelecimentos)

Dentro do projeto `gotaxi`, **+ Create Service → App → GitHub**:

**Aba Source:**
| Campo | Valor |
|-------|-------|
| Repository | `genesiscompany/goplus` |
| Branch | `main` |

**Aba Build:**
| Campo | Valor |
|-------|-------|
| Service Name | `gotaxi-pdv` |
| Build Type | `Dockerfile` |
| Build Path | `/` |
| Dockerfile Path | `migration/dockerfiles/Dockerfile.web` |
| Port | `80` |

**Build Arguments** (procure a seção "Build Args" ou "ARG"):
```
WORKSPACE=pdv
GOOGLE_MAPS_KEY=SUA_CHAVE_GOOGLE_MAPS
```

**Aba Domains:**
| Campo | Valor |
|-------|-------|
| Host | `pdv.gotaxi.com.br` |
| HTTPS | ✅ habilitado |
| Port | `80` |

Clique em **Save** e depois **Deploy**.

---

### 🔧 Painel Admin (administração geral)

**+ Create Service → App → GitHub** novamente:

**Aba Build:**
| Campo | Valor |
|-------|-------|
| Service Name | `gotaxi-admin` |
| Build Type | `Dockerfile` |
| Build Path | `/` |
| Dockerfile Path | `migration/dockerfiles/Dockerfile.web` |
| Port | `80` |

**Build Arguments:**
```
WORKSPACE=admin
GOOGLE_MAPS_KEY=SUA_CHAVE_GOOGLE_MAPS
```

**Aba Domains:**
| Campo | Valor |
|-------|-------|
| Host | `admin.gotaxi.com.br` |
| HTTPS | ✅ habilitado |
| Port | `80` |

Clique em **Save** e depois **Deploy**.

---

### 👥 Hub de Afiliados

**+ Create Service → App → GitHub** mais uma vez:

**Aba Build:**
| Campo | Valor |
|-------|-------|
| Service Name | `gotaxi-afiliados` |
| Build Type | `Dockerfile` |
| Build Path | `/` |
| Dockerfile Path | `migration/dockerfiles/Dockerfile.web` |
| Port | `80` |

**Build Arguments:**
```
WORKSPACE=afiliados-hub
GOOGLE_MAPS_KEY=SUA_CHAVE_GOOGLE_MAPS
BASE_PATH=/afiliados/
PORT=3000
```

> ⚠️ **`BASE_PATH=/afiliados/` é obrigatório** — sem ele os assets carregam com URL errada e o app quebra.

**Aba Domains:** **Não adicione domínio neste serviço.**

Este container é **interno** — o acesso vem através de `gotaxi.com.br/afiliados/` roteado pelo `gotaxi-landing`. Expor um domínio próprio aqui não é necessário e causaria conflito.

Clique em **Save** e depois **Deploy**.

---

## 📱 Parte 7 — Atualizar os Apps Mobile

Os apps no celular precisam saber o endereço do novo servidor. Atualmente eles apontam para o Replit (`gotaxiplus.replit.app`). Você precisa mudar para o seu domínio.

### Passo 6.1 — Editar o arquivo eas.json (App Cliente)

Abra o arquivo `eas.json` na raiz do projeto (`c:\Users\leonr\Downloads\goplus-main\goplus-main\eas.json`) e mude:

**Antes:**
```json
"EXPO_PUBLIC_DOMAIN": "gotaxiplus.replit.app"
```

**Depois:**
```json
"EXPO_PUBLIC_DOMAIN": "gotaxi.com.br"
```

(mude nos dois lugares onde aparece: `preview` e `production`)

---

### Passo 6.2 — Editar o arquivo eas.json (App Pro/Motorista)

Abra `gotaxi-pro/eas.json` e faça a mesma troca se existir.

Abra também `gotaxi-pro/constants/api.ts` e verifique se tem a URL antiga. Se tiver, mude para `https://api.gotaxi.com.br`.

---

### Passo 6.3 — Incrementar a versão dos apps

Para a Play Store aceitar uma atualização, você precisa aumentar o número de versão.

Abra `artifacts/saas-mobile/app.json` e mude:
```json
"version": "1.0.1",
"android": {
  "versionCode": 2
}
```
(suba o número. Se estava `1.0.0` → `1.0.1`, se `versionCode` era `1` → `2`)

Faça o mesmo em `gotaxi-pro/app.json`.

---

### Passo 6.4 — Fazer o build e publicar os apps

Abra o PowerShell na pasta do projeto e execute:

```powershell
# Instalar a ferramenta de build da Expo (só precisa fazer uma vez)
npm install -g eas-cli

# Fazer login na sua conta Expo
eas login
```

**Build do App Cliente:**
```powershell
cd "C:\Users\leonr\Downloads\goplus-main\goplus-main\artifacts\saas-mobile"
eas build --platform android --profile production
```

**Build do App Pro (Motorista):**
```powershell
cd "C:\Users\leonr\Downloads\goplus-main\goplus-main\gotaxi-pro"
eas build --platform android --profile production
```

> ⏱️ Cada build leva cerca de 20 minutos. O processo roda nos servidores da Expo, não no seu PC.

Depois que o build terminar, para publicar na Play Store:
```powershell
eas submit --platform android --latest
```

> ⏱️ A Play Store revisa o app em 1-3 dias antes de publicar.

---

## ✅ Parte 8 — Verificar se tudo está funcionando

Abra cada endereço abaixo no seu navegador e confirme que carrega:

| Endereço | O que deve aparecer |
|----------|---------------------|
| `https://gotaxi.com.br` | Página inicial (landing page) |
| `https://api.gotaxi.com.br` | Resposta JSON da API |
| `https://pdv.gotaxi.com.br` | Tela de login do PDV |
| `https://admin.gotaxi.com.br` | Tela de login do Admin |
| `https://gotaxi.com.br/afiliados/login` | Tela de login do Hub de Afiliados |
| `https://gotaxi.com.br/afiliados/r/TEST` | Página de cadastro por link de indicação |

**Teste de login:**
- Entre no PDV com um usuário do banco restaurado
- Confirme que consegue navegar pelas telas sem erros

**Teste de upload:**
- No PDV, tente fazer upload de uma imagem
- Reinicie o container da API no EasyPanel
- Verifique se a imagem ainda aparece (confirma que o volume está funcionando)

---

## 🔄 Como atualizar o sistema no futuro

> 💡 **Ordem de deploy recomendada quando atualizar:** `gotaxi-api` primeiro, depois os frontends e `gotaxi-landing` por último (ele depende dos outros containers estarem rodando).

Quando você fizer mudanças no código e enviar para o GitHub (`git push`), o EasyPanel vai **atualizar automaticamente** (se você deixou o Auto Deploy habilitado).

Se preferir atualizar manualmente:
1. Entre no EasyPanel
2. Clique no serviço que quer atualizar (ex: `gotaxi-api`)
3. Clique em **Deploy**

---

## 🆘 Problemas comuns e como resolver

### "/afiliados/ abre mas tela fica em branco"
- Verifique se o container `gotaxi-afiliados` está rodando no EasyPanel
- Confirme que o Build Arg `BASE_PATH=/afiliados/` foi definido corretamente
- Veja os logs do build de `gotaxi-afiliados` — um erro de build deixa o container parado


### "O site não abre — erro de DNS"
- Verifique se os registros DNS foram criados corretamente
- Espere mais tempo (DNS pode levar até 24h em casos raros)
- Teste em [dnschecker.org](https://dnschecker.org)

### "Build falhou — erro no log"
- Clique em **Logs** no serviço com problema
- Procure a linha vermelha com o erro
- Erros comuns:
  - `Cannot find module` → alguma dependência faltou, tente fazer deploy de novo
  - `permission denied` → problema no Dockerfile, entre em contato com o desenvolvedor

### "API responde mas os dados estão errados/vazios"
- Verifique se o banco foi restaurado corretamente (Parte 3, Passo 3.3)
- Verifique se `DATABASE_URL` nas variáveis de ambiente está correta
- No EasyPanel, vá em `gotaxi-api` → Environment → confirme os valores

### "Imagens somem após reiniciar"
- Verifique se o volume `/app/public/uploads` foi criado (Parte 4, Passo 4.4)

### "App mobile não conecta na API"
- Confirme que `EXPO_PUBLIC_DOMAIN` no `eas.json` foi alterado para `gotaxi.com.br`
- Refaça o build do app (`eas build`) e atualize na Play Store

### "Cadeado HTTPS não aparece"
- O DNS precisa estar propagado antes do EasyPanel emitir o certificado
- Verifique em [dnschecker.org](https://dnschecker.org) se o domínio já aponta para o IP correto
- No EasyPanel, clique no serviço → Domains → pode ter um botão para renovar o certificado

---

## 🔑 Resumo das variáveis de ambiente e build args por serviço

### gotaxi-api
```
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://gotaxi:SENHA_DO_BANCO@gotaxi-db:5432/gotaxi
JWT_SECRET=STRING_ALEATORIA_64_CHARS
GOOGLE_MAPS_KEY=CHAVE_COM_RESTRICAO_DE_DOMINIO
GOOGLE_MAPS_SERVER_KEY=CHAVE_SEM_RESTRICAO
AI_INTEGRATIONS_OPENAI_API_KEY=sk-proj-...
PUBLIC_DOMAIN=https://gotaxi.com.br
```

### gotaxi-pdv (Build Args)
```
WORKSPACE=pdv
GOOGLE_MAPS_KEY=CHAVE_COM_RESTRICAO_DE_DOMINIO
```

### gotaxi-admin (Build Args)
```
WORKSPACE=admin
GOOGLE_MAPS_KEY=CHAVE_COM_RESTRICAO_DE_DOMINIO
```

### gotaxi-landing (sem build args)
> Porta exposta: `3000`. Dockerfile: `migration/dockerfiles/Dockerfile.landing`.

### gotaxi-afiliados (Build Args)
```
WORKSPACE=afiliados-hub
GOOGLE_MAPS_KEY=CHAVE_COM_RESTRICAO_DE_DOMINIO
BASE_PATH=/afiliados/
PORT=3000
```
> Sem domínio exposto — serviço interno, acessado via `gotaxi.com.br/afiliados/`.

---

*Guia criado em 28/05/2026 — GoTaxi Platform*
