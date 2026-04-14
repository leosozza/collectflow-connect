

# Seletor de Perfil do Devedor (Hover) — Plano

## O que será feito

Criar um componente `DebtorProfileBadge` que exibe o perfil atual como um badge compacto. Ao passar o mouse, um `HoverCard` revela os 4 perfis para seleção. O componente será posicionado **dentro do card de Tabulação** no `ContactSidebar`, como uma seção adicional após "Status".

## Componente: `src/components/shared/DebtorProfileBadge.tsx`

- Badge compacto mostrando perfil atual (ex: "Ocasional" com bolinha verde) ou "Definir perfil" se vazio
- `HoverCard` ao passar o mouse com os 4 perfis clicáveis:
  - Ocasional (verde) — Atrasou, mas paga
  - Recorrente (amarelo) — Sempre atrasa
  - Insatisfeito (laranja) — Reclamações/contestação
  - Resistente (vermelho) — Não quer pagar
- Ao clicar: atualiza `clients.debtor_profile`, insere evento `debtor_profile_changed` em `client_events`, chama `recalcScoreForCpf`
- Props: `clientId`, `clientCpf`, `currentProfile`, `onProfileChanged`

## Integração no ContactSidebar

1. Adicionar `debtor_profile` ao select do `SimpleClient` (linha 57)
2. Renderizar `DebtorProfileBadge` dentro do card de Tabulação (`DispositionSelector`), ou logo abaixo dele, como uma seção "Perfil do Devedor" — visível apenas quando há cliente vinculado
3. Passar callback para atualizar o state local após mudança

## Arquivos

| Ação | Arquivo |
|---|---|
| Criar | `src/components/shared/DebtorProfileBadge.tsx` |
| Editar | `src/components/contact-center/whatsapp/ContactSidebar.tsx` — adicionar `debtor_profile` ao select e renderizar o badge próximo à Tabulação |

Nenhuma alteração de banco de dados necessária — a coluna `debtor_profile` já existe na tabela `clients`.

