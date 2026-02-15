

## Correcoes na Pagina de Detalhes do Cliente

### Problemas Identificados e Solucoes

### 1. Botao WhatsApp nao funcional
**Causa**: Os clientes no banco de dados nao possuem telefone cadastrado (`phone` esta vazio/null). O botao usa `disabled={!client.phone}`, entao fica desabilitado quando nao ha telefone.
**Solucao**: A logica do botao esta correta (`window.open(https://wa.me/...)`) -- ele funciona quando ha telefone. Vamos manter o botao funcional e adicionar um `tooltip` ou feedback visual claro quando nao houver telefone, em vez de apenas desabilitar silenciosamente. Tambem remover o `disabled` e mostrar um toast informando que nao ha telefone cadastrado.

### 2. Aparencia das informacoes do devedor -- restaurar visual anterior
**Solucao**: Redesenhar o `ClientCollapsibleDetails` para ter aparencia de Card com borda, fundo `bg-card`, e layout em grid organizado similar ao que existia antes. Manter o conteudo colapsavel mas com visual mais polido.

### 3. Seta apontando para baixo na lateral direita
**Causa**: Atualmente o chevron esta no lado esquerdo e alterna entre `ChevronRight` e `ChevronDown`.
**Solucao**: Mover o icone para o lado direito do trigger usando `justify-between` e `w-full`. Usar `ChevronDown` com rotacao (rotacionar -90deg quando fechado, 0deg quando aberto) para que sempre aponte para baixo quando expandido.

### 4. Aba "Acordo" -- mostrar ultimo acordo, nao a calculadora
**Causa**: Atualmente a aba "Acordo" renderiza o `AgreementCalculator` completo.
**Solucao**: Na aba "Acordo", exibir apenas o ultimo acordo realizado (da query `agreements` ja existente). Mostrar um Card com as informacoes: status, valor original, valor proposto, desconto, parcelas, data. Se nao houver acordo, exibir mensagem "Nenhum acordo registrado".

### 5. Botao "Formalizar Acordo" nao funciona
**Causa**: O botao chama `scrollToAcordo()` que faz `acordoTabRef.current?.click()` para mudar para a aba "Acordo". Porem como a aba "Acordo" agora deve mostrar apenas o ultimo acordo, o botao precisa de comportamento diferente.
**Solucao**: O botao "Formalizar Acordo" deve abrir um `Dialog` (modal) contendo o `AgreementCalculator`. Assim o usuario pode formalizar o acordo sem sair da tela atual, e a aba "Acordo" fica reservada para visualizar acordos existentes.

---

### Detalhes Tecnicos

**Arquivos a modificar:**

1. **`src/components/client-detail/ClientDetailHeader.tsx`**
   - Remover `disabled` do botao WhatsApp; adicionar toast de aviso quando nao ha telefone
   - Alterar `onScrollToAcordo` para `onFormalizarAcordo` que abre um Dialog

2. **`src/components/client-detail/ClientCollapsibleDetails.tsx`**
   - Mover o chevron para a lateral direita com `flex justify-between`
   - Usar `ChevronDown` com classe de rotacao CSS (`transition-transform rotate-0` / `-rotate-90`)
   - Estilizar o trigger como um Card/barra completa com fundo e borda

3. **`src/pages/ClientDetailPage.tsx`**
   - Adicionar estado `showAcordoDialog` para controlar o Dialog da calculadora
   - Na aba "Acordo", renderizar Card com ultimo acordo (usando `agreements[0]`) em vez do `AgreementCalculator`
   - Envolver `AgreementCalculator` em um `Dialog` que abre ao clicar "Formalizar Acordo"
   - Remover a ref `acordoTabRef` (nao mais necessaria)

4. **`src/components/client-detail/AgreementCalculator.tsx`** -- sem alteracoes, sera reutilizado dentro do Dialog

**Nenhuma migracao de banco de dados necessaria.**

