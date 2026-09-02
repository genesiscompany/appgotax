# Template: Admin — Super-Admin Panel (React + Vite)

## Tipo de serviço
**App → Github**

## Configuração (idêntica ao PDV, mudando apenas o WORKSPACE)

| Campo | Valor |
|---|---|
| Service Name | `gotaxi-admin` |
| Repository | `genesiscompany/goplus` |
| Branch | `main` |
| Dockerfile Path | `migration/dockerfiles/Dockerfile.web` |
| Port | `80` |

### Build Args

```
WORKSPACE=admin
GOOGLE_MAPS_KEY=AIzaSy...
BASE_PATH=/
PORT=3000
```

## Domains

| Host | HTTPS | Path | Port |
|---|---|---|---|
| `admin.gotaxi.com.br` | ✅ Let's Encrypt | `/` | `80` |

## Resources
- CPU: 0.5 vCPU
- Memory: 256 MB

> 💡 **Segurança:** Como esse é o painel de super-admin, considere restringir acesso por IP ou ativar Basic Auth adicional no Easypanel (aba **Advanced → Basic Auth**).
