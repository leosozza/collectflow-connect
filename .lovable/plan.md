

## Plano: Extrato Financeiro na aba Financeiro da Central da Empresa

### Objetivo
Transformar a aba "Financeiro" em um extrato detalhado que lista todos os serviços contratados com seus valores individuais e exibe o total mensal.

### Alteração em `src/pages/TenantSettingsPage.tsx`

Substituir o conteudo da aba Financeiro (linhas 233-300) por:

1. **Card "Resumo Financeiro"** com:
   - Plano base (nome + valor mensal)
   - Status do tenant
   - Saldo de tokens (se existir)

2. **Card "Extrato de Serviços Contratados"** com:
   - Tabela estilizada com colunas: Serviço | Categoria | Qtd | Valor Unit. | Subtotal
   - Linha para o plano base
   - Linha para cada serviço ativo em `tenantServices`, cruzando com `catalog` para obter nome/preco
   - Calculo: `unit_price_override ?? service.price`, multiplicado por `quantity` se `price_type === "per_unit"`
   - Rodape com **Total Mensal** em destaque (soma plano + servicos)

3. Botao "Comprar Tokens" mantido se tokens existirem

### Arquivo alterado
- `src/pages/TenantSettingsPage.tsx` (apenas a seção da TabsContent "financeiro")

