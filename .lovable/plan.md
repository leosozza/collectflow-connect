

## Polimento de UX — 3 melhorias aprovadas + extras encontradas

### Bloco 1 — As 3 melhorias já aprovadas

**1.1 Suprimir toasts intermediários no auto-CEP inline**
`InlineEditableField.tsx` + `ClientDetailHeader.tsx`:
- Adicionar prop `silent?: boolean` no `updateSingleField`.
- Quando o `onCepResolved` dispara os 4 updates paralelos, passar `silent: true` em todos.
- Mostrar 1 único toast final: "Endereço preenchido automaticamente".
- Manter toast de erro normal se algum update falhar.

**1.2 Overlay amigável no AgreementCalculator durante enriquecimento**
`AgreementCalculator.tsx`:
- Trocar texto técnico "Buscando endereço no MaxSystem..." por overlay com `Loader2` + "Validando dados do cliente...".
- Desabilitar botão Formalizar com estado visual claro (`disabled` + opacity) enquanto `enriching === true`.
- Garantir que duplo-clique no botão não dispare 2 fluxos (guard com `isSubmitting`).

**1.3 Optimistic update na edição inline**
`InlineEditableField.tsx`:
- Aplicar `setDraft(next)` e fechar edição imediatamente após o usuário confirmar (Enter/✓).
- Se `onSave` rejeitar, reverter visualmente para o valor anterior + toast de erro.
- Sensação de salvamento instantâneo, mesmo em conexão lenta.

---

### Bloco 2 — Melhorias extras encontradas durante a revisão

**2.1 Atalhos de teclado no perfil do cliente**
- `Esc` para fechar diálogos abertos (já funciona em alguns, padronizar).
- `Ctrl/Cmd+S` no diálogo "Editar Dados" para salvar sem precisar clicar.
- `Tab` ordenado nos campos de endereço (CEP → número → complemento → bairro).

**2.2 Indicador visual de campo "vindo do MaxSystem"**
Quando o auto-fill preencher endereço, mostrar por 3 segundos um destaque sutil (border verde fade-out) nos 4 campos preenchidos. Reforça a percepção de que o sistema "trabalhou" pelo operador.

**2.3 Botão "Buscar no MaxSystem" manual no diálogo Editar Dados**
Hoje o operador depende do auto-trigger ao chegar a 8 dígitos. Adicionar um botão pequeno ao lado do CEP "🔍 Buscar dados" que força o lookup mesmo se o CEP já estiver salvo. Útil quando o cadastro está incompleto mas o CEP existe.

**2.4 Confirmação visual antes de formalizar acordo de alto valor**
`AgreementCalculator.tsx`: para acordos acima de R$ 10.000 ou com mais de 12 parcelas, mostrar um diálogo de confirmação com resumo (valor total, parcelas, descontos aplicados). Evita formalização acidental.

**2.5 Preservar rascunho do AgreementCalculator**
Se o operador fechar o diálogo de acordo sem formalizar, salvar os valores em `sessionStorage` por 30 minutos. Ao reabrir, oferecer "Restaurar rascunho?". Reduz frustração quando o operador é interrompido.

**2.6 Loading skeleton no ClientDetail**
Hoje, ao abrir um cliente, aparece tela em branco até o fetch terminar. Trocar por skeleton com a estrutura do header + abas. Sensação de carregamento muito mais rápida.

**2.7 Feedback de copiar no clipboard**
Vários botões de copiar (CPF, telefone, link de boleto) não dão feedback claro. Adicionar microanimação (ícone troca para ✓ por 1.5s) + toast curto.

**2.8 Persistência de filtros da Carteira**
Hoje, ao navegar para o perfil de um cliente e voltar, os filtros da carteira se perdem. Salvar em `sessionStorage` os filtros ativos por sessão.

---

### Recomendação de priorização

**Fazer agora (alto impacto, baixo esforço):**
- 1.1, 1.2, 1.3 (aprovadas)
- 2.6 (skeleton — sensação imediata de velocidade)
- 2.7 (feedback de cópia — 1 hora de trabalho)
- 2.8 (preservar filtros — operadores reclamam disso constantemente)

**Fazer depois (médio esforço):**
- 2.2 (destaque visual auto-fill)
- 2.3 (botão buscar manual)
- 2.5 (rascunho do acordo)

**Avaliar com você antes:**
- 2.1 (atalhos — pode conflitar com atalhos do navegador)
- 2.4 (confirmação alto valor — define os limites)

### Arquivos que serão alterados (se aprovar tudo da prioridade alta)

- `src/components/client-detail/InlineEditableField.tsx`
- `src/components/client-detail/ClientDetailHeader.tsx`
- `src/components/client-detail/AgreementCalculator.tsx`
- `src/pages/ClientDetailPage.tsx` (skeleton)
- `src/pages/CarteiraPage.tsx` (sessionStorage de filtros)
- Componentes com botão de copiar (busca por `navigator.clipboard`)

### Fora de escopo

- Refatoração do sistema de cache TanStack.
- Mudar fluxo de autenticação ou permissões.
- Mexer em score, WhatsApp, discador ou Edge Functions de integração.

### Próximo passo

Me confirme quais blocos aplicar. Sugiro: **prioridade alta inteira (1.1+1.2+1.3+2.6+2.7+2.8)** numa rodada só, e o restante em outra conversa após você validar.

