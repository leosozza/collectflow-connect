Diagnóstico confirmado:

- O acordo ativo do Cleidson é o `311f5d28-ec25-4a10-a800-344d57ddbf74`, status `pending`, com entrada paga e primeira parcela vencida em `28/04/2026`.
- Existe baixa manual confirmada da parcela: `manual_payments.installment_key = '1'`, `installment_number = 1`, status `confirmed`.
- A RPC do dashboard `get_dashboard_vencimentos` hoje procura pagamento manual regular assim:
  - `installment_key = agreement_id || ':1'`, ou
  - `installment_number = 2` quando existe entrada.
- Ou seja: a baixa real está registrada na chave canônica `1`, mas o dashboard está procurando a chave com prefixo `agreement_id:1` ou o número visual `2`. Por isso ele não reconhece a baixa e cai na regra de vencido/atrasado.

Plano de correção segura para produção:

1. Corrigir somente a função do dashboard
   - Criar uma migration substituindo `public.get_dashboard_vencimentos`.
   - Não alterar registros históricos de acordos, baixas, cobranças, conversas ou arquivos.
   - Manter a mesma assinatura e o mesmo retorno da função para não impactar a tela.

2. Ajustar a reconciliação de pagamentos manuais
   - Para entrada, reconhecer como pago quando houver baixa confirmada/aprovada com:
     - `installment_key = 'entrada'`
     - `installment_key = agreement_id || ':0'`
     - `installment_number = 0`
   - Para parcelas regulares, reconhecer como pago quando houver baixa confirmada/aprovada com:
     - chave canônica: `installment_key = '1'`, `'2'`, etc.
     - chave legada/provedor: `installment_key = agreement_id || ':1'`, etc.
     - número canônico: `installment_number = 1`, etc.
     - número visual antigo: `installment_number = 2` quando existe entrada, preservando compatibilidade com dados antigos.

3. Preservar a lógica da Negociarie
   - Manter a checagem atual de `negociarie_cobrancas` por `agreement_id:n`, pois é assim que os boletos do provedor estão registrados.
   - Não mudar status `registrado`, `estornado`, `cancelado` etc.

4. Validar o caso específico antes/depois
   - Antes: Cleidson em `28/04/2026`, parcela exibida `2/6`, baixa confirmada em `manual_payments`, mas dashboard calcula `overdue`.
   - Depois: a mesma linha deve calcular `paid`, aparecendo como `QUITADO` no dashboard.

5. Atualizar memória técnica
   - Registrar que `get_dashboard_vencimentos` precisa aceitar tanto chaves canônicas (`'1'`, `'entrada'`) quanto chaves legadas/provedor (`agreement_id:n`) para não regredir esse problema.

Impacto esperado:

- Corrige o Cleidson imediatamente no dashboard.
- Corrige outros casos equivalentes onde baixas manuais confirmadas existem, mas o dashboard ainda mostra `ATRASADO` por diferença de chave/número.
- Baixo risco: alteração concentrada em uma RPC de leitura do dashboard, sem modificar dados históricos.