---
name: Portal Agreement Templates
description: Modelos pré-cadastrados de acordo por credor exibidos no portal público do devedor
type: feature
---

# Modelos de Acordo do Portal

Tabela `credor_agreement_templates` (RLS via `get_my_tenant_id()`) armazena ofertas pré-configuradas por credor: nome, tipo (avista/parcelado_com_entrada/parcelado_sem_entrada), desconto_percent, parcelas, entrada_percent, juros_mes_percent, ativo, destaque, ordem.

## Fluxo
1. Tenant cadastra modelos em Cadastros → Credores → Portal → aba "Modelos de Acordo".
2. Portal público chama edge `portal-lookup` action `get-templates` → RPC `get_portal_agreement_templates(_tenant_slug, _credor_name)` (SECURITY DEFINER, GRANT a anon).
3. Se houver templates ativos, `PortalNegotiation` exibe os cards dos modelos (ordenados por destaque DESC, ordem ASC). Senão, cai no fallback de geração dinâmica antiga (preserva compat).
4. Card "Fazer minha proposta" só aparece se `credores.portal_allow_custom_proposal = true` (default true).
5. Submit envia `template_id` opcional ao criar `agreements` (rastreabilidade via `notes`).

## Garantias
- **Não toca no fluxo interno** (operador/AgreementForm/agreementService). Acordo criado pelo portal usa o mesmo path de sempre (insert em `agreements` + triggers de `agreement_installments`).
- Credor sem modelos cadastrados = comportamento legado preservado.
- Rollback: `UPDATE credor_agreement_templates SET ativo=false`.
