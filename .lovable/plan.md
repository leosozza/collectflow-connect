# Padronização da navegação superior (top tabs)

## Objetivo
Aplicar o mesmo padrão visual de navegação horizontal usado em `/gamificacao/ranking` em todas as telas listadas, mantendo o conteúdo, ícones e nomenclaturas atuais de cada uma.

## Padrão visual de referência (extraído de `GamificacaoPage.tsx`)

Container:
```
<nav className="flex flex-wrap items-center gap-1 border-b border-border pb-px w-full">
```

Item ativo:
```
"flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all relative rounded-t-lg
 bg-primary/10 text-primary border-b-[3px] border-primary"
```

Item inativo:
```
"text-muted-foreground hover:bg-muted/50 hover:text-foreground border-b-[3px] border-transparent"
```

Cada item: ícone Lucide 16px (`w-4 h-4 shrink-0`) + label.

Observação: `/cadastros` já usa exatamente esse padrão — fica como referência cruzada e não precisa de alteração.

## Escopo por tela

### 1. `/acordos` (`src/pages/AcordosPage.tsx`)
Hoje usa "pills" arredondadas coloridas (linha ~404). Substituir o bloco `<div className="flex flex-wrap gap-2">…</div>` por um `<nav>` no padrão acima. Manter:
- mesmas chaves do `statusFilterConfig`
- mesma lógica de visibilidade (`payment_confirmation` só para admin)
- mesmo badge de contagem (`tabCounts[key]`) renderizado como `<Badge variant="secondary">` ao lado do label, igual ao `CadastrosPage`
- ícones Lucide já usados (ex.: `HandCoins` para confirmação) e adicionar ícones consistentes para os demais status (ex.: `ListChecks`, `Clock`, `CheckCircle2`, `AlertTriangle`, `XCircle`).

### 2. `/financeiro/aguardando-liberacao` e `/financeiro/confirmacao-pagamento`
Ambas reusam `AcordosPage` forçando `?status=…`. Como a nav nova vive dentro de `AcordosPage`, a mudança feita no item 1 já cobre essas duas rotas. Nenhuma edição adicional nesses arquivos.

### 3. `/automacao` (`src/pages/AutomacaoPage.tsx`)
Substituir o `<Tabs>/<TabsList>/<TabsTrigger>` por um `<nav>` no padrão de Gamificação, usando state local para a aba ativa (mantendo `activeTab`/`setActiveTab` atuais). Itens (mantendo nomenclatura): Fluxos, Gatilhos, Templates, Pós-Tabulação, Histórico, Configurações. Ícones sugeridos: `GitBranch`, `Zap`, `FileText`, `ListChecks`, `History`, `Settings`. Conteúdo continua via render condicional por `activeTab`.

### 4. `/cadastros`
Já está no padrão. Sem alterações.

### 5. `/contact-center/telefonia` (`src/components/contact-center/TelefoniaTab.tsx`)
Hoje tem um `<Tabs>` com uma única aba (3CPlus). Trocar por uma `<nav>` no novo padrão com o item "3CPlus" (icon `Phone`). Mantém comportamento de única aba, agora visualmente alinhado.

### 6. `/contact-center/whatsapp` (`src/pages/ContactCenterPage.tsx`)
Substituir o bloco de botões pill com `bg-primary text-primary-foreground` (linhas 41-63) pela `<nav>` padrão. Itens existentes preservados: Conversas, Campanhas, Agente IA, Etiquetas, Respostas Rápidas, Personalização, com seus ícones e flags `show`. Ajustar o wrapper para que o nav fique acima de `flex-1 overflow-hidden`.

### 7. `/central-empresa` (`src/pages/TenantSettingsPage.tsx`)
Substituir o `<Tabs>/<TabsList>` (linha ~202) por `<nav>` no padrão. Itens: Dados, Financeiro, Contrato, Serviços, Cancelamento. Ícones sugeridos: `Building2`, `Wallet`, `FileSignature`, `Package`, `XOctagon`. Migrar o conteúdo de cada `<TabsContent>` para render condicional por `activeTab` (state local), preservando lógica atual.

### 8. `/configuracoes/integracao` (`src/pages/IntegracaoPage.tsx`)
Hoje renderiza grid de cards agrupados por `INTEGRATION_SEGMENTS` (Negociação, Pagamentos, WhatsApp, etc.) sem nav superior. Adicionar `<nav>` no padrão Gamificação onde cada item corresponde a um segmento de `INTEGRATION_SEGMENTS` (ex.: Todos, Comunicação, Pagamentos, Telefonia, Crédito, Dados). State local controla o segmento selecionado e filtra os cards exibidos. Item "Todos" mostra todos os segmentos como hoje. Quando `activeIntegration` está aberto, o nav fica oculto (mantém a UX atual de "voltar").

## Detalhes técnicos

- Sem alteração de tokens/CSS globais — só uso das classes semânticas existentes.
- Sem alteração em rotas, services, RLS ou lógica de negócio.
- `Badge` reutilizado: `import { Badge } from "@/components/ui/badge"`.
- Em telas que dependem de URL state (`useUrlState`/`useSearchParams`) o estado da aba continua na URL, apenas a renderização do nav muda.
- Não tocar em `src/pages/CadastrosPage.tsx` (já é a referência canônica do padrão).

## Fora de escopo
- Cores/temas globais.
- Lógica funcional de cada aba.
- Mudanças no sidebar lateral do app.
