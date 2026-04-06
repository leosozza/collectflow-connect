

# Plano: Centralizar calculadora na tela ao abrir

## Problema

A posição inicial é `x: window.innerWidth - 300, y: 120` — canto superior direito. Em telas largas, fica fora da área visível ou exige scroll.

## Correção

**Arquivo**: `src/components/client-detail/SimpleCalculator.tsx`, linha 58

Substituir o cálculo de posição inicial por centralização:

```typescript
setPosition({
  x: Math.max(0, (window.innerWidth - 280) / 2),
  y: Math.max(0, (window.innerHeight - 450) / 2)
});
```

280 = largura do componente, 450 ≈ altura estimada. Resultado: calculadora abre centralizada na viewport.

Nenhuma outra alteração.

