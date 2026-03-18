

# Plano: Atualizar credenciais Negociarie para TESS MODELS

## Problema
As credenciais atuais da API Negociarie pertencem a outro cliente. Precisamos atualizar para as credenciais da TESS MODELS.

## Alterações

### 1. Atualizar secrets no backend
Atualizar os dois secrets existentes com os novos valores:

- **NEGOCIARIE_CLIENT_ID** → `1306`
- **NEGOCIARIE_CLIENT_SECRET** → `yXsCjsDI8X66seF0CwRsxrtmxj2yZuLf`

### 2. Corrigir erro de build
O erro `Failed to load native binding` do `@swc/core` será resolvido com rebuild dos módulos nativos.

### 3. Testar conexão
Após atualizar os secrets, testar a edge function `negociarie-proxy` com action `test-connection` para confirmar que as novas credenciais funcionam.

## Nenhuma alteração de código necessária
Os secrets são consumidos pela edge function existente via `Deno.env.get()` — basta atualizar os valores.

