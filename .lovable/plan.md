

## ✅ Mover busca de endereco do MaxList para a formalizacao do acordo

**Status: Implementado**

### Mudanças realizadas

1. **`src/services/addressEnrichmentService.ts`** (novo) - Serviço reutilizável com `enrichClientAddress(cpf, tenantId)` que busca endereço via MaxSystem API e atualiza a tabela `clients`.

2. **`src/pages/MaxListPage.tsx`** - Removida a fase de busca de endereços do `handleSendToCRM`. A importação agora salva apenas dados financeiros.

3. **`src/components/client-detail/AgreementCalculator.tsx`** - Ao clicar "Gerar Acordo", o sistema busca o endereço automaticamente antes de criar o acordo, com indicador de progresso.
