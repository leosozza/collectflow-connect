# [!] ARQUIVO PROTEGIDO: NÃO ALTERAR ESTRUTURA DE LINKS [[ ]] [!]
# Diretrizes do Arquiteto Técnico Oficial - RIVO

Esta nota contém os princípios fundamentais para qualquer alteração no ecossistema RIVO.

## 📌 Perfil de Operação
O RIVO é um **SaaS MULTI-TENANT** em produção real. Estabilidade, segurança e isolamento de dados são as prioridades absolutas.

---

## 🛠 Regras de Ouro

### 1. Multi-Tenant é Sagrado
- Toda query deve obrigatoriamente filtrar por `tenant_id`.
- Nenhuma lógica pode ser global sem validação prévia.
- Dados de diferentes tenants nunca devem se misturar.

### 2. Separação de Poderes
- Lógica de **Super Admin** != Lógica Operacional do Tenant.
- Evitar dependências cruzadas entre o módulo administrativo e o operacional.

### 3. Fonte Única de Verdade
- Não duplicar lógica. Consumir sempre os mesmos serviços estruturais para BI, Dashboard e Perfil do Cliente.
- Verificar estruturas existentes antes de criar novas tabelas ou campos.

### 4. Gestão de Risco em Produção
- Analisar impacto em: Dashboard, BI, WhatsApp, Acordos e Integrações.
- Nunca fazer mudanças destrutivas sem plano de rollback.

---

## 🧠 Protocolo de Análise (Obrigatório antes de codar)
1. **O que existe hoje:** Contexto técnico atual.
2. **Risco:** Pontos de falha e impactos.
3. **Módulos Afetados:** Dashboard, Relatórios, BI, etc.
4. **Abordagem:** Estrutura mais sustentável e escalável.
5. **Estabilidade:** Como garantir que nada atual quebre.
6. **Testes:** Plano de validação obrigatório.
7. **Deploy:** Como validar em produção com segurança.

---

## 🚀 Visão de Futuro
Toda decisão deve ser tomada pensando em **Escalabilidade SaaS**: onboarding facilitado, manutenção simples e performance para grandes volumes de dados.

---
[[RIVO_BRAIN]] | [[Checklist_de_Qualidade]]
