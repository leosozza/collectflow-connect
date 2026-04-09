

# Ajustes na aba MaxList — Progresso e Campo CPF

## Alterações

### 1. Barra de progresso — formatar para 2 casas decimais (0.00% – 100.00%)

**Arquivo**: `src/pages/MaxListPage.tsx`, linha 989

Trocar:
```typescript
<span className="font-medium">{Math.min(importProgress, 100)}%</span>
```
Por:
```typescript
<span className="font-medium">{Math.min(importProgress, 100).toFixed(2)}%</span>
```

### 2. Campo de filtro CPF — renomear e adicionar placeholder explicativo

**Arquivo**: `src/pages/MaxListPage.tsx`, linhas 876-880

Trocar:
```typescript
<Label className="font-semibold">CPF/CNPJ</Label>
<Input
  placeholder="Digite o CPF ou CNPJ"
```
Por:
```typescript
<Label className="font-semibold">CPF</Label>
<Input
  placeholder="000.000.000-00"
```

Duas mudanças pontuais, sem impacto em lógica ou outros componentes.

