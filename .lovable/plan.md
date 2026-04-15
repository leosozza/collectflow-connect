

# Adicionar botão para cancelar/reverter baixa pendente e verificar $ azul

## Diagnóstico

Analisei os dados do cliente no screenshot (CPF 41582350817): a parcela 1 tem um pagamento manual com status `pending_confirmation` (Aguardando), **não** `confirmed`. O ícone $ azul só aparece para parcelas já **confirmadas** (status "pago").

O que falta:
1. **Parcelas "Aguardando"** — não há botão para cancelar a solicitação de baixa pendente (voltar ao status original)
2. **Parcelas "Pago" (confirmadas)** — o $ azul para desconfirmar já existe no código, mas só aparece em parcelas com manual_payment confirmado

## Solução

### Arquivo: `src/components/client-detail/AgreementInstallments.tsx`

**1. Adicionar botão para cancelar baixa pendente (status "Aguardando")**

Para parcelas com `status === "pending_confirmation"`, exibir um ícone $ em **vermelho/laranja** (ou X) que permite ao operador cancelar a solicitação de baixa, deletando o registro `manual_payments` pendente e voltando a parcela ao status anterior ("Em Aberto" ou "Vencido").

```tsx
// Após a seção do $ verde (baixar manualmente), adicionar:
{inst.status === "pending_confirmation" && inst.pendingManual && (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="sm"
        className="h-7 w-7 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-500/10"
        onClick={() => handleCancelPendingPayment(inst)}
      >
        <DollarSign className="w-4 h-4" /> {/* com X ou estilo diferenciado */}
      </Button>
    </TooltipTrigger>
    <TooltipContent><p>Cancelar Solicitação de Baixa</p></TooltipContent>
  </Tooltip>
)}
```

**2. Função `handleCancelPendingPayment`**

Deleta o registro `manual_payments` com `status = "pending_confirmation"` para aquela parcela:
```tsx
const handleCancelPendingPayment = async (inst) => {
  await supabase.from("manual_payments")
    .delete()
    .eq("id", inst.pendingManual.id);
  // invalidar queries e toast
};
```

**3. Manter $ azul para parcelas confirmadas (já implementado)**

O $ azul para desconfirmar já funciona — aparece apenas quando a parcela tem um `manual_payment` com status `confirmed`. Sem alteração necessária.

## Resultado
- **Aguardando** → botão laranja $ para cancelar a solicitação pendente
- **Pago (manual confirmado)** → botão azul $ para desconfirmar (já existe)
- **Em Aberto / Vencido** → botão verde $ para solicitar baixa (já existe)
