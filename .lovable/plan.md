
Substituir o bloco da Linha 2 (atual: duas sublinhas com pipes) por um **grid horizontal de 5 blocos label/valor** estilo CRM moderno. Linha 1 (nome + ações) e o colapsável "Mais informações do devedor" ficam intactos.

### Alteração única: `src/components/client-detail/ClientDetailHeader.tsx` (linhas 462–476)

Trocar o bloco de metadados por um grid responsivo com divisores verticais sutis:

```tsx
{/* Linha 2: Grid de informações (estilo CRM) */}
<div className="ml-11 mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 lg:divide-x divide-border rounded-lg bg-muted/30 border border-border/60 overflow-hidden">
  {/* CPF */}
  <div className="px-4 py-2 min-w-0">
    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">CPF</p>
    <p className="text-[15px] font-semibold text-foreground truncate mt-0.5">{formattedCpf}</p>
  </div>
  {/* Telefone */}
  <div className="px-4 py-2 min-w-0">
    <p className="text-[11px] ...">Telefone</p>
    <p className="text-[15px] font-semibold ... truncate mt-0.5">
      {client.phone ? formatPhone(client.phone) : "—"}
    </p>
  </div>
  {/* Email */}
  <div className="px-4 py-2 min-w-0">
    <p className="text-[11px] ...">Email</p>
    <p className="text-[15px] font-semibold ... truncate mt-0.5" title={client.email || ""}>
      {client.email || "—"}
    </p>
  </div>
  {/* Credor */}
  <div className="px-4 py-2 min-w-0">
    <p className="text-[11px] ...">Credor</p>
    <p className="text-[15px] font-semibold ... truncate mt-0.5" title={client.credor}>
      {client.credor}
    </p>
  </div>
  {/* Em Aberto — destaque */}
  <div className="px-4 py-2 min-w-0 bg-destructive/5">
    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Em Aberto</p>
    <p className="text-[17px] font-bold text-destructive truncate mt-0.5">
      {formatCurrency(totalAberto)}
    </p>
  </div>
</div>
```

### Detalhes
- **Responsivo**: `grid-cols-1` (mobile) → `sm:grid-cols-2` (tablet) → `lg:grid-cols-5` (desktop ≥1024px).
- **Divisórias**: `lg:divide-x divide-border` (apenas no desktop, evita linhas estranhas no wrap).
- **Container**: leve fundo `bg-muted/30` + borda sutil para dar a aparência "card dentro do card" típica de CRMs modernos.
- **Labels**: 11px, uppercase, tracking-wider, `text-muted-foreground`.
- **Valores**: 15px semibold; **Em Aberto** 17px bold em `text-destructive` com fundo `bg-destructive/5` para destaque.
- **Truncate + title**: Email e Credor longos ganham ellipsis com tooltip nativo.
- **Espaçamento**: `mt-0.5` entre label/valor (compacto), `px-4 py-2` interno (confortável).
- **Não alterado**: Linha 1 (nome, ArrowLeft, WhatsApp, Atendimento, Formalizar Acordo) e Collapsible "Mais informações do devedor".
