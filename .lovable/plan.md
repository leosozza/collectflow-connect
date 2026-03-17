

# Plano: Deletar credor YBRASIL do ambiente Test

O credor YBRASIL ainda existe no ambiente Test e precisa ser removido. O ambiente Live já está correto.

## Ação

Executar no **Test**:
```sql
DELETE FROM credores WHERE id = '79180313-fc3f-4f7f-9cba-01db19a339f3';
```

Isso deixará apenas o credor **TESS MODELS PRODUTOS FOTOGRAFICOS LTDA** em ambos os ambientes, alinhado com o tenant **Y.BRASIL**.

