

# Plano: Preservação de Contexto de Navegação

## Resumo

Implementar persistência completa de estado de navegação em todo o sistema, garantindo que filtros, busca, paginação, abas, view mode, scroll e origem sejam preservados ao navegar entre telas. Sem alterar layout, sem criar telas novas, sem mudar arquitetura.

## Estado Atual

- **CarteiraPage**: Já usa `useUrlState` para todos os filtros, sort, viewMode — funciona bem
- **AcordosPage, RelatoriosPage, GamificacaoPage, FinanceiroPage**: Já usam `useUrlState` parcialmente
- **ClientDetailPage**: Usa `useState("titulos")` para aba ativa, só lê `?tab=acordo` via useEffect — não persiste outras abas
- **AtendimentoPage**: Botão "Voltar" usa `navigate(-1)` — funciona mas não garante retorno com filtros
- **ClientDetailHeader**: Botão voltar hardcoded para `/carteira` — perde filtros
- **useUrlState**: Já persiste em sessionStorage por rota — infraestrutura sólida
- **Scroll**: Nenhuma persistência implementada

## Alterações

### 1. Hook `useScrollRestore` (novo arquivo)

Criar `src/hooks/useScrollRestore.ts`:
- Salva posição de scroll no sessionStorage ao sair da rota (keyed por pathname)
- Restaura scroll ao retornar, após breve delay para renderização
- Usa `useEffect` com cleanup para capturar scroll antes do unmount
- Key: `scroll:${pathname}`

### 2. Hook `useNavigateWithOrigin` (novo arquivo)

Criar `src/hooks/useNavigateWithOrigin.ts`:
- Wrapper sobre `useNavigate` que automaticamente inclui `{ state: { from: pathname + search } }`
- Export helper `useOriginBack(fallback)` que lê `location.state?.from` e faz `navigate(from || fallback)`

### 3. CarteiraPage — scroll restore + origin na navegação

- Importar `useScrollRestore` e ativar
- Nas navegações para `/carteira/:cpf` e `/atendimento/:id`, passar `state: { from: pathname + search }`
- Não precisa mudar filtros (já usam useUrlState)

### 4. CarteiraKanban — origin na navegação

- Nos `navigate()` para `/carteira/:cpf` e `/atendimento/:id`, passar `state: { from }` usando `useLocation`

### 5. ClientDetailPage — persistir aba ativa em URL

- Trocar `useState("titulos")` para `useUrlState("tab", "titulos")`
- Remover o useEffect que lê `?tab=acordo` (useUrlState já cobre isso)
- Botão "Voltar" (no ClientDetailHeader): usar `location.state?.from || "/carteira"` em vez de `/carteira` hardcoded

### 6. ClientDetailHeader — back com origin

- Receber `backTo` prop (string) do ClientDetailPage
- ClientDetailPage passa `location.state?.from || "/carteira"` como `backTo`
- Botão ArrowLeft navega para `backTo`

### 7. AtendimentoPage — back com origin

- O botão voltar já usa `navigate(-1)` que é ok para fluxo normal
- No fallback "Cliente não encontrado", usar `location.state?.from || "/carteira"` em vez de `/carteira` hardcoded

### 8. AcordosPage — scroll restore

- Importar e ativar `useScrollRestore`

### 9. ClientsPage (se existir listagem separada) — scroll restore

- Importar e ativar `useScrollRestore`

### 10. Páginas com abas via useState que devem usar useUrlState

- **AuditoriaPage**: Filtros `dateFrom`, `actionFilter`, `entityFilter` → migrar para `useUrlState`
- Outras páginas menores com filtros locais: avaliar caso a caso, priorizar rotas operacionais

### 11. Aplicar scroll restore nas listagens principais

Páginas que receberão `useScrollRestore`:
- CarteiraPage
- ClientsPage  
- AcordosPage
- RelatoriosPage
- CadastrosPage

## Detalhes Técnicos

### useScrollRestore

```typescript
// Salva scroll ao unmount, restaura ao mount
export function useScrollRestore() {
  const { pathname } = useLocation();
  const key = `scroll:${pathname}`;
  
  useEffect(() => {
    const saved = sessionStorage.getItem(key);
    if (saved) {
      requestAnimationFrame(() => window.scrollTo(0, parseInt(saved)));
      sessionStorage.removeItem(key);
    }
    return () => {
      sessionStorage.setItem(key, String(window.scrollY));
    };
  }, [key]);
}
```

### Navigate com origin

```typescript
// Em CarteiraPage
const location = useLocation();
const originUrl = location.pathname + location.search;

// Ao clicar no nome do cliente:
navigate(`/carteira/${cpf}`, { state: { from: originUrl } });

// Em ClientDetailHeader:
const from = location.state?.from || "/carteira";
<Button onClick={() => navigate(from)}>
```

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useScrollRestore.ts` | Novo hook — persistir/restaurar scroll |
| `src/pages/CarteiraPage.tsx` | scroll restore + origin nas navegações |
| `src/components/carteira/CarteiraKanban.tsx` | origin nas navegações |
| `src/pages/ClientDetailPage.tsx` | aba via useUrlState + back com origin |
| `src/components/client-detail/ClientDetailHeader.tsx` | back prop dinâmico |
| `src/pages/AtendimentoPage.tsx` | fallback back com origin |
| `src/pages/AcordosPage.tsx` | scroll restore |
| `src/pages/ClientsPage.tsx` | scroll restore |
| `src/pages/RelatoriosPage.tsx` | scroll restore |
| `src/pages/CadastrosPage.tsx` | scroll restore |
| `src/pages/AuditoriaPage.tsx` | filtros migrados para useUrlState |

## O que NÃO muda
- Layout, design, componentes visuais — intactos
- Arquitetura de rotas — intacta
- Contact Center, chat — intactos
- Banco de dados — intacto
- Fluxos operacionais — preservados

