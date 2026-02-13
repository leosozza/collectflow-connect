
# Auto-preencher ramal do supervisor na Escuta

## Problema
Ao abrir o painel de escuta de um agente, o sistema pede ramal ou telefone manualmente, mas o supervisor logado ja esta mapeado como agente 3CPlus e tem seu ramal disponivel na lista de agentes online.

## Solucao
Detectar automaticamente o ramal do supervisor logado (usuario atual) e pre-preencher o campo, eliminando a necessidade de digitar manualmente.

## Fluxo

1. O `TelefoniaDashboard` ja tem a lista de `agents` (com campo `extension`) e os `profileMappings` (com `threecplus_agent_id`)
2. Passar a lista de agentes para o `AgentDetailSheet`
3. No `AgentDetailSheet`, ao abrir:
   - Buscar o perfil do usuario logado via `supabase.auth.getUser()`
   - Encontrar o `threecplus_agent_id` do usuario logado nos `profiles`
   - Encontrar o agente correspondente na lista de agentes para obter o `extension`
   - Pre-preencher o campo de ramal automaticamente

## Mudancas Tecnicas

### 1. `TelefoniaDashboard.tsx`
- Passar prop `allAgents={agents}` para o `AgentDetailSheet`

### 2. `AgentDetailSheet.tsx`
- Adicionar prop `allAgents?: Agent[]` na interface
- No `useEffect` inicial, buscar o usuario logado e seu `threecplus_agent_id` do perfil
- Cruzar com a lista de agentes para encontrar o ramal
- Setar `setExtension(String(myExtension))` automaticamente
- Mostrar indicacao visual de que o ramal foi detectado automaticamente (ex: badge "Seu ramal: 1001")
- Manter os campos editaveis caso o supervisor queira usar outro ramal/telefone

### 3. `SpyButton.tsx`
- Aplicar a mesma logica de auto-deteccao para manter consistencia (caso ainda seja usado independentemente)
