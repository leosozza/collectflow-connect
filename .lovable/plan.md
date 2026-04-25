# Refinar tela "Baixas Realizadas"

## Filtros (mais clean)
- Substituir o grid de filtros por **uma única barra horizontal compacta** (altura `h-9`, ícones menores), seguindo o padrão visual já usado na barra de filtros de `Acordos`.
- Sequência: Busca → De → Até → Credor → **Operador (novo)** → Local → Meio.
- Labels mais curtos ("Todos credores", "Todos meios", "dd/MM/yy" no botão de data) para reduzir largura.

## Novo filtro: Operador
- Select "Operador" entre Credor e Local.
- Opções derivadas dos operadores que efetivamente registraram baixas no período carregado, mais "Portal" (origem portal) e "Negociarie" (gateway).
- Para baixas manuais, busca paralela leve em `manual_payments(id, requested_by)` + `profiles(user_id, full_name)` apenas para os IDs já listados — sem alterar o RPC.

## Tabela
- **Devedor**: vira link clicável para `/carteira/<cpf>` (mesmo padrão da Gestão de Acordos). Remover a linha do CPF abaixo do nome — sobra só o nome (CPF visível no tooltip se necessário).
- **Credor**: passar a mostrar apenas os 2 primeiros nomes (`split(' ').slice(0,2).join(' ')`), com nome completo no `title`. Será o padrão global daqui para frente; aqui já entra em uso.
- **Parcela**: passar a mostrar apenas a referência da parcela ("Entrada", "Entrada 2", "1", "2", "3"), sem o sufixo "de N".
- **Descontos**: nova coluna imediatamente à direita de "Honorários", consumindo o campo `desconto` que o RPC já retorna.
- **Operador**: nova coluna ao final, exibindo o nome do operador que registrou a baixa (ou "Portal" / "Negociarie" para origens externas).

## Exportação Excel
- Acompanha as mesmas mudanças: credor abreviado, parcela simplificada, novas colunas "Descontos" e "Operador".

## Backend
- **Sem alteração de RPC** nesta iteração (a função `get_baixas_realizadas` já retorna `desconto`). O nome do operador é resolvido no cliente via `manual_payments` + `profiles`, evitando uma migração só para isto.
- Quando voltarmos para o passo de breakdown financeiro completo, podemos mover esse join para dentro da RPC.

## Arquivos a alterar
- `src/pages/financeiro/BaixasRealizadasPage.tsx` — único arquivo modificado.
