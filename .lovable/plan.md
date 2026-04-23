

## Análise: as falhas são realmente sem WhatsApp?

### Resumo da campanha "Disparo carteira 09:33"
- Status: **Concluída** (200 selecionados, 199 únicos, 145 sent, 137 delivered, 5 read, **54 falhas**)
- Provider: Evolution (não-oficial)

### Categorização real das 54 falhas

Analisando os `error_message` retornados:

| Categoria | Qtd aprox. | Causa real | Tem WhatsApp? |
|---|---|---|---|
| **HTTP 500 — `Connection Closed`** | ~20 | **Instância caiu durante envio** (problema do nosso lado) | **Provavelmente SIM** — não foi sequer testado |
| **HTTP 400 — `exists:false` com JID sem "9"** (ex: enviado `5544991119945` → checado `554491119945`) | ~25 | Evolution removeu o nono dígito para checar formato antigo de 8 dígitos. Não confirma o número de 9 dígitos. | **Possivelmente SIM** — checagem é heurística e falha em muitos números reais |
| **HTTP 400 — `exists:false` com JID idêntico ao enviado** | ~9 | Evolution checou o número exato e não achou conta | **Provavelmente NÃO** |

**Conclusão importante**: das 54 falhas, **só ~9 são realmente "sem WhatsApp" com alta confiança**. As outras ~45 merecem retentativa.

### Problemas que isso revela

1. **Marcamos `phone_has_whatsapp=false` cedo demais** — a migração que acabamos de aplicar está classificando como "sem WhatsApp" todos os `exists:false`, inclusive os falsos negativos do Evolution e os erros 500. Isso vai fazer com que números válidos sejam **excluídos permanentemente** das próximas campanhas.

2. **Não há retry automático** para falhas transitórias (`Connection Closed`).

3. **Forçar envio "mesmo assim" é viável no Evolution** — basta usar a opção `options.checkExists: false` (ou enviar direto sem pré-check). Hoje o Evolution faz pre-check obrigatório que rejeita esses casos.

### Plano (3 ajustes)

**1. Reverter a marcação agressiva de `phone_has_whatsapp=false`**

No worker `supabase/functions/send-bulk-whatsapp/index.ts`, mudar a regra: só marcar `phone_has_whatsapp=false` quando o JID retornado for **idêntico** ao enviado E for HTTP 400 com `exists:false`. Não marcar quando:
- HTTP 500 / Connection Closed (erro de instância)
- JID retornado difere do enviado (Evolution mudou o número para checar formato legado — falso negativo)

Adicionalmente: zerar o flag para todos os CPFs que foram marcados nesta primeira campanha (rodar UPDATE one-shot via migration revertendo `phone_has_whatsapp` para `true` nos profiles afetados).

**2. Forçar envio sem pré-checagem no Evolution**

No `supabase/functions/_shared/whatsapp-sender.ts`, função `sendEvolutionText`, adicionar no payload:
```ts
options: { checkExists: false }
```
Assim o Evolution **tenta entregar mesmo se não confirmar a existência prévia**. O WhatsApp vai aceitar ou recusar de fato, e teremos uma resposta mais confiável.

**3. Botão "Reenviar falhas" na aba Resumo da campanha**

Em `src/components/contact-center/whatsapp/campaigns/CampaignSummaryTab.tsx`, adicionar botão **"Tentar reenviar falhas (X)"** que:
- Filtra recipients com status=`failed` da campanha
- Reseta status para `queued`
- Reinvoca o worker `send-bulk-whatsapp` para reprocessar apenas esses
- Mostra toast com resultado

### Validação

1. Após (1) e (2): rodar nova campanha pequena (10-20 destinatários conhecidos) e confirmar que o pre-check não bloqueia mais.
2. Usar o botão "Reenviar falhas" na campanha 09:33 e medir quantos dos 54 falhos efetivamente entregam — expectativa: 30-45 entregas reais.
3. Verificar que `phone_has_whatsapp=false` permanece **apenas** para os ~9 casos com JID idêntico confirmado.

