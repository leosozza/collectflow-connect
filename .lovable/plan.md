

# Redesign do Painel de Tabulacao - Botoes Visuais e Intuitivos

## O que sera feito

Redesenhar o `DispositionPanel` para ter botoes grandes, coloridos e agrupados por categoria, inspirado na referencia visual enviada. Os botoes atuais (pequenos, outline, sem cor) serao substituidos por botoes largos com cores distintas por grupo, icones a esquerda e texto centralizado.

### Layout proposto

```text
+----------------------------------------------+
|  Acoes                                        |
+----------------------------------------------+
|                                               |
|  AGENDAR                                      |
|  [====== Retornar Ligacao (azul) ======]      |
|                                               |
|  RESULTADO DA LIGACAO                         |
|  [=== Caixa Postal (vermelho) ===]            |
|  [=== Lig. Interrompida (amarelo) ===]        |
|  [=== Nao Atende (laranja) ====]              |
|                                               |
|  CONTATO                                      |
|  [=== Contato Incorreto (cinza) ===]          |
|  [=== Promessa Pagamento (verde) ===]         |
|                                               |
|  NEGOCIACAO                                   |
|  [======= NEGOCIAR (verde destaque) ========] |
|                                               |
|  Observacoes: [__________________________]    |
+----------------------------------------------+
```

### Comportamento
- Cada grupo tem um titulo em cinza (label) como "AGENDAR", "RESULTADO DA LIGACAO", etc.
- Botoes sao largos (full-width ou 2 colunas) com fundo colorido, texto branco e icone
- "Retornar Ligacao" ao clicar expande o campo de data/hora inline (como ja funciona)
- "Negociar" e o botao principal, maior e em destaque
- Campo de observacoes fica no final
- Cores por tipo: vermelho para caixa postal, amarelo para interrompida, azul para retorno, verde para promessa/negociar, cinza para contato incorreto

---

## Detalhes Tecnicos

### Arquivo: `src/components/atendimento/DispositionPanel.tsx`

1. **Reorganizar botoes em grupos** com labels de secao (AGENDAR, RESULTADO, CONTATO, NEGOCIACAO)
2. **Aplicar cores de fundo** usando classes Tailwind customizadas por tipo de tabulacao:
   - `callback`: azul (`bg-blue-500 hover:bg-blue-600 text-white`)
   - `voicemail`: vermelho (`bg-red-500 hover:bg-red-600 text-white`)
   - `interrupted`: amarelo (`bg-yellow-500 hover:bg-yellow-600 text-white`)
   - `no_answer`: laranja (`bg-orange-500 hover:bg-orange-600 text-white`)
   - `wrong_contact`: cinza (`bg-gray-500 hover:bg-gray-600 text-white`)
   - `promise`: verde (`bg-emerald-500 hover:bg-emerald-600 text-white`)
   - `negotiated` (Negociar): verde escuro destaque (`bg-green-600 hover:bg-green-700 text-white`)
3. **Botoes maiores**: `h-12` com `text-sm font-medium`, icone a esquerda, texto centralizado
4. **Layout em grid**: secoes de 1-2 colunas conforme quantidade de botoes no grupo
5. **Mover campo de observacoes** para baixo do painel, antes do botao Negociar

### Arquivo: `src/services/dispositionService.ts`

Sem alteracoes - os tipos e labels existentes serao mantidos.

| Arquivo | Acao |
|---------|------|
| `src/components/atendimento/DispositionPanel.tsx` | Modificar - redesign visual com botoes coloridos agrupados |

