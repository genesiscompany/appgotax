# Template: PostgreSQL no Easypanel

## Tipo de serviço
**Database → PostgreSQL**

## Configuração

| Campo | Valor |
|---|---|
| Service Name | `gotaxi-db` |
| Version | `16` |
| Database Name | `gotaxi` |
| Username | `gotaxi` |
| Password | *gere uma senha forte de 32+ caracteres* |

## Connection String resultante
```
postgres://gotaxi:SENHA_GERADA@gotaxi-db:5432/gotaxi
```

> ⚠️ Dentro da rede interna do Easypanel, o **host é o nome do serviço** (`gotaxi-db`), não `localhost` nem o IP da VPS.

## Backups
- Habilite em **Backups → Schedule**
- Frequência: diária às 4h
- Retenção: 7 dias mínimo
- Destino: S3-compatible (Backblaze B2 é o mais barato)

## Restaurar o backup inicial
Após criar o serviço, restaure o `backup_gotaxi.sql`:

```bash
# Via terminal do serviço no painel Easypanel
psql -U gotaxi -d gotaxi < /tmp/backup_gotaxi.sql
```

Ou via SSH na VPS:
```bash
docker exec -i $(docker ps | grep gotaxi-db | awk '{print $1}') \
  psql -U gotaxi -d gotaxi < backup_gotaxi.sql
```
