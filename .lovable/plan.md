

# Plano: Ações inline nas parcelas (sem dropdown)

## Objetivo
Substituir o DropdownMenu (3 pontinhos) por ícones de ação inline diretamente na linha da parcela, tornando todas as funcionalidades visíveis sem clique extra.

## Layout proposto por coluna

A coluna "Ações" será expandida e conterá ícones inline com tooltip:

```text
| Parcela | Vencimento       | Valor          | Status | Ações              |
|---------|------------------|----------------|--------|--------------------|
| 1/6     | 23/03/2026 ✏️    | R$ 203,00 ✏️   | Pago   | 📄 💲 🧾          |
```

- **Lápis ao lado da data** (coluna Vencimento): abre o Dialog de edição de data. Só aparece se não pago e não aguardando confirmação.
- **Lápis ao lado do valor** (coluna Valor): ativa edição inline do valor. Só aparece se não pago e não aguardando confirmação.
- **Ícone de boleto** (`Receipt`) na coluna Ações: gerar/reemitir boleto. Só aparece se não pago.
- **Ícone de cifrão** (`HandCoins`) na coluna Ações: baixar manualmente. Só aparece se não pago e não aguardando confirmação.
- **Ícone de download** (`FileDown`): baixar recibo. Só aparece se pago.
- **Ícone de download boleto** (`Download`): baixar/abrir boleto PDF. Só aparece se existe boleto.
- **Ícone copiar** (`Copy`): copiar linha digitável ou PIX. Aparece se disponível.

## Mudanças no componente

**Arquivo**: `src/components/client-detail/AgreementInstallments.tsx`

1. **Remover** o `DropdownMenu` inteiro da coluna Ações
2. **Coluna Vencimento**: adicionar botão `Pencil` (lápis) ao lado da data formatada, que chama `handleOpenDateEdit(inst)`
3. **Coluna Valor**: adicionar botão `Pencil` ao lado do valor formatado, que ativa `setEditingValueIdx(idx)`
4. **Coluna Ações**: expandir largura e renderizar botões `icon-only` com `Tooltip`:
   - `Receipt` → gerar/reemitir boleto
   - `Download` → abrir boleto (se existir)
   - `Copy` → copiar linha digitável/PIX
   - `HandCoins` → baixar manualmente
   - `FileDown` → baixar recibo (se pago)
5. Cada botão usa `variant="ghost" size="sm"` com classes `h-7 w-7 p-0`
6. Usar `Tooltip` do shadcn para mostrar o nome da ação no hover
7. Remover imports não mais necessários (`MoreHorizontal`, `DropdownMenu*`)

## Resultado esperado
- Todas as ações ficam visíveis e acessíveis com um único clique
- Lápis contextual ao lado de data e valor
- Ícones semânticos para cada ação
- Sem dropdown — operação mais rápida para o operador

