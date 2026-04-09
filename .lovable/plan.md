

# Corrigir Aging na Prestação de Contas

## Problema

O aging agrupa por CPF e usa `valor_pago` da tabela `clients` (carteira original), que pode estar zerado ou desatualizado. O valor **recebido real** está nos agreements (`total_paid_real`). Resultado: aging mostra R$ 0 em "Recebido" mesmo para clientes pagos.

Além disso, a contagem e classificação estão corretas em lógica, mas precisam usar dados dos agreements para "Recebido".

## Solução

### Arquivo: `src/components/relatorios/PrestacaoContas.tsx`

Refatorar o `agingData` memo para:

1. **Manter a base nos `credorClients`** (parcelas originais de clientes com acordo) para determinar a data mais antiga e o saldo aberto
2. **Cruzar com `credorAgreements`** para obter o `total_paid_real` por CPF — esse é o valor realmente recebido
3. Cada CPF fica com:
   - `earliest`: data de vencimento mais antiga da carteira (classifica no bucket)
   - `totalSaldo`: soma dos saldos abertos das parcelas originais
   - `totalRecebido`: soma de `total_paid_real` dos agreements daquele CPF

### Mudança concreta no código

```typescript
const agingData = useMemo(() => {
  // Mapa de recebido real por CPF (vindo dos agreements)
  const recebidoPorCpf = new Map<string, number>();
  credorAgreements.forEach((a: any) => {
    const cpf = normalizeCPF(a.client_cpf);
    recebidoPorCpf.set(cpf, (recebidoPorCpf.get(cpf) || 0) + Number(a.total_paid_real || 0));
  });

  // Agrupar parcelas originais por CPF
  const cpfMap = new Map<string, { earliest: Date; totalSaldo: number }>();
  credorClients.forEach((c) => {
    const cpf = normalizeCPF(c.cpf);
    const vencimento = parseISO(c.data_vencimento);
    const saldo = Math.max(Number(c.valor_parcela) - Number(c.valor_pago), 0);
    const existing = cpfMap.get(cpf);
    if (existing) {
      if (vencimento < existing.earliest) existing.earliest = vencimento;
      existing.totalSaldo += saldo;
    } else {
      cpfMap.set(cpf, { earliest: vencimento, totalSaldo: saldo });
    }
  });

  // Classificar por faixa usando data mais antiga + recebido real dos agreements
  return AGING_BUCKETS.map((b) => {
    let count = 0, totalAberto = 0, totalRecebido = 0;
    cpfMap.forEach(({ earliest, totalSaldo }, cpf) => {
      const dias = differenceInDays(today, earliest);
      if (dias < b.min || dias > b.max) return;
      count++;
      totalAberto += totalSaldo;
      totalRecebido += recebidoPorCpf.get(cpf) || 0;
    });
    return { ...b, count, total: totalAberto, received: totalRecebido };
  });
}, [credorClients, credorAgreements]);
```

### O que muda para o credor

- **Count**: quantidade de devedores (CPFs únicos) por faixa de aging
- **Saldo Aberto**: soma das parcelas originais em aberto
- **Recebido**: valor real pago via agreements (não mais da carteira)
- **Classificação**: pela data da parcela original mais antiga — mostra há quanto tempo o cliente devia

### O que NÃO muda

- KPIs superiores (usam `summary` dos agreements)
- Contadores de clientes (negociados/recebidos/quebrados)
- Parcelas detalhadas
- Acordos resumo
- Nenhum status, fluxo ou automação alterado

