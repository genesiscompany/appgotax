# Guia de Correção — Google Maps no GoTaxi PDV

**Problema:** O mapa na página **Time Line** (`pdv.gotaxi.com.br/timeline`) não carrega.  
**Erro:** `RefererNotAllowedMapError` — o domínio `pdv.gotaxi.com.br` não está autorizado na chave da API do Google Maps.

---

## O que precisa ser feito

Adicionar os domínios do GoTaxi na lista de sites autorizados das chaves de API do Google Maps.

---

## Passo a Passo

### 1. Acessar o Google Cloud Console

Abra no navegador:  
👉 **[https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)**

Faça login com a **conta Google** que gerencia o projeto do Google Maps.

---

### 2. Localizar as chaves de API

Você verá uma lista de chaves (API Keys). As chaves do GoTaxi são:

| Nome da chave | 
|--|
| Chave principal do Maps: **`AIzaSyDhJ7W9PW-hL8G7C0I0bFZ8_n5vDF3xd4g`** |
| Chave Web: **`AIzaSyAWsI1LEskKyzJPCT8F_baYDc8GaudRWAo`** |

> 💡 Se não souber qual projeto é, verifique no painel **EasyPanel** → serviço `api` → aba **Environment** → variável `GOOGLE_MAPS_KEY`.

---

### 3. Editar cada chave

Para cada chave, faça o seguinte:

1. Clique no **nome da chave** (não no ícone de lápis ao lado) para abrir os detalhes
2. Role até **"Application restrictions"**
3. Selecione **"Websites"** (se não estiver já)
4. Em **"Website restrictions"**, clique em **"ADD ITEM"**
5. Adicione os seguintes domínios:

```
pdv.gotaxi.com.br/*
admin.gotaxi.com.br/*
gotaxi.com.br/*
*.gotaxi.com.br/*
```

> ⚠️ **NÃO inclua `https://`** — o Google Maps API usa apenas o domínio sem protocolo.
> O `*` no final é essencial — permite todas as páginas dentro do domínio.

6. Clique em **SAVE** (botão no final da página)

---

### 4. Repetir para a segunda chave

Faça o mesmo procedimento para a outra chave listada no passo 2.

---

### 5. Verificar se funcionou

1. Acesse **[https://pdv.gotaxi.com.br/timeline](https://pdv.gotaxi.com.br/timeline)**
2. Faça login com suas credenciais
3. O mapa deve carregar normalmente (pode levar até 5 minutos para o Google propagar a alteração)

---

## Verificação adicional — API restrictions

Na mesma tela da chave, role até **"API restrictions"**:
- Se estiver **"Don't restrict key"** → ✅ OK
- Se estiver **"Restrict key"** → clique em **Edit** e certifique-se de que **Maps JavaScript API** está na lista

---

## Exemplo Visual

A tela de configuração da chave deve ficar assim no final:

```
Application restrictions: ◎ Websites

Website restrictions:
  + pdv.gotaxi.com.br/*
  + admin.gotaxi.com.br/*
  + gotaxi.com.br/*
  + *.gotaxi.com.br/*
```

> ⚠️ SEM `https://` na frente! Apenas o domínio.

---

## Se ainda não funcionar — Teste sem restrições

Para confirmar que o problema é a restrição de domínio:
1. Na chave, mude **"Application restrictions"** para **"None"**
2. Salve e aguarde 1 minuto
3. Recarregue a página da Timeline

Se o mapa aparecer → o problema é o formato dos domínios, revise os passos acima.
Se o mapa não aparecer com "None" → o problema é diferente (Maps JavaScript API pode não estar ativada no projeto).

> ⚠️ Lembre de recolocar as restrições após o teste.

---

## Precisa de Ajuda?

Se tiver dificuldade para acessar a conta Google Cloud, entre em contato com o suporte GoTaxi.
