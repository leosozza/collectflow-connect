## Causa do erro

O build do Vite está quebrando com:
```
src/services/goalService.ts:154:2: ERROR: Unexpected "}"
```

Ao analisar os dois commits ("ajuste de meta 2" e "correcao final metas tenant"), eles tocaram nos **mesmos arquivos** e o merge deixou **fragmentos duplicados** colados após o final correto das funções/módulos. Não são marcadores `<<<<<<<` desta vez — são linhas órfãs que sobraram do segundo commit.

Dois arquivos afetados:

### 1. `src/services/goalService.ts` (linhas 153-158) — bloqueia o build
A função `awardGoalIfReached` termina corretamente na linha 152 (`};`). Logo abaixo sobraram restos do mesmo trecho duplicado:
```ts
_amount: g.points_reward,
  });

await supabase.from("operator_goals").update({ points_awarded: true } as any).eq("id", g.id);
return true;
};
```
Isso é código solto fora de qualquer função → erro de sintaxe.

**Correção:** apagar as linhas 153-158. O resto do arquivo (incluindo `fetchMyGoal` na linha 50, que continua sem `.is("credor_id", null)` conforme sua decisão anterior) fica intacto.

### 2. `src/components/dashboard/DashboardMetaCard.tsx` (final do arquivo) — duplicação silenciosa
```tsx
export default DashboardMetaCard;

export default DashboardMetaCard;
```
Duas exportações default. Em runtime o segundo `export default` provavelmente passa, mas é warning/erro do TS e indica o mesmo padrão de merge sujo. **Correção:** manter apenas um `export default DashboardMetaCard;`.

## Validação

1. Rodar `npx vite build` → deve completar sem erros.
2. Abrir `/gamificacao?tab=goals` no preview e confirmar que a tela carrega.
3. Abrir o dashboard e checar que o card "Meta do Mês" continua renderizando.

## Escopo

- **2 arquivos**, ~7 linhas removidas no total.
- Sem mexer em lógica, RLS, RPC, edge functions ou outros componentes.
- Sem reverter os commits — apenas remover lixo de merge.
- Sem alterar `fetchMyGoal` (mantém divergência conhecida que você optou por não corrigir).
