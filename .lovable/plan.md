

# Plano: Vincular grupo de intervalos a campanhas existentes

## O que existe hoje

- Na **criação** de campanha já é possível selecionar um grupo de intervalos (`work_break_group_id`)
- O proxy já tem `update_campaign` que aceita qualquer campo via PATCH, incluindo `work_break_group_id`
- Os grupos de intervalos já são carregados via `list_work_break_groups`
- Porém **não existe UI** para alterar o grupo de intervalos de uma campanha já criada

## Correção

### `src/components/contact-center/threecplus/CampaignsPanel.tsx`

Adicionar na área expandida da campanha (junto ao slider de agressividade) um seletor de **Grupo de Intervalos**:

- Select com a lista de `workBreakGroups` já carregada
- Valor inicial: `campaign.work_break_group_id` (do objeto da campanha)
- Botão "Salvar" que chama `update_campaign` com `{ campaign_id, work_break_group_id }`
- Toast de sucesso/erro
- Reload da campanha após salvar

A UI ficará como um card similar ao da agressividade, logo abaixo dele:

```text
[ícone Coffee] Grupo de Intervalos
[Select: Grupo atual ▾]  [Salvar]
```

### Detalhes técnicos

- O `update_campaign` no proxy já faz `PATCH /campaigns/{id}` com qualquer campo — basta enviar `work_break_group_id` no body
- O `loadCampaigns` já traz os dados da campanha incluindo `work_break_group_id`, usado para pré-selecionar o valor

## Arquivo a editar

| Arquivo | Mudança |
|---|---|
| `src/components/contact-center/threecplus/CampaignsPanel.tsx` | Adicionar seletor de grupo de intervalos na view expandida da campanha |

