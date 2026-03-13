

# Plano Revisado — Refatoração de Estabilidade (Itens Viáveis)

Baseado na análise do plano original, filtrei apenas o que é **tecnicamente viável e benéfico** para o projeto atual.

---

## 1. Logger Centralizado — `src/lib/logger.ts`

Criar utilitário leve com `console.*` estruturado (sem tabela no banco — evita overhead).

```typescript
// src/lib/logger.ts
export const logger = {
  info: (module: string, action: string, data?: Record<string, any>) => 
    console.log(JSON.stringify({ level: "info", module, action, ...data, ts: new Date().toISOString() })),
  warn: (module: string, action: string, data?: Record<string, any>) => 
    console.warn(JSON.stringify({ level: "warn", module, action, ...data, ts: new Date().toISOString() })),
  error: (module: string, action: string, error: unknown, data?: Record<string, any>) => 
    console.error(JSON.stringify({ level: "error", module, action, error: String(error), ...data, ts: new Date().toISOString() })),
};
```

**Aplicar em**: Os 39 services existentes, substituindo `console.log` solto por chamadas estruturadas.

---

## 2. Error Handler Padrão — `src/lib/errorHandler.ts`

Criar utilitário para tratamento de erros consistente em todos os services.

```typescript
export class AppError extends Error {
  constructor(public code: string, message: string, public details?: Record<string, any>) {
    super(message);
  }
}

export function handleServiceError(error: unknown, module: string): never {
  logger.error(module, "service_error", error);
  if (error instanceof AppError) throw error;
  throw new AppError("INTERNAL", error instanceof Error ? error.message : "Erro desconhecido");
}
```

**Aplicar em**: Services críticos (`clientService`, `agreementService`, `importService`, `workflowService`) — adicionar `try/catch` com `handleServiceError`.

---

## 3. Expandir Validações Zod — `src/lib/validations.ts`

O arquivo já existe com `clientSchema`. Expandir com schemas para as outras entidades:

- `agreementSchema` — validar dados de acordos
- `crmLeadSchema` — validar leads do CRM
- `workflowSchema` — validar nós e conexões de workflow

**Não** criar pasta `src/validators/` separada — manter tudo em `src/lib/validations.ts` (arquivo único, ~150 linhas).

Remover validações inline duplicadas nos services e importar do arquivo central.

---

## 4. Padronizar Interface dos Services

Atualmente os services misturam padrões: alguns exportam funções individuais (`export const fetchClients`), outros exportam objetos (`export const negociarieService = {...}`).

**Padronizar** para o formato de objeto nos services que ainda usam exports individuais:

```typescript
// Antes (clientService.ts)
export const fetchClients = async () => { ... }
export const createClient = async () => { ... }

// Depois
export const clientService = {
  fetch: async () => { ... },
  create: async () => { ... },
  update: async () => { ... },
  delete: async () => { ... },
};
```

**Services a padronizar** (os que usam exports individuais): `clientService`, `agreementService`, `financeService`, `gamificationService`, `importService`.

> **Nota**: Isso requer atualizar os imports em todos os componentes que usam esses services. É uma mudança segura mas com muitos arquivos tocados.

---

## 5. Extrair Lógica de Negócio Pura para `src/lib/`

Não criar uma camada `domain/` completa, mas extrair funções puras que hoje estão dentro dos services:

- **`src/lib/cpfUtils.ts`** — normalização, formatação e validação de CPF (hoje duplicado em vários services)
- **`src/lib/installmentUtils.ts`** — cálculo de parcelas, datas de vencimento, geração de records (hoje dentro de `clientService.createClient`)
- **`src/lib/commission.ts`** — já existe, manter

Isso reduz o tamanho dos services e torna a lógica testável.

---

## O que NÃO faremos (e por quê)

| Item Original | Motivo de Exclusão |
|---|---|
| Camada `src/domain/` | Over-engineering — `src/lib/` já cumpre o papel |
| Modularizar Edge Functions (subpastas) | **Impossível** — Edge Functions não suportam subpastas |
| `supabase/functions/_shared/` | **Impossível** — imports entre functions não funcionam |
| Event Bus interno | Anti-pattern em React — React Query já invalida caches |
| Job Runner compartilhado | Não suportado pela arquitetura de Edge Functions |

---

## Ordem de Execução

1. Logger + Error Handler (base para tudo)
2. Expandir validações Zod
3. Extrair utilitários puros (`cpfUtils`, `installmentUtils`)
4. Padronizar interface dos services
5. Aplicar logger e error handling nos services críticos

**Estimativa**: ~15 arquivos criados/modificados. Zero alteração de UI, endpoints ou schemas.

