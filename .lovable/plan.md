

## Plano

### 1. Aumentar destaque do "Em Aberto" no header
Em `ClientDetailHeader.tsx`, na **Linha 2 (metadados, ~L429-439)**, separar o "Em Aberto" do resto da linha e renderizá-lo com tipografia maior — aproximando o estilo do screenshot 1 ("SALDO DEVEDOR TOTAL R$ 14.582,40").

Estrutura proposta na Linha 1 (à direita, antes dos botões de ação):
```
┌─────────────────────────────┐
│ EM ABERTO                   │
│ R$ 1.789,20  (text-2xl bold)│
└─────────────────────────────┘
```
- Label pequeno (`text-[10px] uppercase tracking-wider text-muted-foreground`)
- Valor grande (`text-2xl font-bold text-destructive`)
- Posicionado entre o título do nome e os botões de ação (ou substituindo o "Em Aberto" textual da linha 2)
- Remover o `Em Aberto` repetido da linha de metadados (L437-438)

### 2. Remover botão "Editar" + edição inline com hover
- **Remover** o botão "Editar" da Linha 1 (L417-420) e o "Editar endereço" da seção Endereço (L482-485).
- **Manter** o `Sheet` de edição existente como fallback (não remover — não vamos quebrar a mutation).
- **Criar componente novo `InlineEditableField`** em `src/components/client-detail/InlineEditableField.tsx`:
  - Props: `label`, `value`, `onSave(newValue)`, `type` ("text" | "phone" | "cep" | "uf"), `className`.
  - Comportamento:
    - Estado padrão: mostra `label` + `value` (mesma aparência do `InfoItem` atual).
    - No hover do container: aparece ícone `Pencil` minúsculo à direita (`opacity-0 group-hover:opacity-100`).
    - Click no ícone (ou no campo): troca para `<Input>` controlado + botões check/X (ou Enter/Esc).
    - Ao salvar: chama `onSave`, mostra `Loader2` durante a mutation.
- **Substituir** todos os `<InfoItem>` editáveis dentro do colapsável por `<InlineEditableField>`:
  - Identificação: Cod. Devedor (`external_id`), Cod. Contrato (`cod_contrato`)
  - Endereço: Rua, Bairro, Cidade, UF, CEP (CEP mantém auto-fill via ViaCEP no blur)
- Campos **read-only** (não editáveis inline): Modelo, Credor, valores financeiros, datas, classificações — permanecem como `InfoItem`.
- **Mutation única reutilizável**: criar `updateSingleField(field, value)` que chama `supabase.from("clients").update({ [field]: value })` em todos os `clientIds` (compartilhado) ou só no principal (campos unique como `cod_contrato`/`external_id`), e sincroniza com `client_profiles` (igual ao `updateClientMutation` atual). Invalida `["clients"]` ao fim.

### 3. Remover "Parcelas 2/11"
Em `ClientDetailHeader.tsx` **L455**: remover o `<InfoItem label="Parcelas" value={`${pagas}/${clients.length}`} />`. Ajustar o grid para 4 colunas continuar harmônico (Cod. Devedor, Cod. Contrato, Modelo, Credor).

### Resumo de alterações
| Arquivo | Mudança |
|---|---|
| `src/components/client-detail/InlineEditableField.tsx` | **Novo** componente |
| `src/components/client-detail/ClientDetailHeader.tsx` | Hero "Em Aberto", remoção do botão Editar + Editar endereço, substituição de InfoItems editáveis, remoção de "Parcelas", nova mutation por campo |

### Resultado visual (header expandido)
```
← Ana Paula Estevão da Silva    [WA] [📞]   EM ABERTO
                                            R$ 1.789,20    [Formalizar Acordo]
   CPF: ... | Tel: ... | Email: ... | Credor: ...

   ▼ Mais informações do devedor
   ──────────────────────────────────────────
   COD. DEVEDOR ✏  COD. CONTRATO ✏  MODELO    CREDOR
   1315794         768385             Vitória   TESS MODELS...

   TELEFONES                        EMAIL
   📞 (11) 96551-9515 🟢 ▾          ✉ anapaula...

   ENDEREÇO
   RUA ✏          BAIRRO ✏    CIDADE ✏    UF ✏
   —              —           —           —
   CEP ✏
   —
   ...
```

