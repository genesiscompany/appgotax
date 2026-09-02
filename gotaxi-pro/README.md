# GoTaxi Pro — App do Profissional

App Expo React Native para profissionais GoTaxi: **Motorista de App**, **Delivery** e **Entregas**.

## Setup no Replit

### 1. Criar novo Replit
- Acesse replit.com → **Create Repl**
- Escolha template: **Node.js**
- Cole todos os arquivos desta pasta

### 2. Configurar variável de ambiente
No seu Replit, vá em **Secrets** e adicione:
```
EXPO_PUBLIC_API_URL = https://SUA-URL-DO-API.replit.dev
```
> Substitua pelo URL do servidor API do projeto GoTaxi principal.

### 3. Instalar e rodar
```bash
npm install -g expo-cli eas-cli
npm install
npx expo start
```

### 4. Para o Play Store (GoTaxi Pro)
```bash
eas build --platform android --profile production
```
Certifique-se de ter o arquivo `eas.json` configurado com o `package: "gotaxi.pro"`.

---

## Funcionalidades

### 3 Tipos de Profissional
| Tipo | Cor | Conteúdo |
|------|-----|----------|
| 🚗 Motorista de App | Azul | Corridas de passageiro |
| 🍔 Delivery | Laranja | Pedidos de comida |
| 📦 Entregas | Verde | Pacotes e logística |

### Fluxo do Profissional
1. **Cadastro** → Escolhe o tipo de profissional, cria conta com telefone + PIN
2. **Aguardando aprovação** → Envia documentos (CNH, CRLV, Selfie)
3. **Aprovado** → Acesso ao dashboard com 4 abas

### 4 Abas do Dashboard
- **Início** — Ganhos do dia, toggle online/offline, divisão de repasse
- **Corridas/Pedidos/Entregas** — Serviços disponíveis para aceitar
- **Ganhos** — Histórico detalhado com valores bruto e líquido
- **Perfil** — Dados pessoais, veículo, documentos, logout

### API Compartilhada
- `POST /api/motorista-app/cadastro` — Registro com `tipo_profissional`
- `POST /api/motorista-app/login` — Telefone + PIN
- `GET  /api/motorista-app/perfil` — Dados do profissional
- `PUT  /api/motorista-app/perfil` — Atualizar perfil
- `POST /api/motorista-app/documentos` — Enviar documento
- `GET  /api/motorista-app/stats` — Estatísticas de ganhos
- `GET  /api/motorista-app/ganhos` — Histórico de ganhos

---

## Estrutura de Arquivos

```
gotaxi-pro/
├── app/
│   ├── _layout.tsx          # Root com AuthProvider
│   ├── index.tsx            # Redirect baseado em auth
│   ├── pendente.tsx         # Tela de aguardando aprovação
│   ├── (auth)/
│   │   └── index.tsx        # Login + Cadastro + seleção de tipo
│   └── (pro)/
│       ├── _layout.tsx      # Tab bar adaptativa por tipo
│       ├── index.tsx        # Início / Dashboard
│       ├── jobs.tsx         # Corridas / Pedidos / Entregas
│       ├── ganhos.tsx       # Ganhos e histórico
│       └── perfil.tsx       # Perfil e configurações
├── contexts/
│   └── AuthContext.tsx      # Estado global de autenticação
├── constants/
│   ├── colors.ts            # Paleta e temas por tipo
│   └── api.ts               # URL da API e utilitário fetch
├── package.json
├── tsconfig.json
└── app.json
```
