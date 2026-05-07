# [!] ARQUIVO PROTEGIDO: NÃO ALTERAR ESTRUTURA DE LINKS [[ ]] [!]
# Padrões de UI/UX - RIVO Premium

O RIVO deve transmitir confiança, modernidade e alta performance através de sua interface.

## 🎨 Design System
- **Framework:** Tailwind CSS + Shadcn UI.
- **Estética:** Glassmorphism sutil (transparências com desfoque) em cards e menus.
- **Modo Escuro:** Prioridade total. Cores de fundo em tons de zinco/slate profundo, nunca preto puro.
- **Tipografia:** Uso de fontes modernas (Inter/Outfit). Títulos com peso `semibold` ou `bold`.

## 💎 Elementos de Interface
- **Cards:** Bordas levemente arredondadas (`rounded-xl`), bordas finas com baixa opacidade.
- **Botões:** Estados de hover claros, micro-animações de escala ou brilho.
- **Gráficos:** Cores vibrantes mas harmoniosas (evitar cores primárias puras como vermelho vivo/azul puro).
- **Decimal:** Toda porcentagem no sistema deve ter no máximo **2 casas decimais**.

## 🧩 Componentes Reutilizáveis
- Sempre verificar `src/components/ui` antes de criar novos elementos.
- Usar `CraftButton` para ações principais de fluxo.
- Usar `Badge` para status (Pago, Vencido, Em Acordo).

---
[[RIVO_BRAIN]] | [[Checklist_de_Qualidade]]
