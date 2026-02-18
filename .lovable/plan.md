
## Duas correções: Sidebar "Configurações" e Lista de Conversas

### Problema 1 — "Cadastros" no sidebar

Atualmente o link "Cadastros" fica dentro da `nav` principal (área rolável do meio do sidebar). O pedido é:
- Renomear para **"Configurações"**
- Mover para o **rodapé do sidebar**, acima do botão "Sair"
- Atualizar o título da página no header (mapa de `pageTitles`)
- Usar o ícone `Settings` (engrenagem) no lugar de `Database`
- Visível apenas para admin (como já era)

**Arquivo: `src/components/AppLayout.tsx`**

1. Remover `{ label: "Cadastros", icon: Database, path: "/cadastros" }` de `preContactItems`
2. Criar um item de "Configurações" com ícone `Settings` e path `/cadastros` apenas para admins
3. No rodapé (`<div className="px-2 py-4 border-t border-sidebar-border">`), inserir esse link logo acima do botão "Sair"
4. Atualizar `pageTitles["/cadastros"]` de `"Cadastros"` para `"Configurações"`

O cabeçalho interno da `CadastrosPage` (`<h1>Cadastros</h1>`) também será atualizado para "Configurações".

---

### Problema 2 — Lista de conversas ainda cortando

O `ConversationList` tem o markup correto com `truncate` e `min-w-0`, mas o problema é que o **botão pai** (`<button className="w-full text-left ...">`) não tem `overflow-hidden`. O conteúdo vaza além da borda do contêiner pai.

Além disso, o contêiner da lista em `WhatsAppChatLayout` usa `shrink-0` com largura fixa de `360px` mas sem `overflow-hidden` — isso não impede o conteúdo interno de vazar visualmente.

**Arquivo: `src/components/contact-center/whatsapp/ConversationList.tsx`**

Adicionar `overflow-hidden` ao `<button>` de cada item da lista:
```tsx
// ANTES
<button className="w-full text-left px-3 py-[10px] border-b ...">
  <div className="flex items-center gap-3 min-w-0">

// DEPOIS
<button className="w-full text-left px-3 py-[10px] border-b ... overflow-hidden">
  <div className="flex items-center gap-3 w-full min-w-0">
```

**Arquivo: `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx`**

Adicionar `overflow-hidden` ao div que envolve a lista:
```tsx
// ANTES
<div className="w-[360px] shrink-0">

// DEPOIS
<div className="w-[360px] shrink-0 overflow-hidden">
```

---

### Arquivos a modificar

- `src/components/AppLayout.tsx` — renomear e mover "Cadastros" → "Configurações" para o rodapé
- `src/pages/CadastrosPage.tsx` — atualizar título interno de "Cadastros" para "Configurações"
- `src/components/contact-center/whatsapp/ConversationList.tsx` — `overflow-hidden` no botão de cada item
- `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` — `overflow-hidden` no contêiner da lista

### Nenhuma migração de banco necessária.
### Nenhuma nova dependência necessária.
