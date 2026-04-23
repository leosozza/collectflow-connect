

## Plano: corrigir "Extension SIP não encontrada" no click2call (operador Gustavo, agent 100706)

### Diagnóstico

Quando o operador clica para ligar:

1. Edge function `threecplus-proxy` (action `click2call`) faz `GET /users?per_page=500`.
2. Procura, no objeto do agente, um destes campos: `extension`, `extensions[0].extension`, ou `username`.
3. Para o **Gustavo (agent_id 100706)**, o endpoint `/users` da 3CPlus **não retornou** nenhum desses campos — então a função aborta com 422 e mostra o toast exato:
   > "Extension SIP não encontrada para o agente 100706. Configure a extension no 3CPlus."

Isso acontece porque na 3CPlus o vínculo "usuário ↔ extension SIP" mora em um recurso separado (`/extensions`), e nem sempre vem agregado dentro do objeto de `/users`. O Gustavo provavelmente **tem uma extension** atribuída na 3CPlus, mas o `/users` não a está expondo.

### Causa raiz
- **Fonte única de verdade incompleta**: dependemos só de `/users` para descobrir a extension. Se a 3CPlus não embutir a extension nesse payload (o que varia por tenant/configuração), a discagem trava — mesmo com o agente perfeitamente configurado lá.
- **Sem override**: não temos um lugar no nosso lado para o admin "dizer" qual é a extension do operador caso a API da 3CPlus não devolva.

### Correção (2 frentes)

#### Frente 1 — Fallback robusto na Edge Function `threecplus-proxy` (case `click2call`)

Cadeia de resolução da extension, na ordem (para no primeiro hit):

1. **Override manual no nosso DB** (ver Frente 2): se `profiles.threecplus_extension` existir para o operador, usa direto.
2. **`/users`** (já existe hoje): `agent.extension` → `agent.extensions[0].extension` → `agent.username`.
3. **NOVO Fallback `/extensions`**: `GET /extensions?per_page=500`, procurar item onde `user_id == agent_id` (ou `agent_id == agent_id`), pegar campo `extension_number` / `number` / `extension`. Cachear por invocação como já é feito em `agentTokenCache`.
4. **NOVO Fallback `/agents/:id`** (recurso individual, geralmente mais detalhado que a listagem): pegar o mesmo conjunto de campos.

Só se TODOS falharem é que a função retorna 422 com a mensagem atual — agora indicando, no log, qual rota foi tentada.

Bonus: aceitar `body.extension` vindo do frontend como override de runtime (caso o admin queira testar). Se vier preenchido, pula toda a cadeia de resolução.

#### Frente 2 — Override manual por operador (admin UI)

**Migração SQL**: adicionar coluna opcional `threecplus_extension TEXT` em `profiles`.

**UI Admin → Usuários → editar operador**: campo opcional **"Extension SIP 3CPlus"** com helper text:
> "Preencha apenas se o sistema não conseguir descobrir automaticamente a extension do operador (ex.: erro 'Extension SIP não encontrada')."

**Frontend `callService.ts`**: ao chamar `click2call`, se o profile do operador logado tiver `threecplus_extension`, enviar no body como `extension: "xxx"`.

### Arquivos afetados

1. `supabase/functions/threecplus-proxy/index.ts` — adicionar fallbacks `/extensions` e `/agents/:id` no case `click2call`; aceitar `body.extension` como override.
2. **Migração SQL** — `ALTER TABLE profiles ADD COLUMN threecplus_extension TEXT NULL;`
3. `src/services/callService.ts` — incluir `extension` do profile no payload se presente.
4. `src/components/admin/users/...` (form de edição de operador) — campo input opcional para extension.

### Validação esperada

1. **Operador Gustavo (cenário atual)**: clicar no ícone verde → fallback `/extensions` encontra a SIP do 100706 → discagem completa sem erro.
2. **Operador sem extension em lugar nenhum**: mesmo erro 422 atual, mas log da edge mostra "tentado /users + /extensions + /agents/100706 — nenhum trouxe extension".
3. **Admin preenche manualmente "Extension SIP" = 1234**: discagem usa "1234" direto, sem nem chamar `/users`.
4. **Operador antigo que já funciona** (extension veio em `/users`): nenhuma regressão, primeira camada da cadeia resolve igual hoje.

### Esforço
- 1 edge function (~40 linhas), 1 migração trivial, 1 ajuste no `callService`, 1 campo no form admin.
- Sem mudança em `AgreementCalculator`, `ClientHeader`, ou outras telas.
- Risco baixo, valor alto: destrava operação de telefonia de operadores cuja extension não vem no `/users`.

