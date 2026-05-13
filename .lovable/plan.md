## Diagnóstico — "Erro ao gerar boleto: Entrada: {sucesso:0, erro:422, mensagem:Erro desconhecido}"

### O que está realmente acontecendo

A toast mostra **a resposta crua do servidor da Negociarie**:

```json
{ "sucesso": 0, "erro": 422, "mensagem": "Erro desconhecido" }
```

Esse é o corpo HTTP 422 que a Negociarie devolveu para a chamada `POST /cobranca/nova`. Ou seja: **a edge function `generate-agreement-boletos` chamou a Negociarie e a Negociarie rejeitou**. Não é erro do nosso banco (e a UNIQUE da rodada anterior não foi violada — a falha aconteceu **antes** da gente tentar inserir em `negociarie_cobrancas`).

### Por que o erro aparece como "Erro desconhecido"

`supabase/functions/generate-agreement-boletos/index.ts` linha 92:

```ts
if (!res.ok) throw new Error(json.message || json.error || JSON.stringify(json) || `Negociarie ${res.status}`);
```

A Negociarie usa **chaves em português** (`mensagem`, `erro`, `sucesso`). Nosso código procura `message`/`error` (em inglês) e, ao não achar, faz `JSON.stringify(json)` — por isso o blob JSON aparece dentro da toast. O `"Erro desconhecido"` é literalmente o que a Negociarie devolveu como `mensagem`.

Resultado prático: **a Negociarie não nos disse o motivo real** ("Erro desconhecido" é o fallback do lado deles). Para descobrir, precisamos:
1. Logar o **payload exato** que enviamos (CPF, endereço, valor, vencimento, id_geral, id_parcela).
2. Logar a **resposta completa** dela (incluindo headers e body bruto) — pode haver pistas em `details`/`erros[]` que estamos ignorando.
3. Reapresentar a mensagem real (`mensagem`) para o usuário.

### Verificação adicional (já feita)

Consultei `negociarie_cobrancas` — os últimos 8 inserts (15:07 a 15:34 hoje) foram `registrado` com sucesso. Logo, a geração **continua funcionando para a maioria dos acordos**; o erro é em casos específicos. Causas mais prováveis para 422 da Negociarie nesse cenário:
- Endereço/CEP inválido ou cidade/UF não reconhecidos
- `id_parcela` ou `id_geral` colidindo (geramos com `Date.now()` + `idx`; em chamadas paralelas e re-tentativas pode bater)
- Telefone com dígitos a menos depois do `normalizePhone` (que remove o "55" — parcela sem telefone fica como `[]`)
- Valor com mais de 2 casas (não deveria, usamos `toFixed(2)`)
- Cliente já cadastrado na Negociarie com outro CPF/endereço e validação dela falha

Sem o log detalhado, não dá para apontar dedo. O plano abaixo expõe isso na próxima tentativa.

### Bug separado descoberto na revisão (regressão da rodada anterior)

A UNIQUE parcial nova `uq_negociarie_cob_agreement_inst_active` cobre status `('registrado','pago','pendente','RECEIVED','CONFIRMED')`. No fluxo de reemissão (linhas 451-474 da edge):

1. `UPDATE ... SET status='substituido' WHERE installment_key=? AND status <> 'pago'`  ← **propositalmente preserva o `pago`**
2. `INSERT ... status='pendente'` com a mesma `installment_key`

Se já existe uma cobrança `pago` para essa parcela, o passo 1 não a toca, o passo 2 insere um `pendente`, e a nova UNIQUE estoura: **`pago` + `pendente` no mesmo (agreement_id, installment_key)** = violação. A Negociarie até aceitaria a chamada, mas o nosso commit no banco quebraria. Não é o que o usuário viu agora, mas é uma armadilha latente.

Solução simples: **bloquear a reemissão quando já existe `pago` para aquela parcela** (faz sentido de negócio também — não se reemite boleto de parcela já paga). Isso evita o problema sem afetar a UNIQUE.

---

## Plano

**Parte 1 — Diagnóstico permanente (sem mudar comportamento)**

Em `supabase/functions/generate-agreement-boletos/index.ts`:

1. `negociarieRequest`: ao detectar `!res.ok`, montar mensagem priorizando `json.mensagem`, depois `json.message`, depois `json.error`, depois `json.erro`. Fazer `console.error` com `{ status, url, requestBodyKeys, responseBody }` (sem CPF/email — só o que é seguro logar).
2. No `runWithConcurrency` (linha ~478), no `catch` de cada parcela, fazer `console.error` com `{ installment_key, agreement_id, idGeralPrefix, valor, dueDate, message }` para correlacionar com o log da requisição.
3. Manter o erro retornado para o usuário **legível** (`mensagem` real da Negociarie) — assim "Erro desconhecido" só aparece se ela mesma retornar isso.

**Parte 2 — Guarda contra reemissão sobre parcela paga (fecha a regressão da UNIQUE)**

Antes de chamar a Negociarie, em modo `single`:
```ts
SELECT 1 FROM negociarie_cobrancas
WHERE agreement_id=? AND installment_key=? AND status='pago' LIMIT 1
```
Se existir, retornar 400 com `"Parcela já paga — não é possível reemitir boleto"`.

Alternativa adicional (defesa em profundidade): mudar o `UPDATE` da linha 454-457 para também marcar **`pago` velhos como `substituido` apenas se o INSERT for bem-sucedido** — não. Manter `pago` é correto; só não deixar gerar boleto novo em cima.

**Parte 3 — Frontend (UX)**

Em `AgreementInstallments.tsx` (handler que mostra a toast, ~linha 442):
- Se a `data?.errors?.[0]` parecer JSON cru (começa com `{`), tentar `JSON.parse` e exibir só o `mensagem` ou `message` interno. Caso contrário, exibir como está. Garante que mesmo se algum response novo escapar, o usuário não vê blob.

### O que NÃO mexer

- ❌ Lógica de SSOT, triggers, recompute, status hierárquico
- ❌ `negociarie_cobrancas` schema, UNIQUE, callback handler
- ❌ Cron de shadow-check
- ❌ Lógica de geração de `id_parcela`/`id_geral` (pode ser fonte do 422, mas mexer sem dado é chute — primeiro logamos, depois corrigimos se necessário)

### Resultado esperado

- Próxima vez que falhar, a toast mostra a mensagem real (não JSON cru) e os logs da edge mostram o payload + response completo, permitindo diagnóstico final em 1 minuto.
- Reemissão sobre parcela já paga é bloqueada com erro amigável, fechando a armadilha da UNIQUE.

Posso executar as 3 partes?
