

# Plano: Alinhar Tabulação de Chamada com layout 3CPlus

## Diferenças identificadas

| Aspecto | RIVO atual | 3CPlus referência |
|---|---|---|
| **Cor** | 6 cores nomeadas em Select | Grid de ~50 cores hex como bolinhas clicáveis |
| **Comportamento** | 2 opções (Repetir / Não discar) | 3 opções (Repetir / Não discar telefone / Não discar cliente) |
| **Impacto** | Select dropdown | Radio buttons inline |
| **Flags** | Checkboxes em grid | Switches full-width em cards com bordas |
| **Agendamento** | Checkbox simples | Switch expansível com sub-opções: "Agendar para outro número" + "Limite de dias" |
| **Bloqueio** | Checkbox simples | Switch expansível com sub-opções: "Tempo indeterminado" vs "Dias personalizados" |
| **Seções** | Sem divisão visual | Seções "Dados" e "Ações" com ícone e separador |
| **Grupo** | Existe no RIVO | Não existe no 3CPlus |

## Mudanças propostas

### 1. Migração DB — Novas colunas

Adicionar 4 colunas para suportar sub-opções:
- `schedule_allow_other_number` (boolean, default false)
- `schedule_days_limit` (integer, default 7)
- `blocklist_mode` (text, default 'indeterminate') — valores: 'indeterminate' | 'custom'
- `blocklist_days` (integer, default 0)

### 2. Comportamento — 3 opções

Atualizar `BEHAVIOR_OPTIONS` para incluir a terceira opção:
- "Repetir"
- "Não discar novamente para o telefone"
- "Não discar novamente para o cliente"

### 3. Cor — Grid de bolinhas hex

Substituir o Select de 6 cores por um Popover com grid de ~50 cores (as mesmas hex do 3CPlus). Armazenar o valor hex diretamente no campo `color` em vez de nomes como "blue".

### 4. Impacto — Radio buttons

Trocar o Select por radio buttons inline (Positivo / Negativo).

### 5. Flags — Switches em cards

Trocar checkboxes por Switches full-width dentro de cards com borda, replicando o visual do 3CPlus. Cada flag ocupa uma linha inteira.

### 6. Agendamento e Bloqueio — Expansíveis

Quando `is_schedule` é ativado, expandir para mostrar:
- Toggle "Permitir agendar para outro número"
- Input numérico "Limite de dias para agendar" (default 7)

Quando `is_blocklist` é ativado, expandir para mostrar:
- Radio "Tempo indeterminado"
- Radio "Personalizar dias de bloqueio" + input numérico

### 7. Layout com seções

Dividir o dialog em duas seções com separador:
- **Dados**: Nome, Cor, Impacto, Comportamento
- **Ações**: Conversão, CPC, Desconhece, Callback, Agendamento, Bloqueio

Remover o campo "Grupo" do formulário (manter na tabela se já existir dados, mas não exibir no form).

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| **Migração SQL** | 4 novas colunas |
| `CallDispositionTypesTab.tsx` | Redesign completo do dialog + cor hex grid + radios + switches + seções expansíveis |
| `dispositionService.ts` | Atualizar interface `DbDispositionType` e `DEFAULT_DISPOSITION_LIST` com novos campos |

