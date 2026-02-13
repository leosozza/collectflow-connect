

# Pagina Signs - Configuracao e Playground de Assinatura Digital

## Objetivo

Criar uma nova pagina "/signs" no menu lateral em "Avancado" que concentra a configuracao do tipo de assinatura digital e oferece um Playground interativo para simular a experiencia completa do cliente (ver termos, assinar e aprovar).

## O que sera feito

### 1. Nova pagina `SignsPage.tsx`

A pagina tera duas abas (Tabs):

**Aba "Configuracao"**
- Move o card de Assinatura Digital que hoje esta em `TenantSettingsPage.tsx` para esta pagina
- Radio group com as 3 opcoes: Click, Reconhecimento Facial, Assinatura na Tela
- Botao salvar que atualiza `settings.signature_type` do tenant

**Aba "Playground"**
- Simulador completo da experiencia do cliente, dividido em etapas:
  1. **Termo do Acordo**: Mostra um acordo ficticio de exemplo (dados mock) com o layout identico ao que o cliente ve no portal
  2. **Assinatura**: Renderiza o componente de assinatura correspondente ao tipo configurado no tenant (SignatureClick, SignatureFacial ou SignatureDraw) em modo de demonstracao (sem salvar no banco)
  3. **Confirmacao**: Tela de sucesso simulada mostrando que o acordo foi aprovado
- Botao "Reiniciar Simulacao" para voltar ao inicio
- Badge indicando qual tipo de assinatura esta ativo
- Preview mobile-like: o playground sera renderizado dentro de um frame estilizado como celular para dar a sensacao real

### 2. Atualizacoes no Sidebar (`AppLayout.tsx`)

- Adicionar item "Signs" na secao "Avancado" com o icone `PenTool` de lucide-react
- Path: `/signs`
- Adicionar ao mapa de titulos do header

### 3. Rota no `App.tsx`

- Nova rota `/signs` protegida com `requireTenant`, dentro de `AppLayout`

### 4. Limpeza do `TenantSettingsPage.tsx`

- Remover o card de "Assinatura Digital" desta pagina (ja que agora fica em Signs)
- Manter os demais cards (Dados da Empresa e Plano Atual)

## Detalhes Tecnicos

### Arquivos novos
| Arquivo | Descricao |
|---|---|
| `src/pages/SignsPage.tsx` | Pagina principal com abas Configuracao e Playground |

### Arquivos modificados
| Arquivo | Mudanca |
|---|---|
| `src/components/AppLayout.tsx` | Adicionar "Signs" em advancedNavItems |
| `src/App.tsx` | Nova rota `/signs` |
| `src/pages/TenantSettingsPage.tsx` | Remover card de assinatura digital |

### Playground - Modo Demo
Os componentes de assinatura existentes (SignatureClick, SignatureFacial, SignatureDraw) serao reutilizados diretamente no playground. O `onConfirm` no modo playground nao chama a edge function, apenas avanca para a tela de sucesso simulada.

### Dados Mock do Acordo para Playground
```text
Cliente: Maria Silva Exemplo
Credor: Empresa Demonstracao S.A.
Valor Original: R$ 5.000,00
Valor Acordado: R$ 2.500,00
Desconto: 50%
Parcelas: 5x de R$ 500,00
Primeiro Vencimento: 30 dias a partir de hoje
```

### Frame Mobile no Playground
O simulador sera exibido dentro de um container estilizado como tela de celular (bordas arredondadas, proporcao 9:16, max-width de ~375px, sombra) para dar a experiencia visual real de como o cliente ve no dispositivo movel.

