

# Plano: Renomear para "Tabulação de Chamada" + Propriedades 3CPlus

## Resumo

Renomear todas as referências de "Categorização da Chamada" para "Tabulação de Chamada" e adicionar as propriedades de qualificação do 3CPlus (cor, impacto, comportamento, flags booleanas) à tabela `call_disposition_types`, replicando a lógica do screenshot.

---

## 1. Migração — Novas colunas na tabela `call_disposition_types`

Adicionar as colunas que espelham a estrutura de qualificação do 3CPlus:

| Coluna | Tipo | Descrição |
|---|---|---|
| `color` | text | Cor visual (red, blue, green, yellow, black, pink) |
| `impact` | text | "positivo" ou "negativo" |
| `behavior` | text | "repetir" ou "nao_discar" |
| `is_conversion` | boolean | Flag Conversão |
| `is_cpc` | boolean | Flag CPC |
| `is_unknown` | boolean | Flag Desconhece |
| `is_callback` | boolean | Flag Callback |
| `is_schedule` | boolean | Flag Agendamento |
| `is_blocklist` | boolean | Flag Lista de Bloqueio |

Todos com `DEFAULT false` / `DEFAULT 'negativo'` etc. para não quebrar registros existentes.

## 2. Renomear textos — Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `CadastrosPage.tsx` | `label: "Tabulação de Chamada"` |
| `CallDispositionTypesTab.tsx` | Todos os textos: "Nova Tabulação", "Editar Tabulação", toasts |
| `DispositionPanel.tsx` | CardTitle: "Tabulação da Chamada" |

## 3. Expandir formulário de criação/edição — `CallDispositionTypesTab.tsx`

O dialog de criar/editar tabulação passa a incluir:
- **Cor**: Select com opções (vermelho, azul, verde, amarelo, preto, rosa)
- **Impacto**: Select (Positivo / Negativo)
- **Comportamento**: Select (Repetir / Não discar novamente)
- **6 checkboxes**: Conversão, CPC, Desconhece, Callback, Agendamento, Lista de Bloqueio

## 4. Expandir tabela de listagem — `CallDispositionTypesTab.tsx`

A tabela passa a mostrar todas as colunas do screenshot:
- Bolinha de cor | Nome | Impacto | Comportamento | Conversão | CPC | Desconhece | Callback | Agendamento | Lista de Bloqueio
- Valores booleanos exibidos como ✓ ou —

## 5. Atualizar sincronização com 3CPlus

O `syncDispositionsTo3CPlus` no `dispositionService.ts` passará a enviar as novas propriedades ao criar/atualizar qualificações na API 3CPlus, mapeando:
- `impact` → campo da API
- `behavior` → campo da API  
- flags booleanas → campos correspondentes

## 6. Atualizar defaults

O `DEFAULT_DISPOSITION_LIST` será expandido com valores padrão para as novas propriedades.

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| **Migração SQL** | Adicionar 9 colunas à `call_disposition_types` |
| `src/pages/CadastrosPage.tsx` | Renomear label |
| `src/components/cadastros/CallDispositionTypesTab.tsx` | Renomear textos + expandir form e tabela |
| `src/components/atendimento/DispositionPanel.tsx` | Renomear título do card |
| `src/services/dispositionService.ts` | Atualizar interface, defaults, e sync |

