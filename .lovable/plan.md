

# Plano: Indicador visual de progresso na barra de parcelas

## O que será feito

Transformar a barra de progresso (`Progress`) do `AgreementInstallments` em um indicador visual mais rico, mostrando o texto "X/Y pagas" centralizado **dentro** da própria barra e aplicando cores semânticas (verde para progresso, com fundo cinza).

## Mudanças

### `src/components/client-detail/AgreementInstallments.tsx`

Substituir o `<Progress>` genérico (linha 250) por uma barra customizada com:

1. **Barra com texto embutido**: div com largura proporcional ao `progressPercent`, exibindo `"{paidCount}/{totalInstallments} pagas"` centralizado sobre a barra
2. **Cores semânticas**: fundo `bg-muted`, preenchimento `bg-green-500` (parcelas pagas), texto branco sobre a parte preenchida
3. **Altura aumentada** (`h-5`) para acomodar o texto legível
4. **Animação suave** via `transition-all duration-500` no preenchimento

Resultado visual: uma barra de progresso que mostra claramente quantas parcelas foram pagas, diretamente dentro do elemento — sem precisar olhar o texto separado acima.

### Remover texto duplicado

O `{paidCount}/{totalInstallments} pagas` que hoje aparece no header do Collapsible (linha 246) será mantido ali para quando colapsado, mas dentro da barra expandida o texto fica embutido na própria barra.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/client-detail/AgreementInstallments.tsx` | Substituir `<Progress>` por barra customizada com texto embutido |

