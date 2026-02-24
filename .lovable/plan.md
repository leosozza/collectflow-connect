

## Plano: Limpar dados residuais para lançamento oficial

### Problema

O sistema está quase zerado (0 clientes, 0 dispositions, 0 achievements), mas ainda há dados residuais de testes que fazem "RAUL JOSE SEIXAS JUNIOR" aparecer no ranking da gamificação.

### Dados residuais encontrados

| Tabela | Registros | Conteúdo |
|---|---|---|
| `operator_points` | 1 | Raul com 0 pontos (fev/2026) |
| `agreements` | 1 | Acordo cancelado (GIOVANNA) |
| `negociarie_cobrancas` | 1 | Cobrança de teste |
| `gamification_campaigns` | 1 | Campanha de teste |
| `clients` | 0 | Já limpo |
| `achievements` | 0 | Já limpo |
| `call_dispositions` | 0 | Já limpo |
| `operator_goals` | 0 | Já limpo |

### Ações

1. **Limpar `operator_points`** -- remove o registro de Raul que causa ele aparecer no ranking
2. **Limpar `agreements`** -- remove o acordo cancelado de teste
3. **Limpar `negociarie_cobrancas`** -- remove cobrança de teste
4. **Limpar `gamification_campaigns`** -- remove campanha de teste (opcional, manter se quiser)

Após a limpeza, a gamificação ficará completamente zerada -- sem ranking, sem pontos, sem conquistas. Quando a carteira real for importada e os operadores começarem a atuar, os dados serão gerados organicamente.

### Detalhes técnicos

Serão executados DELETEs nas tabelas `operator_points`, `agreements`, e `negociarie_cobrancas` para zerar completamente o sistema. Nenhuma alteração de código é necessária -- apenas limpeza de dados.

