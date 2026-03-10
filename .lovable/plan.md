

## Plano: Atualizar Roadmap com funcionalidades faltantes e status corretos

### Problema
O roadmap não tem nenhum item com status `in_progress` e várias funcionalidades implementadas ou parcialmente implementadas não aparecem.

### Alterações no `src/pages/RoadmapPage.tsx`

**1. Mudar status de `planned` para `in_progress`:**
- **Negativação Serasa** → `in_progress` (25%) — componentes e serviço já existem
- **Resend Email** → `in_progress` (50%) — edge function já existe
- **Agente IA Autônomo** → `in_progress` (15%) — AIAgentTab e AISuggestion já funcionam

**2. Adicionar funcionalidades que existem no código mas NÃO estão no roadmap:**

| Item | Status | Progresso | Categoria |
|------|--------|-----------|-----------|
| Campos Personalizados (Custom Fields) | done | 100% | Core |
| Mapeamento de Campos (Field Mapping) | done | 100% | Core |
| Grade de Comissão | done | 100% | Core |
| Permissões por Usuário | done | 100% | Core |
| Prestação de Contas (Relatório) | done | 100% | Core |
| Integração WuzAPI | done | 100% | Integrações |
| Integração Gupshup WhatsApp | done | 100% | Integrações |
| MaxList / MaxSystem | done | 100% | Integrações |
| Automação Pós-Tabulação | done | 100% | Automação |
| API REST Pública | done | 100% | Core |
| Callbacks Agendados | done | 100% | Core |
| Propensão de Pagamento (IA) | done | 100% | IA |

### Arquivo alterado
- `src/pages/RoadmapPage.tsx` — adicionar ~12 novos itens e atualizar status de 3 existentes

