

# Ajustes: Kanban, Extrato Financeiro e Reorganização de Serviços

## 1. Kanban — colunas preenchendo a página

**Arquivo:** `src/components/carteira/CarteiraKanban.tsx`

Atualmente cada coluna tem largura fixa (`w-[300px]`). Alterar para que as colunas se expandam proporcionalmente ao espaço disponível, mantendo `min-w-[250px]` e usando `flex-1` para distribuir. O scroll horizontal só aparece quando não cabe.

## 2. Extrato Financeiro — unificar CRM + Plano

**Arquivo:** `src/pages/TenantSettingsPage.tsx`

Na aba "Financeiro", o extrato mostra o plano ("Starter") e o serviço "CRM" como linhas separadas. Ajustes:

- Na linha do plano base, exibir **"CRM {nome_do_plano}"** (ex: "CRM Starter", "CRM Professional")
- Filtrar o serviço "CRM" (`service_code === 'crm'`) da lista `serviceRows` para não duplicar
- Remover a aba "Tokens" separada e migrar o conteúdo (TokenBalance + TokenHistoryTable) para dentro da aba "Serviços"

## 3. Reorganização da aba Serviços — novo agrupamento

**Arquivo:** `src/types/tokens.ts` — atualizar categorias e labels

Novas categorias (substituindo as atuais):
```
'crm' | 'contact_center' | 'ai_agent' | 'addon' | 'negativacao' | 'tokens'
```

Labels:
```
crm → "CRM"
contact_center → "Contact Center"
ai_agent → "AI Agent"  
addon → "Serviços Adicionais" (Assinatura Digital, Higienização)
negativacao → "Negativação" (Serasa, Cartório)
tokens → "Tokens"
```

**Database:** Migration para atualizar categorias no `service_catalog`:
- `whatsapp_instance` → category `contact_center`
- `ai_agent_cobranca`, `ai_agent_voip` → category `ai_agent`
- `negativacao_serasa`, `protesto_cartorio` → category `negativacao` (renomear de "integration")
- `higienizacao_base` (addon, duplicado) → **deletar** (manter apenas `higienizacao` com category `addon`)
- `assinatura_digital` → continua `addon`
- `crm` → category `crm` (mas ficará oculto do grid pois já está no plano)

**Arquivo:** `src/components/services/ServiceCatalogGrid.tsx`
- Filtrar `crm` do catálogo exibido (já incluído no plano)
- Exibir aba "Tokens" com TokenBalance + TokenPurchaseDialog + TokenHistoryTable integrados

**Arquivo:** `src/pages/TenantSettingsPage.tsx`
- Remover TabsTrigger "tokens" (conteúdo migra para dentro de "servicos")
- Passar props de tokens para ServiceCatalogGrid (ou renderizar seção de tokens abaixo do grid)

## 4. Resumo de alterações

| Arquivo | Mudança |
|---|---|
| `src/components/carteira/CarteiraKanban.tsx` | Colunas flex-1 para preencher página |
| `src/pages/TenantSettingsPage.tsx` | Unificar "CRM {Plano}" no extrato, remover aba Tokens, mover tokens p/ Serviços |
| `src/types/tokens.ts` | Novas categorias + labels |
| `src/components/services/ServiceCatalogGrid.tsx` | Filtrar CRM, adicionar seção Tokens |
| Migration SQL | Atualizar categories, deletar `higienizacao_base` duplicado |

