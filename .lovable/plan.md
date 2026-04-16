

## Entendimento

O usuário quer que, além de o tenant **editar** os status existentes (renomear, ajustar regras), ele também possa **criar novos status do zero** já com a opção de atribuir um `papel_sistema` — mantendo o sistema robusto e funcional para multi-tenant.

## Plano

### 1. `src/components/cadastros/TipoStatusList.tsx`

**A. Diálogo unificado (criar + editar):**
- Botão **"Novo Status"** no topo da página abre o mesmo diálogo de edição, em modo `create`.
- Campos do formulário:
  - `nome` (texto, obrigatório)
  - `cor` (color picker)
  - `papel_sistema` (`<Select>` com 8 opções: 7 papéis + "Nenhum (custom)")
  - `bloqueio` (switch — bloqueia edição quando ativo)
  - `apenas_responsavel` (switch — só responsável pode mexer)

**B. Validação de unicidade do papel:**
- Antes de salvar (create ou edit), checar se já existe outro status no mesmo tenant com o mesmo `regras.papel_sistema`.
- Se houver conflito → toast de erro: *"O papel 'Inadimplente' já está atribuído ao status 'X'. Cada papel pode ser usado uma única vez."*
- Permitir salvar apenas se papel for único OU "Nenhum".

**C. Persistência:**
- Salvar via `upsertTipoStatus` (já existente em `cadastrosService.ts`), gravando `regras` como JSONB com `papel_sistema`, `bloqueio` e `apenas_responsavel`.

**D. UI da listagem:**
- Coluna extra **"Papel no Sistema"** com badge colorido (ex: `inadimplente` → vermelho, `quitado` → verde, `acordo_vigente` → azul, sem papel → cinza "Custom").
- Botão de excluir desabilitado para status com `papel_sistema` definido (proteção: o tenant pode renomear, mas não apagar um papel ativo, evitando quebra do `auto-status-sync`).

**E. Botão "Carregar status padrão":**
- Já cria os 7 status core com `papel_sistema` preenchido (conforme plano anterior).
- Se o tenant já tem algum status com determinado papel, pula esse para não duplicar.

### 2. Backend (sem mudanças adicionais)
Tudo que envolve lookup por `papel_sistema` já estará coberto pelo plano anterior (auto-status-sync, agreementService, maxlist-import). A criação de novos status apenas alimenta a mesma tabela `tipos_status`.

### 3. Sem quebra
- Status sem `papel_sistema` continuam funcionando como visuais/manuais.
- Validação de unicidade impede que o tenant atribua o mesmo papel a 2 status.
- Proteção contra exclusão de status com papel evita que o `auto-status-sync` quebre.

## Arquivos alterados
1. `src/components/cadastros/TipoStatusList.tsx` — diálogo unificado create/edit, validação de unicidade, badge de papel, proteção de exclusão.

(Os demais arquivos do plano anterior — `auto-status-sync`, `agreementService`, `maxlist-import`, backfill SQL — permanecem como já planejado.)

