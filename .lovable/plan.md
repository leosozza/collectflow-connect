

# Correção: Intervalos e Qualificações 3CPlus — Endpoints Corretos

## Diagnóstico

Após análise da documentação oficial da API 3CPlus, identifiquei os problemas:

### Intervalos (Pausas)
- **Problema**: O código usa `campaigns/{id}/intervals` para criar/editar, mas esse endpoint é apenas leitura (GET). O POST retorna 405.
- **API correta**: Intervalos são gerenciados via **Work Break Groups** (globais, não por campanha):
  - `GET /work_break_group` — listar grupos
  - `POST /work_break_group` — criar grupo
  - `PUT /work_break_group/{id}` — atualizar
  - `DELETE /work_break_group/{id}` — excluir
  - Intervalos dentro dos grupos:
    - `GET /work_break_group/{id}/intervals` — listar
    - `POST /work_break_group/{id}/intervals` — criar
    - `PUT /work_break_group/{id}/intervals/{interval-id}` — atualizar
    - `DELETE /work_break_group/{id}/intervals/{interval-id}` — excluir

### Qualificações (Tabulações)
- **Problema**: O código usa `/qualifications` que não existe (retorna 404).
- **API correta**: Qualificações são gerenciadas via **Qualification Lists** (globais):
  - `GET /qualification_lists` — listar listas
  - `POST /qualification_lists` — criar lista
  - `PUT /qualification_lists/{id}` — atualizar
  - `DELETE /qualification_lists/{id}` — excluir
  - Qualificações dentro das listas:
    - `GET /qualification_lists/{id}/qualifications` — listar
    - `POST /qualification_lists/{id}/qualifications` — criar
    - `PUT /qualification_lists/{id}/qualifications/{qual-id}` — atualizar
    - `DELETE /qualification_lists/{id}/qualifications/{qual-id}` — excluir

### Campanhas
- Ao criar campanha, pode-se associar `qualification_list` e `work_break_group_id`

---

## Plano de Implementação

### 1. Atualizar Edge Function `threecplus-proxy`
Adicionar os novos actions para os endpoints corretos:
- `list_work_break_groups`, `create_work_break_group`, `update_work_break_group`, `delete_work_break_group`
- `list_work_break_group_intervals`, `create_work_break_group_interval`, `update_work_break_group_interval`, `delete_work_break_group_interval`
- `list_qualification_lists`, `create_qualification_list`, `update_qualification_list`, `delete_qualification_list`
- `list_qualification_list_items`, `create_qualification_list_item`, `update_qualification_list_item`, `delete_qualification_list_item`

Remover os actions antigos que usam endpoints errados (`list_qualifications`, `create_qualification`, etc.).

### 2. Reescrever `WorkBreakIntervalsPanel.tsx`
- Remover seletor de campanha (intervalos são globais)
- Estrutura em 2 níveis: Grupos de Pausa → Intervalos dentro de cada grupo
- Listar grupos com expand/collapse para ver intervalos
- CRUD para grupos e intervalos dentro de cada grupo

### 3. Reescrever `QualificationsPanel.tsx`
- Estrutura em 2 níveis: Listas de Qualificação → Qualificações dentro de cada lista
- Listar listas com expand/collapse para ver qualificações
- CRUD completo para listas e qualificações individuais

### 4. Atualizar `CampaignsPanel.tsx`
- No dialog de criação, adicionar seletores para:
  - **Lista de Qualificação** (dropdown com listas existentes)
  - **Grupo de Pausas** (dropdown com grupos existentes)
- Carregar as listas e grupos disponíveis para popular os dropdowns

### 5. Verificação de Funcionalidade
Tudo que for criado/editado/excluído nesses painéis será refletido diretamente no 3CPlus via API REST.

---

## Arquivos Alterados

| Arquivo | Ação |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Adicionar ~12 novos actions, remover 6 antigos |
| `src/components/contact-center/threecplus/WorkBreakIntervalsPanel.tsx` | Reescrever: global com grupos + intervalos |
| `src/components/contact-center/threecplus/QualificationsPanel.tsx` | Reescrever: listas + qualificações aninhadas |
| `src/components/contact-center/threecplus/CampaignsPanel.tsx` | Adicionar seletores de qualification_list e work_break_group na criação |

