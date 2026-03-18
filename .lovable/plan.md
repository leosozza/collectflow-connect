

# Correção: contagem de clientes no DialerExportDialog

## Problema

O botão "Discador" mostra 520 (CPFs únicos), mas o dialog mostra 3077 (`selectedClients.length`), pois `selectedClients` contém múltiplas linhas por CPF. O dialog já faz deduplicação por CPF antes de enviar, mas exibe o total bruto.

## Correção

No `DialerExportDialog`, calcular os clientes únicos por CPF logo na renderização e usar essa contagem na exibição:

### Arquivo: `src/components/carteira/DialerExportDialog.tsx`

1. Adicionar `useMemo` para calcular clientes únicos por CPF:
```typescript
const uniqueClients = useMemo(() => {
  const map = new Map<string, Client>();
  selectedClients.forEach((c) => {
    const cpf = c.cpf.replace(/\D/g, "");
    if (!map.has(cpf)) map.set(cpf, c);
  });
  return Array.from(map.values());
}, [selectedClients]);
```

2. Usar `uniqueClients.length` no badge de contagem (em vez de `selectedClients.length`)

3. Usar `uniqueClients` diretamente no `handleSend` em vez de recalcular a deduplicação

