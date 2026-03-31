

# Plano: Perfil de Devedor, Score Inteligente e Melhorias Operacionais

## Resumo

Reestruturar o sistema de perfil de devedor com 4 perfis fixos, redesenhar o score operacional com novo modelo de 5 dimensões, adicionar filtros de score na carteira, converter filtros para multiselect, melhorar busca global e preparar classificação automática.

## Escopo dividido em 8 blocos

### Bloco 1 — Perfis fixos de devedor (migração + UI)

**Migração SQL:**
- Criar enum `debtor_profile_type` com valores: `ocasional`, `recorrente`, `resistente`, `insatisfeito`
- Adicionar coluna `debtor_profile` (tipo enum, nullable) na tabela `clients`
- Backfill: mapear tipos existentes da `tipos_devedor` para os novos valores onde possível
- A tabela `tipos_devedor` continua existindo mas deixa de ser usada nos filtros (backward compat)

**UI `TipoDevedorList.tsx`:**
- Substituir CRUD dinâmico por lista fixa de 4 perfis (read-only)
- Adicionar tooltip com descrição ao hover:
  - Ocasional: "Atrasou, mas paga"
  - Recorrente: "Sempre atrasa"  
  - Resistente: "Não quer pagar"
  - Insatisfeito: "Não paga por insatisfação"

### Bloco 2 — Novo modelo de Score (Edge Function)

Reescrever `calculate-propensity/index.ts` com 5 dimensões aditivas (0-100):

| Dimensão | Range | Lógica |
|---|---|---|
| Contato | 0 a +30 | Recência do último contato (7d=30, 8-30d=20, >30d=10, sem=0) |
| Engajamento | 0 a +25 | Frequência de resposta (frequente=25, pouco=10, nada=0) |
| Histórico pgto | -20 a +25 | Pagou acordos=+25, parcial=+10, nunca=0, quebrou=-20 |
| Perfil devedor | -25 a +20 | Ocasional=+20, Recorrente=+5, Resistente=-25, Insatisfeito=-10 |
| Tempo atraso | -20 a +10 | <30d=+10, 30-90d=0, 90-180d=-10, >180d=-20 |

Score final = soma das dimensões, clamp 0-100.

Classificação: 75-100 = bom, 50-74 = médio, <50 = ruim.

O perfil do devedor será lido diretamente da coluna `debtor_profile` do cliente.

### Bloco 3 — PropensityBadge atualizado

Atualizar thresholds no `PropensityBadge.tsx`:
- >= 75: verde "Bom"
- 50-74: amarelo "Médio"  
- < 50: vermelho "Ruim"

### Bloco 4 — Filtros de Score na Carteira

**`ClientFilters.tsx`:**
- Adicionar filtro "Faixa de Score" com MultiSelect: "Bom (75-100)", "Médio (50-74)", "Ruim (<50)"

**`CarteiraPage.tsx`:**
- Adicionar URL state `scoreRange`
- Aplicar filtro client-side (propensity_score já vem nos dados)

**`clientService.ts`:**
- Não precisa mudar query (score já está nos clients)

### Bloco 5 — MultiSelect para Perfil Devedor e Tipo Dívida

**`ClientFilters.tsx`:**
- Converter "Perfil do Devedor" de Select para MultiSelect (igual Status de Carteira)
- Converter "Tipo de Dívida" de Select para MultiSelect

**`clientService.ts`:**
- Ajustar filtro `tipoDevedorId` e `tipoDividaId` para suportar lista separada por vírgula (`.in()` em vez de `.eq()`)

### Bloco 6 — Busca Global melhorada

**`ClientFilters.tsx`:**
- Placeholder: "Buscar por nome, CPF, telefone ou e-mail..."

**`clientService.ts`:**
- A busca já pesquisa nome, CPF, phone, phone2, phone3, email
- Garantir normalização: se input é numérico, buscar sem máscara no CPF e telefones
- Já está implementado (linhas 83-95) — apenas ajustar placeholder

### Bloco 7 — Classificação automática de perfil

**Edge Function `calculate-propensity`:**
- Após calcular score, gerar `suggested_profile`:
  - Ocasional: pagou acordos + atraso < 90 dias
  - Recorrente: atrasos frequentes (>2 eventos overdue)
  - Resistente: nunca pagou + não responde + score < 50
  - Insatisfeito: possui eventos de reclamação

- Salvar `suggested_profile` no client (nova coluna)
- Operador pode alterar manualmente (registra em `client_events`)

### Bloco 8 — Priorização automática (metadados)

Já existe `suggested_queue` no score. Ajustar lógica:
- Score 75-100: queue `priority_high` (oferta direta)
- Score 50-74: queue `priority_medium` (negociação guiada)
- Score < 50: queue `priority_low` (cobrança firme)

Esses metadados ficam nos clients para uso futuro pelo discador e WhatsApp.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migração SQL | Enum `debtor_profile_type`, coluna `debtor_profile` e `suggested_profile` em clients |
| `TipoDevedorList.tsx` | Lista fixa com tooltips (read-only) |
| `calculate-propensity/index.ts` | Novo modelo de 5 dimensões + sugestão de perfil |
| `PropensityBadge.tsx` | Novos thresholds (75/50) |
| `ClientFilters.tsx` | MultiSelect para perfil/dívida, filtro score, placeholder busca |
| `CarteiraPage.tsx` | URL state para scoreRange, passar filtros |
| `clientService.ts` | Suportar multi-value para tipoDevedor/tipoDivida com `.in()` |

## O que NÃO muda
- Layout geral da carteira
- Nenhuma tela nova criada
- Arquitetura existente preservada
- Contact Center, chat, atendimento — intactos
- Fluxos e automação — intactos

