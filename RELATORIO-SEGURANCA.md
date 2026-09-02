# Relatório de Segurança — GoTaxi Platform
**Data:** 28/05/2026  
**Escopo:** Varredura estática completa de `artifacts/api-server/src/`, frontends e configurações  
**Severidades:** 🔴 Crítica | 🟠 Alta | 🟡 Média | 🟢 Baixa

---

## Resumo Executivo

| Severidade | Quantidade |
|-----------|-----------|
| 🔴 Crítica | 3 |
| 🟠 Alta | 4 |
| 🟡 Média | 3 |
| 🟢 Baixa | 4 |
| **Total** | **14** |

---

## 🔴 Críticas

### [C1] Senhas de clientes armazenadas em texto puro

**Arquivo:** `artifacts/api-server/src/routes/auth.ts` linhas 83, 165, 228  
**Arquivo:** `artifacts/api-server/src/routes/afiliados.ts` linha 73

```ts
// auth.ts linha 83 — atualiza senha SEM hash
if (novaSenha && novaSenha.length >= 4) drizzleUpdates.senhaHash = novaSenha;

// auth.ts linha 165 — login compara texto puro
if (usuario.senhaHash !== senha) { ... }

// auth.ts linha 228 — registro salva sem hash
senhaHash: senha,  // campo chamado "Hash" mas armazena texto puro
```

**Impacto:** Qualquer vazamento do banco de dados expõe as senhas de todos os clientes diretamente. Viola LGPD art. 46 (medidas de segurança adequadas).

**Correção:**
```ts
// No registro:
const senhaHash = await bcrypt.hash(senha, 10);
// ...
senhaHash: senhaHash,

// No login:
const ok = await bcrypt.compare(senha, usuario.senhaHash);
if (!ok) return res.status(401).json({ error: "unauthorized" });

// Na atualização de perfil:
if (novaSenha && novaSenha.length >= 4)
  drizzleUpdates.senhaHash = await bcrypt.hash(novaSenha, 10);
```

---

### [C2] Tokens de sessão PDV/Cliente são Base64 trivialmente decodificável (sem assinatura)

**Arquivos:** `auth.ts` linhas 38, 168, 235, 278 | `pdv.ts` linha 136 | `public.ts` linha 563

```ts
// Geração do token — não há assinatura, não há segredo
const token = Buffer.from(`${usuario.id}:${usuario.empresaId}:${Date.now()}`).toString("base64");

// Decodificação — qualquer base64 válido é aceito
const decoded = Buffer.from(String(raw), "base64").toString();
const [userId, empresaId] = decoded.split(":");
```

**Impacto:** Qualquer pessoa pode forjar um token para qualquer `userId:empresaId` simplesmente codificando em base64. Não há verificação de integridade. Permite **escalada horizontal de privilégio** — um parceiro PDV pode acessar dados de outro parceiro passando um token forjado.

> Nota: as rotas de admin, afiliados e motorista-app usam JWT corretamente. Somente PDV e clientes usam base64 simples.

**Correção:** Assinar o token com `jwt.sign({ userId, empresaId }, JWT_SECRET, { expiresIn: "7d" })` e verificar com `jwt.verify()`.

---

### [C3] SQL Injection via interpolação de string em múltiplas rotas

**Arquivos:** `corporativo.ts`, `servicos.ts`, `suporte.ts`, `admin.ts`, `pdv.ts`, `public.ts`

Exemplos com dados provenientes do usuário (via `req.body` / `req.query`) interpolados diretamente:

