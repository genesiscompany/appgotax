# Relatório Técnico Completo — GoTaxi SaaS Platform

> **Gerado em:** 27 de maio de 2026  
> **Versão da plataforma:** 2.0.20 (mobile) / 0.0.0 (monorepo)  
> **Repositório:** `goplus-main`

---

## 1. Visão Geral do Produto

**GoTaxi** é uma plataforma **SaaS multi-tenant** voltada para empresas de transporte, delivery e logística no Brasil. A solução abrange múltiplos segmentos de negócio em um único ecossistema:

| Segmento | Descrição |
|----------|-----------|
| **Motorista App** | Gestão de corridas, despacho, GPS em tempo real e repasses PIX |
| **Food Delivery** | Pedidos de alimentação, cardápios e gestão de restaurantes |
| **E-commerce** | Loja virtual, catálogo de produtos e pedidos online |
| **Serviços** | Agendamento de serviços profissionais |
| **Passagens / Viagens** | Venda de passagens e gestão de rotas |
| **Entrega / Encomendas** | Logística de entregas com rastreamento |
| **Corporativo** | Gestão de viagens e frotas para empresas |

O modelo de negócio é **multi-empresa (multi-tenant)**: cada empresa (tenant) opera de forma isolada dentro da plataforma, identificada via header `x-empresa-id` em todas as requisições.

---

## 2. Arquitetura Geral

O projeto é um **monorepo** gerenciado com `pnpm workspaces`, contendo aplicações frontend, backend, apps mobile e bibliotecas compartilhadas.

```
┌─────────────────── Infraestrutura (VPS / Easypanel) ─────────────────────┐
│                                                                            │
│  🐘 PostgreSQL 16  ◄────┐                                                 │
│                         │                                                  │
│  🟢 api-server          │  api.gotaxi.com.br (porta 8080 → 443)           │
│     Node.js + Express   │                                                  │
│                         │                                                  │
│  🌐 pdv-web ────────────┤  pdv.gotaxi.com.br                              │
│  🌐 admin-web ──────────┤  admin.gotaxi.com.br                            │
│  🌐 afiliados-web ──────┘  afiliados.gotaxi.com.br                        │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘
              ▲                                ▲
   📱 App Mobile (Expo)            🌐 Web (React + Vite)
   Android (Play Store)
```

### Padrão de multi-tenancy

- Todas as requisições do PDV e do app mobile carregam o header `x-empresa-id` junto ao JWT
- O banco de dados usa tabelas compartilhadas com coluna `empresaId` para separação dos dados
- Tabelas de módulos específicos (corridas, viagens) são criadas **sob demanda** (lazy tables) para evitar acoplamento de schema

### Comunicação em tempo real

- Implementada via **Server-Sent Events (SSE)**: `GET /api/pdv/stream?empresaId=X`
- Eventos suportados: `novo_pedido`, `status_atualizado`
- Não utiliza WebSockets — solução leve e compatível com proxies HTTP

---

## 3. Estrutura do Monorepo

```
goplus-main/
├── artifacts/                  # Aplicações deployáveis
│   ├── api-server/             # Backend Node.js + Express
│   ├── pdv/                    # App Web do parceiro (PDV)
│   ├── admin/                  # Painel super-admin
│   ├── afiliados-hub/          # Hub de afiliados
│   ├── saas-mobile/            # App mobile (cliente + motorista)
│   └── mockup-sandbox/         # Sandbox de componentes
│
├── lib/                        # Bibliotecas compartilhadas
│   ├── db/                     # Schema Drizzle + conexão PostgreSQL
│   ├── api-spec/               # OpenAPI 3.1 spec + config Orval
│   ├── api-zod/                # Schemas Zod gerados (via Orval)
│   └── api-client-react/       # React Query hooks gerados (via Orval)
│
├── gotaxi-pro/                 # App Expo separado para motoristas Pro
├── scripts/                    # Scripts de seed e migração
├── migration/                  # Guias e configs para deploy em VPS
└── backups/                    # Keystore Android e backups SQL
```

---

## 4. Tecnologias e Dependências

### 4.1 Runtime e Tooling

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| **Node.js** | 24.x | Runtime do servidor |
| **TypeScript** | ~5.9.2 | Tipagem estática em todo o projeto |
| **pnpm** | 10.26.1 | Gerenciador de pacotes + workspaces |
| **tsx** | ^4.21.0 | Execução direta de TypeScript (dev) |
| **esbuild** | ^0.27.3 | Build do servidor para produção |
| **Prettier** | ^3.8.1 | Formatação de código |

