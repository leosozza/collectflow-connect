

## Mover busca de endereco do MaxList para a formalizacao do acordo

### Resumo
Atualmente, ao importar registros do MaxList, o sistema busca o endereco de cada contrato via MaxSystem API antes de salvar. A mudanca move essa busca para o momento em que o operador clica em "Gerar Acordo" na tela de detalhe do cliente (`/carteira/:cpf`), garantindo que os dados de endereco estejam atualizados no momento da formalizacao.

### Mudancas

**1. Remover busca de endereco do MaxList (`src/pages/MaxListPage.tsx`)**
- Remover a fase de busca de enderecos (linhas 367-378 com `fetchAddressForContract`)
- Remover os campos `endereco`, `cep`, `bairro`, `cidade`, `uf`, `email` do mapeamento de registros na importacao
- Manter a funcao `fetchAddressForContract` no arquivo (sera reutilizada) OU mover para um service

**2. Criar servico de enriquecimento de endereco (`src/services/addressEnrichmentService.ts`)**
- Extrair a funcao `fetchAddressForContract` do MaxListPage para um servico reutilizavel
- Criar funcao `enrichClientAddress(cpf, tenantId)` que:
  1. Busca todos os registros `clients` com o CPF dado
  2. Identifica os `cod_contrato` unicos
  3. Chama `fetchAddressForContract` para cada contrato
  4. Atualiza os registros na tabela `clients` com os dados de endereco obtidos
  5. Retorna os dados de endereco para uso no acordo

**3. Integrar no AgreementCalculator (`src/components/client-detail/AgreementCalculator.tsx`)**
- Ao clicar em "Gerar Acordo", antes de chamar `createAgreement`:
  1. Verificar se o cliente ja tem endereco preenchido
  2. Se nao, buscar via `enrichClientAddress`
  3. Exibir indicador de progresso "Buscando endereco..."
  4. Atualizar os registros na tabela `clients` com os dados obtidos
  5. Prosseguir com a criacao do acordo normalmente

### Fluxo atualizado

```text
Importacao MaxList          Formalizacao do Acordo
+-------------------+      +----------------------------+
| Busca parcelas    |      | Operador clica "Gerar"     |
| Salva no CRM      | ---> | Sistema busca endereco     |
| SEM endereco      |      | via MaxSystem API          |
+-------------------+      | Atualiza clients no banco  |
                            | Cria o acordo              |
                            +----------------------------+
```

### Detalhes tecnicos

| Arquivo | Acao |
|---|---|
| `src/services/addressEnrichmentService.ts` | Novo - funcao `enrichClientAddress` extraida do MaxListPage |
| `src/pages/MaxListPage.tsx` | Remover busca de endereco no `handleSendToCRM`; remover campos de endereco do mapeamento |
| `src/components/client-detail/AgreementCalculator.tsx` | Chamar `enrichClientAddress` antes de `createAgreement`, com loading state |

