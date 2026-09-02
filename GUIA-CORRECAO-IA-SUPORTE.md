# Guia de Correção — IA do Suporte GoTaxi (Gô)

**Problema:** A assistente virtual Gô não responde no chat de suporte do PDV.
**Erro nos logs:** `401 Incorrect API key provided` — a chave da OpenAI expirou ou é inválida.

---

## O que precisa ser feito

Gerar uma nova chave de API na OpenAI e atualizar no EasyPanel.

---

## Passo a Passo

### 1. Acessar a OpenAI Platform

Abra no navegador:
👉 **[https://platform.openai.com/account/api-keys](https://platform.openai.com/account/api-keys)**

Faça login com a conta que gerencia o projeto GoTaxi na OpenAI.

---

### 2. Criar uma nova chave de API

1. Clique em **"Create new secret key"**
2. Escolha o tipo **"Standard"** (não "Project")
3. Dê um nome como `GoTaxi Suporte`
4. Clique em **"Create secret key"**
5. **Copie a chave imediatamente** — ela só aparece uma vez!

> ⚠️ A chave começa com `sk-proj-...` **(não usar esse tipo)**.
> A chave correta começa com `sk-...`.

---

### 3. Atualizar no EasyPanel

1. Acesse o **[EasyPanel](http://187.77.21.165:3000)**
2. Vá em **Projeto `app`** → serviço **`api`** → aba **Environment**
3. Encontre a variável `OPENAI_API_KEY`
4. Substitua o valor pela nova chave copiada
5. Clique em **Save**
6. Clique em **Deploy** no serviço `api`

---

### 4. Testar

1. Acesse **[https://pdv.gotaxi.com.br/suporte](https://pdv.gotaxi.com.br/suporte)**
2. Faça login
3. Abra um ticket ou crie um novo
4. Envie uma mensagem — a **Gô** deve responder em ~5 segundos

---

### 5. Se ainda não funcionar

Verifique os **Logs** do serviço `api` no EasyPanel. Procure por:
```
[suporte-ia] erro:
```

Se aparecer novamente `401 Incorrect API key`, a chave nova também é inválida — repita o passo 2.

Se aparecer outro erro, entre em contato com o suporte GoTaxi.

---

## Precisa de Ajuda?

Se tiver dificuldade para acessar a conta OpenAI ou gerar a chave, entre em contato com o suporte GoTaxi.
