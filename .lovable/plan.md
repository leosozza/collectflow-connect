

# Plano: Sistema de Gestao de Tokens - RIVO CONNECT

Este e um sistema grande que sera implementado em fases sequenciais. Cada fase depende da anterior.

---

## Fase 1: Estrutura de Banco de Dados

Criar todas as tabelas, RLS policies, funcoes RPC e dados iniciais via migracao SQL:

**Tabelas:**
- `service_catalog` - Catalogo global de servicos (Super Admin)
- `tenant_services` - Servicos contratados por tenant
- `tenant_tokens` - Saldo de tokens por tenant
- `token_packages` - Pacotes de tokens disponiveis
- `token_transactions` - Historico de transacoes
- `service_usage_logs` - Logs de uso
- `payment_records` - Registros de pagamento

**Funcoes RPC:**
- `consume_tokens()` - Consumo atomico com FOR UPDATE
- `add_tokens()` - Creditar tokens (compra/bonus/ajuste)
- `check_token_balance()` - Verificar saldo
- `get_tenant_token_summary()` - Resumo do tenant

**Dados iniciais:**
- 8 servicos no catalogo (CRM, WhatsApp, IA Cobranca, IA Voip, Assinatura Digital, Serasa, Protesto, Higienizacao)
- 5 pacotes de tokens (Starter R$50 ate Enterprise R$1.500)

**RLS:** Catalogo/pacotes publicos para leitura, demais isolados por tenant, Super Admin acessa tudo.

---

## Fase 2: Types + Services TypeScript

**Arquivos a criar:**
- `src/types/tokens.ts` - Todas as interfaces e types
- `src/services/tokenService.ts` - CRUD tokens, compra, consumo, historico
- `src/services/serviceCatalogService.ts` - CRUD catalogo, servicos do tenant

---

## Fase 3: UI Tenant - Aba Servicos e Tokens na Central da Empresa

**Atualizar `src/pages/TenantSettingsPage.tsx`:**
- Substituir aba "Servicos" atual (baseada em JSON settings) pela nova baseada em `service_catalog` + `tenant_services`
- Adicionar aba "Tokens" com saldo, compra e historico

**Componentes a criar:**

| Componente | Funcao |
|---|---|
| `src/components/tokens/TokenBalance.tsx` | Widget saldo com badge baixo |
| `src/components/tokens/TokenPurchaseDialog.tsx` | Modal compra em 3 steps |
| `src/components/tokens/TokenPackageCard.tsx` | Card de pacote |
| `src/components/tokens/TokenHistoryTable.tsx` | Tabela historico com filtros |
| `src/components/services/ServiceCatalogGrid.tsx` | Grid de servicos por categoria |
| `src/components/services/ServiceCard.tsx` | Card servico com ativar/desativar |

**Aba Financeiro** tambem sera atualizada para mostrar resumo de servicos ativos e custo mensal.

---

## Fase 4: Area Super Admin - Gestao de Servicos

**Nova rota:** `/admin/servicos`

**Nova pagina:** `src/pages/admin/AdminServicosPage.tsx`

**Componentes:**
- `AdminServiceCatalog.tsx` - Tabela editavel CRUD de servicos
- `AdminServiceForm.tsx` - Form criar/editar servico
- `AdminTokenPackages.tsx` - Gestao de pacotes de tokens
- `AdminTenantTokens.tsx` - Ver tokens por tenant

**Atualizar:**
- `src/components/SuperAdminLayout.tsx` - Adicionar item "Servicos" no menu
- `src/App.tsx` - Registrar rota `/admin/servicos`

---

## Fase 5: Edge Functions

**3 funcoes:**
1. `purchase-tokens` - Iniciar compra, criar payment_record, integrar gateway (placeholder)
2. `payment-webhook` - Receber confirmacao, creditar tokens
3. `consume-tokens` - Consumir tokens atomicamente, verificar servico ativo, alertar saldo baixo

---

## Fase 6: Widget de Tokens no Sidebar/Header

Adicionar indicador de saldo de tokens no `AppLayout.tsx` para visibilidade constante.

---

## Ordem de implementacao

Dado o tamanho, sugiro implementar **Fase 1 + Fase 2** primeiro (banco + services), depois **Fase 3** (UI tenant), depois **Fase 4** (admin), e por fim **Fases 5 e 6**.

Posso comecar pela Fase 1 (migracao SQL com todas as tabelas, RLS, funcoes e dados iniciais)?