### 4.2 Backend — `@workspace/api-server`

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| **Express** | ^5.x | Framework HTTP |
| **Drizzle ORM** | 0.45.1 | ORM para PostgreSQL |
| **PostgreSQL (pg)** | ^8.20.0 | Banco de dados relacional |
| **Zod** | ^3.25.76 | Validação de schemas e dados |
| **jsonwebtoken** | ^9.0.3 | Autenticação JWT |
| **bcryptjs** | ^3.0.3 | Hash de senhas |
| **multer** | ^2.1.1 | Upload de arquivos (multipart) |
| **cors** | ^2.x | Controle de CORS |
| **cookie-parser** | ^1.4.7 | Parse de cookies |
| **@google-cloud/storage** | ^7.19.0 | Upload de imagens no Google Cloud Storage |
| **google-auth-library** | ^10.6.2 | Autenticação OAuth Google |
| **openai** | ^6.35.0 | Integração com API da OpenAI (IA) |

#### Módulos de API (rotas Express):

```
/api/auth              — Autenticação (login, register, perfil)
/api/empresas          — Gerenciamento de tenants
/api/pdv               — Ponto de venda e pedidos (SSE incluído)
/api/pdv/encomendas    — Encomendas e rastreamento
/api/pdv/corporativo   — Módulo corporativo
/api/motorista         — Gestão de motoristas
/api/motorista-app     — App do motorista (GPS, corridas, despacho)
/api/ecommerce         — Loja virtual
/api/servicos          — Agendamento de serviços
/api/passagens         — Passagens e viagens
/api/entrega           — Logística de entregas
/api/food              — Food delivery
/api/food-delivery     — Módulo delivery de alimentos
/api/tur-viagens       — Turismo e viagens
/api/cliente           — App do cliente final
/api/admin             — Super-admin
/api/afiliados         — Programa de afiliados
/api/financeiro        — Financeiro e repasses PIX
/api/chat              — Chat entre usuários
/api/places            — Proxy Google Maps Places
/api/configuracoes     — Configurações da empresa
/api/suporte           — Central de suporte
/api/public            — Endpoints públicos (sem auth)
/api/modulos           — Lista de módulos ativos
/api/healthz           — Health check
```

### 4.3 Banco de Dados — `@workspace/db`

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| **Drizzle ORM** | 0.45.1 | Definição de schema e queries |
| **drizzle-zod** | ^0.8.3 | Geração de schemas Zod a partir do Drizzle |
| **drizzle-kit** | ^0.31.9 | CLI para migrations e push de schema |
| **PostgreSQL (pg)** | ^8.20.0 | Driver do banco de dados |

#### Módulos de schema (tabelas):

| Arquivo | Conteúdo |
|---------|----------|
| `schema/empresas.ts` | Tenants, configurações de empresa |
| `schema/usuarios.ts` | Usuários, perfis, papéis |
| `schema/motorista.ts` | Motoristas, corridas, veículos |
| `schema/ecommerce.ts` | Produtos, categorias, pedidos e-comm |
| `schema/servicos.ts` | Serviços, agendamentos |
| `schema/passagens.ts` | Rotas, passagens, embarques |
| `schema/entrega.ts` | Pedidos de entrega, rastreamento |
| `schema/food.ts` | Restaurantes, cardápios, pedidos |
| `schema/pedidos.ts` | Pedidos genéricos |
| `schema/subcategorias-alimentacao.ts` | Categorias de alimentos |

### 4.4 Frontend Web — PDV, Admin, Afiliados Hub

Todos os três frontends web compartilham o mesmo stack:

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| **React** | 19.1.0 | Framework UI |
| **Vite** | ^7.3.0 | Bundler e dev server |
| **Tailwind CSS** | ^4.1.14 | Estilização utility-first |
| **shadcn/ui** | — | Componentes UI (baseados em Radix UI) |
| **Radix UI** | ^1–^2.x | Primitivos de UI acessíveis |
| **TanStack React Query** | ^5.90.21 | Data fetching e cache |
| **Framer Motion** | ^12.35.1 | Animações |
| **React Hook Form** | via @hookform/resolvers | Formulários |
| **Zod** | ^3.25.76 | Validação de formulários |
| **date-fns** | ^3.6.0 | Manipulação de datas |
| **lucide-react** | ^0.545.0 | Ícones |
| **next-themes** | ^0.4.6 | Suporte a tema claro/escuro |
| **embla-carousel-react** | ^8.6.0 | Carrossel de imagens |
| **cmdk** | ^1.1.1 | Command palette |
| **class-variance-authority** | ^0.7.1 | Variantes de classes CSS |
| **clsx + tailwind-merge** | — | Utilitários de classes |

#### Páginas do PDV (`@workspace/pdv`):

```
Dashboard, Login, Pedidos, Produtos, Motoristas, Corridas,
Financeiro, Relatórios, Configurações, Chat, Suporte,
Encomendas, Viagens, TimeLine, Track, Promoções, Loja Config
```

#### Páginas do Admin (`@workspace/admin`):

