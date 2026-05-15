# Plano de correção — Webhook de baixa automática Negociarie no Bancário do Credor

## Diagnóstico encontrado

### 1) A baixa da ZULEICA não chegou ao RIVO automaticamente

Localizei o acordo da **Zuleica Amancio**:

- CPF: `03427364933`
- Acordo: `8fb06217-fba6-417f-90c8-807b5118837e`
- Parcela vencimento: `15/05/2026`
- Valor: `R$ 300,00`
- ID parcela Negociarie usado pelo RIVO: `8fb062-1-moszyod7`

Antes do teste, a cobrança estava assim no RIVO:

| Campo | Valor |
|---|---|
| status | `registrado` |
| id_status | `800` |
| valor_pago | `0` |
| data_pagamento | vazio |
| `agreement_installments.paid` | `false` |

Também não havia evento `payment_confirmed` para essa parcela.

### 2) O endpoint de callback funciona, mas a Negociarie não está chamando ele

Os logs recentes da função `negociarie-callback` vieram vazios. Isso indica que a Negociarie **não disparou chamada para o RIVO** quando esses pagamentos aconteceram.

Para validar se o problema era no RIVO ou na chamada da Negociarie, simulei o callback da parcela da ZULEICA com:

- `id_parcela = 8fb062-1-moszyod7`
- `id_status = 801`
- `valor_pago = 300`
- `data_pagamento = 2026-05-15`

A função respondeu `200 OK` e processou corretamente.

Depois do teste, a baixa ficou aplicada no RIVO:

| Campo | Valor |
|---|---|
| `negociarie_cobrancas.status` | `pago` |
| `id_status` | `801` |
| `valor_pago` | `300` |
| `data_pagamento` | `2026-05-15` |
| `agreement_installments.paid` | `true` |
| `paid_source` | `negociarie` |
| evento | `payment_confirmed` criado |

Ou seja: **o motor de baixa do RIVO está funcionando**. A falha está em **registro/roteamento do webhook na conta Negociarie correta** e em alguns pontos do código que ainda tratam Negociarie como configuração do tenant, não do credor.

## Causa raiz

Hoje existem três problemas combinados:

### Problema A — O webhook não aparece no Bancário do Credor

Você está certo: se a conta Negociarie é da **TESS MODELS**, a URL de retorno precisa aparecer no **Cadastro do Credor → Bancário**, junto das credenciais da TESS.

Hoje ela aparece na tela geral de Configurações/Integrações, que dá a entender que é configuração da Y.BRASIL/tenant. Isso está conceitualmente errado para “Cobrança Direta”.

### Problema B — A ação “Registrar callback” usa credenciais do tenant, não do credor

No `negociarie-proxy`, a ação `atualizar-callback` chama:

```ts
negociarieRequest(tenantId, "POST", "/cobranca/atualizar-url-callback", callbackPayload)
```

Falta passar o `creditorId`. Então, mesmo que a tela do credor envie `creditor_id`, a função ainda registra o callback usando as credenciais do tenant.

Para TESS MODELS, isso é crítico porque a conta real é a do credor.

### Problema C — A geração de boletos de acordo ainda usa credencial global/ENV

A função `generate-agreement-boletos` hoje autentica assim:

```ts
Deno.env.get("NEGOCIARIE_CLIENT_ID")
Deno.env.get("NEGOCIARIE_CLIENT_SECRET")
```

Ela não resolve as credenciais pelo credor do acordo. Isso precisa ser alinhado ao mesmo padrão do `negociarie-proxy`:

1. Se o credor tem `cobrança_direta_ativa = true`, usar credenciais do credor.
2. Se não, usar credenciais do tenant.
3. Se não houver, bloquear para evitar boleto saindo no CNPJ errado.

## Correção proposta

### 1) Exibir Webhook de baixa no Cadastro Bancário do Credor

No componente `CreditorIntegrationsVault`, adicionar bloco:

- URL de webhook:
  `https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/negociarie-callback`
