

# Plano: Ação "Quebrar Acordo" para Admin na Gestão de Acordos

## Contexto

Hoje os acordos vigentes (`pending`) e vencidos (`overdue`) só podem ser aprovados/rejeitados na aba "Aguardando Liberação". Não existe botão para o admin (ou usuário autorizado) **quebrar** manualmente um acordo vigente/vencido. A quebra manual deve usar `cancellation_type = 'manual'` (já implementado no plano anterior) e funcionar no mesmo padrão visual das ações de aprovação.

## Alterações

### 1. Nova permissão: `acordos.break`

**`src/hooks/usePermissions.ts`**
- Adicionar `"break"` nas actions de `acordos` para `super_admin` e `admin` nos `ROLE_DEFAULTS`
- Expor `canBreakAcordos: has("acordos", "break")` no retorno do hook

### 2. AcordosPage — mostrar botão de quebra nas abas Vigentes e Vencidos

**`src/pages/AcordosPage.tsx`**
- Passar nova prop `onBreak` para `AgreementsList` quando o usuário tem permissão `canBreakAcordos`
- Mostrar ações (coluna Ações) nas abas `vigentes` e `overdue` para quem tem permissão de quebra
- Handler `handleBreak` chama `cancelAgreement(id)` (que já grava `cancellation_type = 'manual'`)

### 3. AgreementsList — botão "Quebrar Acordo"

**`src/components/acordos/AgreementsList.tsx`**
- Nova prop `onBreak?: (id: string) => void`
- Exibir botão com ícone de quebra (ex: `Ban` do lucide) nos acordos `pending` e `overdue` quando `onBreak` está definido
- Ao clicar, abrir AlertDialog de confirmação com texto "Quebrar Acordo — parcelas pendentes serão marcadas como Quebra de Acordo"
- Ajustar lógica de `hasActions` para considerar também `onBreak`

### 4. Permissão configurável na UI

O admin já pode configurar permissões granulares por módulo na tela de Usuários. A action `break` ficará disponível automaticamente no módulo `acordos`, permitindo que o admin conceda essa permissão a qualquer usuário.

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/hooks/usePermissions.ts` | Adicionar `break` nos defaults de admin/super_admin + expor `canBreakAcordos` |
| `src/pages/AcordosPage.tsx` | Handler `handleBreak` + passar prop `onBreak` + expandir abas com ações |
| `src/components/acordos/AgreementsList.tsx` | Botão "Quebrar" + AlertDialog de confirmação |

Nenhuma alteração em banco. Usa `cancelAgreement` existente (que já grava `cancellation_type = 'manual'`).

