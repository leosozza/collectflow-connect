## Diagnóstico

**Confirmado no banco:** existe 1 anexo da Ana da Silva Fernandes (CPF `83447148500`) no tenant `39a450f8...` (Y.BRASIL). A Barbara é `admin` do **mesmo** tenant — a RLS de `client_attachments` (`tenant_id = get_my_tenant_id()`) permite ler. Não é problema de permissão.

**Causa real:** o componente `ClientAttachments` recebe o CPF errado em dois cenários:

1. **Rota nova `/carteira/perfil/:id`** (App.tsx linha 122): o `useParams` devolve `cpf = undefined`. Em `ClientDetailPage.tsx` linha 828:
   ```tsx
   <ClientAttachments cpf={cpf || ""} />
   ```
   passa **string vazia** → query `.eq("client_cpf", "")` devolve 0 resultados.

2. **Rota antiga `/carteira/:cpf`**: o CPF pode chegar formatado (`834.471.485-00`), mas o componente faz `.eq("client_cpf", cpf)` **sem normalizar**, enquanto o banco guarda só dígitos (`83447148500`).

A Barbara provavelmente abriu o cliente por uma lista que usa a rota `/perfil/:id` (ex.: cards agrupados da Carteira), enquanto o outro operador (screenshot 2) entrou por uma lista que usa `/carteira/:cpf` com CPF cru — por isso vê os anexos.

Outros componentes da página (`PaymentDialog`, `ClientTimeline`, etc.) sofrem do mesmo padrão `cpf={cpf || ""}` e podem ter sintomas idênticos quando o usuário entra pela rota `/perfil/:id`.

## Correção (UI/presentation, sem mexer em RLS nem schema)

### 1. `src/components/clients/ClientAttachments.tsx`
- Normalizar internamente: `const cpfDigits = (cpf || "").replace(/\D/g, "");`
- Usar `cpfDigits` no `queryKey`, na query (`.eq("client_cpf", cpfDigits)`), no upload e no insert.
- `enabled: !!cpfDigits` (em vez de `!!cpf`) para não disparar query com string vazia.

### 2. `src/pages/ClientDetailPage.tsx`
- Derivar um `effectiveCpf` único no topo do componente:
  ```ts
  const effectiveCpf = ((cpf || clientData?.cpf || "") as string).replace(/\D/g, "");
  ```
  (usando o CPF retornado pela query `client-detail` quando a rota é por `id`).
- Substituir todas as ocorrências de `cpf={cpf || ""}` (linhas 529, 789, 815, 828, 839, 1035) e `clientCpf={cpf}` (807) por `effectiveCpf`.
- Manter `enabled` das queries dependentes desse valor.

### 3. Verificação
- Recarregar o perfil da Ana pelos dois caminhos (`/carteira/83447148500` e `/carteira/perfil/<id>`) com a sessão da Barbara e confirmar que a aba **Anexos** lista o PDF.
- Conferir que Histórico, Pagamentos e Documentos continuam funcionando nas duas rotas.

## Fora de escopo
- Nenhuma alteração em RLS, edge functions, storage ou schema.
- Não vamos mexer no segundo PDF que aparece no screenshot 2 — ele não está no banco hoje (provavelmente foi excluído ou nunca foi confirmado o insert); se o usuário quiser, investigamos depois em tarefa separada.
