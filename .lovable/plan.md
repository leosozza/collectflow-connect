

# Correções e Melhorias na Carteira

## 1. Corrigir Pesquisa por Nome

**Problema:** A busca por primeiro nome pode falhar devido a acentos e caracteres especiais (ex: "João" vs "joao"). A busca atual usa `includes()` sem normalização de acentos.

**Solução:** Adicionar normalização de acentos (remover diacríticos) na comparação, usando `normalize("NFD").replace(/[\u0300-\u036f]/g, "")` tanto no termo de busca quanto no nome do cliente.

**Arquivo:** `src/pages/CarteiraPage.tsx` (linhas 70-76)

```typescript
// De:
const term = filters.search.trim().toLowerCase();
filtered = clients.filter(
  (c) =>
    c.nome_completo.toLowerCase().includes(term) || ...
);

// Para:
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const term = normalize(filters.search.trim());
filtered = clients.filter(
  (c) =>
    normalize(c.nome_completo).includes(term) || ...
);
```

---

## 2. Corrigir Logica de Entrada + Parcelas

**Problema:** No `createClient`, a primeira parcela recebe `valor_parcela = valorEntrada`, quando deveria manter a distinção clara: parcela 1 tem o valor de entrada, demais parcelas tem o valor da parcela regular.

**Arquivo:** `src/services/clientService.ts` (linhas 75-97)

**Correção:** Garantir que:
- Parcela 1: `valor_parcela = valor_entrada` (valor de entrada)
- Parcelas 2+: `valor_parcela = valor_parcela` (valor regular da parcela)
- O campo `valor_entrada` armazena o valor de entrada apenas na primeira parcela, e 0 nas demais

```typescript
records.push({
  ...commonFields,
  numero_parcela: validated.numero_parcela + i,
  total_parcelas: totalParcelas,
  valor_entrada: isFirst ? valorEntrada : 0,       // entrada só na 1a
  valor_parcela: isFirst ? valorEntrada : validated.valor_parcela,
  valor_pago: isFirst ? validated.valor_pago : 0,
  data_vencimento: dateStr,
  status: isFirst ? validated.status : "pendente",
  operator_id: operatorId,
});
```

---

## 3. Pagina de Detalhes do Cliente (clicavel pelo nome)

### 3.1 Nova rota `/carteira/:cpf`

**Arquivo:** `src/App.tsx`
- Adicionar rota `/carteira/:cpf` apontando para novo componente `ClientDetailPage`

### 3.2 Nome clicavel na tabela

**Arquivo:** `src/pages/CarteiraPage.tsx`
- Tornar o nome do cliente um link clicavel (usando `react-router-dom` `Link` ou `useNavigate`) que navega para `/carteira/:cpf`

### 3.3 Nova pagina `ClientDetailPage`

**Arquivo (novo):** `src/pages/ClientDetailPage.tsx`

Layout inspirado no print de referência (dados do devedor), com as seguintes seções:

**Cabeçalho - Dados do Cliente:**
- Nome Completo, CPF, Telefone, Email
- Credor, Operador
- Informações consolidadas (total em aberto, total pago)

**Abas (usando Tabs do Radix UI):**

1. **Titulos em Aberto** - Lista de todas as parcelas pendentes do cliente (filtradas por CPF), com status, valor, vencimento e ações (pagar, editar)

2. **Historico de Negociação e Ocorrencias** - Lista de acordos (da tabela `agreements`) filtrados pelo CPF do cliente + log de auditoria relacionado

3. **Anexos** - Upload e visualização de comprovantes e documentos do cliente (requer storage bucket)

### 3.4 Bucket de Storage para Anexos

**Migração SQL:**
- Criar bucket `client-attachments` no storage
- Criar tabela `client_attachments` para metadados (id, tenant_id, client_cpf, file_name, file_path, uploaded_by, created_at)
- RLS: tenant users podem ver/inserir, admins podem deletar
- Policies no bucket de storage para controle de acesso

### 3.5 Componente de Anexos

**Arquivo (novo):** `src/components/clients/ClientAttachments.tsx`
- Upload de arquivos (comprovantes, documentos)
- Lista de arquivos com download
- Exclusão de arquivos (admin)

---

## Resumo dos Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/CarteiraPage.tsx` | Corrigir busca + nome clicavel |
| `src/services/clientService.ts` | Corrigir lógica entrada/parcelas |
| `src/pages/ClientDetailPage.tsx` | **Novo** - Pagina de detalhes com abas |
| `src/components/clients/ClientAttachments.tsx` | **Novo** - Componente de upload/lista de anexos |
| `src/App.tsx` | Adicionar rota `/carteira/:cpf` |
| **Migração SQL** | Criar bucket `client-attachments` + tabela `client_attachments` com RLS |

