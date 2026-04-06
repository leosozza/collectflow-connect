

# Relatório de Validação — Fase 5: Fluxo Completo de Documentos

## 1. Geração de Documentos — Análise por Tipo

**Fluxo geral**: `handleGenerate` → valida → resolve template (3 níveis) → renderiza → abre preview → download PDF + salva histórico. **Correto.**

Todos os 5 tipos (acordo, recibo, quitação, divida, notificação) seguem o mesmo caminho. Templates default existem para todos. **OK.**

---

## 2. Validação de Regras de Negócio

| Cenário | Esperado | Resultado |
|---|---|---|
| Sem acordo → gerar acordo | Bloqueado | OK |
| Sem pagamento → gerar recibo | Bloqueado | OK |
| Saldo aberto → gerar quitação | Bloqueado | OK (verifica `totalAberto > 0` e `agreement.status !== 'pago'`) |
| Com dívida → descrição | Disponível | OK |
| Com dívida → notificação | Disponível | OK |

**Sem problemas.**

---

## 3. Fallback de Template

Cascata: credor → tenant → default. Implementação em `resolveTemplate()` linhas 72-80. **Correta.**

---

## 4. Problemas Encontrados

### CRÍTICO

**Bug 1 — Botão clicável mesmo quando documento é inválido**
- Linha 177: `onClick={() => handleGenerate(...)` é sempre executado, mesmo com `canGenerate = false`
- Embora o `handleGenerate` valide e mostre toast, o botão NÃO tem `disabled` ou early return no onClick
- O CSS mostra `cursor-not-allowed` e `opacity-60`, mas o click passa → valida → mostra toast. Isso é um **comportamento aceitável** (toast explica o motivo), mas semanticamente o botão deveria ter `disabled` ou um guard no onClick para não executar quando `!canGenerate`
- **Severidade: Média** — funciona corretamente (valida e bloqueia), mas UX poderia ser melhor

**Bug 2 — Erro silenciado no salvamento de histórico**
- Linhas 142-144: o `catch` apenas faz `console.error`. Se o INSERT no banco falhar (ex: RLS, campo obrigatório), o usuário recebe toast de sucesso mas o histórico NÃO é salvo
- **Severidade: Crítico** — o operador acredita que o documento foi registrado, mas pode não ter sido

**Bug 3 — Falta de validação no `rendered_html` antes do INSERT**
- Se `preview.html` estiver vazio ou corrupto, o INSERT acontece mesmo assim
- **Severidade: Baixa**

### MÉDIO

**Bug 4 — `formatCurrency` nos templates default usa `R$` duplicado**
- `formatCurrency()` retorna `R$ 5.000,00` (com prefixo)
- Templates default contêm `R$ {valor_divida}` → renderiza como `R$ R$ 5.000,00`
- Afeta: linhas 6-8 de `documentDefaults.ts` (acordo, recibo, quitação, divida, notificação)
- **Severidade: Média** — visualmente incorreto no PDF final

**Bug 5 — `{numero_parcela}` hardcoded como "1"**
- Linha 114 de `documentDataResolver.ts`: `"{numero_parcela}": "1"` — sempre fixo
- Não reflete a parcela real sendo paga (relevante para recibo)
- **Severidade: Média**

**Bug 6 — `{total_parcelas}` usa `clients.length` em vez de dados do acordo**
- Linha 115: `String(clients.length)` conta títulos no banco, não parcelas do acordo
- Pode divergir do número real de parcelas negociadas
- **Severidade: Média**

### MELHORIA

**Item 7 — Preview dialog não tem botão de fechar explícito (X)**
- O `DialogContent` do shadcn já inclui um X padrão, mas o header menciona dois botões e só mostra "Baixar PDF"
- **Severidade: Baixa** — funciona, o X do shadcn existe

**Item 8 — `markdownLight` faz `escapeHtml` que escapa `<` e `>`**
- Isso significa que se o template do credor contiver HTML (ex: `<br>`, `<b>`), ele será escapado e exibido como texto
- O two-pass no renderer só protege `<table>` blocks, não HTML inline
- **Severidade: Baixa** — templates normalmente usam markdown, não HTML

**Item 9 — Sem loading state ao abrir preview**
- `resolveDocumentData` é síncrono, então não é um problema real
- **Severidade: Nenhuma**

**Item 10 — RLS não tem policy de DELETE**
- `client_generated_documents` só tem SELECT e INSERT. Se precisar excluir documentos, não será possível
- **Severidade: Baixa** — por design, documentos são imutáveis

---

## 5. Timeline do Cliente

INSERT em `client_events` com `event_type: 'document_generated'` e metadata com tipo/source. **Correto.**
Porém sujeito ao mesmo problema do Bug 2 (erro silenciado).

---

## 6. PDF

- Layout A4 com margens `[20, 18, 20, 18]mm` — **OK**
- `html2canvas` com `scale: 2` — boa qualidade
- Wrapper com tipografia serifada — **OK**
- Tabela de parcelas usa inline styles — compatível com html2pdf
- **Risco**: documentos muito longos podem ter quebra de página no meio da tabela (limitação do html2pdf.js)

---

## 7. Edge Cases

| Cenário | Comportamento |
|---|---|
| Sem endereço | `filter(Boolean).join(", ")` → string vazia. **OK** |
| CPF sem formato | `formatCPF` aceita qualquer string. **OK** |
| Valores zerados | `formatCurrency(0)` → "R$ 0,00". **OK** |
| Sem acordo | `buildTabelaParcelas` retorna `""`. **OK** |
| Parcela única | Tabela com 1 linha. **OK** |

---

## Resumo de Ações Recomendadas

| # | Severidade | Problema | Ação |
|---|---|---|---|
| 2 | **Crítico** | Erro silenciado no histórico | Mostrar toast de warning se INSERT falhar |
| 4 | **Médio** | `R$` duplicado nos templates | Remover `R$` dos templates default OU remover do `formatCurrency` retorno nos vars |
| 5 | **Médio** | `{numero_parcela}` fixo em "1" | Calcular parcela real ou remover placeholder |
| 6 | **Médio** | `{total_parcelas}` inconsistente | Usar `agreement.new_installments` quando houver acordo |
| 1 | **Médio** | Botão clicável sem validação visual | Adicionar guard `if (!canGenerate) return` no onClick |
| 8 | **Baixo** | HTML inline no template escapado | Documentar ou proteger HTML inline |
| 10 | **Baixo** | Sem policy de DELETE | Manter por design (imutável) |

Deseja que eu corrija os itens críticos e médios?

