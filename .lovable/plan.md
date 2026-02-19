

# Pagina de Importacao MaxList dentro do CollectFlow

## O que sera feito
Criar uma pagina dedicada dentro do sistema para importar listas diretamente do MaxSystem, substituindo a aplicacao MaxList externa. A pagina tera filtros de data, preview dos dados, e envio direto para a base de clientes -- tudo com acesso restrito a um tenant especifico.

## Funcionalidades

1. **Filtros de busca** - Campos de data para Vencimento (de/ate), Pagamento (de/ate) e Registro (de/ate), igual ao MaxList atual
2. **Consulta ao MaxSystem** - Busca via API do MaxSystem com contagem de resultados
3. **Preview dos dados** - Tabela mostrando os registros encontrados antes de importar
4. **Importacao em lote** - Envio via edge function para a base de clientes com upsert por external_id
5. **Download Excel** - Opcao de baixar a planilha como no MaxList atual
6. **Controle de acesso** - Apenas o tenant autorizado (configuravel) tera acesso a essa pagina

## Fluxo

```text
+------------------+     +------------------+     +------------------+
| Filtros de Data  | --> | Consulta API     | --> | Preview Tabela   |
| (Venc/Pag/Reg)   |     | MaxSystem        |     | com contagem     |
+------------------+     +------------------+     +------------------+
                                                          |
                                              +-----------+-----------+
                                              |                       |
                                     +--------v--------+    +--------v--------+
                                     | Enviar para CRM |    | Download Excel  |
                                     | (clients/bulk)  |    | (.xlsx)         |
                                     +-----------------+    +-----------------+
```

## Controle de Acesso

- Rota `/maxlist` acessivel apenas para tenants autorizados
- Verificacao feita no componente via `useTenant()` comparando o `tenant.id` ou `tenant.slug` com uma lista permitida
- Se o tenant nao tiver acesso, redireciona para o dashboard

---

## Detalhes Tecnicos

### Arquivos a criar

**`src/pages/MaxListPage.tsx`** (~400 linhas)
- Pagina React com filtros de data (Vencimento DE/ATE, Pagamento DE/ATE, Registro DE/ATE)
- Botao "Buscar" que consulta o MaxSystem via edge function proxy
- Tabela de preview com scroll usando componentes UI existentes (Table, ScrollArea)
- Botao "Enviar para CRM" que faz POST para `clients-api/clients/bulk` em lotes de 500
- Botao "Download Excel" usando a lib `xlsx` ja instalada
- Barra de progresso durante importacao
- Verificacao de tenant autorizado no mount

**`supabase/functions/maxsystem-proxy/index.ts`** (~80 linhas)
- Edge function proxy para evitar CORS ao chamar `https://maxsystem.azurewebsites.net/api/Installment`
- Recebe os filtros de data como query params
- Retorna os Items e Count do MaxSystem
- Autenticacao via JWT (usuario logado) + verificacao de tenant

### Alteracoes em arquivos existentes

**`src/App.tsx`**
- Adicionar rota `/maxlist` protegida com `ProtectedRoute requireTenant`

**`src/components/AppLayout.tsx`**
- Adicionar link "MaxList" no menu lateral (visivel apenas para o tenant autorizado)

**`supabase/config.toml`** (nao editavel diretamente, mas a function sera registrada automaticamente)

### Mapeamento de campos MaxSystem -> CollectFlow

| MaxSystem API Field | Campo Intermediario | Campo clients |
|---|---|---|
| ResponsibleName | NOME_DEVEDOR | nome_completo |
| ResponsibleCPF | CNPJ_CPF | cpf |
| ContractNumber | COD_CONTRATO | cod_contrato |
| Id (titulo) | TITULO | external_id |
| Number | PARCELA | numero_parcela |
| Value | VL_TITULO | valor_parcela |
| PaymentDateQuery | DT_VENCIMENTO | data_vencimento |
| PaymentDateEffected | DT_PAGAMENTO | data_pagamento |
| IsCancelled | STATUS | status (pendente/pago/quebrado) |
| CellPhone1 | FONE_1 | phone |
| CellPhone2 | FONE_2 | phone2 |
| HomePhone | FONE_3 | phone3 |

### Logica de status
- Se tem `DT_PAGAMENTO` -> "pago"
- Se `IsCancelled === true` -> "quebrado"
- Caso contrario -> "pendente"

### Tenant autorizado
O controle de acesso sera feito comparando o slug do tenant. Inicialmente configurado como constante no codigo, podendo futuramente ser movido para uma tabela de configuracao.
