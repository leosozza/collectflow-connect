

## Plano: Criar documentacao da integracao MaxSystem

### Arquivo a criar

**`docs/maxsystem-integracao.md`**

Documento completo cobrindo todos os fluxos de integracao com o MaxSystem, organizado nas seguintes secoes:

---

### Conteudo do documento

1. **Visao Geral** - O que e o MaxSystem, URL base (`maxsystem.azurewebsites.net`), proxy utilizado (`maxsystem-proxy`)

2. **Autenticacao e Controle de Acesso**
   - JWT via Bearer token
   - Tenants permitidos: `maxfama`, `temis`
   - Validacao de claims e verificacao de tenant

3. **Endpoints Disponiveis** (via query param `action`)

   **3.1 Parcelas / Installments** (`action=installments` ou default)
   - API: `/api/Installment`
   - Filtros OData: vencimento, pagamento, registro, CPF, contrato, status (IsCancelled), agencias
   - Campos retornados: ContractNumber, ResponsibleName, ResponsibleCPF, Value, PaymentDateQuery, PaymentDateEffected, IsCancelled, Number, CellPhone1/2, HomePhone
   - Paginacao: `$top` (default 50000), `$orderby`, `$inlinecount`
   - Diferenciacao entre parcelas pagas (PaymentDateEffected preenchido) e em aberto

   **3.2 Agencias** (`action=agencies`)
   - API: `/api/Agencies`
   - Retorna lista de agencias com Id e Name
   - Usado como filtro multi-select na importacao

   **3.3 Busca de Modelo** (`action=model-search`)
   - API: `/api/NewModelSearch`
   - Parametro: `contractNumber`
   - Retorna o primeiro item com `Id` do modelo (usado para buscar detalhes)

   **3.4 Detalhes do Modelo** (`action=model-details`)
   - API: `/api/NewModelSearch/Details/{modelId}`
   - Parametro: `modelId`
   - Retorna: Address, CEP, Neighborhood, City, State (convertido para UF), Email, ModelName

4. **Fluxo de Importacao (MaxList)**
   - Pagina: `/maxlist`
   - Filtros disponiveis: periodo de vencimento/pagamento/registro, CPF, contrato, status, agencias
   - Mapeamento de campos MaxSystem para tabela `clients`
   - Upsert por `external_id` (formato: `{ContractNumber}-{Number}`)
   - Status: pago (tem data pagamento), cancelado (IsCancelled), pendente (demais)
   - Selecao de Status de Cobranca antes da importacao
   - Log de importacao na tabela `import_logs`

5. **Enriquecimento de Endereco**
   - Servico: `addressEnrichmentService.ts`
   - Momento: na formalizacao do acordo (nao na importacao)
   - Processo em 2 passos: model-search (por ContractNumber) -> model-details (por modelId)
   - Cache por contrato para evitar chamadas duplicadas
   - Busca em lote (batches de 5 contratos em paralelo)
   - Campos persistidos: endereco, cep, bairro, cidade, uf, email, observacoes (ModelName)
   - Se ja possui endereco, retorna o existente sem consultar API

6. **Mapa de Conversao de Estados**
   - Tabela completa: numero do MaxSystem -> sigla UF (1=AC, 2=AL, ..., 27=TO)
   - Nota sobre inconsistencia entre proxy (25=SE, 26=SP) e frontend (25=SP, 26=SE) — ambos estao no codigo

7. **Estrutura de Arquivos**
   - `supabase/functions/maxsystem-proxy/index.ts` — Edge function proxy
   - `src/pages/MaxListPage.tsx` — Interface de consulta e importacao
   - `src/services/addressEnrichmentService.ts` — Enriquecimento de endereco

8. **Tabela de Mapeamento de Campos**
   - MaxSystem -> CRM: ContractNumber -> cod_contrato, ResponsibleName -> nome_completo, ResponsibleCPF -> cpf, Value -> valor_parcela, etc.

