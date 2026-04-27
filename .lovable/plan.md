## Objetivo

Deixar a tela **Regras de Pontuação** (`/gamificacao?tab=manage`) mais autoexplicativa. Hoje:

- O nome da **Métrica** é editável, mas não deveria ser — são métricas fixas do sistema.
- Os rótulos **Pontos** e **Por unidade** são genéricos e juntos ficam confusos (ex.: "5 pontos / por faixa de 100").

## Mudanças propostas

### 1. Bloquear edição da Métrica
- O campo "Métrica" deixa de ser um `Input` editável e passa a ser apresentado como **texto fixo** (label + ícone de info com tooltip explicativo). 
- O usuário continua vendo o nome amigável (ex.: "Pagamento confirmado", "Cada R$ 100 recebidos"), mas não pode alterá-lo.
- Remove `label` do payload de `updateScoringRule` e do estado de "dirty".

### 2. Renomear e contextualizar os campos numéricos
Trocar a dupla **Pontos / Por unidade** por uma frase legível, montada dinamicamente por métrica, com 1 ou 2 inputs conforme o caso:

| Métrica | Layout proposto |
|---|---|
| Pagamento confirmado | `[ 10 ] pontos por pagamento confirmado` |
| Cada R$ X recebidos | `[ 5 ] pontos a cada R$ [ 100 ] recebidos` |
| Acordo formalizado | `[ 0 ] pontos por acordo formalizado` |
| Acordo totalmente quitado | `[ 30 ] pontos por acordo quitado` |
| Quebra de acordo | `[ -3 ] pontos por quebra de acordo` (aviso: use negativo para penalizar) |
| Conquista desbloqueada | `[ 50 ] pontos por conquista desbloqueada` |
| Meta do mês atingida | `[ 100 ] pontos (bônus único ao bater a meta do mês)` |

Ou seja:
- **Pontos** vira sempre o número multiplicador.
- **Por unidade** só aparece quando faz sentido (apenas em `total_received`, como "a cada R$ X").
- Em todas as outras métricas o `unit_size` fica oculto e travado em `1`.

### 3. Melhorar o cabeçalho explicativo
Substituir o texto atual por algo mais direto:

> **Regras de Pontuação**  
> Defina quantos pontos cada ação do operador vale neste mês. As métricas são fixas do sistema — você só configura o valor em pontos e ativa/desativa cada uma.  
> Os pontos acumulados no mês são convertidos em **Rivo Coins (1:1)** no primeiro dia do mês seguinte.  
> Alterações valem para cálculos futuros — use **Recalcular mês atual** para reaplicar agora.

### 4. Ajustes finos de UX
- Tooltip da métrica passa a ter título em negrito + descrição (hoje só descrição).
- Botão "Salvar" só fica ativo quando `points`, `unit_size` ou `enabled` mudam.
- Mostrar abaixo de cada card uma pré-visualização: *"Exemplo: um pagamento de R$ 250 vale 12 pontos"* nas regras onde aplicável (apenas `total_received`).

## Arquivos afetados

- `src/components/gamificacao/ScoringRulesTab.tsx` — refazer layout dos cards, remover input de label, montar frase por métrica.
- `src/services/scoringRulesService.ts` — `updateScoringRule` deixa de aceitar `label`; `restoreDefaultScoringRules` não precisa reescrever label (mantém o do banco como está).

## Não faz parte

- Não altera schema do banco (`gamification_scoring_rules` continua igual).
- Não muda a lógica de cálculo nem a conversão mensal para Rivo Coins.
