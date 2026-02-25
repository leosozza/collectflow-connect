import { useState } from "react";
import { Search, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

interface GuideStep {
  title: string;
  description: string;
}

interface Guide {
  id: string;
  title: string;
  description: string;
  steps: GuideStep[];
}

interface GuideCategory {
  category: string;
  icon: string;
  guides: Guide[];
}

const guidesData: GuideCategory[] = [
  {
    category: "Dashboard",
    icon: "📊",
    guides: [
      {
        id: "dash-kpis",
        title: "Como interpretar os KPIs",
        description: "Entenda cada métrica do dashboard principal.",
        steps: [
          { title: "Acesse o Dashboard", description: "Clique em 'Dashboard' no menu lateral esquerdo." },
          { title: "Observe os cards superiores", description: "Cada card mostra uma métrica: total de clientes, valor recuperado, taxa de acordos e valor em aberto." },
          { title: "Analise os gráficos", description: "O gráfico de evolução mostra o progresso mensal. Use os filtros de período para ajustar." },
          { title: "Confira o ranking", description: "O mini ranking mostra os top 5 operadores do mês." },
        ],
      },
      {
        id: "dash-metas",
        title: "Como definir metas de operadores",
        description: "Configure metas mensais por operador e credor.",
        steps: [
          { title: "Vá em Gamificação", description: "No menu lateral, clique em 'Gamificação'." },
          { title: "Acesse a aba Metas", description: "Clique na aba 'Metas' no painel de gerenciamento." },
          { title: "Crie uma nova meta", description: "Clique em 'Nova Meta', selecione o operador, credor (opcional), mês e valor alvo." },
          { title: "Salve e acompanhe", description: "A meta aparecerá no dashboard do operador com barra de progresso." },
        ],
      },
    ],
  },
  {
    category: "Carteira",
    icon: "💼",
    guides: [
      {
        id: "cart-import",
        title: "Como importar clientes",
        description: "Importe planilhas de clientes em massa.",
        steps: [
          { title: "Acesse a Carteira", description: "Clique em 'Carteira' no menu lateral." },
          { title: "Clique em Importar", description: "No canto superior direito, clique no botão 'Importar'." },
          { title: "Selecione o arquivo", description: "Faça upload de um arquivo Excel (.xlsx) com as colunas obrigatórias: CPF, Nome, Valor, Vencimento." },
          { title: "Mapeie os campos", description: "Confira o mapeamento automático e ajuste se necessário." },
          { title: "Confirme a importação", description: "Clique em 'Importar' e aguarde o processamento." },
        ],
      },
      {
        id: "cart-filtros",
        title: "Como usar filtros avançados",
        description: "Filtre clientes por status, credor, valor e mais.",
        steps: [
          { title: "Abra os filtros", description: "Na Carteira, clique no ícone de filtro acima da tabela." },
          { title: "Selecione os critérios", description: "Filtre por: status, credor, faixa de valor, data de vencimento, operador responsável." },
          { title: "Aplique e visualize", description: "Os resultados são atualizados em tempo real conforme você aplica filtros." },
        ],
      },
      {
        id: "cart-export",
        title: "Como exportar para discador",
        description: "Exporte a lista filtrada para campanhas 3CPlus.",
        steps: [
          { title: "Filtre os clientes", description: "Use os filtros para selecionar o público-alvo da campanha." },
          { title: "Clique em Exportar", description: "No botão 'Exportar Discador', selecione o formato desejado." },
          { title: "Configure a exportação", description: "Escolha os campos que serão exportados e confirme." },
        ],
      },
    ],
  },
  {
    category: "Acordos",
    icon: "🤝",
    guides: [
      {
        id: "acordo-criar",
        title: "Como criar um acordo",
        description: "Negocie e formalize um acordo de pagamento.",
        steps: [
          { title: "Acesse a ficha do cliente", description: "Na Carteira, clique no nome do cliente para abrir sua ficha." },
          { title: "Use a calculadora de acordo", description: "Na ficha, clique em 'Novo Acordo' para abrir a calculadora." },
          { title: "Configure os termos", description: "Defina: desconto, número de parcelas, data do primeiro vencimento." },
          { title: "Envie para aprovação", description: "Clique em 'Salvar Acordo'. Se necessário, ele será encaminhado para aprovação do gerente." },
        ],
      },
    ],
  },
  {
    category: "Contact Center",
    icon: "📞",
    guides: [
      {
        id: "cc-whatsapp",
        title: "Como usar o WhatsApp",
        description: "Atenda conversas de WhatsApp pelo sistema.",
        steps: [
          { title: "Acesse Contact Center > WhatsApp", description: "No menu lateral, expanda 'Contact Center' e clique em 'WhatsApp'." },
          { title: "Selecione uma conversa", description: "Na lista à esquerda, clique na conversa que deseja atender." },
          { title: "Envie mensagens", description: "Digite no campo inferior e pressione Enter para enviar." },
          { title: "Use respostas rápidas", description: "Clique no ícone de raio para acessar respostas pré-configuradas." },
        ],
      },
      {
        id: "cc-3cplus",
        title: "Como entrar numa campanha 3CPlus",
        description: "Selecione e entre em campanhas de telefonia.",
        steps: [
          { title: "Acesse Contact Center > Telefonia", description: "No menu lateral, clique em 'Telefonia'." },
          { title: "Selecione a campanha", description: "No dropdown 'Campanhas Disponíveis', escolha a campanha desejada." },
          { title: "Entre na campanha", description: "Clique em 'Entrar na Campanha' para iniciar o atendimento." },
          { title: "Para sair", description: "Clique em 'Sair da Campanha' quando finalizar." },
        ],
      },
    ],
  },
  {
    category: "Automação",
    icon: "⚡",
    guides: [
      {
        id: "auto-regua",
        title: "Como criar uma régua de cobrança",
        description: "Configure disparos automáticos por canal.",
        steps: [
          { title: "Acesse Automação", description: "Clique em 'Automação' no menu lateral." },
          { title: "Crie uma nova regra", description: "Clique em 'Nova Regra' e configure: nome, canal (WhatsApp/SMS/Email), dias de offset." },
          { title: "Defina o template", description: "Escreva o template da mensagem usando variáveis: {{nome}}, {{valor}}, {{vencimento}}." },
          { title: "Ative a regra", description: "Salve e ative a regra para que ela comece a disparar automaticamente." },
        ],
      },
      {
        id: "auto-workflow",
        title: "Como criar um workflow visual",
        description: "Monte fluxos de cobrança arrastar-e-soltar.",
        steps: [
          { title: "Acesse Automação > Fluxos", description: "Na aba 'Fluxos Visuais' da Automação." },
          { title: "Crie um novo fluxo", description: "Clique em 'Novo Fluxo' e dê um nome." },
          { title: "Arraste os nós", description: "Da barra lateral, arraste gatilhos, ações e condições para o canvas." },
          { title: "Conecte os nós", description: "Clique e arraste entre os pontos de conexão para criar o fluxo." },
          { title: "Salve e ative", description: "Clique em 'Salvar' e depois ative o fluxo." },
        ],
      },
    ],
  },
  {
    category: "Cadastros",
    icon: "📋",
    guides: [
      {
        id: "cad-credores",
        title: "Como adicionar credores",
        description: "Cadastre empresas credoras no sistema.",
        steps: [
          { title: "Acesse Cadastros", description: "Clique em 'Cadastros' no menu lateral." },
          { title: "Selecione Credores", description: "Na navegação lateral, clique em 'Credores'." },
          { title: "Clique em Novo Credor", description: "Preencha: razão social, CNPJ, dados bancários e configurações de negociação." },
          { title: "Configure o portal", description: "Na aba 'Portal', personalize cores e textos para o portal do devedor." },
        ],
      },
      {
        id: "cad-equipes",
        title: "Como gerenciar equipes",
        description: "Crie equipes e atribua membros.",
        steps: [
          { title: "Acesse Cadastros > Equipes", description: "Na navegação lateral dos Cadastros, clique em 'Equipes'." },
          { title: "Crie uma equipe", description: "Clique em 'Nova Equipe', defina o nome e selecione o líder." },
          { title: "Adicione membros", description: "Clique em 'Gerenciar Membros' e adicione os operadores desejados." },
        ],
      },
    ],
  },
  {
    category: "Portal do Devedor",
    icon: "🌐",
    guides: [
      {
        id: "portal-config",
        title: "Como configurar o portal",
        description: "Personalize o portal self-service do devedor.",
        steps: [
          { title: "Acesse o Credor", description: "Em Cadastros > Credores, edite o credor desejado." },
          { title: "Aba Portal", description: "Ative o portal e configure: título, subtítulo, cor primária e logotipo." },
          { title: "Compartilhe o link", description: "O link do portal será: /portal/{slug-da-empresa}." },
        ],
      },
    ],
  },
];

const SupportGuidesTab = () => {
  const [search, setSearch] = useState("");
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);

  const filteredCategories = guidesData
    .map((cat) => ({
      ...cat,
      guides: cat.guides.filter(
        (g) =>
          g.title.toLowerCase().includes(search.toLowerCase()) ||
          g.description.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((cat) => cat.guides.length > 0);

  if (selectedGuide) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedGuide(null)}
          className="text-xs text-primary hover:underline"
        >
          ← Voltar aos guias
        </button>
        <h3 className="font-semibold text-foreground">{selectedGuide.title}</h3>
        <p className="text-xs text-muted-foreground">{selectedGuide.description}</p>
        <div className="space-y-3 mt-4">
          {selectedGuide.steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar guia..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>
      <Accordion type="multiple" className="space-y-1">
        {filteredCategories.map((cat) => (
          <AccordionItem key={cat.category} value={cat.category} className="border rounded-lg px-3">
            <AccordionTrigger className="py-2.5 text-sm font-medium hover:no-underline">
              <span className="flex items-center gap-2">
                <span>{cat.icon}</span>
                <span>{cat.category}</span>
                <Badge variant="outline" className="text-[10px] ml-1">{cat.guides.length}</Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-2 space-y-1">
              {cat.guides.map((guide) => (
                <button
                  key={guide.id}
                  onClick={() => setSelectedGuide(guide)}
                  className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{guide.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{guide.description}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 ml-2" />
                </button>
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      {filteredCategories.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-8">Nenhum guia encontrado.</p>
      )}
    </div>
  );
};

export default SupportGuidesTab;