- Botão copiar URL
- Botão **Registrar webhook na Negociarie da TESS**
- Status: último registro (`callback_registered_at`) quando existir

Essa área só aparece quando `Cobrança Direta` estiver ativa e o credor tiver credenciais Negociarie cadastradas.

### 2) Corrigir `negociarie-proxy` para registrar callback usando o credor

Alterar a action `atualizar-callback` para chamar:

```ts
negociarieRequest(
  tenantId,
  "POST",
  "/cobranca/atualizar-url-callback",
  callbackPayload,
  creditorIdCtx
)
```

E após sucesso, atualizar:

```sql
tenant_integrations.callback_registered_at = now()
```

na linha correta:

- `tenant_id = Y.BRASIL`
- `creditor_id = TESS MODELS`
- `provider = negociarie`

### 3) Corrigir `generate-agreement-boletos` para usar a conta Negociarie correta

A geração de boleto precisa buscar o credor do acordo e resolver credenciais assim:

```text
agreement.credor
  → credores.id pelo tenant + razão social/nome fantasia
  → se cobrança_direta_ativa=true
      usa tenant_integrations com creditor_id = credor.id
    senão
      usa tenant_integrations com creditor_id IS NULL
```

Isso garante que boleto da TESS seja gerado pela conta da TESS, e boleto de qualquer outro credor sem conta própria não caia indevidamente na conta da TESS.

### 4) Corrigir validação de token do callback para credor direto

Hoje o callback valida o token buscando credenciais do tenant (`creditor_id IS NULL`).

A validação deve resolver pela própria cobrança:

```text
id_parcela recebido
  → negociarie_cobrancas
  → agreement_id
  → agreements.credor
  → credores
  → se cobrança_direta_ativa=true, usa segredo do credor
```

Assim, quando a Negociarie da TESS chamar o RIVO com token da TESS, o RIVO valida com as credenciais da TESS, não com as da Y.BRASIL.

### 5) Criar reconciliação das baixas já pagas que o webhook perdeu

Como os clientes do print já pagaram e a Negociarie não chamou o webhook, registrar o callback agora não baixa retroativamente tudo sozinho.

Então vou adicionar um botão no Bancário do Credor:

**Sincronizar baixas pagas**

Ele consulta a Negociarie com as credenciais do credor para o período recente e aplica a mesma rotina de baixa automática no RIVO para parcelas encontradas por `id_parcela`.

Isso cobre:

- ZULEICA AMANCIO
- CRISELIDE BRAGA SOUZA BARBOZA
- CRISTIANE SANTOS SILVA SOUZA
- ALINE OLIVEIRA DO ESPIRITO SANTO
- CARLOS FERNANDO ROCHA DA SILVEIRA
- LINDETE CARDOZA DA SILVA
- TATIANE DA SILVA
- GRAZIELE VERISSIMO DA SILVA MOTA

### 6) Remover/evitar confusão no painel geral da Y.BRASIL

Como a conta Negociarie é da TESS, não da Y.BRASIL, a tela geral de Configurações/Integrações deve deixar claro:

> “Este tenant não possui conta Negociarie própria. As cobranças são configuradas por credor em Cadastros → Credores → Bancário.”

E não deve incentivar cadastrar ali o client/secret da TESS como se fosse da Y.BRASIL.

## Resultado esperado após implementação

- No Bancário da TESS aparece a URL de webhook de baixa.
- O botão registra a URL diretamente na conta Negociarie da TESS.
- Novos pagamentos da TESS entram automaticamente no RIVO.
- Pagamentos já feitos podem ser sincronizados via botão de reconciliação.
- Boletos da TESS usam credenciais da TESS.
- Outros credores não caem acidentalmente na conta Negociarie da TESS.

## Observação importante

A baixa da parcela da **ZULEICA AMANCIO** foi validada com sucesso no RIVO durante o diagnóstico: o processamento do callback funcionou e a parcela ficou marcada como paga. O que falta agora é corrigir o fluxo permanente para a Negociarie chamar o endpoint certo da conta certa, e sincronizar os demais pagamentos perdidos.
