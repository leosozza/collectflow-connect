

## Plano: Ajustar badges e status na tabela de Acordos

### Alteracoes

#### 1. `src/pages/AcordosPage.tsx` — Badges
- Reordenar: Pagos, Vigentes, Vencidos, Aguardando Liberacao, Cancelados
- Remover "Pendente" separado — unificar com "Vigentes" (pending + approved)
- Remover contagem numerica dos badges
- Remover borda/contorno — aplicar cor de fundo direto em todos (ativo ou nao), com destaque (ring/shadow) apenas no selecionado
- Texto em negrito sempre

#### 2. `src/components/acordos/AgreementsList.tsx` — Coluna Status
- Trocar os labels de status para refletir o status real do acordo:
  - `pending` → "Vigente" (laranja)
  - `approved` → "Pago" (verde) — nao "Aprovado"
  - `pending_approval` → "Aguardando Liberação" (azul)
  - `overdue` → "Vencido" (amber)
  - `cancelled` → "Cancelado" (vermelho)

### Arquivos

| Arquivo | Alteracao |
|---|---|
| `src/pages/AcordosPage.tsx` | Reordenar badges, remover contagens, estilo direto sem borda |
| `src/components/acordos/AgreementsList.tsx` | Renomear labels de status (approved→Pago, pending→Vigente) |

