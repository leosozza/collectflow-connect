

# Diagnóstico: Boleto gerado mas não abre

## O que foi encontrado

O boleto **foi gerado com sucesso** e o link está salvo corretamente no banco de dados:
- `link_boleto`: `https://negociarie.nyc3.digitaloceanspaces.com/boletos/CS2006187_PIX_2522933_260327_69c67df93ccf9.pdf`
- A URL é acessível publicamente (testei e funciona)

O problema está em **como o link é aberto**. O botão "Abrir Boleto" usa `window.open(url, "_blank")`, que pode ser bloqueado pelo navegador (popup blocker) ou pelo sandbox do iframe de preview do Lovable.

## Solução

No componente `AgreementInstallments.tsx`, trocar `window.open` por uma abordagem mais confiável:

1. **Usar `<a>` tag com `target="_blank"`** em vez de `window.open` programático — links clicáveis em `<a>` não são bloqueados por popup blockers
2. **Adicionar fallback**: se o link não abrir, copiar para clipboard e informar o usuário
3. **Verificar também** se há outros pontos no código que usam `window.open` para boletos e aplicar a mesma correção

O botão "Abrir Boleto" já usa `<a>` em `CobrancaForm.tsx` (que funciona), mas no `AgreementInstallments.tsx` usa `window.open` dentro de um `onClick` em um `<Button>` — essa é a diferença.

## Correção

### `src/components/client-detail/AgreementInstallments.tsx`
- Linha ~422: trocar o `<Button onClick={() => window.open(...)}>` por `<Button asChild><a href={url} target="_blank" rel="noopener noreferrer">...</a></Button>`
- Isso replica o padrão que já funciona no `CobrancaForm.tsx`

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/components/client-detail/AgreementInstallments.tsx` | Trocar `window.open` por `<a>` tag para abrir boleto |

