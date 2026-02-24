

## Analise da aba Negociacao - Problemas encontrados e correcoes

Apos revisar o codigo completo de `CredorForm.tsx`, identifiquei os seguintes problemas:

### Problemas encontrados

1. **Grade de Honorarios sem botao "Salvar"**: O usuario adiciona/edita faixas mas so consegue persistir salvando o credor inteiro no botao "Salvar Credor" no rodape. Se trocar de aba sem salvar, perde as alteracoes. O usuario pede um botao dedicado.

2. **Faixas de Aging sem botao "Salvar"**: Mesmo problema. As faixas ficam apenas no state local ate o "Salvar Credor" ser clicado.

3. **`template_notificacao_extrajudicial` ausente nos defaults de novo credor** (linha 136): Ao criar um novo credor, o template de Notificacao Extrajudicial nao e pre-preenchido com o modelo padrao, diferente dos outros 4 templates que sao inicializados.

4. **Campo Desconto Maximo sem restricoes**: Faltam atributos `min={0}`, `max={100}`, `step={0.01}` no input, permitindo valores negativos ou acima de 100%.

5. **Campos numericos de Juros e Multa sem restricoes**: Mesma situacao, sem `min={0}` e `step`.

### Plano de correcoes

**Arquivo: `src/components/cadastros/CredorForm.tsx`**

| Correcao | Detalhe |
|---|---|
| Botao "Salvar Grade" | Adicionar botao ao lado de "Adicionar Faixa" nos honorarios. Ao clicar, faz upsert parcial do credor com `honorarios_grade` atualizado (somente quando editando um credor existente). |
| Botao "Salvar Faixas" | Adicionar botao ao lado de "Adicionar Faixa" no aging. Ao clicar, faz upsert parcial com `aging_discount_tiers` atualizado (somente quando editando). |
| Template notificacao no form novo | Adicionar `template_notificacao_extrajudicial: TEMPLATE_NOTIFICACAO_EXTRAJUDICIAL_DEFAULT` ao state inicial (linha 136). |
| Restricoes desconto_maximo | Adicionar `min={0} max={100} step={0.01}` ao Input. |
| Restricoes juros/multa | Adicionar `min={0} step={0.01}` aos Inputs de juros e multa. |
| Feedback visual nos botoes salvar | Mostrar toast de sucesso apos salvar grade ou faixas individualmente. Botoes aparecem apenas quando ha um credor existente (editing). |

### Detalhes tecnicos

Os botoes "Salvar Grade" e "Salvar Faixas" farao chamadas independentes ao `upsertCredor` passando apenas `{ id, tenant_id, honorarios_grade }` ou `{ id, tenant_id, aging_discount_tiers }`, sem precisar reenviar todos os campos do credor. Isso garante salvamento parcial seguro.

Para novos credores (sem `editing.id`), os botoes nao aparecem -- as grades sao salvas junto com o "Salvar Credor" como ja funciona hoje.

