

## Plano: mostrar apenas as últimas 5 campanhas, colapsar o restante

### Comportamento

Na tabela de campanhas em `/contact-center/whatsapp?tab=campanhas`:

- Exibir apenas as **5 campanhas mais recentes** (primeiras da lista, já vem ordenada por `created_at desc` do backend).
- Demais campanhas ficam **ocultas** atrás de um botão expansível no rodapé da tabela: **"Ver mais N campanhas"** / **"Ocultar"**.
- Estado inicial: colapsado (mostrando 5).
- Quando expandido, mostra todas as campanhas da página atual (até `PAGE_SIZE = 50`).

### Importante — interação com filtros e paginação

- A regra das 5 se aplica **dentro da página atual** já filtrada pelo backend.
- Sempre que o usuário **muda filtro, busca, ou paginação**, o estado volta para **colapsado** (mostrando só 5).
- Filtros, busca, paginação e ações (cancelar/pausar/editar) continuam funcionando normalmente.
- Se a página tiver ≤ 5 campanhas, o botão de expandir não aparece.

### Alteração técnica

**Arquivo**: `src/components/contact-center/whatsapp/CampaignManagementTab.tsx`

1. Adicionar estado `const [expanded, setExpanded] = useState(false);`
2. Adicionar `useEffect` que zera `expanded` quando `debouncedSearch`, `statusFilter`, `scheduleTypeFilter` ou `page` mudam.
3. Calcular `visibleCampaigns = expanded ? campaigns : campaigns.slice(0, 5);` e renderizar o `.map()` sobre `visibleCampaigns`.
4. Após o `</table>` (dentro do `CardContent`), renderizar:
   - Se `campaigns.length > 5`: botão centralizado com texto "Ver mais X campanhas" (com ícone `ChevronDown`) ou "Ocultar" (com `ChevronUp`), alternando `expanded`.

### Validação

1. Abrir a aba Campanhas com mais de 5 campanhas → tabela mostra apenas 5 + botão "Ver mais N campanhas".
2. Clicar no botão → expande mostrando todas; texto vira "Ocultar".
3. Mudar filtro de status ou buscar → volta automaticamente para 5.
4. Página com ≤ 5 campanhas → sem botão de expandir.

