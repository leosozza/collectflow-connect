

# Contact Center - Nova Estrutura de Navegacao e Tela Completa

## Resumo

Criar uma nova secao "Contact Center" no sidebar, abaixo de "Carteira", contendo duas abas principais: **Telefonia** e **WhatsApp**. Dentro de Telefonia, o primeiro discador disponivel sera o **3CPlus**, com tela completa para gerenciar campanhas, enviar mailings, visualizar listas e configurar credenciais. A arquitetura e preparada para multi-tenant e futuros discadores.

## Estrutura de Navegacao

```text
Sidebar (mainNavItems)
├── Dashboard
├── Carteira
├── Contact Center        <-- NOVO (admin only)
│   (pagina com tabs)
│   ├── Telefonia
│   │   └── 3CPlus (sub-tab ou secao padrao)
│   │       ├── Configuracao (credenciais)
│   │       ├── Campanhas (listar, criar)
│   │       ├── Enviar Mailing
│   │       └── Historico de Envios
│   └── WhatsApp (placeholder para Fase 3)
├── Relatorios
├── Acordos
├── ...
```

## O que sera construido

### 1. Nova rota `/contact-center`
- Adicionar rota protegida em `App.tsx`
- Pagina `ContactCenterPage.tsx` com Tabs de nivel 1: **Telefonia** e **WhatsApp**

### 2. Aba Telefonia > 3CPlus (componente completo)
Refatorar o `ThreeCPlusTab` atual e expandir para uma tela completa com sub-abas:

- **Configuracao**: formulario de credenciais (dominio + token) - ja existe, sera movido
- **Campanhas**: listar campanhas da conta, exibir detalhes (status, listas vinculadas), botao para criar nova campanha via API
- **Enviar Mailing**: selecionar campanha, selecionar lista (ou criar nova), fazer upload de contatos manualmente ou selecionar da carteira
- **Historico**: registro local dos envios feitos pelo sistema (data, qtd contatos, campanha, status)

### 3. Sidebar atualizado
- Adicionar item "Contact Center" com icone `Headphones` abaixo de "Carteira" nos `mainNavItems` (visivel apenas para admins)
- Remover a aba 3CPlus da pagina `/integracao` (mover para Contact Center)

### 4. Mover logica do DialerExportDialog
- O botao "Discador" na Carteira continuara funcionando, mas abrira o dialog que redireciona ou envia direto
- Alternativamente, o envio de mailing tambem pode ser feito pela tela do Contact Center

## Detalhes Tecnicos

### Novos arquivos
- `src/pages/ContactCenterPage.tsx` - pagina principal com Tabs (Telefonia / WhatsApp)
- `src/components/contact-center/TelefoniaTab.tsx` - container da aba Telefonia com sub-tabs por discador
- `src/components/contact-center/threecplus/ThreeCPlusPanel.tsx` - painel completo 3CPlus com sub-abas (Config, Campanhas, Mailing, Historico)
- `src/components/contact-center/threecplus/CampaignsPanel.tsx` - listagem e criacao de campanhas
- `src/components/contact-center/threecplus/MailingPanel.tsx` - envio de mailing (selecionar campanha, lista, contatos)
- `src/components/contact-center/threecplus/ConfigPanel.tsx` - credenciais (extraido do ThreeCPlusTab atual)
- `src/components/contact-center/WhatsAppTab.tsx` - placeholder para Fase 3

### Alteracoes em arquivos existentes
- `src/App.tsx` - adicionar rota `/contact-center`
- `src/components/AppLayout.tsx` - adicionar "Contact Center" ao `mainNavItems` (admin only)
- `src/pages/IntegracaoPage.tsx` - remover aba 3CPlus (manter CobCloud e Negociarie)

### Edge function `threecplus-proxy`
- Adicionar novas actions: `create_campaign`, `get_campaign_details`, `get_list_mailings` para suportar as novas funcionalidades da tela

### Preparacao multi-discador
- A aba Telefonia tera sub-tabs por provedor (inicialmente so "3CPlus")
- Futuro: adicionar outros discadores como novas sub-tabs sem alterar a estrutura

