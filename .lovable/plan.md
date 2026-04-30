## Pendentes — janela de 3 dias de atraso

### Regra (sua definição)
"Pendentes" deve conter apenas parcelas que:
- **Ainda não venceram**, ou
- **Venceram há no máximo 3 dias**

Parcelas com mais de 3 dias de atraso **saem** de Pendentes.

### Mudança técnica
Migration que substitui `get_dashboard_stats` alterando **apenas o bloco de Pendentes do mês corrente**:

**Antes**
```
due_date BETWEEN month_start AND month_end
```

**Depois**
```
due_date BETWEEN GREATEST(month_start, CURRENT_DATE - 3) AND month_end
```

Aplicado tanto para entrada quanto para parcelas 1..N.

### O que NÃO muda
- **Quebra**: lógica per-installment com `due_date <= updated_at` (igual)
- **Recebido / Negociado / Projetado / contagens**: idênticos
- **Pendente do mês anterior** (usado para variação +/-%): mantém mês inteiro — é snapshot histórico, não faz sentido aplicar janela móvel a um mês passado

### Efeito esperado
Hoje (30/abr): cutoff = 27/abr. Parcelas vencidas entre 01/abr e 26/abr saem de Pendentes. Parcelas que vencem 27/abr → 30/abr permanecem. O valor atual (R$ 62.877,62) deve cair de forma significativa.

### Arquivo
- `supabase/migrations/<timestamp>_dashboard_pendente_3day_window.sql`
