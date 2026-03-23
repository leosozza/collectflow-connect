

# Plano: Separar qualificacoes padrao do sistema das tabulacoes gerenciaveis

## Contexto

As qualificacoes com IDs negativos (-2 a -5: Nao qualificada, Caixa Postal, Mudo, Limite de tempo excedido) sao **nativas do sistema 3CPlus** — nao podem ser criadas, editadas ou excluidas pelo RIVO. O RIVO so precisa saber que elas existem para poder mapea-las.

As demais qualificacoes (IDs positivos) sao as que o RIVO cria na lista "RIVO Tabulacoes" via `sync_dispositions`. Essas sim precisam de mapeamento bidirecional.

## O que precisa mudar

### 1. Separar visualmente no mapeamento

Na secao "Mapeamento de Tabulacoes" em `ThreeCPlusTab.tsx`, o dropdown de qualificacoes da 3CPlus mistura qualificacoes do sistema (IDs negativos) com as criadas pelo RIVO (IDs positivos). Precisamos:

- Agrupar no Select: primeiro as qualificacoes do RIVO (criadas via sync), depois um separador, depois as "Padrao do sistema" (IDs -2 a -5)
- Adicionar label de grupo no dropdown para clareza

### 2. Mostrar card informativo das qualificacoes padrao

Adicionar um card readonly abaixo do mapeamento mostrando as 4 qualificacoes nativas do sistema (como no screenshot do usuario), com colunas: Cor, ID, Nome, Impacto, Comportamento, e badge "Qualificacao nativa do sistema". Isso e apenas informativo — nao editavel.

### 3. Nao incluir qualificacoes do sistema no `sync_dispositions`

O `sync_dispositions` ja nao cria as qualificacoes do sistema (so cria as do tenant). Isso esta correto. Nenhuma mudanca necessaria no proxy.

## Arquivo a editar

| Arquivo | Mudanca |
|---|---|
| `src/components/integracao/ThreeCPlusTab.tsx` | Separar qualificacoes do sistema no dropdown com grupo; adicionar card informativo readonly das qualificacoes nativas |

