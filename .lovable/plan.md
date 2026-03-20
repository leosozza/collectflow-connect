

# Plano: Reformular formulário de cadastro de cliente

## Problemas identificados

1. **Dialog muito grande** — `max-w-lg` não comporta todos os campos sem scroll. Falta `overflow-y-auto` e `max-h` no conteúdo.
2. **Ordem errada** — Dados da dívida (parcelas, valores) aparecem misturados com dados pessoais. Nome/CPF/endereço devem vir primeiro.
3. **Campos de dívida complexos demais** — "Valor de Entrada", "Valor das Demais Parcelas", "Nº da Parcela" parecem linguagem de venda. Para cadastro de dívida existente, o ideal é: Valor da Dívida, Data de Vencimento, Status.
4. **CEP não busca endereço** — Ao digitar o CEP, deveria consultar a API ViaCEP e preencher automaticamente endereço, bairro, cidade e UF.

## Mudanças

### `src/components/clients/ClientForm.tsx`

**Reorganizar em seções visuais:**

```text
── Dados Pessoais ──
  Nome Completo* | CPF*
  Telefone | Email

── Endereço ──
  CEP (auto-busca) | UF
  Endereço (logradouro + número)
  Bairro | Cidade

── Dados da Dívida ──
  Credor* | Valor da Dívida (R$)*
  Data de Vencimento* | Status
  Nº Parcela | Total Parcelas
  ID Externo (contrato)

── Observações ──
  Textarea
```

**Simplificar campos de dívida:**
- Renomear "Valor de Entrada" → "Valor da Dívida" (campo principal)
- Manter "Valor das Demais Parcelas" mas como opcional (colapsável ou secondary)
- "Valor Pago" como opcional
- Labels mais claros

**Adicionar busca de CEP:**
- `onBlur` no campo CEP: quando tiver 8 dígitos, chamar `https://viacep.com.br/ws/{cep}/json/`
- Preencher automaticamente: `endereco` (logradouro), `bairro`, `cidade`, `uf`
- Adicionar state `bairro` (atualmente não existe no form mas existe na tabela clients)
- Mostrar loading spinner enquanto busca

**Adicionar scroll ao dialog:**

### `src/pages/CarteiraPage.tsx`

- Mudar `max-w-lg` para `max-w-2xl`
- Adicionar `max-h-[85vh] overflow-y-auto` ao conteúdo do dialog

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/clients/ClientForm.tsx` | Reorganizar seções, simplificar dívida, busca CEP via ViaCEP |
| `src/pages/CarteiraPage.tsx` | Dialog com scroll e largura adequada |

