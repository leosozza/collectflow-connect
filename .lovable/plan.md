
## Plano — Marcar telefone como "Hot" (número quente) e promover a Telefone 1

### Conceito
Operador clica num telefone (1, 2 ou 3) → marca como **Hot** → o número vira automaticamente o `phone` (Telefone 1) e os outros são reorganizados. O botão WhatsApp continua simples (sempre usa Telefone 1 = Hot).

### Comportamento

**Regra de promoção (rotação de slots):**
- Marcar Telefone 2 como Hot → `phone2` vira `phone`, `phone` antigo desce para `phone2`, `phone3` permanece.
- Marcar Telefone 3 como Hot → `phone3` vira `phone`, `phone` antigo vira `phone2`, `phone2` antigo vira `phone3`.
- Marcar Telefone 1 como Hot → no-op (já é).

Sempre preserva todos os números, só rotaciona posição. Telefone 1 = sempre o Hot.

**UI:**
- Cada `InfoItem` de telefone (1, 2, 3) ganha um ícone de chama 🔥 (`Flame` do lucide):
  - Telefone 1 → chama **preenchida laranja** (indica que é o Hot atual, não clicável).
  - Telefones 2 e 3 → chama **outline cinza** clicável com tooltip "Marcar como número quente".
- Ao clicar, confirmação inline (toast com undo opcional) + atualização otimista.

**Persistência:**
- UPDATE em `clients` setando os 3 campos `phone`, `phone2`, `phone3` rotacionados.
- Aplicar para **todos os registros do mesmo CPF + credor** (manter consistência da carteira agrupada).
- Atualizar também `client_profiles` (SSOT canônica de contatos por CPF/tenant) — campo `phone` principal.
- Registrar `client_event` tipo `phone_promoted_hot` com metadata `{ old_phone, new_phone, slot_origem }` para aparecer no Histórico.

**Botão WhatsApp:**
- Mantém comportamento atual (`client.phone`) — sem mudança, pois Hot = phone.

### Arquivos

1. **`src/components/atendimento/ClientHeader.tsx`** (~40 linhas)
   - Adicionar ícone `Flame` em cada renderer de telefone (`phone`, `phone2`, `phone3`).
   - Handler `promoteToHot(slot: 'phone2' | 'phone3')` que chama o serviço.
   - Invalidar query do cliente após sucesso.

2. **`src/services/clientPhoneService.ts`** (novo, ~50 linhas)
   - Função `promotePhoneToHot(cpf, credor, tenantId, slotOrigem)`:
     - Lê registro atual.
     - Calcula rotação dos 3 slots.
     - UPDATE em `clients` (todos do CPF+credor) e `client_profiles`.
     - INSERT em `client_events` (`phone_promoted_hot`).

3. **`src/components/atendimento/ClientTimeline.tsx`** (~5 linhas)
   - Adicionar label PT no `EVENT_TYPE_LABELS`: `phone_promoted_hot: "Número Quente Definido"`.
   - Renderização do evento mostrando o telefone novo com ícone `Flame`.

### Fora do escopo
- Schema (campos `phone`/`phone2`/`phone3` já existem).
- RLS, edge functions, dropdown de seleção de número (não é mais necessário — Hot resolve).
- Mexer no `useTenant`, `useModules` ou na lógica do botão WhatsApp.

### Sem alteração
- Botão WhatsApp em si (continua usando `client.phone`).
- Layout do header, ordem dos campos no `fieldConfig`.
- Outros lugares que leem telefone (régua de cobrança, campanhas) — vão pegar o Hot automaticamente porque sempre leem `phone` primeiro.
