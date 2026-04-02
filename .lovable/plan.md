

# Plano: Corrigir erro "Já existe boleto gerado com o código 1"

## Causa Raiz

O campo `id_parcela` enviado à API Negociarie é apenas o número da parcela (ex: `"1"`). Esse valor precisa ser único por CPF/documento no sistema Negociarie. Se um boleto anterior já foi gerado com `id_parcela = "1"` para este CPF (mesmo de outro acordo ou tentativa anterior), a API rejeita com "Já existe boleto gerado com o código 1".

No código atual (`negociarieService.ts`, linhas 279 e 356):
```typescript
const idParcela = installment.number === 0 ? "" : String(installment.number);
```

Isso gera `"1"`, `"2"`, etc. — colide com boletos anteriores do mesmo CPF.

## Correção

Tornar `id_parcela` único por acordo + parcela + tentativa, usando o mesmo padrão já aplicado ao `id_geral`:

```typescript
// Antes:
const idParcela = installment.number === 0 ? "" : String(installment.number);

// Depois:
const shortAgreementId = agreement.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
const idParcela = installment.number === 0
  ? String(Date.now()).slice(-8)
  : `${shortAgreementId}-${installment.number}-${Date.now().toString(36)}`;
```

Isso garante que cada tentativa de geração de boleto tenha um `id_parcela` único, eliminando conflitos com boletos anteriores.

## Arquivo Afetado

| Arquivo | Mudança |
|---|---|
| `src/services/negociarieService.ts` | Gerar `idParcela` único em `generateSingleBoleto` e `generateAgreementBoletos` |

Nenhuma alteração em banco, UI ou fluxo do operador.

