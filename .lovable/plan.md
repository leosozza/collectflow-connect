

## Plano — Simplificar card "Cliente Vinculado"

### Mudança
Em `src/components/contact-center/whatsapp/ContactSidebar.tsx`, dentro do `<CardContent>` do card "Cliente Vinculado", remover:
- Badge **Status** (Pago/Pendente/Quebrado)
- Linha **Parcela X/Y · R$ valor**

Manter, na ordem:
1. Nome
2. CPF
3. Credor
4. Saldo Devedor (R$ em vermelho)
5. Status Cliente (badge colorido vindo de `statusCobranca` — mesmo do perfil)
6. Botões "Abrir Perfil do Cliente" e "Formalizar Acordo" (inalterados)

### Detalhes
- Remover o bloco `<div className="flex items-center gap-2 flex-wrap pt-0.5">` que contém os dois badges, e substituir por um bloco mais simples só com o badge "Status Cliente".
- Remover o `<div>` "Parcela X/Y · R$ ...".
- Se `statusCobranca` for null (cliente sem status calculado), não renderizar nada nessa linha.

### Arquivo
- `src/components/contact-center/whatsapp/ContactSidebar.tsx` — remover ~10 linhas no `CardContent`.

### Sem alteração
Lógica de fetch, cálculo de Saldo Devedor, demais cards (Perfil do Devedor, Tabulação, AI Summary), schema, RLS.

