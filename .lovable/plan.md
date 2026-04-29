## Adicionar rotas para edição de credor (incluindo abas internas)

Hoje, ao clicar em **Editar** em um credor, abre um `Sheet` em cima sem mexer na URL. As abas internas (Dados, Bancário, Negociação, Régua, **Personalização**, Assinatura, Portal) também não estão na URL — então é impossível enviar link, recarregar a página ou voltar pelo navegador.

A página `/cadastros/:tab` já tem rota. O que falta são rotas para o **credor selecionado** e para a **aba interna** dele.

### Rotas novas

```
/cadastros/credores                              → lista (já existe)
/cadastros/credores/novo                         → abre o formulário em modo "novo"
/cadastros/credores/:credorId                    → abre o formulário do credor (aba padrão: dados)
/cadastros/credores/:credorId/:section           → abre na aba específica
   sections válidas: dados | bancario | negociacao | regua | personalizacao | assinatura | portal
```

Exemplos:
- `/cadastros/credores/abc-123/personalizacao`
- `/cadastros/credores/abc-123/portal`
- `/cadastros/credores/novo`

### Mudanças

1. **`src/App.tsx`** — substituir a rota única por:
   ```tsx
   <Route path="cadastros/:tab?" element={<CadastrosPage />} />
   <Route path="cadastros/credores/novo" element={<CadastrosPage />} />
   <Route path="cadastros/credores/:credorId/:section?" element={<CadastrosPage />} />
   ```

2. **`src/pages/CadastrosPage.tsx`** — quando os params `credorId` ou rota `/novo` estiverem presentes:
   - Forçar `active = "credores"` no menu lateral (para destacar a seção correta).
   - Renderizar `<CredorList />` normalmente (mostra a lista atrás) e abrir `CredorForm` controlado pelos params.
   - Buscar o credor correspondente pelo `credorId` para passar como `editing` ao `CredorForm`.

3. **`src/components/cadastros/CredorList.tsx`** — substituir o estado local `editing/formOpen` por navegação:
   - `openNew()` → `navigate("/cadastros/credores/novo")`
   - `openEdit(c)` → `navigate("/cadastros/credores/${c.id}")`
   - Remover o `<CredorForm>` daqui (passa a ser renderizado pela página).

4. **`src/components/cadastros/CredorForm.tsx`** — sincronizar a aba interna com a URL:
   - Trocar `<Tabs defaultValue="dados">` por `<Tabs value={section} onValueChange={(v) => navigate('/cadastros/credores/${id || "novo"}/${v}', { replace: true })}>`.
   - `section` vem dos params (`useParams`) com fallback `"dados"`.
   - Validar contra a lista de seções permitidas; se inválida, redireciona para `dados`.
   - Ao fechar o Sheet (`onOpenChange(false)`) → `navigate("/cadastros/credores")`.
   - Quando `editing?.id` muda (após criar um novo credor), atualizar a URL para `/cadastros/credores/:novoId/:section`.

### Comportamento resultante
- Cada aba do credor passa a ter URL própria, copiável e recarregável.
- O botão "voltar" do navegador funciona entre abas.
- Abrir `/cadastros/credores/abc/personalizacao` direto cai já com o formulário aberto na aba certa.
- Fechar o credor volta para `/cadastros/credores` (lista).

### Fora de escopo
- Não muda nada visualmente nas abas/sheet — só sincroniza estado com URL.
- Outras seções (`/cadastros/usuarios`, `/cadastros/equipes` etc.) continuam funcionando como hoje, pois a rota `/cadastros/:tab?` é mantida.
