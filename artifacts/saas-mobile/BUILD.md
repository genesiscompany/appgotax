# Como gerar o build (AAB) pelo GitHub

Este projeto está configurado para gerar o **AAB de produção** (arquivo que se envia para a Google Play Store) automaticamente pelo GitHub, usando o EAS Build da Expo.

## Pré-requisitos (faz uma vez só)

### 1. Gerar o token da Expo

1. Acesse: https://expo.dev/accounts/gotaxiplus/settings/access-tokens
2. Clique em **Create token**
3. Dê um nome (ex: `github-actions`) e clique em **Create**
4. **Copie o token** que aparece (ele só é mostrado uma vez!)

### 2. Adicionar os secrets no GitHub

1. Vá no repositório: https://github.com/genesiscompany/gotaxiplus
2. Clique em **Settings** → **Secrets and variables** → **Actions**
3. Adicione **dois** secrets:

   | Nome do secret      | Valor                                                       |
   | ------------------- | ----------------------------------------------------------- |
   | `EXPO_TOKEN`        | Token gerado no passo anterior                              |
   | `GOOGLE_MAPS_KEY`   | Sua chave da API do Google Maps (ex: `AIzaSy...`)           |

## Como gerar uma build

1. Acesse: https://github.com/genesiscompany/gotaxiplus/actions
2. No menu lateral, clique em **Build Android (AAB - Produção)**
3. Clique em **Run workflow** (botão à direita)
4. Escolha o perfil:
   - **production** → gera um `.aab` para subir na Google Play (recomendado)
   - **preview** → gera um `.apk` para instalar direto no celular
5. Clique em **Run workflow**

## Onde baixar o build pronto

Depois que o workflow termina (cerca de 5–10 minutos), o build fica disponível em:

👉 https://expo.dev/accounts/gotaxiplus/projects/saas-mobile/builds

Lá você pode baixar o `.aab` (ou `.apk`) e enviar para a Play Store.

## Versionamento

Antes de gerar uma nova build, lembre-se de atualizar a versão no arquivo `app.json`:

```json
{
  "expo": {
    "version": "1.2.0",          // ← versão visível na loja
    "android": {
      "versionCode": 11           // ← incrementar +1 a cada build na Play Store
    }
  }
}
```

A Google Play **exige** que o `versionCode` seja maior que o da última build enviada — caso contrário, recusa o upload.
