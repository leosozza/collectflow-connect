## Reorganizar bloco colapsável do perfil do cliente

Bloco superior (CPF • Telefone • Email • Credor • Saldo Devedor) e ações no topo **permanecem idênticos**. Identidade visual, cards, divisores e tipografia mantidos — só muda a ordem e o agrupamento dentro do colapsável "Mais informações do devedor".

### Nova ordem do colapsável (`ClientDetailHeader.tsx`, linhas 565–680)

1. **Valores** (1ª linha)
   - `grid-cols-2 md:grid-cols-4`
   - Total Pago • Saldo Devedor • Status do Cliente • Data Quitação
   - **Remover** Valor Atualizado (e o cálculo `totalAtualizado`, `credorData`, query `credor-juros-multa` ficam órfãos — manter por enquanto, apenas não renderizar; evita quebrar outras dependências caso a query seja reaproveitada futuramente).

2. **Campos do credor** (cabeçalho cinza opcional, oculto se todos vazios)
   - Cod. Devedor • Cod. Contrato • Modelo • Data Devolução
   - Cada item via `InfoItem`/`InlineEditableField` como hoje. Para Y.BRASIL todos esses campos seguem aparecendo (não muda dado, só layout).

3. **Campos personalizados** (dinâmico, novo bloco, oculto se vazio)
   - Lista `custom_fields` ativos do tenant (já buscados via `fetchCustomFields`).
   - Filtra os que têm alias para colunas diretas (ex.: `nome_do_modelo` → já mostrado em "Modelo" no bloco 2) — usa o mesmo `CUSTOM_FIELD_ALIASES` que `ClientHeader.tsx` (atendimento) já implementa, para não duplicar.
   - Renderiza valor de `client.custom_data[field_key]` em grid igual aos outros blocos. Sem editor inline neste momento (read-only).

4. **Endereço** (último)
   - Rua • Bairro • Cidade • UF • CEP (igual ao layout atual).

5. **Observações** — mantém como está, no fim.

**Remover** do header:
- Bloco antigo "Identificação" (Cod. Devedor/Contrato/Modelo/Credor) — Credor já está no card superior; os outros migram para "Campos do credor".
- Bloco "Telefones + Email" — já estão no card superior; remover daqui evita duplicidade. (Telefones extras continuam acessíveis via `PhoneList` no atendimento; aqui o operador só consulta.)
- Bloco "Classificações" (Tipo de Dívida + Status Cliente) — Status migra para "Valores", Tipo de Dívida some daqui.

### Mover "Tipo de Dívida" para a aba "Títulos em Aberto"

`ClientDetailPage.tsx` (linhas 590–668), tabela da aba `titulos`:

- Adicionar coluna `<TableHead>Tipo</TableHead>` antes de "Vencimento".
- Resolver nome via `tiposDivida` (já carregado em `cadastrosService`) usando `c.tipo_divida_id`. Fallback: `—`.
- Mostra o que estiver cadastrado no `tipos_divida` do tenant (boleto, cheque, cartão, duplicata, etc.). Não cria novos tipos — usa os já existentes em Cadastros → Tipos de Dívida.

### Impacto Y.BRASIL (validado)

- `totalAtualizado` não é consumido fora deste componente (`rg` confirma). Remover apenas a renderização não quebra dashboards, relatórios nem Maxlist.
- Y.BRASIL não tem nada em `tenants.custom_fields` que sobreponha "Modelo" — o campo `model_name` (coluna direta) continua exibido no bloco 2.
- Nenhum `tipos_divida` adicional é exigido — a coluna nova só lê `tipo_divida_id` quando presente; se Y.BRASIL não preenche, a célula mostra `—` (não trava import nem cálculo de saldo).

### Arquivos tocados

1. `src/components/client-detail/ClientDetailHeader.tsx` — reordenar blocos dentro do `CollapsibleContent` (566–680).
2. `src/pages/ClientDetailPage.tsx` — adicionar coluna "Tipo" na tabela de Títulos em Aberto.

### Fora de escopo

- Edição inline dos campos personalizados (atual feature request é só exibição).
- Mudar o card superior (CPF/Telefone/Email/Credor/Saldo).
- Tornar `tipos_divida` obrigatório no import.
- Migrar `valor_atualizado` para fora de `clients` (continua existindo no banco e em outras telas).
