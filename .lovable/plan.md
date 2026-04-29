Vou corrigir a gamificação para que **admin não seja tratado como participante**. A regra ficará clara:

- **Operador**: vê desempenho próprio, carteira, loja, histórico pessoal, metas pessoais e comemorações.
- **Admin/Gestor**: gerencia e analisa a equipe inteira, sem aparecer como “você”, sem carteira pessoal, sem loja pessoal e sem pop-up de premiação de operador.

Plano de implementação:

1. **Separar o cabeçalho/KPIs da Gamificação**
   - Para operador, manter os cards atuais: posição, pontos, conquistas, recebido e RivoCoins.
   - Para admin, trocar para visão analítica da equipe, por exemplo:
     - participantes ranqueados no mês;
     - pontos totais da equipe;
     - conquistas concedidas;
     - recebido total no mês;
     - campanhas ativas.
   - Alterar o subtítulo de admin de “Seu desempenho e ranking do mês” para algo como “Visão geral da equipe e gestão da gamificação”.

2. **Ajustar abas visíveis para admin**
   - Admin deve ver abas de análise/gestão:
     - Ranking;
     - Campanhas;
     - Conquistas;
     - Metas;
     - Gerenciar.
   - Remover da visão admin as abas pessoais:
     - Loja;
     - Carteira;
     - Histórico.
   - Operador continua vendo as abas pessoais normalmente.

3. **Corrigir Ranking para admin não aparecer como participante atual**
   - Hoje o ranking compara cada linha com `profile.id` e pode marcar o admin como “você”.
   - Para admin, desativar esse destaque e remover o texto “(você)”.
   - Para operador, manter o destaque pessoal.

4. **Corrigir Campanhas para admin analisar sem ser participante**
   - Nos cards de campanha, admin não deve ter destaque como participante atual.
   - Operador continua vendo seu destaque no ranking da campanha.

5. **Corrigir Conquistas para admin ver a equipe**
   - A aba Conquistas no admin passará a mostrar conquistas concedidas para todos os usuários do tenant, com nome do operador.
   - Operador continua vendo apenas suas conquistas.

6. **Evitar comemoração/popup de campanha para admin**
   - O modal de parabéns por campanha encerrada deve aparecer apenas para participantes operacionais.
   - Admin não deve receber esse comportamento visual de participante, mesmo se por erro estiver em `campaign_participants`.

7. **Proteger URLs antigas de abas pessoais**
   - Se um admin acessar `/gamificacao?tab=wallet`, `/history` ou `/shop`, redirecionar a aba para uma visão válida de admin, como Ranking.
   - Isso evita tela vazia ou comportamento de operador por URL direta.

Arquivos previstos:
- `src/pages/GamificacaoPage.tsx`
- `src/components/gamificacao/RankingTab.tsx`
- `src/components/gamificacao/CampaignsTab.tsx`
- `src/hooks/useCampaignCelebrations.ts`

Sem alteração de banco prevista. A correção será de regra de interface e comportamento: admin = gestão/análise; operador = participação.