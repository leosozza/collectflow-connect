## Reatribuição manual — Flaviane Santos de Godoy → Maria Eduarda

Caso pontual de correção de dados. **Nenhuma regra/RPC/código será alterada**, apenas dados no banco do tenant Y.brasil.

### Alvos

| Tabela | Registro | Campo | De | Para |
|---|---|---|---|---|
| `conversations` | `2945b767-897a-4c6f-b2ce-ab045737fd02` | `assigned_to` | `c734c47b…` (Sabrina) | `c176575c-7860-4640-a776-446414bd553e` (Maria Eduarda) |
| `clients` (3 parcelas, CPF `35001812879`, credor TESS MODELS) | todas | `operator_id` | `NULL` | `c176575c…` (Maria Eduarda) |

### Passos

1. **UPDATE em `conversations`** — define `assigned_to = 'c176575c…'` para a conversa da Flaviane.
2. **UPDATE em `clients`** — define `operator_id = 'c176575c…'` para todas as parcelas com `cpf='35001812879'` e `tenant_id` da Y.brasil (vincula a cliente à Maria Eduarda na Carteira).
3. **Validação** — logar como Maria Eduarda e pesquisar "flaviane" na Caixa de Entrada: a conversa deve aparecer; abrir o perfil da cliente e confirmar que está na carteira dela.

### Fora de escopo

- Não vou mexer na RPC `get_visible_conversations` (regra global de visibilidade fica como está).
- Não vou alterar a Sabrina nem outras conversas.
- Não vou criar `atendimento_session` nova — a sessão atual continua válida.
