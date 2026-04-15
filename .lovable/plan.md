

# Parcelas com rolagem e collapse no AgreementCalculator

## Problema
A tabela de parcelas (títulos) no card "Formalizar Acordo" empurra o formulário "Condições do Acordo" para fora da tela quando há muitos títulos. O usuário precisa rolar toda a página.

## Solução

### Arquivo: `src/components/client-detail/AgreementCalculator.tsx`

**1. Adicionar estado de collapse e Collapsible:**
- Importar `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` de `@/components/ui/collapsible`
- Importar `ChevronDown` de `lucide-react`
- Adicionar `const [titlesOpen, setTitlesOpen] = useState(true)`

**2. Transformar a row "Totais" em trigger clicável:**
- Mover a row de totais (linha 623-632) para **fora** do `CollapsibleContent`, visível sempre
- Adicionar `ChevronDown` ao lado direito da row de totais com `rotate-180` quando expandido
- Tornar a row clicável (`cursor-pointer`) para abrir/fechar

**3. Envolver as rows de parcelas em Collapsible com rolagem:**
- Dentro do `CollapsibleContent`, colocar as linhas individuais das parcelas em um `div` com `max-h-[300px] overflow-y-auto`
- A row de totais + desconto fica sempre visível (fora do collapsible)

**Estrutura resultante:**
```text
┌─────────────────────────────────────────┐
│ Header (Parc | Vencimento | ... | Total)│  ← sempre visível
├─────────────────────────────────────────┤
│ ▼ Parcelas com scroll (max 300px)       │  ← collapsible + scroll
│   3/3  26/11/2020  ...                  │
│   4/4  26/12/2020  ...                  │
│   ...                                   │
├─────────────────────────────────────────┤
│ Totais (5 títulos) ... R$ 1.640,10   ▲  │  ← sempre visível, clicável
│ Desconto (se houver)                    │
└─────────────────────────────────────────┘
```

**Benefício:** O card "Condições do Acordo" e "Simular" ficam sempre visíveis na tela. As parcelas podem ser colapsadas ou roladas quando há muitos títulos.

