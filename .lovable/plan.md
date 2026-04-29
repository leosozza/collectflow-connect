Vou corrigir a aba **Gerenciar > Campanhas** para usar a mesma regra da tela **Campanhas**.

Hoje, nessa tela de gerenciamento, a separação está considerando apenas `status === "ativa"`. Por isso uma campanha já vencida/encerrada por data ainda aparece dentro de **Campanhas Ativas** se o status no banco continuar como `ativa`.

Plano de ajuste:

1. **Unificar a regra de campanha ativa**
   - Uma campanha só deve aparecer em **Campanhas Ativas** quando:
     - `status` for `ativa`;
     - possuir datas válidas;
     - a data final ainda não tiver passado.

2. **Mover automaticamente vencidas para “Campanhas encerradas” na UI**
   - Campanhas com data final passada, status diferente de `ativa`, rascunho ou datas inválidas ficarão no bloco colapsado **Campanhas encerradas**.
   - Esse bloco continuará abaixo e fechado por padrão.

3. **Ajustar a consistência visual**
   - O card continuará mostrando o selo correto: **Ativa**, **Encerrada**, **Rascunho** ou **Datas inválidas**.
   - A tela de gerenciamento ficará igual à aba Campanhas: ativas em cima, encerradas colapsadas abaixo.

Arquivos previstos:
- `src/components/gamificacao/CampaignsManagementTab.tsx`

Não será necessário alterar banco de dados para essa correção; é apenas a regra de exibição da tela de gerenciamento.