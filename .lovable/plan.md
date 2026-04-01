

# Plano: Limpar importação incompleta e reimportar MaxList com segurança

## Diagnóstico

A importação de hoje **funcionou parcialmente**:
- Os 21.356 registros do MaxSystem foram buscados com sucesso
- Os registros foram inseridos na tabela `clients` (todos os 21.356 estão lá, com 5.581 CPFs únicos)
- **O erro ocorreu no final**: `supabase.from(...).insert(...).catch is not a function` — um bug na linha que salva o log de importação
- A function crashou antes de retornar o resultado ao frontend, que interpretou como falha

**Resumo**: os dados estão no banco, mas o frontend recebeu erro. Não há acordos, eventos ou tabulações vinculados — os registros estão "limpos".

## Etapas

### 1. Corrigir o bug na Edge Function `maxlist-import`

O `.catch(() => {})` não funciona na Supabase JS v2 quando encadeado após `.insert()` sem `.select()` ou `.then()`. Trocar por tratamento com `try/catch` explícito tanto no `import_logs` (linha 459) quanto no `audit_logs` (linha 469).

### 2. Excluir todos os clientes do tenant YBRASIL

Como não há acordos, eventos ou dados operacionais vinculados, a exclusão é segura:
- Deletar todos os registros da tabela `clients` onde `tenant_id = '39a450f8-...'`
- Limpar `import_logs` relacionados para evitar confusão de contadores

### 3. Reimportar via interface

Após a correção e limpeza, o usuário pode refazer a importação normalmente pela tela `/maxlist`. Os 21.356 registros serão reimportados com o log correto.

## Detalhes Técnicos

**Bug exato (linha ~459-466):**
```typescript
// ANTES (causa o crash):
await supabase.from("import_logs").insert({...}).catch(() => {});

// DEPOIS:
try {
  await supabase.from("import_logs").insert({...});
} catch (e) {
  console.error("[maxlist-import] import_logs error:", e);
}
```

Mesma correção para `audit_logs` (linha ~469).

**Exclusão dos clientes:**
```sql
DELETE FROM clients WHERE tenant_id = '39a450f8-7a40-46e5-8bc7-708da5043ec7';
DELETE FROM import_logs WHERE tenant_id = '39a450f8-7a40-46e5-8bc7-708da5043ec7';
```

**Arquivo afetado:** `supabase/functions/maxlist-import/index.ts`

**Dados no banco (antes da limpeza):**
| Métrica | Valor |
|---|---|
| Total de registros | 21.356 |
| CPFs únicos | 5.581 |
| Credor | TESS MODELS PRODUTOS FOTOGRAFICOS LTDA |
| Status pendente | 13.090 |
| Status pago | 8.266 |
| Acordos vinculados | 0 |
| Eventos vinculados | 0 |

