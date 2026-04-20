

## Substituir filtro "Com IA / Com Humano" por filtro de Tabulação

### Diagnóstico

Em `ConversationList.tsx` (linhas 326-336) existe o `Select` "Atendente" com opções **Todos / Com IA / Com Humano**, controlado por `handlerFilter` e propagado server-side via `get_visible_conversations` (`_handler_filter`) e via query direta de admin em `conversationService.ts`.

As tabulações (dispositions) de WhatsApp já existem na tabela `conversation_disposition_assignments` (FK para `disposition_types`, channel=`whatsapp`) e já são carregadas no `WhatsAppChatLayout` (`dispositionTypes` e `dispositionAssignments`) e exibidas no header do chat. Hoje **não há filtro** por tabulação na lista.

### Mudanças

#### 1. Banco — adicionar suporte server-side ao filtro

Migração: alterar a função `get_visible_conversations` para receber novo parâmetro `_disposition_filter uuid DEFAULT NULL`. Adicionar no bloco `filtered`:

```sql
AND (
  _disposition_filter IS NULL
  OR EXISTS (
    SELECT 1 FROM public.conversation_disposition_assignments cda
    WHERE cda.conversation_id = v.conv_id
      AND cda.disposition_type_id = _disposition_filter
  )
)
```

Sem alterações em RLS (a tabela já é acessada via SECURITY DEFINER da RPC).

#### 2. `src/services/conversationService.ts`

- Em `ConversationFilters`: remover `handlerFilter`, adicionar `dispositionFilter?: string`.
- No path RPC (não-admin): remover `_handler_filter` da chamada e passar `_disposition_filter`.
- No path admin (query direta): remover bloco `if (filters.handlerFilter === ...)` e adicionar:
  ```ts
  if (filters.dispositionFilter && filters.dispositionFilter !== "all") {
    const { data: ids } = await supabase
      .from("conversation_disposition_assignments")
      .select("conversation_id")
      .eq("disposition_type_id", filters.dispositionFilter);
    const convIds = (ids || []).map((r: any) => r.conversation_id);
    if (convIds.length === 0) return { data: [], count: 0 };
    query = query.in("id", convIds);
  }
  ```

#### 3. `src/components/contact-center/whatsapp/ConversationList.tsx`

- Remover `handlerFilter` state e o `<Select>` "Atendente" (linhas 192, 207, 326-336) e o ícone `Bot` do import se não for mais usado em outro lugar.
- Adicionar `dispositionFilter` state (default `"all"`) e novo `<Select>` no mesmo lugar, ocupando `flex-1`:
  - Trigger com ícone `Tag` e placeholder "Tabulação".
  - Itens: `"Todas as tabulações"` + `dispositionTypes.map(dt => <SelectItem value={dt.id}>` exibindo bolinha colorida (`backgroundColor: dt.color`) + `dt.label`.
  - Só renderizar se `dispositionTypes.length > 0`.
- O `Select` "Etiqueta" atual (`tagFilter`, linhas 337-355) é cliente-only e ficou pouco usado. **Mantemos o filtro de Etiqueta como está** (não foi pedido remover) — posicionado ao lado do novo filtro de Tabulação.
  - Observação: se a fila ficar apertada visualmente em larguras menores, podemos esconder Etiqueta quando `tags.length === 0` (já é o caso hoje).
- Atualizar `useEffect` para enviar `dispositionFilter` em vez de `handlerFilter` no `onFiltersChange`.

#### 4. Sem mudanças

- `WhatsAppChatLayout.tsx`: já passa `dispositionTypes` e `dispositionAssignments` para `ConversationList`. Nada a alterar além do tipo de filtros (já é `ConversationFilters`).
- `ChatPanel.tsx`: nada.
- Edge functions, realtime, schema das tabelas (apenas a função RPC é recriada).

### Validação

1. Lista de conversas: o seletor "Atendente / Com IA / Com Humano" não aparece mais.
2. No mesmo lugar aparece "Tabulação" listando todas as tabulações de WhatsApp ativas do tenant, com bolinha colorida.
3. Selecionar uma tabulação → lista filtra apenas conversas que possuem aquela tabulação atribuída (validar com paginação infinita: rolar até o fim e confirmar contagem coerente).
4. Selecionar "Todas as tabulações" → volta a lista completa.
5. Combinação com outros filtros (status, instância, busca, não lidas) continua funcionando.
6. Operador comum: filtro respeita visibilidade (só vê conversas que ele já enxergaria sem filtro).
7. Tenant sem nenhuma tabulação WhatsApp cadastrada: o seletor não é renderizado (sem ocupar espaço inútil).

