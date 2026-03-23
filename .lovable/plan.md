

# Plano: Edição bidirecional completa de intervalos (RIVO ↔ 3CPlus)

## Situacao atual

O `WorkBreakIntervalsPanel` atualmente envia apenas `name` e `max_time` (como `minutes`) ao criar/editar intervalos na 3CPlus. A 3CPlus suporta campos adicionais que o RIVO nao envia:

- **Cor** (`color`) — hex string
- **Tempo maximo diario** (`daily_limit` ou `maximum_daily_time`)
- **Classificacao do intervalo** (`classification`) — "productive", "unproductive", "nr17"
- **Retorno do intervalo** (`return_type`) — "flexible", "automatic", "request"
- **Intervalo automatico** (`auto_start`) — boolean

O dialog de edicao no RIVO so tem Nome e Tempo Maximo, faltam todos os outros campos que a 3CPlus oferece (conforme o screenshot).

Alem disso, a edicao no RIVO ja chama a API 3CPlus (`update_work_break_group_interval`), entao **RIVO → 3CPlus ja funciona** para os campos que envia. O problema e que:
1. Faltam campos no formulario do RIVO
2. O proxy so envia `name` e `minutes`, ignorando os demais campos
3. A leitura dos intervalos da 3CPlus nao carrega esses campos extras na UI

## Correcoes

### 1. `src/components/contact-center/threecplus/WorkBreakIntervalsPanel.tsx` — Redesign do dialog de intervalo

Expandir o dialog de edicao para incluir todos os campos da 3CPlus:

- **Nome** (ja existe)
- **Cor** — color picker com paleta de cores (dots clicaveis, como na 3CPlus)
- **Tempo maximo do intervalo** (minutos) (ja existe)
- **Tempo maximo em intervalo diario** (minutos) — novo campo
- **Classificacao do intervalo** — Select com opcoes: Produtivo, Improdutivo, NR 17
- **Retorno do intervalo** — Select com opcoes: Retorno flexivel, Retorno automatico, Solicitar retorno
- **Intervalo automatico** — Switch toggle

Ao salvar, enviar todos os campos para o proxy. Ao abrir para edicao, carregar todos os campos do intervalo existente.

### 2. `supabase/functions/threecplus-proxy/index.ts` — Enviar campos extras

No `create_work_break_group_interval` e `update_work_break_group_interval`, adicionar os campos extras ao body enviado para a 3CPlus:

```
const intervalBody = { name: body.name };
if (body.max_time != null) intervalBody.minutes = Number(body.max_time);
if (body.daily_limit != null) intervalBody.daily_limit = Number(body.daily_limit);
if (body.color) intervalBody.color = body.color;
if (body.classification) intervalBody.classification = body.classification;
if (body.return_type) intervalBody.return_type = body.return_type;
if (body.auto_start != null) intervalBody.auto_start = body.auto_start;
```

### 3. Exibicao dos campos na lista de intervalos

Mostrar a cor como dot colorido ao lado do nome e o tempo diario na linha do intervalo.

## Arquivos a editar

| Arquivo | Mudanca |
|---|---|
| `src/components/contact-center/threecplus/WorkBreakIntervalsPanel.tsx` | Redesign do dialog com todos os campos (cor, tempo diario, classificacao, retorno, auto) |
| `supabase/functions/threecplus-proxy/index.ts` | Enviar campos extras no create/update de intervalos |

