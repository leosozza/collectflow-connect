
Objetivo: corrigir o botão “Solicitar Liberação” para acordos fora do padrão do credor e corrigir o erro dos campos numéricos/percentuais que não permitem apagar durante digitação.

1) Centralizar e robustecer a busca de regras do credor
- Criar utilitário compartilhado para buscar regras por `tenant_id` + nome do credor.
- Estratégia de matching:
  - tentativa 1: `razao_social` exata
  - tentativa 2: `nome_fantasia` exata
  - tentativa 3: fallback normalizado (trim + lowercase, removendo múltiplos espaços) em memória após lista curta de credores do tenant.
- Arquivo: `src/services/cadastrosService.ts` (nova função de leitura de regras).

2) Aplicar a busca robusta em todas as telas de negociação
- Substituir as queries atuais que usam apenas `.eq("razao_social", client.credor)` em:
  - `src/components/client-detail/AgreementCalculator.tsx`
  - `src/pages/AtendimentoPage.tsx`
  - `src/components/contact-center/threecplus/TelefoniaAtendimento.tsx`
- Passar/usar `credorRules` com estado de loading e erro de forma explícita.

3) Evitar “falso Gerar Acordo” quando regras não carregaram
- Ajustar lógica de exibição para não assumir `isOut=false` quando `credorRules` ainda não foi carregado.
- Se houver `credor` e regras ausentes/erro:
  - bloquear ação final temporariamente
  - mostrar alerta “Regras do credor não encontradas/carregadas”.
- Isso evita bypass da liberação por falha de lookup.

4) Corrigir campos numéricos que travam ao apagar
- Corrigir padrão de input controlado que hoje faz `Number/parseFloat(... ) || 0` no `onChange`.
- Implementar estado textual temporário nos campos e conversão numérica no `onBlur` (ou ao confirmar), preservando clamp/limites.
- Aplicar em:
  - `src/components/client-detail/AgreementCalculator.tsx` (desconto %, desconto R$, entrada, parcelas quando aplicável)
  - `src/components/atendimento/NegotiationPanel.tsx` (desconto %, parcelas)
  - `src/components/cadastros/CredorForm.tsx` (desconto máximo %, juros %, multa %, entrada mínima percentual).

5) Garantir comportamento visual/funcional esperado
- Cenários de validação:
  - Credor com `desconto_maximo=50`, digitar `70` => botão vira “Solicitar Liberação”.
  - Credor sem match exato, mas com `nome_fantasia` equivalente => regras carregam e validação funciona.
  - Apagar totalmente campo percentual e redigitar novo número sem “voltar para 0” automaticamente.
  - Fluxos em Atendimento, Telefonia e Formalizar Acordo permanecem consistentes.

Detalhes técnicos (resumo)
- Causa principal 1: lookup de regras frágil (somente `razao_social` exata), gerando `credorRules=null` e forçando `isOut=false`.
- Causa principal 2: inputs numéricos controlados com fallback imediato para 0 em `onChange`, impedindo estado vazio durante edição.
- Correção: lookup resiliente + tratamento de estado de carregamento/ausência + inputs com estado string e parse controlado.
