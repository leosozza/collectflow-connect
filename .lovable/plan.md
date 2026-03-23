

# Plano: Sincronizar tabulações RIVO com qualificações nas campanhas 3CPlus

## Situação atual

O sistema já cria uma lista de qualificações "RIVO Tabulações" na 3CPlus via `sync_dispositions` e salva o `qualification_list_id` no tenant settings. Porém, **essa lista não é automaticamente vinculada às campanhas existentes**. Ao criar uma campanha nova, o campo `qualification_list` é enviado opcionalmente, mas campanhas já criadas ficam sem a lista RIVO.

## O que fazer

Após sincronizar as tabulações, automaticamente vincular a lista "RIVO Tabulações" a **todas as campanhas do tenant** via `update_campaign` (PATCH com `qualification_list: listId`).

## Mudanças

### 1. `src/services/dispositionService.ts` — `syncDispositionsTo3CPlus`

Após salvar o `disposition_map` e `qualification_list_id` no tenant settings, fazer um loop pelas campanhas do tenant e vincular a lista:

- Chamar `threecplus-proxy` com action `list_campaigns` para obter todas as campanhas
- Para cada campanha, chamar `update_campaign` com `qualification_list: listId`
- Logar resultado

### 2. `src/components/contact-center/threecplus/CampaignsPanel.tsx`

Na aba "Qualificações" da campanha expandida:
- Mostrar qual lista de qualificações está vinculada à campanha (campo `qualification_list` ou `dialer_settings.qualification_list_id` da resposta)
- Botão "Vincular Tabulações RIVO" que faz o PATCH da campanha com o `qualification_list_id` salvo no tenant settings
- Se já vinculada, mostrar badge "✅ Sincronizada"

### 3. `src/components/cadastros/CallDispositionTypesTab.tsx`

No botão "Sincronizar 3CPlus", após a sync, mostrar toast informando quantas campanhas foram atualizadas.

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/services/dispositionService.ts` | Após sync, vincular lista a todas as campanhas |
| `src/components/contact-center/threecplus/CampaignsPanel.tsx` | Mostrar status de qualificações vinculadas + botão manual |
| `src/components/cadastros/CallDispositionTypesTab.tsx` | Toast com info de campanhas atualizadas |

