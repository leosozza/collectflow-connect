# Recalibração do Score Operacional

Ajustes solicitados na edge function `calculate-propensity` (motor único do score).

## 1. Perfil "Resistente": -25 → -10

Na **Dimensão 4 (Perfil do Devedor)**, a penalidade do perfil `resistente` cai de **-25 para -10**, alinhando-se ao perfil `insatisfeito`.

| Perfil | Antes | Depois |
|---|---|---|
| ocasional | +20 | +20 |
| recorrente | +5 | +5 |
| insatisfeito | -10 | -10 |
| **resistente** | **-25** | **-10** |

## 2. Remover Dimensão "Tempo de Atraso"

A **Dimensão 5** deixa de existir. Nenhum cliente recebe mais pontos (positivos ou negativos) com base em `data_vencimento`.

- Remover bloco `delayScore` (linhas 163-173).
- Remover `delayScore` da soma `rawScore`.
- Remover a razão "Atraso prolongado" do `score_reason`.

**Impacto esperado:** carteiras antigas (>180d) deixam de ser penalizadas em -20, o que deve elevar muitos CPFs hoje classificados como "Ruim" para faixas melhores.

## 3. WhatsApp enviado sem resposta: -5

Nova lógica na **Dimensão 2 (Engajamento)**: se o cliente recebeu mensagens WhatsApp (`whatsapp_outbound` ou `message_sent` de canal whatsapp) e **não respondeu nenhuma** (`whatsapp_inbound = 0`), aplica-se **-5 pontos**.

- Penalidade aplicada **uma única vez**, não por mensagem (evita acumular -50 por campanhas).
- Só penaliza se houver pelo menos 1 envio WhatsApp registrado.
- Adicionar razão "WhatsApp sem resposta" no `score_reason` quando aplicável.

## Faixas Finais (continuam iguais)

| Faixa | Score | Significado |
|---|---|---|
| Bom | 75-100 | Alta propensão |
| Médio | 50-74 | Propensão média |
| Ruim | 1-49 | Baixa propensão |
| Zero | 0 | Sem sinais positivos |

Novo intervalo teórico do `rawScore`:
```text
Mín: 0 (contato) + -5 (wpp s/ resposta) + -20 (quebra acordo) + -10 (resistente) = -35  → clamp 0
Máx: 30 + 30 + 25 + 20 = 105 → clamp 100
```

## Recálculo da Base

Após o deploy, executar **recálculo em massa** de todos os CPFs com eventos para que a nova distribuição reflita os ajustes (a função `calculate-propensity` já suporta processamento em lote da base inteira do tenant).

## Arquivos Alterados

- `supabase/functions/calculate-propensity/index.ts` — único arquivo modificado.
- Sem mudanças de schema, sem migrations.
- Frontend (PropensityBadge, filtros) **não muda**: faixas e campo `propensity_score` permanecem.

## Validação Pós-Deploy

1. Rodar o recálculo da base.
2. Validar nova contagem de CPFs por faixa (Bom / Médio / Ruim / Zero).
3. Conferir alguns CPFs específicos para auditar `score_reason`.
