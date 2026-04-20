

## Plano

Reorganizar o canto direito do header em `ClientDetailHeader.tsx` para eliminar o espaço vazio abaixo do botão Formalizar Acordo.

### Layout proposto
```
[WA] [Atend] [Formalizar Acordo]
                      EM ABERTO
                      R$ 1.789,20
```

- **Botão "Formalizar Acordo"** sobe para a linha dos botões WhatsApp/Atendimento (lado direito, colado no Atendimento).
- **Card "Em Aberto"** fica logo abaixo do botão Formalizar, alinhado à direita, ocupando a mesma largura visual — preenchendo o espaço que hoje está vazio.
- Remove a borda lateral / `border-l` do card atual; o agrupamento vira vertical (`flex-col items-end`) à direita.

### Mudança em `ClientDetailHeader.tsx`
Substituir o cluster atual `[WA] [Atend] | [Em Aberto card] [Formalizar]` por:

```tsx
<div className="flex flex-col items-end gap-2">
  <div className="flex items-center gap-2">
    <Button>WhatsApp</Button>
    <Button>Atendimento</Button>
    <Button onClick={onFormalizarAcordo} className="bg-primary">
      <FileText className="w-4 h-4" /> Formalizar Acordo
    </Button>
  </div>
  <div className="flex flex-col items-end leading-tight">
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Em Aberto</span>
    <span className="text-2xl font-bold text-destructive">{formatCurrency(totalAberto)}</span>
  </div>
</div>
```

### Arquivo afetado
| Arquivo | Mudança |
|---|---|
| `src/components/client-detail/ClientDetailHeader.tsx` | Reagrupa botões + card "Em Aberto" em coluna vertical à direita; Formalizar Acordo ao lado do Atendimento; saldo abaixo |

