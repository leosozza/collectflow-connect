

## Otimizacoes no Formulario de Credor

### 1. Descricao de Divida - Template padrao nao aparece ao editar credor existente
**Problema**: Quando o credor ja existe no banco e o campo `template_descricao_divida` esta vazio/null, o template padrao nao e carregado.
**Solucao**: No `useEffect` que carrega os dados do credor em edicao, aplicar fallback para o template padrao quando o valor estiver vazio.

### 2. Dialog de edicao dos templates - Aumentar tamanho e adicionar formatacao
**Problema**: O Dialog e pequeno (`sm:max-w-lg`) e o Textarea nao tem opcoes de formatacao.
**Solucao**:
- Aumentar o Dialog para `sm:max-w-2xl`
- Adicionar barra de ferramentas acima do Textarea com botoes de formatacao: **Negrito**, *Italico*, Sublinhado, Titulo (H1/H2), Lista
- As formatacoes inserem marcadores simples no texto (ex: `**texto**` para negrito, `_texto_` para italico)
- Aumentar o Textarea de 8 para 12 rows

### 3. Entrada Minima - Melhorar organizacao do switch R$/% 
**Problema**: O Switch entre R$ e % nao e intuitivo.
**Solucao**: Substituir o Switch por um `Select` com opcoes claras "Valor fixo (R$)" e "Percentual (%)", posicionado ao lado do campo de valor em layout mais limpo.

### 4. Grade de Honorarios - Adicionar opcao por valores
**Problema**: Atualmente so existe a opcao por porcentagem.
**Solucao**: Adicionar uma coluna "Valor Fixo (R$)" na tabela de honorarios, ao lado da coluna de percentual existente. O usuario pode preencher um ou outro.

### 5. Regua - Excluir mensagem informativa do rodape
**Problema**: A mensagem `"Mensagens serao disparadas automaticamente..."` na parte de baixo polui a tela.
**Solucao**: Remover o paragrafo informativo (linha 279-281 do CredorReguaTab.tsx).

### 6. Portal - Excluir Preview e mensagem inferior
**Problema**: O bloco de Preview e a mensagem informativa ocupam espaco desnecessario.
**Solucao**: 
- Remover o bloco de Preview (linhas 511-522 do CredorForm.tsx)
- Remover a mensagem informativa (linhas 524-526)

### 7. Portal - Melhorar visual do Link do Portal
**Problema**: O campo de link esta com visual amador.
**Solucao**: Redesenhar o bloco do link com um Card mais profissional: icone de link, typography melhorada, botao "Copiar" com destaque, sem a descricao desnecessaria.

### 8. Portal - Otimizar o quadro geral
**Solucao**: Reorganizar campos com spacing mais limpo, agrupando logo + cor primaria de forma mais compacta.

### 9. Bancario - Excluir mensagem do final
**Problema**: A mensagem `"Este gateway sera usado automaticamente..."` polui a tela.
**Solucao**: Remover o paragrafo informativo (linha 222 do CredorForm.tsx).

---

### Detalhes Tecnicos

**Arquivos a modificar:**
- `src/components/cadastros/CredorForm.tsx` - Itens 1, 2, 3, 4, 6, 7, 8, 9
- `src/components/cadastros/CredorReguaTab.tsx` - Item 5

**Nenhuma alteracao de banco de dados necessaria.**

**Componentes a utilizar:** `Card`, `Dialog`, `Button`, `Select`, `Popover` - todos ja existentes no projeto.

**Formatacao de templates (item 2):** Sera implementada com botoes que inserem marcadores de texto (markdown-like) na posicao do cursor do Textarea. Botoes: Negrito (`**texto**`), Italico (`_texto_`), Titulo, Lista, Aumento de fonte.
