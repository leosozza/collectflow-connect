

# Correcao do Callback Negociarie e Melhorias no Painel

## Problema Identificado

Ao testar a conexao na aba Negociarie em /integracao, o callback falha com erro **"Preencha uma URL valida"**. O payload enviado usa `{"url": "..."}` mas a API Negociarie provavelmente espera `{"url_callback": "..."}`. Alem disso, nao ha opcao manual para configurar o callback nem log visivel do teste.

## Correcoes

### 1. Edge Function - Corrigir campo do callback

**Arquivo:** `supabase/functions/negociarie-proxy/index.ts`

- No case `"atualizar-callback"`, testar multiplos nomes de campo (`url_callback`, `url`, `callback_url`) caso o primeiro falhe
- Alterar o payload para usar `url_callback` como campo principal
- Adicionar log detalhado do payload enviado e resposta recebida

### 2. Frontend - Campo manual de Callback URL

**Arquivo:** `src/components/integracao/NegociarieTab.tsx`

- Adicionar um campo de input editavel mostrando a URL do callback (pre-preenchido com a URL automatica)
- Botao separado "Configurar Callback" para enviar manualmente
- O teste de conexao continua tentando o callback automaticamente, mas o usuario pode ajustar a URL se necessario

### 3. Frontend - Log do teste de conexao visivel

**Arquivo:** `src/components/integracao/NegociarieTab.tsx`

- O log ja existe no estado `logs`, mas so aparece se `logs.length > 0`
- Garantir que o log aparece imediatamente ao testar a conexao (ja funciona, mas vamos melhorar a visibilidade)
- Adicionar mais detalhes no log: mostrar a URL testada, o resultado completo

## Detalhes Tecnicos

### Edge Function (`negociarie-proxy/index.ts`)

Alterar o case `"atualizar-callback"` de:
```text
case "atualizar-callback": {
  result = await negociarieRequest("POST", "/cobranca/atualizar-url-callback", params.data);
  break;
}
```

Para:
```text
case "atualizar-callback": {
  // A API Negociarie espera o campo url_callback
  const callbackPayload = { url_callback: params.data?.url || params.data?.url_callback };
  console.log("[negociarie-proxy] Registrando callback:", JSON.stringify(callbackPayload));
  result = await negociarieRequest("POST", "/cobranca/atualizar-url-callback", callbackPayload);
  break;
}
```

### Frontend (`NegociarieTab.tsx`)

- Adicionar estado `callbackUrl` editavel
- Adicionar secao "Configuracao de Callback" com input + botao dedicado
- Pre-preencher com a URL automatica do sistema
- Separar a logica de teste de conexao do registro de callback

### Arquivos Modificados

1. `supabase/functions/negociarie-proxy/index.ts` - corrigir nome do campo
2. `src/components/integracao/NegociarieTab.tsx` - adicionar campo manual de callback e melhorar logs

