

## Otimizar seção "Modelos de Documentos" na aba Negociação

### Problema atual
Os três modelos de documentos (Carta de Acordo, Recibo de Pagamento, Carta de Quitação) aparecem todos expandidos com seus Textareas visíveis, ocupando muito espaço vertical e poluindo a interface.

### Solução
Transformar cada modelo em um **Card compacto** que mostra apenas o título e um botão "Editar". Ao clicar em "Editar", abre um **Dialog/Popover** com o Textarea e o botão de inserir variáveis. Isso deixa a seção limpa e organizada.

### Layout proposto

```text
┌─────────────────────────────────────┐
│  📄 Carta de Acordo        [Editar] │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  📄 Recibo de Pagamento    [Editar] │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  📄 Carta de Quitação      [Editar] │
└─────────────────────────────────────┘

Ao clicar "Editar" abre:
┌──────────────────────────────────────────┐
│  Editar: Carta de Acordo                 │
│  [Inserir Variável v]                    │
│  ┌────────────────────────────────────┐  │
│  │ Textarea com o template...         │  │
│  │                                    │  │
│  └────────────────────────────────────┘  │
│                           [Concluir]     │
└──────────────────────────────────────────┘
```

### Detalhes Técnicos

**Arquivo:** `src/components/cadastros/CredorForm.tsx`

1. Refatorar a seção "Modelos de Documentos" (linhas 279-296) para renderizar 3 Cards compactos com borda, titulo e botao "Editar"
2. Ao clicar "Editar", abrir um `Dialog` contendo:
   - Titulo do template
   - Botao "Inserir Variavel" (reutilizando o Popover de variaveis existente)
   - O Textarea editavel
   - Botao "Concluir" para fechar
3. Remover o estado `editingTemplate` - o Textarea dentro do Dialog sera sempre editavel
4. Manter o componente `TemplateActions` simplificado (apenas o Popover de variaveis, sem toggle de editar/concluir)
5. Usar os componentes `Card` e `Dialog` ja existentes no projeto

Nenhuma alteracao de banco de dados necessaria.
