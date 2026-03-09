

## Plano: Usar `prazo_dias_acordo` do credor para controlar expiração automática de acordos

### Situação atual
A edge function `auto-expire-agreements` usa valores fixos:
- 1 dia após vencimento → marca como "overdue"
- 5 dias após vencimento → cancela automaticamente

### O que será feito
Alterar a edge function para consultar o `prazo_dias_acordo` de cada credor e usar esse valor:

1. **Se `prazo_dias_acordo` > 0**: Após o acordo ficar "overdue" por X dias (valor do campo), cancela automaticamente
2. **Se `prazo_dias_acordo` = 0 ou NULL**: O acordo fica como "vencido" indefinidamente, sem cancelamento automático

### Alterações

**`supabase/functions/auto-expire-agreements/index.ts`**
- Etapa 1 (marcar overdue): Continua igual — 1 dia após `first_due_date` sem pagamento = overdue
- Etapa 2 (cancelar): Em vez de usar 5 dias fixo, buscar todos os acordos "overdue" com JOIN no credor para obter `prazo_dias_acordo`. Para cada acordo, calcular se `(hoje - first_due_date) >= prazo_dias_acordo`. Se `prazo_dias_acordo` for 0 ou NULL, não cancelar
- Mensagem de notificação: Atualizar para usar o prazo real do credor

### Lógica resumida
```text
Para cada acordo com status "overdue":
  → Buscar credor pelo campo agreements.credor = credores.razao_social (ou nome_fantasia)
  → Se credor.prazo_dias_acordo = NULL ou 0 → NÃO cancelar (fica vencido)
  → Se (hoje - first_due_date em dias) >= prazo_dias_acordo → Cancelar + notificar
```

### Arquivo alterado
- `supabase/functions/auto-expire-agreements/index.ts`

