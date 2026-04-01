

# Plano: Corrigir barra de progresso do MaxList

## Problema

A barra de progresso fica em 10% e pula direto para 100% porque o frontend faz apenas duas atualizações:
1. `setImportProgress(10)` — antes de chamar a Edge Function
2. `setImportProgress(100)` — quando a resposta chega

Não há progresso intermediário porque a Edge Function é uma chamada única que retorna só quando termina.

## Backend: OK ✅

A importação mais recente funcionou corretamente:
- **3.700 registros** importados (2.041 pendente + 1.659 pago)
- Import log registrado corretamente
- Nenhum erro

## Correção do Frontend

**Arquivo:** `src/pages/MaxListPage.tsx`

Adicionar um **progresso simulado** (fake progress) que avança gradualmente enquanto aguarda a resposta da Edge Function, similar ao padrão usado em uploads grandes:

```typescript
// Iniciar timer que avança de 10% até 90% gradualmente
const interval = setInterval(() => {
  setImportProgress(prev => {
    if (prev >= 90) return prev;
    return prev + Math.random() * 5; // incremento suave
  });
}, 800);

// Ao receber resposta:
clearInterval(interval);
setImportProgress(100);
```

Aplicar em ambos os fluxos:
- `handleImportOrUpdate` (importar/atualizar)
- `handleUpdatePagos` (atualizar pagos)

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/pages/MaxListPage.tsx` | Adicionar fake progress com `setInterval` nos dois fluxos de importação |

