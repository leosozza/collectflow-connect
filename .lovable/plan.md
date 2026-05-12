
## Unificação da geração de boletos Negociarie — Fonte única de verdade

Objetivo: eliminar a duplicação entre `negociarieService` (frontend) e `generate-agreement-boletos` (edge), mantendo a edge como **única** fonte. Sem regressão de UX. Sem quebrar nenhum dos demais fluxos da Negociarie (cobrança avulsa, sync, callback).

---

### Fase 1 — Estender a edge `generate-agreement-boletos` (sem tocar o front)

**1.1. Aceitar novo parâmetro opcional no body**
- `installment_key?: string` (ex: `"entrada"`, `"entrada_2"`, `"1"`, `"2"`).
- Quando ausente: comportamento atual (lote completo) — **100% retro-compatível** com `agreementService.ts:444`, `agreementService.ts:1040` e `AgreementCalculator.tsx:697`.

**1.2. Comportamentos do modo single (`installment_key` presente)**
- Filtrar `buildInstallments()` para devolver apenas a parcela com a chave canônica recebida.
- Validar que a chave existe no acordo; se não, devolver `400` com mensagem clara.
- **NÃO** aplicar o skip de `dueDate < today` (a UI já valida; reemissão manual deve passar).
- **NÃO** alterar a flag `boleto_pendente` do acordo (uma parcela individual não deve mexer no estado do acordo todo).
- Manter a marcação de `status='substituido'` da cobrança anterior com mesma `installment_key` (já existe no código atual da edge — linha 405).
- Manter o skip de método ≠ BOLETO (linha 331), devolvendo erro explícito: `"Método da parcela é PIX/cartão — altere para boleto antes de reemitir"`. (Mais seguro que silenciosamente trocar; alinhado com `mem://features/billing/agreement-installments-ui`.)

**1.3. Portar auto-heal de `client_profiles` para a edge**
- Replicar `enrichClientDataFromClients` (hoje em `negociarieService.ts:24-68`) dentro da edge: se faltar campo em `client_profiles`, buscar em `clients` e disparar `upsertClientProfile` em background.
- Deve rodar **antes** do check `missingFields` que dispara `boleto_pendente`. Sem isso, acordos que hoje só funcionam graças ao enrichment passariam a ser marcados como pendentes — regressão silenciosa.
- Preserva a regra `mem://logic/client-data/canonical-profile-architecture`.

**1.4. Logging**
- Adicionar `mode: "single" | "batch"` aos logs já existentes da edge.
- Manter timing detalhado (`auth_ms`, `queries_ms`, `negociarie_total_ms`, `per_installment_ms`).

**1.5. Deploy isolado**
- Deploy `generate-agreement-boletos`. Nenhuma mudança no front nesta fase → **zero risco** para usuários.

---

### Fase 2 — Validação da edge isolada (antes de tocar o front)

Tudo via `curl_edge_functions` em ambiente preview, contra acordos reais de teste:

**2.1.** Modo lote (sem `installment_key`) em acordo já existente → confirmar:
- Comportamento idêntico ao de hoje (mesma quantidade de cobranças geradas, mesmo `boleto_pendente`, mesmos logs de timing).

**2.2.** Modo single em parcela "entrada" → confirmar:
- 1 cobrança nova com `installment_key = "<agId>:entrada"`.
- Anterior marcada `substituido`.
- `agreements.boleto_pendente` **não** mudou.

**2.3.** Modo single em parcela com `dueDate < today` (vencimento já editado para futuro pela UI antes da chamada) → confirmar geração OK.

**2.4.** Modo single em parcela com método PIX → confirmar erro claro retornado.

**2.5.** Modo single em acordo com `client_profiles` incompleto (mas com dados em `clients`) → confirmar auto-heal e geração OK.

**2.6.** Simular callback Negociarie (`negociarie-callback`) chegando para a cobrança gerada → confirmar baixa correta no classificador (`agreementInstallmentClassifier.ts:147`).

**Critério de avanço para fase 3:** todos os 6 cenários acima passando.

---

### Fase 3 — Migrar o frontend

