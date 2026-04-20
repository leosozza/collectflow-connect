
## Verificar correção do auto-preenchimento de CEP

Vou validar as 3 telas alteradas, com foco na geração de boleto (que foi a dor original do operador Gustavo).

### O que será verificado

**1. `src/lib/viaCep.ts`** — confirmar que `lookupCepDetailed` existe e retorna `{ ok, data | reason }`.

**2. `src/components/client-detail/InlineEditableField.tsx`** — confirmar:
- Suporte a `type="cep"` com máscara `00000-000`
- `useEffect` que dispara lookup automático ao atingir 8 dígitos (com debounce/cancel)
- Callback `onCepResolved` exposto
- Spinner durante consulta + toast de erro

**3. `src/components/client-detail/ClientDetailHeader.tsx`** — confirmar:
- Campo CEP inline usa `onCepResolved` chamando `updateSingleField` para `endereco`, `bairro`, `cidade`, `uf`
- Diálogo "Editar dados" dispara lookup ao chegar a 8 dígitos (não só no blur)

**4. `src/components/clients/ClientForm.tsx`** — confirmar:
- `bairro` está no `defaultValues` (estado inicial)
- `bairro` está no payload de `handleSubmit`
- Handler do CEP dispara lookup ao chegar a 8 dígitos

**5. Fluxo de boleto (foco da reclamação)** — `CobrancaForm.tsx` já estava OK no plano original; vou reconfirmar que continua funcionando e que os 4 campos (`endereco`, `bairro`, `cidade`, `uf`) entram no payload da Negociarie quando o operador digita o CEP do cliente.

### Entregável

Relatório curto por arquivo: ✅ implementado conforme plano / ⚠️ divergência encontrada (com linha exata) / ❌ não aplicado. Se houver divergência, listo o que precisa ser ajustado. Sem usar browser — leitura de código é suficiente para esta verificação.