```
Dashboard, Empresas, Usuários, Motoristas, Entregadores,
Pedidos, Corridas, Entregas, Food Delivery, E-commerce,
Serviços, Passagens/Viagens/Turismo, Módulos, Repasses,
Agendamentos, Configurações do Sistema, Push Notifications,
Afiliados Admin, Corporativo, Suporte, e mais...
```

#### Páginas do Afiliados Hub (`@workspace/afiliados-hub`):

```
Landing, Login, Dashboard, Indicados, Comissões,
Resgates, Relatórios, Corporativo, Baixar App
```

### 4.5 App Mobile — `@workspace/saas-mobile`

**Expo SDK 54 + React Native 0.81.5**  
App publicado na Play Store como `br.gotaxi.app` (GoTaxi Brasil Plus, v2.0.20)

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| **Expo SDK** | ~54.0.27 | Framework mobile |
| **React Native** | 0.81.5 | Base do app mobile |
| **Expo Router** | ~6.0.17 | Navegação file-based |
| **React Native Maps** | 1.20.1 | Mapas e GPS |
| **Expo Location** | ~19.0.8 | Geolocalização |
| **Expo Notifications** | ~0.32.17 | Push notifications |
| **React Native Reanimated** | ~4.1.1 | Animações nativas |
| **React Native Gesture Handler** | ~2.28.0 | Gestos tácteis |
| **Expo Image Picker** | ~17.0.9 | Upload de fotos/documentos |
| **expo-av** | ^16.0.8 | Áudio e vídeo |
| **expo-clipboard** | ~8.0.8 | Cópia para área de transferência |
| **react-native-qrcode-svg** | ^6.3.21 | Geração de QR Codes |
| **react-native-webview** | ^13.16.1 | WebViews internas |
| **@tanstack/react-query** | ^5.90.21 | Data fetching |
| **Zod** | ^3.25.76 | Validação de dados |
| **Inter Font** (@expo-google-fonts) | ^0.4.0 | Tipografia |

#### Estrutura de rotas do app mobile:

```
app/
├── index.tsx               — Splash / roteamento inicial
├── login.tsx               — Tela de login
├── (tabs)/                 — Tabs principais
│   ├── index.tsx           — Home
│   ├── dashboard.tsx       — Dashboard
│   ├── empresas.tsx        — Empresas (admin mobile)
│   └── perfil.tsx          — Perfil do usuário
├── cliente/                — Fluxo do cliente final
├── pro/                    — Fluxo do motorista/entregador Pro
├── modulo/                 — Seleção de módulo ativo
└── viagens/                — Módulo de viagens
```

**Permissões Android:** Localização fina/grossa, gravação de áudio  
**Novas arquiteturas:** Habilitadas (New Architecture) para Android e iOS

### 4.6 App GoTaxi Pro — `gotaxi-pro`

App Expo separado e independente para motoristas profissionais:
- Bundle: `com.gotaxi.pro` (iOS) / `gotaxi.pro` (Android)
- Focado no fluxo do motorista: aceitar corridas, navegação, ganhos

### 4.7 Codegen e Contrato de API — `@workspace/api-spec` / `@workspace/api-zod` / `@workspace/api-client-react`

| Tecnologia | Uso |
|------------|-----|
| **OpenAPI 3.1** | Especificação da API (contrato único) |
| **Orval** | Geração automática de código a partir do OpenAPI |
| **React Query hooks** | Gerados pelo Orval a partir do OpenAPI |
| **Zod schemas** | Gerados pelo Orval para validação de requests/responses |

O fluxo de codegen garante que frontend e backend compartilhem os mesmos tipos e validações.

---

## 5. Integrações Externas

| Serviço | Uso |
|---------|-----|
| **Google Maps API** | Mapas, rotas, Places autocomplete |
| **Google Cloud Storage** | Armazenamento de imagens (avatares, produtos, docs) |
| **Google OAuth** | Autenticação social |
| **OpenAI** | Funcionalidades de IA (chat, sugestões) |
| **Expo EAS Build** | Build e deploy do app mobile |
| **PIX** | Pagamentos e repasses para motoristas/entregadores |

---

## 6. Deploy e Infraestrutura

