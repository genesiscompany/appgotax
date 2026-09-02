# Template: API Server (Node + Express + Drizzle)

## Tipo de serviço
**App → Github**

## Source (Github)

| Campo | Valor |
|---|---|
| Repository | `genesiscompany/goplus` |
| Branch | `main` |
| Auto Deploy | ✅ Habilitado |

## Build

| Campo | Valor |
|---|---|
| Build Type | `Dockerfile` |
| Build Path | `/` |
| Dockerfile Path | `migration/dockerfiles/Dockerfile.api` |

## Deploy

| Campo | Valor |
|---|---|
| Service Name | `gotaxi-api` |
| Port | `8080` |
| Replicas | `1` |

## Environment Variables

```env
NODE_ENV=production
PORT=8080
DATABASE_URL=postgres://gotaxi:SUA_SENHA_AQUI@gotaxi-db:5432/gotaxi
JWT_SECRET=COLE_UMA_STRING_ALEATORIA_DE_64_CHARS
GOOGLE_MAPS_KEY=AIzaSy...
GOOGLE_MAPS_SERVER_KEY=AIzaSy...
OPENAI_API_KEY=sk-proj-...
PUBLIC_DOMAIN=https://gotaxi.com.br
```

> 🔑 **Onde obter cada chave:**
> - `JWT_SECRET`: gere em https://generate-secret.vercel.app/64
> - `GOOGLE_MAPS_KEY` / `GOOGLE_MAPS_SERVER_KEY`: https://console.cloud.google.com/google/maps-apis/credentials
> - `OPENAI_API_KEY`: https://platform.openai.com/api-keys

## Volumes

| Mount Path | Volume Name |
|---|---|
| `/app/public/uploads` | `gotaxi-uploads` |

> ⚠️ Sem esse volume, as imagens enviadas pelo PDV/mobile somem ao reiniciar o container.

## Domains

| Host | HTTPS | Path | Port |
|---|---|---|---|
| `api.gotaxi.com.br` | ✅ Let's Encrypt | `/` | `8080` |

## Healthcheck (opcional)
- Path: `/`
- Interval: 30s
- Timeout: 5s

## Resources (recomendado)
- CPU: 1 vCPU
- Memory: 1 GB
