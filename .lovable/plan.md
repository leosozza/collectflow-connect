## Problema

A tela não carrega porque dois arquivos têm JSX duplicado após `export default`, gerando Syntax Error no Vite:

- `src/components/atendimento/ClientTimeline.tsx` — linhas 747–784 são lixo duplicado depois de `export default ClientTimeline;` (linha 745) e `export { ClientObservations };` (linha 746).
- `src/components/client-detail/AgreementInstallments.tsx` — linhas 1231–1260 são lixo duplicado depois de `export default AgreementInstallments;` (linha 1230).

Esses blocos são cópias do JSX já presente acima nos arquivos (botão "Salvar Nota", dialog de "Campos faltantes"), provavelmente resíduo de um merge/edit anterior.

## Correção

1. `ClientTimeline.tsx`: apagar tudo depois da linha 746 (manter apenas até `export { ClientObservations };`).
2. `AgreementInstallments.tsx`: apagar tudo depois da linha 1230 (manter apenas até `export default AgreementInstallments;`).

Sem nenhuma outra mudança — o JSX correto já existe acima nos dois arquivos.
