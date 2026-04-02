

# Plano: Detalhes expandíveis nos logs de auditoria + rotas nas abas de Configurações

## Problemas

1. **Logs sem detalhes**: A coluna "Detalhes" mostra texto truncado sem possibilidade de expandir e ver o conteúdo completo (ex: métricas de importação, campos alterados).
2. **Sem rota nas abas**: `/configuracoes` usa `?tab=auditoria` via query string, mas ao navegar diretamente não há rota dedicada — o `useUrlState` já resolve isso via query param, porém a URL não reflete a aba ativa de forma persistente ao compartilhar links.

## Solução

### 1. Linhas expandíveis na tabela de Logs (`AuditoriaPage.tsx` — `LogsTab`)

Adicionar um estado `expandedLogId` e tornar cada linha clicável. Ao clicar, expande uma linha extra abaixo com os detalhes completos formatados:

- **Detalhes genéricos**: Renderizar cada chave/valor do objeto `details` em formato legível (grid de 2-3 colunas)
- **Importação** (`action: import_completed`): Mostrar cards com métricas — total importado, inseridos, atualizados, erros, credor, duração
- **Operacional** (`entity_type: operational`): Mostrar módulo, sucesso/erro, duração, mensagem de erro se houver
- **Acordo** (`entity_type: agreement`): Mostrar CPF, credor, valor
- **Fallback**: JSON formatado para detalhes não mapeados

UI da expansão:
- Ícone `ChevronDown/ChevronUp` na primeira coluna
- Linha expandida com `colSpan=5`, fundo `bg-muted/20`, padding generoso
- Detalhes em grid com labels em `text-muted-foreground` e valores em `text-foreground`

### 2. Rotas nas abas de Configurações (`ConfiguracoesPage.tsx`)

O `useUrlState("tab", "integracao")` já sincroniza com `?tab=xxx` na URL. Isso já funciona — ao acessar `/configuracoes?tab=auditoria` a aba correta abre.

**Melhoria**: Garantir que ao clicar numa aba o `visited` set seja populado a partir do valor inicial da URL (não só do default). Atualmente, se o usuário acessa `/configuracoes?tab=auditoria` diretamente, o `visited` começa com `Set(["integracao"])` e não inclui `"auditoria"`, então a aba não renderiza.

**Fix**: Inicializar `visited` incluindo o valor ativo vindo da URL:
```typescript
const [active, setActive] = useUrlState("tab", "integracao");
const [visited, setVisited] = useState<Set<string>>(() => new Set(["integracao", active]));
```

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/AuditoriaPage.tsx` | Linhas expandíveis com detalhes formatados no `LogsTab` |
| `src/pages/ConfiguracoesPage.tsx` | Inicializar `visited` com aba ativa da URL |

Nenhuma alteração em banco, serviços ou fluxos operacionais.

