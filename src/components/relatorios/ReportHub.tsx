import { FileText, Wallet, TrendingUp, Radio, LucideIcon, ArrowRight } from "lucide-react";

export type ReportKey = "prestacao" | "carteira" | "negociacoes" | "canais";

interface Card {
  key: ReportKey;
  title: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  tag: string;
}

const CARDS: Card[] = [
  {
    key: "prestacao",
    title: "Prestação de Contas",
    description: "Reconciliação financeira por credor: repasses, acordos ativos, quebras e caixa real recebido.",
    icon: FileText,
    gradient: "from-primary/15 via-card to-card",
    tag: "Financeiro",
  },
  {
    key: "carteira",
    title: "Análise da Carteira",
    description: "Raio-X da inadimplência: dívida original, aging de títulos abertos e ticket médio.",
    icon: Wallet,
    gradient: "from-emerald-500/10 via-card to-card",
    tag: "Carteira",
  },
  {
    key: "negociacoes",
    title: "Desempenho de Negociações",
    description: "Funil de conversão, média de descontos concedidos e performance por operador.",
    icon: TrendingUp,
    gradient: "from-blue-500/10 via-card to-card",
    tag: "Operação",
  },
  {
    key: "canais",
    title: "Acionamentos e Canais",
    description: "Efetividade de WhatsApp, Portal e Ligação, volumetria e retorno por canal.",
    icon: Radio,
    gradient: "from-purple-500/10 via-card to-card",
    tag: "Contato",
  },
];

export const ReportHub = ({ onOpen }: { onOpen: (k: ReportKey) => void }) => (
  <div className="space-y-6 animate-fade-in">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Central de Relatórios</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Relatórios formais para prestação de contas, apresentações executivas e auditoria.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {CARDS.map((c) => {
        const Icon = c.icon;
        return (
          <button
            key={c.key}
            onClick={() => onOpen(c.key)}
            className={`group text-left rounded-2xl border border-border bg-gradient-to-br ${c.gradient} shadow-sm hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/40 transition-all p-6 backdrop-blur-sm`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="rounded-xl p-3 bg-primary/10 text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted/40 px-2 py-1 rounded-full">
                {c.tag}
              </span>
            </div>
            <h3 className="mt-5 text-lg font-bold text-foreground leading-tight">{c.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{c.description}</p>
            <div className="mt-4 inline-flex items-center text-xs font-semibold text-primary opacity-70 group-hover:opacity-100 transition-opacity">
              Abrir relatório <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        );
      })}
    </div>
  </div>
);
