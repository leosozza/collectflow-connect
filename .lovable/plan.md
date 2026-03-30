

# Plano: Corrigir contagem de clientes no disparo WhatsApp

## Problema

Na Carteira, cada "cliente" visual pode ter múltiplas linhas na tabela `clients` (uma por parcela/dívida com o mesmo CPF). Ao selecionar 3 clientes, o sistema seleciona todas as linhas associadas (ex: 14 parcelas), e o modal exibe "14 clientes selecionados" em vez de "3 clientes selecionados".

O disparo deve ser **1 mensagem por pessoa**, não por parcela.

## Mudança

**Arquivo**: `src/pages/CarteiraPage.tsx`

Deduplicar `selectedClients` por CPF antes de passar ao `WhatsAppBulkDialog`:

```typescript
const selectedClients = clients.filter((c) => selectedIds.has(c.id));

// Dedup por CPF: 1 representante por pessoa
const uniqueSelectedClients = useMemo(() => {
  const cpfMap = new Map<string, Client>();
  for (const c of selectedClients) {
    const cpf = c.cpf.replace(/\D/g, "");
    if (!cpfMap.has(cpf)) cpfMap.set(cpf, c);
  }
  return Array.from(cpfMap.values());
}, [selectedClients]);
```

Passar `uniqueSelectedClients` ao `WhatsAppBulkDialog` em vez de `selectedClients`.

Isso garante que o modal recebe exatamente 3 clientes (1 por CPF), e a deduplicação por telefone no service continua funcionando como segunda camada.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `CarteiraPage.tsx` | Deduplicar `selectedClients` por CPF antes de passar ao WhatsAppBulkDialog |

