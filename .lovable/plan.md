

Reduzir altura/padding vertical do card do header em `ClientDetailHeader.tsx` para deixá-lo mais fino.

### Ajustes
- Reduzir padding do container externo do card (de `p-6` ou similar para `px-6 py-3`).
- Reduzir gap vertical do cluster direito de `gap-3` para `gap-1.5`.
- Reduzir tamanho do nome do cliente de `text-2xl` para `text-xl`.
- Reduzir altura dos botões circulares (WhatsApp/Atendimento) de `h-10 w-10` para `h-9 w-9`.
- Reduzir tamanho do valor "Em Aberto" de `text-2xl` para `text-xl` e `leading-none` para compactar.
- Reduzir margem vertical entre Linha 1 (nome+botões) e Linha 2 (CPF/Tel/Email) de `mt-3` para `mt-1.5`.
- Reduzir margem vertical entre Linha 2 e o trigger "Mais informações do devedor".
- Trigger colapsável: reduzir `py-3` para `py-2`.

### Arquivo afetado
| Arquivo | Mudança |
|---|---|
| `src/components/client-detail/ClientDetailHeader.tsx` | Compactação vertical: paddings, gaps, font-sizes e altura de botões reduzidos |

