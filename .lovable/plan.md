

# Plano: Corrigir exibição de email e adicionar validação pré-boleto

## Causa Raiz

1. **Email não exibido em "Mais Informações"**: O `client` usado no header é `clients[0]` (primeiro registro por `numero_parcela`). Se esse registro específico não tem email mas outro registro do mesmo CPF tem, o email aparece vazio na visualização — mas ao editar, o formulário usa `client.email || ""` que pode pegar de outro lugar.

2. **Erro ao gerar boleto**: `fetchClientAddress` no `negociarieService.ts` busca apenas o primeiro registro via `.maybeSingle()`. Se esse registro não tem email, a validação em `validateClienteFields` rejeita com "Campo obrigatório ausente: email".

3. **Sem validação preventiva**: O fluxo de formalização do acordo gera boletos automaticamente sem verificar antes se os dados obrigatórios (email, endereço, CEP, telefone) estão completos.

## Solução

### 1. Consolidar dados do cliente (email, endereço, telefone)

No `fetchClientAddress`, ao invés de buscar `.maybeSingle()`, buscar todos os registros do CPF e consolidar os campos, priorizando valores preenchidos.

**Arquivo**: `src/services/negociarieService.ts`

```typescript
// ANTES: .maybeSingle() retorna apenas 1 registro
// DEPOIS: buscar múltiplos e consolidar
const { data } = await supabase
  .from("clients")
  .select("nome_completo, cpf, email, phone, cep, endereco, bairro, cidade, uf")
  .eq("cpf", cleanCpf);

// Consolidar: para cada campo, usar o primeiro valor não-vazio encontrado
const consolidated = (data || []).reduce((acc, row) => {
  for (const key of Object.keys(acc)) {
    if (!acc[key] && row[key]) acc[key] = row[key];
  }
  return acc;
}, { nome_completo: "", email: "", phone: "", cep: "", endereco: "", bairro: "", cidade: "", uf: "" });
```

### 2. Consolidar `client` no header

No `ClientDetailPage.tsx`, criar um `client` consolidado ao invés de usar `clients[0]`.

**Arquivo**: `src/pages/ClientDetailPage.tsx`

```typescript
// ANTES: const first = clients[0];
// DEPOIS: consolidar campos de contato de todos os registros
const first = useMemo(() => {
  const base = { ...clients[0] };
  for (const c of clients) {
    if (!base.email && c.email) base.email = c.email;
    if (!base.phone && c.phone) base.phone = c.phone;
    if (!base.endereco && c.endereco) base.endereco = c.endereco;
    if (!base.bairro && c.bairro) base.bairro = c.bairro;
    if (!base.cidade && c.cidade) base.cidade = c.cidade;
    if (!base.uf && c.uf) base.uf = c.uf;
    if (!base.cep && c.cep) base.cep = c.cep;
  }
  return base;
}, [clients]);
```

### 3. Diálogo de validação pré-boleto no AgreementCalculator

Antes de gerar boletos automaticamente, verificar se os campos obrigatórios estão preenchidos. Se não, mostrar um diálogo com os campos faltantes para o usuário preencher e atualizar.

**Arquivo**: `src/components/client-detail/AgreementCalculator.tsx`

- Adicionar estado `missingFieldsDialog` com os campos faltantes
- Antes de chamar `negociarieService.generateAgreementBoletos`, verificar: email, endereco, bairro, cidade, uf, cep, phone
- Se algum estiver faltando, abrir diálogo com formulário inline para preenchimento
- Ao confirmar, atualizar os registros do cliente no banco e prosseguir com a geração

```text
Fluxo:
1. Usuário clica "Formalizar Acordo"
2. Acordo é criado no banco ✓
3. NOVO: Verificar dados obrigatórios para boleto
4. Se faltam dados → abrir diálogo "Dados incompletos para emissão de boleto"
   - Formulário com campos faltantes (email, endereço, etc.)
   - Botão "Salvar e Gerar Boletos"
5. Se dados completos → gerar boletos normalmente
```

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/services/negociarieService.ts` | `fetchClientAddress` consolida dados de múltiplos registros |
| `src/pages/ClientDetailPage.tsx` | `first` consolidado via `useMemo` |
| `src/components/client-detail/AgreementCalculator.tsx` | Diálogo de validação pré-boleto com formulário inline |