### Ambiente de Desenvolvimento
- Originalmente desenvolvido no **Replit**
- Variáveis necessárias: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_MAPS_KEY`, `GOOGLE_MAPS_SERVER_KEY`, `EXPO_PUBLIC_DOMAIN`

### Produção (VPS + Easypanel)
Guia de migração disponível em `migration/GUIA-MIGRACAO.md`:

| Serviço | Domínio | Tecnologia |
|---------|---------|------------|
| API | `api.gotaxi.com.br` | Node.js + Docker |
| PDV | `pdv.gotaxi.com.br` | Nginx + React (SPA) |
| Admin | `admin.gotaxi.com.br` | Nginx + React (SPA) |
| Afiliados | `afiliados.gotaxi.com.br` | Nginx + React (SPA) |
| Banco de dados | (interno) | PostgreSQL 16 |

### Build Mobile
- **Android AAB** gerado via **GitHub Actions + Expo EAS Build**
- Workflow automatizado: `Build Android (AAB - Produção)`
- Distribuição via **Google Play Store** (`br.gotaxi.app`)

---

## 7. Segurança

| Mecanismo | Implementação |
|-----------|--------------|
| **Autenticação** | JWT (jsonwebtoken) |
| **Senhas** | Hash com bcryptjs |
| **Multi-tenancy** | Header `x-empresa-id` validado por middleware |
| **Upload de arquivos** | Filtro por mimetype (apenas imagens), limite de 8MB |
| **CORS** | Configurado via middleware cors |
| **Tipagem forte** | TypeScript + Zod em todo o pipeline |

---

## 8. Comandos Principais

```bash
# Instalar dependências
pnpm install

# Verificar tipagem de todo o monorepo
pnpm run typecheck

# Subir schema no banco de dados
pnpm --filter @workspace/db run push

# Seed de dados de demonstração (PDV)
pnpm --filter @workspace/scripts run seed-pdv

# Build completo de todos os pacotes
pnpm -r run build

# Executar servidor de desenvolvimento (API)
pnpm --filter @workspace/api-server run dev

# Executar PDV em desenvolvimento
pnpm --filter @workspace/pdv run dev

# Executar Admin em desenvolvimento
pnpm --filter @workspace/admin run dev

# Executar Afiliados Hub em desenvolvimento
pnpm --filter @workspace/afiliados-hub run dev

# Executar app mobile
pnpm --filter @workspace/saas-mobile run dev
```

---

## 9. Diagrama de Pacotes (Dependências Internas)

```
                    ┌──────────────────┐
                    │   @workspace/db  │
                    │  (Drizzle + PG)  │
                    └────────┬─────────┘
                             │ depende de
                    ┌────────▼─────────┐
                    │ @workspace/      │
                    │  api-server      │◄──────────────────────┐
                    └────────┬─────────┘                       │
                             │ openapi.yaml                    │
                    ┌────────▼─────────┐                       │
                    │ @workspace/      │                       │
                    │  api-spec        │                       │
                    └────┬──────┬──────┘                       │
                         │      │ orval gera                   │
              ┌──────────▼┐    ┌▼──────────────────┐          │
              │@workspace/ │    │ @workspace/        │          │
              │ api-zod    │    │ api-client-react   │          │
              └────────────┘    └────────┬───────────┘          │
                                         │ usada por             │
                          ┌──────────────┼───────────────┐      │
                          │              │               │      │
                   ┌──────▼──┐   ┌───────▼──┐   ┌──────▼──┐   │
                   │  @ws/   │   │  @ws/    │   │  @ws/   │   │
                   │   pdv   │   │  admin   │   │afiliados│   │
                   └─────────┘   └──────────┘   └─────────┘   │
                                                                │
                   ┌──────────────────────────────────────┐    │
                   │       @workspace/saas-mobile         │────┘
                   │        (consome API diretamente)      │
                   └──────────────────────────────────────┘
```

---

## 10. Resumo Executivo

**GoTaxi** é uma plataforma SaaS completa e robusta para o mercado de mobilidade urbana e logística brasileiro. Tecnicamente, destaca-se por:

1. **Monorepo bem estruturado** com pnpm workspaces, separando responsabilidades de forma clara
2. **Contrato de API fortemente tipado** via OpenAPI 3.1 + geração automática de código com Orval
3. **Multi-tenancy nativa** permitindo que múltiplas empresas operem isoladamente na mesma infraestrutura
4. **Stack moderna e consistente**: TypeScript em todos os layers (frontend, backend, mobile, scripts)
5. **App mobile completo** para Android (e iOS) com GPS, notificações, QR Code, pagamentos PIX
6. **Tempo real via SSE** para atualização de pedidos sem necessidade de WebSockets
7. **Cobertura de produtos**: 5 aplicações deployáveis independentes (API, PDV, Admin, Afiliados, Mobile)
8. **Pronto para produção**: Guias completos de deploy em VPS com Docker, Nginx e Easypanel

| Dimensão | Métricas |
|----------|---------|
| Pacotes no monorepo | ~10 pacotes |
| Aplicações web | 4 (PDV, Admin, Afiliados, Mockup Sandbox) |
| Apps mobile | 2 (saas-mobile + gotaxi-pro) |
| Rotas de API | ~30 módulos de rota |
| Tabelas de banco | ~10 módulos de schema |
| Linguagem principal | TypeScript 5.9 |
| Módulos de negócio | 7 (Motorista, Food, E-commerce, Serviços, Passagens, Entrega, Corporativo) |
