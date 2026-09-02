GoTaxi — API completa corrigida — v5

Este pacote contém a API completa, não apenas a rota do Mercado Pago.
Não contém credenciais, node_modules, dist ou uploads.

IMPORTAÇÃO:
1. Extraia/mescle o conteúdo na RAIZ do repositório.
2. Preserve exatamente os caminhos artifacts/api-server/src/...
3. Não copie src/index.ts para dentro de src/routes/.
4. Confirme que estes arquivos existem:
   - artifacts/api-server/src/app.ts
   - artifacts/api-server/src/index.ts
   - artifacts/api-server/src/routes/index.ts
   - artifacts/api-server/src/routes/payments.ts

EASYPANEL — serviço app/api:
- Dockerfile: Dockerfile.api
- Porta: 8080
- Health check: /api/healthz
- Publicar somente app/api primeiro.

O build correto deve mostrar:
  pnpm --filter @workspace/api-server run build

O serviço deve iniciar com:
  node artifacts/api-server/dist/index.cjs

SEGURANÇA:
Não coloque DATABASE_URL, JWT, Google, OpenAI ou Mercado Pago em Build Arguments.
Configure-os como variáveis de ambiente de execução e troque as credenciais que já apareceram em logs.
