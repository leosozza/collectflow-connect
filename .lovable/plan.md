

## Validação Fase 1 + Plano Fase 2

### Parte A — Validação dos 3 fluxos aplicados (leitura de código)

Vou auditar os 3 fluxos da Fase 1 lendo os arquivos alterados, sem usar browser. Relatório por fluxo:

**Fluxo 1 — Auto-CEP inline (1.1 + 1.3)**
Arquivos: `InlineEditableField.tsx`, `ClientDetailHeader.tsx`
- Confirmar que `silent: true` está propagado nos 4 updates paralelos do `onCepResolved`.
- Confirmar que apenas 1 toast final ("Endereço preenchido") é exibido.
- Confirmar que o `setDraft(next)` é aplicado antes do `await onSave` (optimistic) e que há rollback no catch.
- Confirmar que o `lastLookupRef` previne re-execução em re-render.

**Fluxo 2 — Overlay no AgreementCalculator (1.2)**
Arquivo: `AgreementCalculator.tsx`
- Confirmar overlay com `Loader2` + texto amigável durante `enriching`.
- Confirmar `disabled` + opacity no botão Formalizar/Gravar.
- Confirmar guard contra duplo-clique (`isSubmitting || enriching`).
- Confirmar recheck via `checkRequiredFields()` após enrich.

**Fluxo 3 — Persistência + feedback (2.6, 2.7, 2.8)**
Arquivos: `CarteiraPage.tsx`, `ClientDetailPage.tsx`, `CopyButton.tsx`, `ClientSignature.tsx`, `useSessionStorage.ts`
- Confirmar que filtros da Carteira são salvos em `sessionStorage` e restaurados ao voltar.
- Confirmar skeleton no `ClientDetailPage` enquanto carrega.
- Confirmar que `CopyButton` troca ícone para ✓ por 1.5s e dá toast.
- Confirmar uso do `CopyButton` em pelo menos 2 lugares (assinatura, links de boleto).

**Entregável da validação:** relatório curto por fluxo — ✅ implementado / ⚠️ divergência (com linha) / ❌ faltando. Se houver divergência, ajusto antes de iniciar a Fase 2.

---

### Parte B — Fase 2: Validação obrigatória de acordo

Você pediu confirmação **sempre** antes de formalizar acordo, independente de valor ou parcelas. Isso substitui a ideia original do item 2.4 (que tinha limite de R$10.000 / 12 parcelas) por uma regra universal.

**Comportamento proposto:**

1. Operador clica em "GRAVAR ACORDO" no `AgreementCalculator`.
2. Antes de qualquer escrita no banco, abre um `AlertDialog` com resumo:
   - Nome do cliente + CPF
   - Credor
   - Valor original vs. valor proposto
   - Desconto aplicado (% e R$)
   - Quantidade de parcelas
   - Valor da entrada (se houver)
   - Valor de cada parcela
   - Data do primeiro vencimento
   - Forma de pagamento
3. Dois botões:
   - **"Cancelar"** → fecha o diálogo, mantém formulário aberto.
   - **"Confirmar e Formalizar"** → procede com o fluxo atual (enrich, criar acordo, gerar boletos).
4. O diálogo é bloqueante (não permite fechar clicando fora) — exige decisão consciente.
5. Acessibilidade: foco inicial no botão Cancelar (mais seguro).

**Onde encaixar no fluxo atual:**
- Hoje `handleSubmit` faz: validar → enrich → criar acordo → gerar boletos.
- Novo fluxo: validar → **abrir diálogo de confirmação** → (se confirmado) enrich → criar acordo → gerar boletos.
- Se faltar campo obrigatório, manter o diálogo `missingFieldsOpen` atual antes do diálogo de confirmação.

**Edge cases:**
- Se já existir confirmação em andamento, ignorar cliques adicionais.
- Se o operador cancelar, o estado do formulário permanece intacto (já compatível com a melhoria 2.5 de rascunho, se aplicarmos depois).

**Visual:**
- Usar `AlertDialog` do shadcn (já existe em `src/components/ui/alert-dialog.tsx`).
- Resumo em cards/grid 2 colunas com labels destacados.
- Valores monetários em destaque (font-semibold + cor primária).
- Aviso curto no rodapé: "Esta ação não pode ser desfeita automaticamente."

### Arquivos que serão alterados na Fase 2

- `src/components/client-detail/AgreementCalculator.tsx` — adicionar estado `confirmOpen`, abrir diálogo antes de processar, mover lógica atual de `handleSubmit` para `handleConfirmedSubmit`.

### Fora de escopo (Fase 2)

- Não mexer em score, WhatsApp, discador, Edge Functions de integração.
- Não alterar a lógica de cálculo de desconto/parcelas.
- Não tocar no `AgreementForm.tsx` (formulário antigo da página de Acordos) — escopo é apenas a formalização dentro do perfil do cliente.

### Sequência de execução

1. Rodar a validação da Parte A e reportar resultado.
2. Se houver divergência, corrigir.
3. Implementar a Parte B (validação obrigatória).
4. Pedir teste end-to-end de uma formalização real.

