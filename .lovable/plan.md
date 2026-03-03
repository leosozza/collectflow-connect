

## Plano: Dois mapeamentos separados no Settings do MaxList

### Contexto
O `MaxListSettingsDialog` atualmente mostra apenas o mapeamento da API (campos como `ResponsibleName`, `ModelName`). O usuário quer que ele também mostre o mapeamento de planilha (campos como `NOME_DEVEDOR`, `CNPJ_CPF`), permitindo configurar ambos independentemente.

### Alterações em `src/components/maxlist/MaxListSettingsDialog.tsx`

**1. Adicionar constante `SPREADSHEET_HEADERS`** com os nomes de colunas típicos de planilhas:
```
NOME_DEVEDOR, CNPJ_CPF, COD_CONTRATO, COD_DEVEDOR,
FONE_1, FONE_2, FONE_3, EMAIL,
NUM_PARCELA, VL_PARCELA, VL_SALDO, DESCONTO,
DT_VENCIMENTO, DT_PAGAMENTO, STATUS,
NOME_MODELO, OBSERVACOES, COD_TITULO, DADOS_ADICIONAIS
```

**2. Adicionar `DEFAULT_SPREADSHEET_MAP`** mapeando esses nomes para campos do sistema (similar ao auto-map antigo).

**3. Gerenciar dois mapeamentos separados no state:**
- `apiMapping` → salvo como `"MaxSystem - API"` com `source: "api"`
- `spreadsheetMapping` → salvo como `"MaxSystem - Planilha"` com `source: "spreadsheet"`

**4. Usar Tabs na UI** para separar os dois mapeamentos:
- Aba "API" → mostra `SOURCE_HEADERS` (campos da API)
- Aba "Planilha" → mostra `SPREADSHEET_HEADERS` (campos de planilha)

**5. Salvar ambos independentemente** na tabela `field_mappings`, cada um com seu `source` e `name`.

### Resultado
O usuário configura uma vez os dois mapeamentos. Importações via API usam o mapeamento "API", importações via planilha usam o mapeamento "Planilha".

### Arquivo a editar

| Arquivo | Alteração |
|---|---|
| `src/components/maxlist/MaxListSettingsDialog.tsx` | Adicionar tabs com dois mapeamentos (API + Planilha) |

