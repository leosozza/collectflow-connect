

## Melhorias nos Filtros da Carteira e Exclusao de Quitados com Envio por E-mail

### Resumo das alteracoes

1. Renomear "Status de Cobranca" para "Status de Carteira" no filtro
2. Adicionar filtro por Data de Cadastro (De/Ate)
3. Adicionar filtro por Data de Quitacao (De/Ate)
4. Adicionar checkbox "Quitados" (filtra clientes com status "pago")
5. Ao excluir clientes quitados, perguntar e-mail para envio da planilha
6. Criar campo `data_quitacao` na tabela `clients`

---

### Detalhes tecnicos

**1. Migracao de banco de dados**

Adicionar coluna `data_quitacao` (tipo `date`, nullable) na tabela `clients`:
```sql
ALTER TABLE public.clients ADD COLUMN data_quitacao date;
```

**2. `src/services/clientService.ts`**

- Atualizar a interface `Client` para incluir `data_quitacao: string | null`
- Na funcao `markAsPaid`, setar `data_quitacao` com a data atual quando o status muda para "pago"

**3. `src/components/clients/ClientFilters.tsx`**

- Renomear label "Status de Cobranca" para **"Status de Carteira"**
- Adicionar ao estado de filtros (interface `Filters`):
  - `cadastroDe: string` e `cadastroAte: string` (Data de Cadastro)
  - `quitacaoDe: string` e `quitacaoAte: string` (Data de Quitacao)
  - `quitados: boolean` (checkbox Quitados)
- Adicionar no grid de filtros avancados:
  - Dois campos de data para "Cadastro De" / "Cadastro Ate"
  - Dois campos de data para "Quitacao De" / "Quitacao Ate"
  - Checkbox "Quitados" ao lado do existente "Sem acordo"

**4. `src/pages/CarteiraPage.tsx`**

- Atualizar estado `filters` com os novos campos
- Adicionar logica de filtragem no `displayClients`:
  - `cadastroDe/cadastroAte`: filtrar por `created_at`
  - `quitacaoDe/quitacaoAte`: filtrar por `data_quitacao`
  - `quitados`: filtrar clientes com `status === "pago"`
- Criar dialog de exclusao de quitados:
  - Mostra campo para digitar e-mail adicional
  - Ao confirmar: gera planilha Excel, envia via edge function, exclui os registros
  - Titulo da planilha: "Clientes Quitados excluidos do Sistema RIVO CONNECT"

**5. Edge Function `send-quitados-report`**

- Recebe: lista de clientes (JSON), e-mail do destinatario, e-mail do admin
- Gera arquivo Excel (usando biblioteca no Deno)
- Envia o e-mail com a planilha anexada via Resend
- Requer configuracao da chave `RESEND_API_KEY`

**6. Configuracao necessaria**

Para o envio de e-mail funcionar, sera necessario:
- Cadastrar uma conta no Resend (https://resend.com)
- Validar o dominio de e-mail no Resend
- Criar uma API Key e configurar como secret no projeto

---

### Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | Adicionar coluna `data_quitacao` |
| `src/components/clients/ClientFilters.tsx` | Renomear label, novos filtros de data e checkbox Quitados |
| `src/pages/CarteiraPage.tsx` | Novos filtros no state, logica de filtragem, dialog de exclusao com e-mail |
| `src/services/clientService.ts` | Campo `data_quitacao` na interface e no `markAsPaid` |
| `supabase/functions/send-quitados-report/index.ts` | Edge function para gerar e enviar planilha por e-mail |

### Proximos passos apos aprovacao

Antes de implementar, sera solicitada a configuracao da **RESEND_API_KEY** para habilitar o envio de e-mails.

