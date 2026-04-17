

## Plano — Eliminar termos em inglês / técnicos no Histórico

### Pontos crus identificados em `ClientTimeline.tsx`

1. **Fallback de status de acordo** (linha 503): `Acordo ${a.status}` exibe `completed`, `cancelled`, `pending_approval` etc. quando cai no fallback (sem client_events).
2. **Fallback de status de ligação** (linha 515): `Ligação — ${c.status || "realizada"}` exibe valores brutos como `answered`, `no_answer`, `busy`, `failed`.
3. **Detalhe de canal** (linha 461) `Canal: ${meta.channel || "whatsapp"}` exibe em minúsculo / em inglês (`sms`, `email`, `voice`).
4. **Fonte de field_update** (linha 463): se `event_value` não estiver no `SOURCE_LABELS`, mostra a chave crua (ex.: `whatsapp_auto`, `regua`).
5. **Status de pagamento manual** — `event_value` ("confirmed", "rejected", "pix", "boleto") aparece como `detail` nos casos que não foram tratados; verificar e mapear.
6. **Actor "Discador"** (linha 518) — termo já em PT, ok; mas reforçar.
7. **Fallback final genérico** — `EVENT_TYPE_LABELS[eventType] || toTitleCase(eventType)` ainda pode produzir títulos em inglês com Title Case (ex.: "Send Failed", "Channel Switched"). Solução: dicionário expandido + fallback explícito "Evento do Sistema" quando não houver tradução.

### Mudanças (apenas `src/components/atendimento/ClientTimeline.tsx`)

**1. Novo dicionário `AGREEMENT_STATUS_LABELS`**
```ts
{ pending: "Pendente", pending_approval: "Aguardando Aprovação",
  approved: "Aprovado", completed: "Quitado", cancelled: "Cancelado",
  overdue: "Vencido", broken: "Quebrado" }
```
Aplicar no fallback (linha 503).

**2. Novo dicionário `CALL_STATUS_LABELS`**
```ts
{ answered: "Atendida", no_answer: "Não Atendida", busy: "Ocupado",
  failed: "Falhou", completed: "Concluída", abandoned: "Abandonada",
  voicemail: "Caixa Postal" }
```
Aplicar no fallback (linha 515).

**3. Novo dicionário `CHANNEL_LABELS`**
```ts
{ whatsapp: "WhatsApp", sms: "SMS", email: "E-mail", voice: "Voz",
  call: "Ligação", boleto: "Boleto" }
```
Aplicar em `Canal: ...` (linha 461).

**4. Expandir `SOURCE_LABELS`** com todas as chaves possíveis: `whatsapp_auto: "WhatsApp Automático"`, `email_auto: "E-mail Automático"`, `regua: "Régua de Cobrança"`, `prevention: "Régua de Prevenção"`, `negociarie: "Negociarie"`, `portal: "Portal do Devedor"`, `ai: "Agente IA"`, `operator: "Operador"`, `admin: "Administrador"`. Fallback: `toTitleCase`.

**5. Tratar `payment_method` em manual_payment_requested** — adicionar detail traduzido: `pix → "PIX"`, `boleto → "Boleto"`, `dinheiro → "Dinheiro"`, `cartao → "Cartão"`, etc.

**6. Substituir fallback final** (linha 441): em vez de `toTitleCase(eventType)` quando o tipo é totalmente desconhecido, exibir **"Evento do Sistema"** + manter o tipo cru apenas em `title` attribute (tooltip) para depuração. Garante zero inglês visível.

**7. Adicionar ao `EVENT_TYPE_LABELS`** quaisquer eventos que ainda apareçam crus: `send_failed: "Falha no Envio"` (caso vaze), `agreement_broken: "Acordo Quebrado"`.

### Sem alteração
- Schema, RLS, edge functions, services.
- Layout do card, ordenação, paginação "Ver tudo".
- `ResponsibleLabel` (já em PT após ajuste anterior).

### Arquivo
- `src/components/atendimento/ClientTimeline.tsx` — ~30 linhas adicionadas (3 novos dicionários, expansão de SOURCE_LABELS, fallback final humanizado, tradução de payment_method).