```ts
// corporativo.ts linha 271 — status vem de req.query
const where = status ? `AND c.status = '${status}'` : "";

// corporativo.ts linha 344 — status vem de req.body
`UPDATE pro_corridas SET status = '${status}' ...`

// public.ts linha 580 — origem vem de req.query
conditions.push(`LOWER(c.origem) LIKE LOWER('%${safeStr(origem)}%')`);

// admin.ts — nome, plano vêm de req.body (mesmo com replace de aspas simples,
//            é uma proteção fraca — não defende contra todos os vetores)
`INSERT INTO empresas ... VALUES ('${String(nome).replace(/'/g, "''")}', ...)`
```

> `safeStr` faz apenas `replace(/'/g, "''")` — insuficiente para todos os vetores de SQL injection.

**Impacto:** Exfiltração de dados, modificação ou deleção de registros, potencial execução de comandos no banco.

**Correção:** Usar `drizzle-orm` com parâmetros tipados (já usado em partes do código) ou `sql` tagged template do Drizzle:
```ts
// Correto — parametrizado
await db.execute(sql`UPDATE pro_corridas SET status = ${acao} WHERE id = ${corridaId}`);
```

---

## 🟠 Altas

### [A1] CORS completamente aberto — aceita qualquer origem

**Arquivo:** `artifacts/api-server/src/app.ts` linha 14

```ts
app.use(cors()); // Sem configuração = Access-Control-Allow-Origin: *
```

**Impacto:** Qualquer site na internet pode fazer requisições autenticadas para a API usando as credenciais do usuário (cookies, tokens). Facilita ataques CSRF em browsers modernos e CORS-based attacks.

**Correção:**
```ts
app.use(cors({
  origin: [
    "https://gotaxi.com.br",
    "https://pdv.gotaxi.com.br",
    "https://admin.gotaxi.com.br",
    "https://afiliados.gotaxi.com.br",
    ...(process.env.NODE_ENV === "development" ? ["http://localhost:3001", "http://localhost:3002", "http://localhost:3003"] : []),
  ],
  credentials: true,
}));
```

---

### [A2] Fallback de JWT_SECRET hardcoded em produção

**Arquivos:** `admin.ts`, `motorista-app.ts`, `afiliados.ts`, `food-delivery.ts`, `delivery.ts`, `ecommerce.ts`, `tur-viagens.ts`, `subcategorias-alimentacao.ts`, `corporativo-cadastro.ts`

```ts
const JWT_SECRET = process.env.JWT_SECRET || "gotaxi-admin-secret-2024";
//                                             ^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                             segredo público e fraco
```

**Impacto:** Se `JWT_SECRET` não for configurado no servidor (erro de deploy, container reiniciado sem env var), o sistema opera com um segredo **publicamente conhecido** neste repositório. Permite forjar tokens JWT de admin/motorista.

**Correção:** Remover o fallback e falhar na inicialização se o segredo não existir:
```ts
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET não configurado");
```

---

### [A3] Ausência de rate limiting em endpoints de autenticação

**Arquivos:** `auth.ts`, `afiliados.ts`, `pdv.ts`, `motorista-app.ts`

Nenhum endpoint de login possui proteção contra brute force. Um atacante pode testar senhas ilimitadas:
- `POST /api/auth/login`
- `POST /api/afiliados/login`
- `POST /api/motorista-app/login`

**Impacto:** Ataques de força bruta ou credential stuffing sem qualquer restrição.

**Correção:**
```ts
import rateLimit from "express-rate-limit";
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: "too_many_requests" } });
router.post("/login", loginLimiter, async (req, res) => { ... });
```

---

### [A4] Ausência de headers de segurança HTTP (Helmet)

**Arquivo:** `artifacts/api-server/src/app.ts`

A API não usa `helmet` nem define manualmente headers como:
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Content-Security-Policy`
- `Strict-Transport-Security`
- `Referrer-Policy`

**Impacto:** Vulnerável a clickjacking, MIME sniffing, e downgrade attacks.

**Correção:**
```ts
import helmet from "helmet";
app.use(helmet());
```

---

## 🟡 Médias

### [M1] Token de cliente (`cl_ID:timestamp`) não expira

**Arquivo:** `artifacts/api-server/src/routes/auth.ts` linhas 168, 235

```ts
const token = Buffer.from(`cl_${usuario.id}:${Date.now()}`).toString("base64");
```

O `timestamp` é gerado mas **nunca validado** no servidor. O token é válido para sempre.

**Impacto:** Tokens roubados (dispositivo perdido, malware) permanecem válidos indefinidamente. Sem mecanismo de logout real.

**Correção:** Usar JWT com expiração (`expiresIn: "30d"`) ou armazenar tokens no banco com data de expiração.

---

### [M2] Senha mínima de 4 caracteres para clientes

**Arquivo:** `artifacts/api-server/src/routes/auth.ts` linha 215

```ts
if (senha.length < 4) { return res.status(400).json({ error: "bad_request" }); }
```

Senhas de 4 dígitos (ex: `1234`) são extremamente fracas e trivialmente quebradas.

**Correção:** Mínimo de 8 caracteres com orientação de complexidade.

---

### [M3] Dados sensíveis retornados desnecessariamente em respostas

**Arquivo:** `artifacts/api-server/src/routes/admin.ts`

Consultas com `SELECT *` em tabelas de usuários e empresas retornam campos como `senha_hash`, `cnpj`, dados bancários para o frontend do admin, mesmo que a UI não os exiba.

**Impacto:** Exposição excessiva de dados. Princípio do menor privilégio violado.

**Correção:** Selecionar apenas os campos necessários em cada consulta.

---

## 🟢 Baixas

### [B1] Senha de teste hardcoded no app mobile

**Arquivo:** `artifacts/saas-mobile/app/login.tsx` linha 31

```ts
const [senha, setSenha] = useState("123456");
```

Senha de teste pré-preenchida no formulário de login em produção. Indica hábito de deixar credenciais hardcoded.

**Correção:** Remover valor padrão: `useState("")`

---

### [B2] Segredo JWT diferente por módulo sem necessidade

Os módulos `afiliados` e `corporativo-cadastro` usam `"afiliados-gotaxi-secret-2024"` enquanto os demais usam `"gotaxi-admin-secret-2024"`. Isso cria dois domínios de token distintos desnecessariamente e dificulta a rotação de segredos.

**Correção:** Unificar em uma única variável de ambiente `JWT_SECRET`.

---

### [B3] Falta validação de tipo MIME por magic bytes em uploads

**Arquivo:** `artifacts/api-server/src/routes/auth.ts` linha 17

```ts
if (file.mimetype.startsWith("image/")) cb(null, true);
```

`mimetype` vem do header HTTP enviado pelo cliente — pode ser falsificado. Um atacante pode enviar um executável com `Content-Type: image/jpeg`.

**Correção:** Usar `file-type` para inspecionar os magic bytes do buffer antes de aceitar:
```ts
import { fileTypeFromBuffer } from "file-type";
const type = await fileTypeFromBuffer(file.buffer);
if (!type || !["image/jpeg","image/png","image/webp"].includes(type.mime)) {
  return cb(new Error("Tipo de arquivo inválido"));
}
```

---

### [B4] `app.use(express.json({ limit: "20mb" }))` sem validação de Content-Type

**Arquivo:** `artifacts/api-server/src/app.ts` linha 15

Limite de 20MB para JSON abre possibilidade de ataques de DoS por payload gigante em endpoints que não precisam de dados grandes.

**Correção:** Reduzir o limite global para `1mb` e criar middleware específico de `20mb` apenas nas rotas de upload de imagem.

---

## Matriz de Risco

| ID | Título | Severidade | Dificuldade de Exploração | Impacto |
|----|--------|------------|--------------------------|---------|
| C1 | Senhas em texto puro | 🔴 Crítica | Baixa (requer acesso ao BD) | Altíssimo |
| C2 | Token base64 forjável | 🔴 Crítica | Baixa (qualquer usuário) | Altíssimo |
| C3 | SQL Injection | 🔴 Crítica | Média | Altíssimo |
| A1 | CORS aberto | 🟠 Alta | Média | Alto |
| A2 | JWT secret público | 🟠 Alta | Baixa (requer env mal configurado) | Alto |
| A3 | Sem rate limiting | 🟠 Alta | Baixa | Alto |
| A4 | Sem helmet | 🟠 Alta | Média | Médio |
| M1 | Token sem expiração | 🟡 Média | Média | Médio |
| M2 | Senha mín. 4 chars | 🟡 Média | Baixa | Médio |
| M3 | SELECT * excessivo | 🟡 Média | Alta | Baixo |
| B1 | Senha hardcoded app | 🟢 Baixa | Baixa | Baixo |
| B2 | JWT secrets múltiplos | 🟢 Baixa | Baixa | Baixo |
| B3 | MIME sem magic bytes | 🟢 Baixa | Média | Baixo |
| B4 | JSON limit 20MB global | 🟢 Baixa | Baixa | Baixo |

---

## Prioridade de Correção Recomendada

**Imediato (antes de ir a produção):**
1. **C1** — Hash de senhas de clientes com bcrypt
2. **C2** — Substituir tokens base64 por JWT assinados
3. **A2** — Remover fallback de JWT_SECRET hardcoded

**Curto prazo (semana 1):**
4. **C3** — Migrar queries com interpolação de string para `sql` parametrizado do Drizzle
5. **A1** — Restringir CORS às origens conhecidas
6. **A3** — Adicionar rate limiting nos endpoints de login

**Médio prazo (semana 2-3):**
7. **A4** — Adicionar `helmet`
8. **M1** — Tokens com expiração
9. **B3** — Validação de magic bytes em uploads

---

*Varredura realizada via análise estática de código. Não inclui testes de penetração dinâmicos.*
