## Diagnóstico

Na tela **Configurações da Empresa → Contrato** (`src/pages/TenantSettingsPage.tsx`), o texto do contrato é uma constante hardcoded (`CONTRATO_PADRAO`, linhas 24–58) com a frase genérica:

> `CONTRATANTE: A empresa identificada nos dados cadastrais deste sistema.`

Não há nenhuma interpolação dos dados do tenant. Por isso, mesmo em uma tenant nova com nome e CNPJ preenchidos, o contrato sai sem o nome da empresa.

A tabela `tenants` já possui `name` e `cnpj` (verificado no schema), e o hook `useTenant()` já carrega esses campos.

## Plano de correção

Em `src/pages/TenantSettingsPage.tsx`:

1. Converter `CONTRATO_PADRAO` de constante para uma função `buildContrato(tenant)` que recebe o tenant e injeta:
   - **Nome**: `tenant.name`
   - **CNPJ**: `tenant.cnpj` formatado como `00.000.000/0000-00` (ou `"CNPJ não informado"` se vazio)

2. Substituir a linha do CONTRATANTE por:
   ```
   CONTRATANTE: {tenant.name}, inscrita no CNPJ sob nº {cnpjFormatado}.
   ```

3. Renderizar com `{buildContrato(tenant)}` no `<pre>` da aba (linha 430).

4. Se `tenant.cnpj` estiver vazio, mostrar um aviso visual acima do contrato sugerindo preencher o CNPJ na aba **Dados** antes de assinar (não bloqueia, só orienta).

Sem alteração de banco, sem alteração de outras telas. Apenas a renderização do contrato passa a refletir os dados reais da empresa.