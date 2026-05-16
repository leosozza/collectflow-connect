---
name: Portal Agreement Templates
description: Modelos pré-cadastrados de acordo por credor exibidos no portal público do devedor, com filtragem por aging
type: feature
---

# Modelos de Acordo do Portal

Tabela `credor_agreement_templates` (RLS via `get_my_tenant_id()`) armazena ofertas pré-configuradas por credor: nome, tipo (avista/parcelado_com_entrada/parcelado_sem_entrada), desconto_percent, parcelas, entrada_percent, juros_mes_percent, ativo, destaque, ordem, **aging_min_days**, **aging_max_days**.

## Aging (dias em atraso)
- `aging_min_days` / `aging_max_days` são opcionais. Ambos NULL = vale para qualquer aging.
- Aging do devedor = `floor((hoje - MIN(data_vencimento)) / 1 dia)` das parcelas `status='pendente'` em `clients` para o CPF/credor/tenant.
- Calculado pela edge `portal-lookup` (action `get-templates`) e passado como `_aging_days` ao RPC.
- RPC `get_portal_agreement_templates(_tenant_slug, _credor_name, _aging_days)` filtra: `(aging_min IS NULL OR _aging_days >= aging_min) AND (aging_max IS NULL OR _aging_days <= aging_max)`.

## Fluxo
1. Tenant cadastra modelos em Cadastros → Credores → Portal → aba "Modelos de Acordo" (com presets de aging: Qualquer, 0–30, 31–90, 91–180, 181–360, 360+).
2. Portal público chama edge `portal-lookup` action `get-templates` → calcula aging → RPC retorna só os modelos que batem.
3. `PortalNegotiation` exibe cards (ordenados por destaque DESC, ordem ASC). Sem matches → fallback de geração dinâmica antiga.
4. Card "Fazer minha proposta" só aparece se `credores.portal_allow_custom_proposal = true`.

## Garantias
- **Não toca no fluxo interno** (operador/AgreementForm/agreementService).
- Templates sem aging configurado = comportamento legado preservado.
- Rollback: `UPDATE credor_agreement_templates SET ativo=false` ou `aging_min_days=NULL, aging_max_days=NULL`.
