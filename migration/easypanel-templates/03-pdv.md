# Template: PDV — Painel do Parceiro (React + Vite)

## Tipo de serviço
**App → Github**

## Source

| Campo | Valor |
|---|---|
| Repository | `genesiscompany/goplus` |
| Branch | `main` |
| Auto Deploy | ✅ |

## Build

| Campo | Valor |
|---|---|
| Build Type | `Dockerfile` |
| Build Path | `/` |
| Dockerfile Path | `migration/dockerfiles/Dockerfile.web` |

### Build Args (importante!)

```
WORKSPACE=pdv
GOOGLE_MAPS_KEY=AIzaSy...
BASE_PATH=/
PORT=3000
```

> ⚠️ `BASE_PATH` e `PORT` são exigidos pelo `vite.config.ts` no momento do build (mesmo que depois usemos Nginx).

## Deploy

| Campo | Valor |
|---|---|
| Service Name | `gotaxi-pdv` |
| Port | `80` |
| Replicas | `1` |

## Environment Variables
*(Nenhuma — tudo é injetado em tempo de build via Build Args)*

Se o código fizer fetch para a API, certifique-se que está usando o domínio absoluto `https://api.gotaxi.com.br`. Caso contrário, adicione um Build Arg:
```
VITE_API_URL=https://api.gotaxi.com.br
```

## Domains

| Host | HTTPS | Path | Port |
|---|---|---|---|
| `pdv.gotaxi.com.br` | ✅ Let's Encrypt | `/` | `80` |

## Resources
- CPU: 0.5 vCPU
- Memory: 256 MB (Nginx serve estático, gasta pouco)
