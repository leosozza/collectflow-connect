

# Correção: Validação e formatação de mailing 3CPlus

## Problema

Dos 520 clientes enviados, apenas 383 aparecem no 3CPlus. A diferença (137 contatos) é rejeitada silenciosamente pela API por problemas de validação:

1. **Telefones vazios** — clientes sem telefone são enviados com `phone: ""`, o 3CPlus descarta
2. **Falta do prefixo "55"** — a API 3CPlus exige telefones com código de país (ex: `5511999998888`), mas enviamos apenas `11999998888`
3. **Telefones inválidos** — números com menos de 10 dígitos (sem DDD) são rejeitados
4. **Sem feedback por contato** — a API retorna HTTP 200 mesmo quando descarta contatos individuais, e o sistema não detecta isso

## Solução

### Arquivo: `src/components/carteira/DialerExportDialog.tsx`

1. **Filtrar clientes sem telefone válido** antes do envio:
   - Remover clientes com `phone` vazio/nulo
   - Remover telefones com menos de 10 dígitos (após limpar)
   - Mostrar no log quantos foram ignorados por falta de telefone

2. **Adicionar prefixo "55"** a todos os telefones que não começam com "55":
   ```typescript
   const rawPhone = c.phone?.replace(/\D/g, "") || "";
   const phone = rawPhone.length >= 10 
     ? (rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`)
     : "";
   ```

3. **Exibir contagem de descartados** no log e no resumo final:
   - "X contatos ignorados (sem telefone válido)"
   - Adicionar campo `skippedCount` no card de resumo

4. **Verificar contagem real na API** após envio — comparar total enviado com total registrado na lista (usando `get_campaign_lists`) e logar divergências

## Resultado

- Apenas contatos com telefone válido serão enviados
- Telefones formatados corretamente com prefixo "55"
- Operador saberá exatamente quantos foram ignorados e por quê
- A contagem no log baterá com o 3CPlus

