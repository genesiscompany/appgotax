# Template: Afiliados Hub (React + Vite)

## Tipo de serviço
**App → Github**

## Configuração

| Campo | Valor |
|---|---|
| Service Name | `gotaxi-afiliados` |
| Repository | `genesiscompany/goplus` |
| Branch | `main` |
| Dockerfile Path | `migration/dockerfiles/Dockerfile.web` |
| Port | `80` |

### Build Args

```
WORKSPACE=afiliados-hub
GOOGLE_MAPS_KEY=AIzaSy...
BASE_PATH=/afiliados/
PORT=3000
```

> ⚠️ **`BASE_PATH=/afiliados/` é obrigatório.** O SPA é servido via proxy em
> `gotaxi.com.br/afiliados/` (pelo container `gotaxi-landing`). Com outro valor
> os assets ficam com URL errada e o app quebra.

## Domínio

**Não expor domínio público neste serviço.**

O acesso é feito através de `gotaxi.com.br/afiliados/` — o container
`gotaxi-landing` (nginx) faz o proxy interno para `gotaxi-afiliados:80`.

Deixar sem domínio configurado no EasyPanel (serviço interno apenas).

## Resources
- CPU: 0.5 vCPU
- Memory: 256 MB
