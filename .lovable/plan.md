

# Corrigir Recebimento Automatico de Callbacks da Negociarie

## Problema
A cobranca COB-1770834042432 foi paga na gateway Negociarie, mas o sistema local continua mostrando "pendente" porque:
1. A URL de callback nunca foi registrada na API Negociarie
2. Os dados retornados pela API (pix_copia_cola, id_parcela) nao estao sendo salvos localmente

## Solucao em 3 partes

### Parte 1: Registrar URL de callback automaticamente

Adicionar um botao na aba Negociarie (ou disparar automaticamente ao testar conexao) para registrar a URL de callback na API.

**Arquivo:** `src/components/integracao/NegociarieTab.tsx`
- Adicionar botao "Configurar Callback" ou chamar automaticamente ao testar conexao
- Chamar `negociarieService.atualizarCallback({ url: callbackUrl })`
- A URL sera: `https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/negociarie-callback`

**Arquivo:** `src/components/integracao/SyncPanel.tsx`
- Adicionar botao dedicado para configurar/atualizar a URL de callback
- Mostrar status de configuracao

### Parte 2: Salvar dados retornados pela API ao criar cobranca

**Arquivo:** `src/components/integracao/CobrancaForm.tsx`
- Apos criar a cobranca com sucesso, extrair `pix_copia_cola`, `id_parcela`, `link_boleto`, `linha_digitavel`, `link_cartao` da resposta da API
- Salvar esses dados na tabela `negociarie_cobrancas` para que o callback consiga localizar a cobranca corretamente

Trecho atual que salva a cobranca:
```typescript
await negociarieService.saveCobranca({
  tenant_id: tenantId,
  client_id: null,
  id_geral: idGeral2,
  id_parcela: null,        // <-- deveria salvar o retornado
  tipo,
  status: "pendente",
  valor: parseCurrencyInput(form.valor),
  data_vencimento: form.vencimento,
  link_boleto: null,        // <-- deveria salvar o retornado
  pix_copia_cola: null,     // <-- deveria salvar o retornado
  link_cartao: null,        // <-- deveria salvar o retornado
  linha_digitavel: null,    // <-- deveria salvar o retornado
});
```

Sera alterado para extrair os dados da resposta:
```typescript
const parcela = apiResult.parcelas?.[0] || {};
await negociarieService.saveCobranca({
  tenant_id: tenantId,
  client_id: null,
  id_geral: idGeral2,
  id_parcela: parcela.id_parcela || null,
  tipo,
  status: "pendente",
  valor: parseCurrencyInput(form.valor),
  data_vencimento: form.vencimento,
  link_boleto: parcela.link_boleto || parcela.url_boleto || null,
  pix_copia_cola: parcela.pix_copia_cola || null,
  link_cartao: parcela.link_cartao || parcela.url_cartao || null,
  linha_digitavel: parcela.linha_digitavel || null,
});
```

### Parte 3: Adicionar botao de sincronizacao manual de status

**Arquivo:** `src/components/integracao/CobrancasList.tsx`
- Adicionar botao "Atualizar Status" em cada cobranca que consulta a API Negociarie via `consultaCobrancas({ id_geral })` e atualiza o status local
- Isso serve como fallback caso o callback falhe

### Parte 4: Atualizar a cobranca existente manualmente (acao imediata)

Como a cobranca COB-1770834042432 ja existe e foi paga, o botao de sincronizacao manual permitira atualizar o status consultando a API.

## Resumo dos arquivos modificados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/integracao/NegociarieTab.tsx` | Registrar callback URL ao testar conexao |
| `src/components/integracao/SyncPanel.tsx` | Botao dedicado para configurar URL de callback |
| `src/components/integracao/CobrancaForm.tsx` | Salvar dados retornados (pix_copia_cola, id_parcela, etc.) |
| `src/components/integracao/CobrancasList.tsx` | Botao "Atualizar Status" por cobranca via consulta API |

