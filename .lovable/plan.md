

# Excluir e reimportar registros de cheque (escopo expandido por CPF)

## Descoberta

Os 12.974 registros com `data_devolucao` pertencem a CPFs que também possuem **12.544 registros adicionais sem data de devolução** -- provavelmente parcelas do mesmo cheque que não foram devolvidas. Para que a reimportação cubra o cliente completo, precisamos excluir **todos os 25.518 registros** desses CPFs.

```text
Registros com data_devolucao:    12.974
Registros sem data_devolucao:    12.544  (mesmo CPF)
─────────────────────────────────────────
Total a excluir:                 25.518
Acordos vinculados:              0
Tabulações vinculadas:           0
```

Zero risco de perda de dados operacionais.

## Plano

### Passo 1 -- Excluir todos os registros dos CPFs de cheque

```sql
DELETE FROM clients 
WHERE tenant_id = '39a450f8-7a40-46e5-8bc7-708da5043ec7'
  AND cpf IN (
    SELECT DISTINCT cpf FROM clients
    WHERE tenant_id = '39a450f8-7a40-46e5-8bc7-708da5043ec7'
      AND data_devolucao IS NOT NULL
  );
```

Isso remove os 25.518 registros (com e sem data de devolução) dos CPFs que possuem cheques.

### Passo 2 -- Reimportar via MaxList

Reimportar usando o filtro "Data Dev. Cheque" na interface. A lógica do `maxlist-import` já preenche `tipo_divida_id` com o ID de "Cheque" quando `rawPaymentType` é 2 ou 6.

## Resultado esperado

Após reimportar, todos os registros de cheque terão `tipo_divida_id` preenchido e o filtro na Carteira funcionará corretamente.

## Detalhes técnicos

- Será usado o tool de delete para executar o SQL
- Nenhuma alteração de código necessária
- A reimportação é feita pelo usuário na interface MaxList

