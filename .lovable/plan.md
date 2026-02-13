
# Redesign da Interface de Telefonia

Redesign completo da area de telefonia inspirado no layout de referencia, adaptado ao design system existente (cores laranja/dark, Inter font, cards com sombra suave).

---

## Problemas Atuais

1. **Tabs aninhadas desnecessarias**: ContactCenterPage > TelefoniaTab (com aba "3CPlus" unica) > ThreeCPlusPanel (13 abas). Tres niveis de tabs.
2. **KPI cards genericos**: Todos iguais, sem diferenciacao visual por tipo (sucesso, perigo, neutro).
3. **Tabela de agentes basica**: Sem avatares, sem filtros, sem legenda de status.
4. **Toolbar de refresh desorganizada**: Elementos soltos sem hierarquia visual.
5. **13 abas em uma linha**: Overflow visual, dificulta navegacao.

---

## Mudancas Planejadas

### 1. Eliminar TelefoniaTab (wrapper desnecessario)
- `ContactCenterPage.tsx` renderiza `ThreeCPlusPanel` diretamente (sem o wrapper `TelefoniaTab` que so tem uma aba "3CPlus").

### 2. Redesign do ThreeCPlusPanel (navegacao por abas)
- Tabs organizadas em **2 linhas logicas**: operacionais (Dashboard, Campanhas, Mailing, Chamadas, Graficos, Produtividade) e administrativas (Qualificacoes, Bloqueio, Equipes, Agendamentos, SMS, Usuarios, Receptivo).
- Tabs com visual mais limpo: sem icones nos triggers (apenas texto), fundo neutro, indicador ativo mais visivel.

### 3. Redesign do TelefoniaDashboard
- **KPI Cards redesenhados**: Fundo colorido suave por tipo (verde para online, vermelho para em ligacao, amarelo para pausa, azul para ociosos). Icone maior, valor em destaque, indicador de tendencia.
- **Toolbar de refresh**: Barra horizontal integrada com status de conexao a esquerda e controles (auto-refresh toggle, intervalo, botao atualizar) a direita, dentro de um card sutil.
- **Secao de agentes**: Card com header que inclui titulo + subtitulo descritivo, botoes de filtro e refresh no header.
- **Campanhas**: Mantidas abaixo, com layout melhorado.

### 4. Redesign do AgentStatusTable
- **Avatares com iniciais**: Circulo colorido com as 2 primeiras letras do nome do agente (como na referencia: "GA", "VS", "ME").
- **Status badges mais refinados**: Badges com dot colorido animado (pulse para "Em Ligacao").
- **Legenda de status**: Footer da tabela com indicadores visuais dos status possiveis (Online, Em Ligacao, Offline, Pausa).
- **Texto descritivo**: "Mostrando X de Y agentes registrados" no rodape.
- **Acoes com tooltips**: Botoes de espionar e deslogar mais claros.

---

## Detalhes Tecnicos

### Arquivos modificados:

1. **`ContactCenterPage.tsx`** - Importar `ThreeCPlusPanel` diretamente, remover `TelefoniaTab`.

2. **`ThreeCPlusPanel.tsx`** - Reorganizar tabs em layout mais limpo, remover icones dos triggers, agrupar visualmente.

3. **`TelefoniaDashboard.tsx`** - Redesign completo:
   - KPI cards com backgrounds coloridos suaves (bg-emerald-50, bg-red-50, bg-amber-50, bg-blue-50)
   - Toolbar integrada em barra horizontal
   - Melhor espacamento e hierarquia visual

4. **`AgentStatusTable.tsx`** - Adicionar:
   - Avatar com iniciais (funcao helper para extrair iniciais e gerar cor)
   - Dot animado no status "Em Ligacao"
   - Legenda no rodape
   - Contador de agentes

5. **`TelefoniaTab.tsx`** - Pode ser mantido mas simplificado, ou removido se o ContactCenterPage renderizar direto.

### Sem dependencias novas - usa apenas Tailwind, Lucide, e componentes UI existentes.
