

## Diagnóstico: por que "salva" tira da página e não persiste a regra

### Causa raiz (confirmada via session replay)

Na aba **Régua de Cobrança** (dentro do Sheet do credor) existem **dois botões "Salvar" no mesmo ecrã**:

1. O botão "**Salvar**" do formulário interno da régua (`CredorReguaTab.handleSave`) — esse é o que persiste a regra em `collection_rules`.
2. O botão "**Salvar Credor**" do rodapé do `CredorForm` (Sheet pai) — esse salva o credor e **fecha o Sheet inteiro**.

No replay, o usuário clicou no **botão errado** ("Salvar Credor", id 3602). O toast mostrou "Credor salvo!" e o Sheet fechou — exatamente o sintoma "salva e me tira da página". A regra nunca chegou ao banco porque `handleSave` da régua nunca foi chamado.

Isso acontece porque o formulário da régua não tem CTA visualmente diferenciado, fica solto no meio da aba e o "Salvar Credor" do rodapé fixo do Sheet rouba a atenção.

### Correções

**1. Eliminar a confusão visual entre os dois "Salvar"** (`src/components/cadastros/CredorReguaTab.tsx`)

- Renomear o botão da régua para "**Salvar Regra**" (não mais só "Salvar").
- Renderizar o formulário da régua dentro de um **Dialog modal** próprio (em vez de inline na aba). Isso isola visualmente o ato de criar/editar regra do Sheet pai, e o botão "Salvar Credor" do rodapé deixa de competir.
- Header do Dialog: "Nova Regra de Cobrança" / "Editar Regra".
- Footer do Dialog com 3 botões:
  - **Salvar Regra** (fecha modal, atualiza lista)
  - **Salvar e criar outra** ← novo, atende o pedido explícito do usuário
  - **Cancelar**

**2. Fluxo "Salvar e criar outra"** (mesmo arquivo)

- `handleSave(closeAfter: boolean)` parametrizado.
- Após sucesso:
  - Se `closeAfter=true` → `resetForm()` + fecha Dialog.
  - Se `closeAfter=false` → mantém Dialog aberto, limpa só `name`/`daysOffset`/`template` (preserva `channel` e `instanceId` para acelerar criação em série), mostra toast "Regra criada — pronto para a próxima".
- Foco automático no campo "Nome" após reset.

**3. Confirmação de saída sem salvar**

- Se `name` ou `template` estiverem preenchidos e o usuário tentar fechar o Dialog ou clicar Cancelar, perguntar: "Descartar esta regra?". Evita perda acidental.

**4. Robustez do save (defensivo)**

- Já existem validações de `name`/`daysOffset`/`template` e `console.error` do erro real.
- Adicionar log explícito do payload no console antes do insert para auditoria caso ainda ocorra falha silenciosa de RLS.
- Após `createCollectionRule`, fazer `loadData()` retornando antes de mostrar toast — garante que a UI já reflete a nova regra (hoje a ordem está OK, mas o try/catch envolve tudo; vou mover o `await loadData()` para dentro do try imediatamente após o insert/update para que falha de leitura não engane o usuário).

### Fora de escopo

- Auto-save da régua dentro do save do credor (mantém os fluxos separados — régua é entidade independente, vinculada ao credor por `credor_id`).
- Mover régua para fora do Sheet do credor (continua acessível pela aba "Régua de Cobrança" do credor, como hoje).
- Mexer no motor `send-notifications` (já corrigido na iteração anterior).

### Validação pós-correção

1. Abrir credor → aba Régua → "Nova Regra".
2. Preencher (name, D-3, WhatsApp, instância, template).
3. Clicar **"Salvar e criar outra"** → toast "Regra criada", Dialog continua aberto, campos limpos, foco no Nome.
4. Criar segunda regra (D0) → "Salvar Regra" → Dialog fecha, lista mostra **2 regras**.
5. Conferir via SQL: `SELECT count(*) FROM collection_rules WHERE credor_id = '<id>'` retorna 2.
6. Conferir que clicar "Salvar Credor" do rodapé do Sheet **não** afeta regras (apenas dados do credor).

### Arquivo alterado

- `src/components/cadastros/CredorReguaTab.tsx` — converter form inline em Dialog, adicionar botão "Salvar e criar outra", renomear CTA, confirmação de descarte.

### Próximo passo

Confirme **"Aplicar"** e eu implemento + valido o fluxo end-to-end criando 2 regras em sequência.

