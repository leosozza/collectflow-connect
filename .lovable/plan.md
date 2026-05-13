## Diagnóstico

**O erro NÃO foi causado pelas nossas alterações recentes.**

As únicas mudanças recentes na função `generate-agreement-boletos` foram:
1. Guard que bloqueia reemissão de boleto já pago
2. Log de erro mais detalhado

Nenhuma delas afeta o payload enviado à Negociarie.

### Causa real

A API da Negociarie retornou **HTTP 422 "Erro desconhecido"** ao receber o payload. Investigando o cadastro da cliente Josieli Fátima Viega (CPF 09744608935):

| Campo | Valor cadastrado | Problema |
|---|---|---|
| CEP | `00.000-000` | **CEP inválido** — Negociarie rejeita |
| Cidade | `Chápeco` | Grafia incorreta (correto: `Chapecó`) |
| Endereço | `São Wendelino, 0` | Sem número real |
| Bairro | `Interior` | Genérico |

O CEP `00000000` é a causa direta da rejeição — é um placeholder e não corresponde a nenhuma localidade real, então a Negociarie devolve 422 sem detalhar o motivo (a mensagem genérica "Erro desconhecido" é padrão deles para validação de endereço).

A entrada de R$ 175 com vencimento 2026-05-13 e o restante do payload estão corretos. O acordo não tem nenhuma cobrança anterior (`negociarie_cobrancas` vazia), então não é problema de duplicidade.

### Plano de correção

**Solução imediata (sem código):** Atualizar o cadastro da cliente em `client_profiles` com CEP, endereço e cidade reais. Após isso, "Reemitir boleto" funciona normalmente.

**Melhorias opcionais (se você quiser que eu implemente):**

1. **Validação preventiva no edge function** — antes de chamar a Negociarie, validar:
   - CEP ≠ `00000000` e com 8 dígitos
   - Endereço com mais de 3 caracteres
   - Cidade não vazia
   
   Retornar mensagem clara como "CEP inválido no cadastro — atualize antes de gerar boleto" em vez de "Erro desconhecido".

2. **Toast no front com mensagem amigável** — quando a Negociarie devolver 422 genérico, mapear para "Verifique CEP e endereço do cliente".

Me confirme se quer só a correção manual do cadastro, ou se quer também as validações preventivas (item 1 e/ou 2).