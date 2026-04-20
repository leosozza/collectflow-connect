

## Corrigir preenchimento automático de endereço pelo CEP

### Diagnóstico

Existem 4 telas que usam `lookupCep` (`@/lib/viaCep`). A função em si está OK — o problema está em como cada tela consome o resultado.

**Tela 1 — Edição inline do endereço no detalhe do cliente** (`ClientDetailHeader.tsx` linha 577-583):
O `InlineEditableField` com `type="cep"` é usado **sem** `onBlurExtra`. Não há nenhum lookup automático. O usuário edita o CEP, salva, e Rua/Bairro/Cidade/UF continuam como estavam. Esta é a tela mais visível e provavelmente o foco da reclamação.

**Tela 2 — Diálogo "Editar dados" no detalhe** (`ClientDetailHeader.tsx` linha 660-673):
Tem `onBlur={handleCepBlur}` mas só dispara quando o usuário tira o foco. Sem máscara/auto-trigger ao digitar 8 dígitos. Sem toast de erro se o CEP não existir.

**Tela 3 — `ClientForm` (Carteira → Novo Cliente)** (`src/components/clients/ClientForm.tsx`):
- `onBlur` igual ao caso 2.
- **Bug grave**: `bairro` é preenchido pelo lookup mas **nunca é incluído no payload** do `handleSubmit` (linhas 77-96). O backend recebe rua/cidade/uf, mas nunca o bairro.
- Sem `defaultValues` para `bairro` (linha 40).

**Tela 4 — `CobrancaForm`** (`src/components/integracao/CobrancaForm.tsx`):
Já funciona bem — auto-dispara ao atingir 8 dígitos via `handleChange`. Mantém-se.

**Tela 5 — `AgreementCalculator` (campos faltantes)**:
Já funciona via `onBlur`, só preenche se o campo estiver vazio. Mantém-se.

### Mudanças

**1. `src/components/client-detail/InlineEditableField.tsx` — auto-lookup interno para `type="cep"`**

Quando `type === "cep"`, ao digitar 8 dígitos (ou no blur), chamar `lookupCep` automaticamente e expor o resultado via novo callback opcional `onCepResolved(data)`. Adicionar máscara `00000-000` no onChange. Mostrar `Loader2` enquanto consulta. Toast de erro discreto se inválido.

```ts
type?: "text" | "uf" | "cep";
onCepResolved?: (data: { logradouro: string; bairro: string; localidade: string; uf: string }) => void;
```

Internamente: `useEffect` no draft — quando `type==="cep"` e `digits.length===8`, dispara lookup (com debounce de 300 ms e cancelamento via `AbortController`/flag `cancelled`), chama `onCepResolved`, e ainda mantém `onBlurExtra` para retrocompat.

**2. `src/components/client-detail/ClientDetailHeader.tsx` — usar o novo callback no campo CEP inline**

```tsx
<InlineEditableField
  label="CEP"
  value={client.cep}
  onSave={(v) => updateSingleField("cep", v)}
  type="cep"
  maxLength={10}
  placeholder="00000-000"
  onCepResolved={async (data) => {
    // Atualiza os 4 campos via updateSingleField (que já normaliza, persiste em clients + client_profiles e refetch)
    await Promise.all([
      data.logradouro && updateSingleField("endereco", data.logradouro),
      data.bairro && updateSingleField("bairro", data.bairro),
      data.localidade && updateSingleField("cidade", data.localidade),
      data.uf && updateSingleField("uf", data.uf),
    ].filter(Boolean));
    toast({ title: "Endereço preenchido", description: "Rua, bairro, cidade e UF atualizados pelo CEP." });
  }}
/>
```

No diálogo "Editar dados" (linhas 660-673): trocar `onChange` simples por handler que aplica máscara `formatCEP` e dispara `handleCepBlur` ao atingir 8 dígitos (não esperar o blur). Toast quando CEP não existir.

**3. `src/components/clients/ClientForm.tsx` — incluir bairro no payload + auto-trigger**

- Adicionar `defaultValues?.bairro` em `useState` (linha 40).
- Adicionar `bairro: bairro.trim() || undefined` no `formData` do `handleSubmit`.
- Trocar `onChange={(e) => setCep(e.target.value)}` por handler que aplica `formatCEP` e dispara `handleCepBlur` ao chegar a 8 dígitos (mantém o `onBlur` como fallback).
- Toast quando CEP não existir.

**4. `src/lib/viaCep.ts` — sinalizar erro de rede vs CEP inexistente**

Hoje retorna `null` em ambos os casos. Adicionar uma versão que diferencia (ou expor `{ ok, data, reason }`):
```ts
export type LookupCepResult = 
  | { ok: true; data: ViaCepResult }
  | { ok: false; reason: "invalid_format" | "not_found" | "network" };
```
Manter `lookupCep` (boolean-friendly) por retrocompat, e adicionar `lookupCepDetailed` para quem quer mostrar toast específico. Telas usam a versão detalhada para feedback claro.

### Validação

1. **Detalhe do cliente** → clicar lápis no CEP → digitar `01310100` → ao chegar nos 8 dígitos: spinner, depois Rua/Bairro/Cidade/UF preenchem sozinhos com toast "Endereço preenchido". Refresh da página mantém os dados (persistidos em `clients` + `client_profiles`).
2. **Diálogo "Editar dados"** → digitar CEP válido → 4 campos preenchem antes do blur. CEP inválido → toast "CEP não encontrado".
3. **Carteira → Novo Cliente** → digitar CEP válido → 4 campos preenchem. Ao salvar, o **bairro** agora é persistido no banco (verificar coluna `bairro` em `clients`).
4. **Cobrança e AgreementCalculator** → comportamento inalterado (continuam funcionando).
5. CEP com erro de rede (offline) → toast "Falha ao consultar CEP". CEP com 7 dígitos → não dispara nada.
6. Console limpo, sem warnings novos.

### Fora de escopo

- Mudar a estrutura de `client_profiles` ou os triggers de sincronização.
- Adicionar lookup por número/complemento.
- Migrar `viaCep` para Edge Function (continua client-side, ViaCEP é público e CORS-friendly).

