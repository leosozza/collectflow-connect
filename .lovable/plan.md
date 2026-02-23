

## Adicionar item no Roadmap: Configuracao de E-mail (Resend)

### O que sera feito

Adicionar um novo item no array `roadmapData` do arquivo `src/pages/RoadmapPage.tsx` com status **"planned"** para lembrar de configurar a RESEND_API_KEY e finalizar o envio de e-mail do relatorio de quitados.

### Detalhes do item

- **Titulo**: Configuracao de E-mail — Resend API
- **Descricao**: Configurar a API Resend para envio de e-mail com planilha de clientes quitados excluidos. Requer: conta Resend, validacao de dominio e API Key.
- **Status**: planned
- **Progresso**: 50% (a edge function ja esta criada, falta apenas a chave)
- **Categoria**: Integracoes
- **lovablePrompt**: Instrucoes para configurar a RESEND_API_KEY como secret do projeto, incluindo referencia a edge function `send-quitados-report` ja implementada.

### Arquivo modificado

| Arquivo | Mudanca |
|---|---|
| `src/pages/RoadmapPage.tsx` | Adicionar novo objeto no array `roadmapData` na secao "PLANNED" |

