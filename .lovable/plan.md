
Objetivo

Voltar o dashboard para a leitura original, sem o card "Quitados no Mês", mantendo a interpretação correta de que o restante do valor vem de acordos já quitados e não de pendências.

O que encontrei

- O cálculo de "Pendentes" já está novamente na semântica correta: acordos `completed` não entram nele.
- O que sobrou da última alteração foi o campo auxiliar `total_quitados` no backend e o card "Quitados no Mês" no frontend.
- Esse campo extra só está sendo usado no dashboard atual, então a reversão é pequena e localizada.

Plano

1. Reverter o campo auxiliar no backend
- Atualizar a função `get_dashboard_stats` para remover `total_quitados` do retorno.
- Remover a variável `_quitados` e a consulta que soma acordos `completed`.
- Manter sem mudança os cálculos atuais de:
  - `total_recebido`
  - `total_pendente`
  - `total_negociado`
  - `total_negociado_mes`

2. Limpar o dashboard
- Remover `total_quitados` da interface `DashboardStats`.
- Remover o card "Quitados no Mês".
- Ajustar a grade dos KPIs para voltar ao layout original sem esse card extra.
- Remover qualquer texto visual diretamente ligado a esse indicador extra, se houver.

3. Preservar o entendimento original
- O dashboard volta a mostrar só os KPIs principais.
- A explicação continua sendo esta:
  - "Total de Primeira Parcela" inclui acordos criados no mês.
  - "Pendentes" mostra apenas o que ainda está em aberto.
  - O restante do valor corresponde a acordos já quitados, então não aparece como pendência.

Resultado esperado

- Sai o card "Quitados no Mês".
- O dashboard volta a ficar como antes dessa última mudança visual.
- Nenhum dado será alterado.
- Nenhuma regra principal de cálculo será mexida além da remoção do campo auxiliar.

Detalhes técnicos

- Arquivos principais:
  - `src/pages/DashboardPage.tsx`
  - nova migration para atualizar `get_dashboard_stats`
- Não vou editar manualmente o arquivo gerado de tipos da integração; ele deve refletir a função atualizada automaticamente depois da mudança no backend.
