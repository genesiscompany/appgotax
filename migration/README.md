# 📦 Pasta de Migração — GoTaxi para Easypanel

Esta pasta contém **tudo** o que você precisa para migrar seu projeto do Replit para uma VPS com Easypanel.

> ✅ **Importante:** Nenhum arquivo aqui dentro modifica seu código original. Você pode copiar essa pasta inteira pro seu repositório `goplus` sem medo de quebrar o Replit.

## 📂 Estrutura

```
migration/
├── GUIA-MIGRACAO.md              ⭐ COMECE AQUI — passo a passo completo
├── README.md                      ← este arquivo
├── .dockerignore                  ← otimiza tamanho de build
├── dockerfiles/
│   ├── Dockerfile.api            ← imagem da API (Node 24 + Express + Drizzle)
│   └── Dockerfile.web            ← imagem dos painéis web (Nginx + Vite build)
├── nginx/
│   └── spa.conf                  ← config Nginx para SPA + cache de assets
└── easypanel-templates/          ← templates prontos para cada serviço
    ├── 01-postgres.md
    ├── 02-api-server.md
    ├── 03-pdv.md
    ├── 04-admin.md
    └── 05-afiliados.md
```

## 🚀 Resumo de 30 segundos

1. Copie esta pasta `migration/` para a raiz do seu repositório GitHub e faça commit
2. No Easypanel, crie 5 serviços seguindo os templates em `easypanel-templates/`:
   - 1 PostgreSQL
   - 1 API (Node)
   - 3 Web (PDV, Admin, Afiliados)
3. Restaure `backup_gotaxi.sql` no Postgres
4. Aponte os DNS dos 4 subdomínios pra VPS
5. Rebuild dos apps mobile via EAS com a nova URL → publica na Play Store

**Tempo estimado total:** 1-2 horas (sem contar revisão do Google na Play Store).

📖 **Leia o `GUIA-MIGRACAO.md` para os detalhes completos de cada etapa.**

---

## ⚠️ Aviso de segurança

Antes de fazer commit, certifique-se que **nenhuma chave real** está nos templates `.md`. Os arquivos aqui contêm apenas placeholders. As chaves reais devem ser inseridas **diretamente no painel do Easypanel** (Environment Variables) — nunca no código ou no Git.

## 🆘 Suporte

Em caso de problemas, consulte a seção **Troubleshooting** no `GUIA-MIGRACAO.md`. Os erros mais comuns já estão documentados lá.
