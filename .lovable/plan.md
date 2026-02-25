

## Plano: Correcoes Prioritarias da Auditoria

A auditoria identificou problemas reais. Vou focar nas correcoes de maior impacto que podem ser feitas sem risco de quebrar funcionalidades existentes.

### Fase 1 — Correcoes Criticas (esta implementacao)

---

#### 1. Adicionar timeout em fetch calls dos services

**Arquivos afetados:**
- `src/services/cobcloudService.ts`
- `src/services/negociarieService.ts`
- `src/services/addressEnrichmentService.ts`

Criar helper `fetchWithTimeout` e usar em todas as chamadas fetch externas. Timeout padrao: 30 segundos.

---

#### 2. Validacao de CPF no importService

**Arquivo: `src/services/importService.ts`**

A funcao `cleanCPF` nao valida comprimento. Adicionar validacao de 11 digitos e log de CPFs invalidos na lista de erros de importacao.

---

#### 3. Melhorar error handling no auditService

**Arquivo: `src/services/auditService.ts`**

Trocar catch vazio por `console.warn` para que falhas de auditoria sejam rastreáveis sem quebrar o fluxo principal.

---

#### 4. Validacao de env vars no startup

**Arquivo: `src/main.tsx`**

Adicionar verificacao de `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no inicio da aplicacao com mensagem clara no console.

---

#### 5. Corrigir filtro de data no auditService

**Arquivo: `src/services/auditService.ts`**

A concatenacao `filters.dateTo + "T23:59:59"` pode falhar. Adicionar validacao antes de concatenar.

---

### Fase 2 — Melhorias de Qualidade (proxima iteracao)

Estas ficam para um segundo momento pois exigem refatoracao mais ampla:

- Eliminar `as any` (requer regenerar types do Supabase)
- Implementar retry logic com backoff
- Quebrar componentes grandes (CarteiraPage, ClientDetailPage)
- Adicionar testes unitarios
- Paginacao real no lugar de `.limit(1000)`

---

### Resumo dos Arquivos

| Arquivo | Acao |
|---------|------|
| `src/lib/fetchWithTimeout.ts` | Novo — helper de fetch com timeout |
| `src/services/cobcloudService.ts` | Usar fetchWithTimeout |
| `src/services/negociarieService.ts` | Usar fetchWithTimeout |
| `src/services/addressEnrichmentService.ts` | Usar fetchWithTimeout |
| `src/services/importService.ts` | Validar CPF com 11 digitos |
| `src/services/auditService.ts` | console.warn no catch + validar dateTo |
| `src/main.tsx` | Validar env vars no startup |

