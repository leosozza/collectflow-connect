

## Correção: busca de endereço (MaxList) e ViaCEP no fluxo de Acordo

### Problemas identificados

**1. Enriquecimento de endereço bloqueia a criação do acordo**
- Em `AgreementCalculator.handleSubmit` (linha 467), `enrichClientAddress` é chamado **antes** de `createAgreement`, dentro do mesmo `try`. Se a chamada ao MaxSystem falhar (timeout, 500, contrato não encontrado, JWT expirado), a exceção sobe e o acordo **nunca é gravado** — o usuário vê apenas "Erro ao gravar acordo".
- O serviço também grava direto na tabela `clients` (`update().in("id", clientIds)`), o que pode disparar políticas RLS/validações e travar o fluxo principal.

**2. Latência alta com muitos contratos**
- `enrichClientAddress` itera todos os `cod_contrato` únicos do CPF em batches de 5, fazendo 2 requests por contrato (`model-search` + `model-details`). CPFs com 20+ contratos demoram dezenas de segundos antes mesmo do acordo começar a ser criado.
- Para na primeira resposta com endereço, mas só **depois** de processar o batch inteiro.

**3. Falta de ViaCEP no diálogo "Campos faltantes"**
- Em `AgreementCalculator.tsx` (linhas 1024–1037), o input de CEP é um `<Input>` simples. Não dispara ViaCEP, então o operador precisa digitar manualmente endereço, bairro, cidade e UF — exatamente os campos que o ViaCEP retorna. Os outros formulários do projeto (`ClientForm`, `ClientDetailHeader`, `CobrancaForm`) já têm essa lógica.

### Mudanças

**A. `src/components/client-detail/AgreementCalculator.tsx`**

1. **Tornar o enriquecimento não-bloqueante** — mover `enrichClientAddress` para fora do caminho crítico:
   - Antes: `await enrichClientAddress(...)` → `createAgreement(...)`.
   - Depois: disparar `enrichClientAddress(...)` em background (`.catch(console.warn)`), criar o acordo imediatamente. O endereço, quando vier, fica disponível para `checkRequiredFields` na próxima execução.
   - Manter o indicador "Buscando endereço..." apenas se já houver endereço em cache; caso contrário, ir direto para "Gravando acordo".

2. **Adicionar ViaCEP no diálogo de "Campos faltantes"** (linhas ~1024–1037):
   - Detectar quando `field === "cep"`, atrelar `onBlur` ao input que:
     - Faz fetch em `https://viacep.com.br/ws/{cleanCep}/json/`.
     - Se sucesso, popula automaticamente `endereco`, `bairro`, `cidade`, `uf` no estado `missingFields` (apenas se estiverem vazios — não sobrescreve o que o operador já digitou).
     - Mostra um spinner (`Loader2`) enquanto busca.
   - Reaproveitar o helper já existente em `ClientDetailHeader.handleCepBlur` extraindo para `src/lib/viaCep.ts` (função pura `lookupCep(cep): Promise<{logradouro, bairro, localidade, uf} | null>`) e importando nos 4 lugares (`ClientForm`, `ClientDetailHeader`, `CobrancaForm`, `AgreementCalculator`).

**B. `src/services/addressEnrichmentService.ts`**

3. **Reduzir tentativas e respeitar limite de tempo**:
   - Limitar a no máximo 3 contratos únicos (priorizar os mais recentes por `created_at` desc).
   - Reduzir timeout por request de 30s (default global) para **8s** explícitos.
   - Logar `console.warn("[address-enrichment] failed:", err)` em vez de engolir silenciosamente — para observabilidade.
   - Se a primeira tentativa retornar endereço, abortar as demais (curto-circuito real).

4. **Não bloquear se update de `clients` falhar**:
   - Envolver `supabase.from("clients").update(...)` em try/catch isolado. Falha de RLS ou trigger não deve fazer a função inteira retornar `null`.

**C. `src/lib/viaCep.ts` (novo)**

```ts
export async function lookupCep(cep: string): Promise<{
  logradouro: string; bairro: string; localidade: string; uf: string;
} | null> {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const data = await res.json();
    if (data?.erro) return null;
    return data;
  } catch { return null; }
}
```

**D. Refactor leve dos 3 consumidores existentes**
- `ClientForm.tsx`, `ClientDetailHeader.tsx`, `CobrancaForm.tsx`: trocar o fetch inline por `lookupCep()`. Comportamento visível inalterado.

### Fora de escopo

- Não vamos alterar a edge `maxsystem-proxy` (o backend está OK; o problema é como o frontend trata as falhas).
- Não vamos cachear endereços em uma tabela dedicada — `client_profiles`/`clients` já cumprem esse papel via `enrichClientAddress`.
- Não vamos adicionar autocomplete de endereço por número (Google Places) — fica como evolução futura.

### Validação

1. Acordo com CPF que **tem endereço** em `client_profiles`/`clients`: criação imediata, sem chamada ao MaxSystem.
2. Acordo com CPF **sem endereço** e MaxSystem **lento/fora do ar**: acordo é criado normalmente; toast de sucesso aparece em <2s; warning silencioso no console; endereço continua faltando e o diálogo "Campos faltantes" abre como hoje.
3. Acordo com CPF sem endereço e MaxSystem OK: endereço é enriquecido em background; na próxima abertura do cliente já aparece.
4. Diálogo "Campos faltantes" com CEP listado: digitar CEP válido → ao sair do campo, `endereco`, `bairro`, `cidade` e `uf` são preenchidos automaticamente; spinner aparece durante a busca; CEP inválido (8 dígitos não encontrados) não trava nem mostra erro ruidoso.
5. Os 3 formulários antigos (`ClientForm`, `ClientDetailHeader`, `CobrancaForm`) continuam funcionando idênticos após refactor para `lookupCep`.

