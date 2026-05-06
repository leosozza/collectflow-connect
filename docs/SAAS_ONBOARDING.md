# 🚀 Guia de Onboarding: Novo Tenant (Assessoria)

Este guia descreve como configurar uma nova assessoria no RIVO SaaS de forma segura.

## 1. Cadastro da Empresa
1. Acesse o painel **Super Admin**.
2. Vá na aba **Novo Cliente**.
3. Preencha o **Nome**, **Slug** (único, ex: `assessoria-alpha`) e selecione o **Plano**.
4. Clique em **Criar Empresa**.

## 2. Configuração de Integração (Negociarie)
1. Vá na aba **Empresas** e localize a nova assessoria.
2. Clique no ícone de **Engrenagem (Gerenciar)**.
3. No painel lateral, localize a seção **Cofre de Integrações**.
4. Insira o `Client ID` e o `Client Secret` fornecidos pela Negociarie para esta assessoria específica.
5. Clique em **Salvar no Cofre**.
6. Clique no botão de **Testar (Play)**. 
   - Se retornar verde: As chaves estão corretas e o isolamento está ativo.
   - Se retornar erro: Verifique os logs logo abaixo para identificar o problema.

## 3. Criação do Primeiro Usuário (Admin do Tenant)
Atualmente, a criação de usuários admins para novos tenants pode ser feita via SQL ou via aba "Usuários" no Super Admin.
1. Vá em **Configurações > Usuários** (dentro do Super Admin).
2. Clique em **Convidar Novo Usuário**.
3. Selecione o Tenant recém-criado e defina a Role como `admin`.

## 4. Validação de Isolamento
- Logue com o novo usuário.
- Vá em **Carteira**. A tela deve estar vazia (sem dados da YBRASIL).
- Tente importar um arquivo de teste. Os dados devem ficar restritos apenas a este novo Tenant.

---
**Dúvidas Frequentes:**
- **E o Asaas?** O Asaas para cobrança da plataforma (sua receita) é configurado na seção "Cobrança Asaas". O Asaas do cliente (para as cobranças dele) será implementado na Fase 4, seguindo o mesmo modelo do Cofre.
- **O Fallback da YBRASIL parou?** Não. Se o Cofre estiver vazio, o sistema continuará usando as chaves globais do `.env`.