**3.1.** Em `src/components/client-detail/AgreementInstallments.tsx`:
- Linha 351 (`generateSingleBoleto`) → trocar por `supabase.functions.invoke("generate-agreement-boletos", { body: { agreement_id: agreementId, installment_key: inst.customKey } })`.
- Linha 736 (`generateAgreementBoletos`) → trocar por `supabase.functions.invoke("generate-agreement-boletos", { body: { agreement_id: agreementId } })` (modo lote — mesma chamada que `agreementService` já faz).
- Manter toast, refetch e `onRefresh` exatamente iguais.

**3.2.** Em `src/services/negociarieService.ts`:
- Remover: `generateSingleBoleto`, `generateAgreementBoletos`, `markPreviousBoletosAsSubstituido`, `enrichClientDataFromClients`, `buildBoletoPayload`, `buildInstallmentKey`, interface `BoletoInstallment` e helpers internos correlatos.
- **Preservar intacto**: `testConnection`, `atualizarCallback`, `consultaCobrancas`, `parcelasPagas`, `alteradasHoje`, `novaCobranca`, `novaPix`, `novaCartao`, `getCobrancas`, `saveCobranca`. Esses são usados por `CobrancaForm`, `CobrancasList`, `NegociarieTab`, `SyncPanel` (cobrança avulsa e sync — fora do escopo).

**3.3.** Verificações estáticas
- Rodar typecheck (automático).
- Confirmar que nenhum import órfão sobrou.

---

### Fase 4 — QA manual no preview

**4.1. Detalhe do acordo → "Reemitir parcela"**
- Em entrada: confirmar toast OK, link novo, anterior substituída na lista.
- Em parcela normal: idem.

**4.2. Detalhe do acordo → "Gerar boletos depois"** (acordo com `boleto_pendente=true`)
- Confirmar geração em lote, flag desligada, toast OK.

**4.3. Aprovar acordo novo** (`agreementService:444`)
- Confirmar que continua gerando todos os boletos (caminho não alterado).

**4.4. Cobrança avulsa** (`Configurações → Integração → Cobranças → Nova`)
- Confirmar que `CobrancaForm` continua funcionando (não tocado).

**4.5. Sync** (`SyncPanel`)
- Confirmar `parcelasPagas` e `alteradasHoje` continuam funcionando.

**4.6. Callback real**
- Aguardar/forçar callback Negociarie em uma cobrança gerada pela edge → confirmar baixa correta em `negociarie_cobrancas` e classificador exibindo "pago".

---

### Garantias de não-quebrar (regras do projeto)

- **Tenant Isolation**: a edge resolve `tenant_id` a partir de `agreement_id` no DB; o front nunca mais manda tenant explícito para esse fluxo. Reduz surface de erro.
- **Phone Normalization E.164**: passa a viver só na edge (já existe em `generate-agreement-boletos`).
- **Security: edge functions validam via JWT**: a edge já valida (`agreementService` invoca via supabase client autenticado).
- **Canonical Profiles**: auto-heal preservado e centralizado.
- **Installment UI Rules** (`mem://features/billing/agreement-installments-ui`): a UI continua dependendo de `installment_key` canônica — agora **garantidamente** canônica porque só existe um gerador.
- **Negociarie Integration** (`mem://integrations/negociarie-gateway`): payload mantido (lógica `buildBoletoPayload` já espelhada na edge).

### Fora de escopo (explicitamente não tocar)

- `negociarie-callback` — funciona por `id_geral`, não depende de `installment_key`.
- `agreementInstallmentClassifier.ts` — só leitura, já consome chave canônica.
- `manual_payments`, `portal_payments`, `send-notifications` — caminhos paralelos legítimos.
- `CobrancaForm` (cobrança avulsa não-acordo).
- O caso da Eunice (`proposed_total` inconsistente) — separado.

### Plano de rollback

- Fase 1 e 2: nada para reverter (edge é retro-compatível).
- Fase 3: revert do commit do front em 1 clique restaura o caminho B; a edge estendida continua funcionando para quem usa o modo lote.

### Resultado esperado

- Uma única implementação canônica da geração de boleto de acordo, server-side.
- Impossível regredir convenção de chave (`:entrada` vs `:0`).
- ~250 linhas a menos no bundle do front.
- Logs centralizados em `edge_function_logs` para qualquer admin debugar.
- Comportamento observável **idêntico** para o usuário final.
