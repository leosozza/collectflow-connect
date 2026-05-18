## Diagnóstico

O download da "Planilha Modelo" está em `src/pages/CarteiraPage.tsx` (linhas 452-478, função `downloadTemplate`). Hoje ela gera apenas 10 colunas fixas:

`Credor, Nome Completo, CPF/CNPJ, Parcela, Valor Entrada, Valor Parcela, Valor Pago, Total Parcelas, Data Vencimento, ID Externo`

Em seguida ela busca `fetchCustomFields(tenant.id)` e **já anexa** as colunas personalizadas ativas (`field_label`) ao final — então a parte de custom fields já funciona. O que falta é incluir no modelo todas as demais colunas que o `importService.parseRows` (e o `clientSchema`) já sabem ingerir.

### Campos que o backend já aceita mas o modelo não expõe

Validado em `src/services/importService.ts` e `src/lib/validations.ts`:

- **Telefones**: `FONE_1`, `FONE_2`, `FONE_3` (mapeia para `phone`, `phone2`, `phone3`)
- **E-mail**: `EMAIL`
- **Endereço completo**: `ENDERECO`, `NUMERO`, `COMPLEMENTO`, `BAIRRO`, `CIDADE`, `UF/ESTADO`, `CEP`
- **Parcela**: `COD_CONTRATO`, `COD_TITULO`, `NOME_MODELO`, `OBSERVACOES`, `DADOS_ADICIONAIS`, `DT_PAGAMENTO`, `VL_SALDO`
- **Custom fields** já anexados (ok)

## Plano de alteração (somente frontend)

Escopo único: refatorar `downloadTemplate` em `src/pages/CarteiraPage.tsx`. Nada no backend / importService / schema é tocado.

### Novo cabeçalho proposto (ordem lógica)

Bloco 1 — Identificação do credor/cliente
```
Credor | Nome Completo | CPF/CNPJ | ID Externo | Cod Contrato | Cod Titulo
```

Bloco 2 — Contato
```
Telefone 1 | Telefone 2 | Telefone 3 | E-mail
```

Bloco 3 — Endereço
```
CEP | Endereço | Número | Complemento | Bairro | Cidade | UF
```

Bloco 4 — Dados da parcela / dívida
```
Parcela | Total Parcelas | Valor Entrada | Valor Parcela | Valor Saldo | Valor Pago | Data Vencimento | Data Pagamento | Observações
```

Bloco 5 — Campos personalizados do tenant (dinâmico, já existe)
```
<field_label_1> | <field_label_2> | ...
```

### Implementação

1. Trocar `baseHeaders` / `baseRow1` / `baseRow2` por arrays organizados nos blocos acima.
2. Manter o `fetchCustomFields` + concat no final (já está correto).
3. Aumentar levemente `wch` para colunas de endereço (24) e manter 16 para o resto.
4. Adicionar uma 2ª aba `Instruções` no workbook explicando:
   - Quais colunas são obrigatórias (Credor, Nome, CPF/CNPJ, Valor Parcela, Data Vencimento)
   - Formato de data `DD/MM/AAAA`
   - Formato de telefone (DDD + número, normalizado para E.164 automaticamente)
   - Campos personalizados (último bloco) preencher conforme o cadastro do tenant
   - Aceita CPF (11) e CNPJ (14)

### Diagrama do fluxo

```text
[Botão "Planilha Modelo"]
        │
        ▼
downloadTemplate()
        │
        ├── monta cabeçalho fixo (5 blocos)
        ├── fetchCustomFields(tenant.id)  ← já existe
        ├── concatena field_label[] ativos
        ├── 2 linhas de exemplo (PF + PJ)
        └── XLSX: aba "Modelo" + aba "Instruções"
```

## Sugestões adicionais de campos que a RIVO já suporta receber

Validados como aceitos pelo importer ou existentes em `clients`:

- **`Cod Titulo`** — identificador único da parcela/título no sistema de origem (mapeado em `cod_titulo`); útil para reconciliação.
- **`Nome Modelo`** — modelo de cobrança/produto (`model_name`), usado por integrações MaxSystem.
- **`Dados Adicionais`** — campo livre (`dados_adicionais` / `Producer`) para informações soltas do credor.
- **`Valor Saldo`** — saldo devedor distinto do valor da parcela (`valor_saldo`), importante quando há juros/multa.
- **`Data Pagamento`** — `data_pagamento`, permite importar histórico já quitado.
- **`Observações`** — texto livre para anotações operacionais por linha.

Não inclui no modelo padrão (sugiro deixar de fora para não poluir):
- `Tipo de Dívida` (só faz sentido se o tenant tiver tipos cadastrados — já dá pra criar como campo personalizado).
- `Perfil do Devedor` (calculado automaticamente pelo `debtorProfileAutoService`, não importar).
- `Score / Propensity` (calculado).

## O que NÃO muda

- `importService.ts`, `clientSchema`, mapeamento da `ImportDialog`, RLS, edge functions: **nada**.
- Custom fields já são anexados — apenas validamos que continua funcionando.
- Comportamento atual de importação preserva 100% de compatibilidade (colunas novas são opcionais).
