

# Plano: Abas de Integração no Super Admin Configurações

## Objetivo
Transformar a página de Configurações do Sistema (`AdminConfiguracoesPage`) em uma interface com abas, adicionando uma aba para cada integração do sistema com teste de conexão e configuração. Atualmente a página tem apenas o card do Asaas e cards de configuração geral.

## Estrutura de Abas

A página será reorganizada com as seguintes abas:

1. **Geral** -- configurações existentes (Asaas, Go-Live Checklist, Segurança, Notificações, etc.)
2. **Target Data** -- configuração de API Key/Secret, teste de conexão com a edge function `targetdata-enrich`
3. **Negociarie** -- configuração de credenciais e teste de conexão via `negociarie-proxy`
4. **CobCloud** -- configuração de tokens e teste de conexão via `cobcloud-proxy`
5. **3CPlus** -- configuração de domínio/token e teste de conexão via `threecplus-proxy`
6. **WhatsApp** -- configuração de provedores (Gupshup, Evolution, WuzAPI) e teste de conexão
7. **Negativação** -- configuração de Serasa e Protesto

## Diferença do Admin vs Tenant

As abas do tenant (em `IntegracaoPage`) configuram credenciais **por tenant** (no campo `settings` do tenant). As abas do Super Admin configurarão os **secrets globais** da plataforma (variáveis de ambiente das edge functions) e permitirão testar a conectividade de cada serviço.

## Implementação

### Arquivo: `src/pages/admin/AdminConfiguracoesPage.tsx`

- Adicionar `Tabs` com `TabsList` e `TabsTrigger` para cada integração
- Mover o conteúdo atual para a aba "Geral"
- Criar componentes internos (ou inline) para cada aba de integração:

**Cada aba de integração terá:**
- Card com ícone e título
- Campos de credenciais (mascarados com show/hide)
- Botão "Testar Conexão" com terminal de logs em tempo real (mesmo padrão do Asaas)
- Badge de status (Conectado / Falha / Não configurado)

**Target Data (aba nova):**
- Campos: API Key, API Secret (read-only display, indicando que são secrets do sistema)
- Botão "Testar Conexão" que invoca `targetdata-enrich` com um CPF de teste
- Status da configuração

**Demais abas:**
- Cada uma invocará a edge function correspondente com dados de teste para validar a conectividade

### Detalhes Técnicos

- Os testes de conexão utilizarão `supabase.functions.invoke()` para chamar as edge functions correspondentes
- O terminal de logs seguirá o mesmo padrão visual já implementado no card do Asaas (ScrollArea + logs com timestamp e ícones de status)
- Nenhuma alteração de banco de dados necessária
- Nenhuma nova edge function necessária -- usaremos as existentes para testes

### Arquivos modificados
- `src/pages/admin/AdminConfiguracoesPage.tsx` -- refatorar com abas e criar seções para cada integração

