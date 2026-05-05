# Corrigir aparecimento indevido do gate de Perfil + Tabulação no WhatsApp

## Problema confirmado

O componente `WhatsAppGateBanner` é renderizado pela `ChatPanel` sempre que:

```
inboundCount >= 5
&& conversation existe
&& clientInfo.id existe
&& (!hasDisposition || !hasProfile)
```

Arquivos:
- `src/components/contact-center/whatsapp/ChatPanel.tsx` (linhas 232–244 e 580–590)
- `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` (gate defensivo no `handleSend`, linhas 692–701)

Isso faz o banner aparecer para **qualquer** cliente com 5+ mensagens recebidas e sem tabulação — mesmo quando o perfil já está definido (caso da Eliandra do print: perfil "Ocasional" já marcado, mas banner ainda aparece pedindo Tabulação).

A regra correta, segundo a operação:

1. Exigir perfil + tabulação **somente quando o cliente ainda não tem perfil definido** (`debtor_profile IS NULL`).
2. **Ou** quando o cliente acabou de **quebrar um acordo e iniciar um novo** (existe um agreement `cancelled` anterior + um agreement `pending`/`approved` posterior, do mesmo credor/cliente).
3. Em qualquer outra situação (perfil já definido e sem novo acordo após quebra) o banner **não deve aparecer**, e o envio não deve ser bloqueado.

## Mudanças

### 1. Novo sinal: `hasReopenedAgreement`

Em `WhatsAppChatLayout.tsx`, ao carregar `clientInfo` (linhas ~555–561), buscar também o histórico de agreements do cliente para o mesmo credor e calcular:

```ts
hasReopenedAgreement =
  existe agreement com status='cancelled'
  AND existe agreement (status in ('pending','approved')) criado depois do cancelado
```

Hoje a tabela `agreements` não tem `broken_at`/coluna específica de quebra; usamos `status='cancelled'` (que é o status aplicado em `agreementService.ts` quando há quebra) + `created_at` do próximo acordo como heurística canônica.

Salvar em `clientInfo.has_reopened_agreement` para reaproveitar no `ChatPanel` sem prop drilling extra.

### 2. Ajuste da condição do gate em `ChatPanel.tsx`

Substituir o cálculo atual por:

```ts
const needsProfileGate = !hasProfile;                      // perfil não definido
const needsReopenGate  = !!clientInfo?.has_reopened_agreement && (!hasProfile || !hasDisposition);

const mustGate =
  inboundCount >= GATE_THRESHOLD
  && !!conversation
  && !!clientInfo?.id
  && (needsProfileGate || needsReopenGate);
```

Resumo do comportamento:

| Estado do cliente | Perfil | Tabulação | Gate? |
|---|---|---|---|
| Sem perfil | — | — | Sim (exige perfil + tabulação) |
| Com perfil, sem acordo quebrado refeito | ok | qualquer | Não |
| Com perfil, acordo quebrado + novo acordo | ok | sem tabulação | Sim (exige tabulação) |
| Com perfil + tabulação, acordo refeito | ok | ok | Não |

### 3. Espelhar no gate defensivo

Aplicar a mesma lógica no `handleSend` de `WhatsAppChatLayout.tsx` (linhas 692–701) para manter coerência entre UI e backend defensivo.

### 4. Banner: texto contextual

Em `WhatsAppGateBanner.tsx`, ajustar o subtítulo para refletir o motivo:

- Sem perfil: "O cliente ainda não tem Perfil definido. Defina o perfil e selecione ao menos uma tabulação para liberar o envio."
- Acordo refeito: "Cliente refez um acordo após quebra. Confirme o perfil e registre uma tabulação para esta nova negociação."

Passar uma prop `reason: 'no_profile' | 'reopened_agreement'` do `ChatPanel` para o banner.

## Detalhes técnicos

- A consulta extra de agreements deve ser leve: `select id, status, created_at` filtrando por `client_id` do `selectedConv` e ordenando por `created_at desc` com `limit(20)`. Cálculo de `hasReopenedAgreement` no client.
- Manter as RLS / `tenant_id` filter para respeitar as regras Core.
- Manter `GATE_THRESHOLD = 5` inalterado.
- Sem mudanças em SQL/migrations.

## Arquivos alterados

- `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx`
- `src/components/contact-center/whatsapp/ChatPanel.tsx`
- `src/components/contact-center/whatsapp/WhatsAppGateBanner.tsx`
