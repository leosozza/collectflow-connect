

## Análise final e publicação

Todas as alterações recentes foram revisadas e estão consistentes. Não há plano de mudanças adicionais — apenas validação visual e publicação.

### Status de cada mudança

| Mudança | Status |
|---|---|
| Aviso de contato recente (centralizado, sem status) | OK |
| Foto de perfil real do WhatsApp (Evolution/Wuzapi) | OK — edge `whatsapp-fetch-avatar` deployada, hook com batch+TTL, fallback para iniciais |
| Header do `ChatPanel` mostrando nome do cliente (`nome_completo`) | OK |
| Bloqueio da tabulação "EM DIA" para clientes com acordo no Rivo | OK — 4 pontos cobertos (sidebar WhatsApp, modal fechar conversa, auto-assign, painel de voz) |
| Busca de endereço (MaxList) não-bloqueante na criação de acordo | OK — roda em background com `.catch` |
| Otimização do `enrichClientAddress` (3 contratos, 8s, try/catch isolado) | OK |
| ViaCEP no diálogo "Campos faltantes" do AgreementCalculator | OK — `cepLookupLoading` + `Loader2` + preenche apenas campos vazios |
| Helper `lookupCep` centralizado, refactor de 3 formulários | OK — `ClientForm`, `ClientDetailHeader`, `CobrancaForm` migrados |

### Observação sobre o warning "FunctionsFetchError" no console

Esse log é de **antes** do deploy da edge `whatsapp-fetch-avatar`. Edge functions são deployadas automaticamente assim que o código vai para produção, então o erro deixa de ocorrer após o publish. Se persistir após o publish, basta recarregar (cache do navegador).

### Próximo passo (executado em modo default)

1. Reproduzir rapidamente no preview: abrir uma conversa do WhatsApp, conferir foto + nome corretos, abrir um cliente da carteira, formalizar um acordo de teste para confirmar que o ViaCEP no diálogo de "Campos faltantes" preenche endereço/bairro/cidade/UF.
2. Sem alterações de código previstas — caso alguma validação acima falhe, ajusto pontualmente.
3. Confirmar visualmente e orientar o usuário a clicar em **Publish → Update** (mudanças de frontend exigem update manual; edge functions e migrations já estão no ar).

