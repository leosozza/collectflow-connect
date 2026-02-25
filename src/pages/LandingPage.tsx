import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import {
  Zap, MessageSquare, Globe, Trophy, BarChart3, Plug,
  Upload, Settings, TrendingUp, Check, ArrowRight, Shield,
  Star, ChevronRight, Phone, Mail, MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImg from "@/assets/rivo_connect.png";

/* ───────── animated counter ───────── */
function AnimatedCounter({ target, suffix = "", prefix = "" }: { target: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 2000;
    const step = Math.ceil(target / (duration / 16));
    const id = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(id); }
      else setCount(start);
    }, 16);
    return () => clearInterval(id);
  }, [isInView, target]);

  return <span ref={ref}>{prefix}{count.toLocaleString("pt-BR")}{suffix}</span>;
}

/* ───────── section wrapper ───────── */
const Section = ({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) => (
  <motion.section
    id={id}
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.6 }}
    className={`px-4 sm:px-6 lg:px-8 ${className}`}
  >
    {children}
  </motion.section>
);

/* ───────── data ───────── */
const features = [
  { icon: Zap, title: "Automação Inteligente", desc: "Réguas de cobrança automáticas com IA que priorizam os devedores com maior propensão a pagar." },
  { icon: MessageSquare, title: "Contact Center Omnichannel", desc: "WhatsApp, telefonia e SMS integrados em uma única plataforma com filas inteligentes." },
  { icon: Globe, title: "Portal do Devedor", desc: "Portal personalizado por credor onde o devedor consulta dívidas e faz acordos 24/7." },
  { icon: Trophy, title: "Gamificação de Equipe", desc: "Rankings, conquistas e campanhas que motivam sua equipe a bater metas diariamente." },
  { icon: BarChart3, title: "Relatórios em Tempo Real", desc: "Dashboards com métricas de recuperação, aging, performance de operadores e muito mais." },
  { icon: Plug, title: "Integrações Prontas", desc: "3CPlus, Gupshup, CobCloud, Serasa, Protesto e APIs abertas para seu ERP." },
];

const steps = [
  { num: "01", title: "Importe sua carteira", desc: "Envie planilhas ou conecte via API. Seus dados são processados em segundos.", icon: Upload },
  { num: "02", title: "Automatize réguas", desc: "Configure regras de cobrança por canal, credor e aging. A IA faz o resto.", icon: Settings },
  { num: "03", title: "Acompanhe resultados", desc: "Veja acordos fechados, valores recuperados e ranking da equipe em tempo real.", icon: TrendingUp },
];

const metrics = [
  { value: 45, suffix: "%", label: "mais acordos fechados" },
  { value: 3, suffix: "x", label: "mais produtividade por operador" },
  { value: 70, suffix: "%", label: "redução no tempo de negociação" },
  { value: 500, prefix: "+", suffix: "", label: "empresas confiam no RIVO" },
];

const testimonials = [
  { name: "Carlos Mendes", role: "Diretor de Cobrança — FinCred", quote: "O RIVO Connect triplicou nossa taxa de recuperação em apenas 3 meses. A automação das réguas mudou completamente nosso jogo." },
  { name: "Ana Paula Silva", role: "Gerente Operacional — RecuperaBR", quote: "A gamificação transformou o ambiente da equipe. Os operadores estão mais engajados e as metas são batidas com consistência." },
  { name: "Roberto Alves", role: "CEO — CobTech Solutions", quote: "A integração com 3CPlus e o portal do devedor nos permitiram operar 24h sem aumentar a equipe. ROI impressionante." },
];

const plans = [
  {
    name: "Starter", price: "Grátis", period: "para começar",
    features: ["Até 500 devedores", "1 operador", "Régua básica", "Portal do devedor", "Relatórios essenciais"],
    cta: "Comece Grátis", highlight: false,
  },
  {
    name: "Pro", price: "R$ 497", period: "/mês",
    features: ["Até 10.000 devedores", "10 operadores", "Automação avançada", "WhatsApp + Telefonia", "Gamificação completa", "Integrações premium", "Suporte prioritário"],
    cta: "Começar Agora", highlight: true,
  },
  {
    name: "Enterprise", price: "Sob medida", period: "",
    features: ["Devedores ilimitados", "Operadores ilimitados", "IA preditiva", "API dedicada", "SLA personalizado", "Gerente de conta", "Treinamento presencial"],
    cta: "Falar com Vendas", highlight: false,
  },
];

/* ═══════════════════════════════════════ */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    document.title = "RIVO Connect — Plataforma de Cobrança Inteligente";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Recupere mais dívidas com menos esforço. Automação, contact center omnichannel e portal do devedor em uma única plataforma.");
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* ── HEADER ── */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "bg-secondary/95 backdrop-blur-md shadow-lg" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          <img src={logoImg} alt="RIVO Connect" className="h-8" />
          <nav className="hidden md:flex items-center gap-8 text-sm text-secondary-foreground/80">
            <a href="#recursos" className="hover:text-primary transition-colors">Recursos</a>
            <a href="#como-funciona" className="hover:text-primary transition-colors">Como Funciona</a>
            <a href="#precos" className="hover:text-primary transition-colors">Preços</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" className="text-secondary-foreground hidden sm:inline-flex">Entrar</Button>
            </Link>
            <Link to="/auth">
              <Button className="font-semibold">Comece Grátis</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        <div className="absolute inset-0 gradient-dark opacity-95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(30_100%_50%/0.15),transparent)]" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <span className="inline-block mb-4 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase bg-primary/15 text-primary border border-primary/25">
              Plataforma #1 de Cobrança no Brasil
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight">
              Recupere mais dívidas<br className="hidden sm:block" /> com <span className="text-primary">menos esforço</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
              Automação inteligente, contact center omnichannel e portal do devedor — tudo em uma única plataforma que transforma sua operação de cobrança.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="text-base px-8 py-6 font-bold shadow-lg shadow-primary/25">
                  Comece Grátis <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <a href="https://wa.me/5511999999999?text=Quero%20uma%20demonstração%20do%20RIVO%20Connect" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="text-base px-8 py-6 border-white/20 text-white hover:bg-white/10">
                  Ver Demonstração
                </Button>
              </a>
            </div>
          </motion.div>

          {/* hero metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto"
          >
            {metrics.map((m) => (
              <div key={m.label} className="text-center">
                <p className="text-3xl sm:text-4xl font-extrabold text-primary">
                  <AnimatedCounter target={m.value} suffix={m.suffix} prefix={m.prefix} />
                </p>
                <p className="mt-1 text-xs sm:text-sm text-white/60">{m.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ── */}
      <Section className="py-12 bg-muted/50">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Empresas que confiam no RIVO Connect</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8 opacity-50">
            {["FinCred", "RecuperaBR", "CobTech", "MaxCobra", "NovaCollect"].map((n) => (
              <span key={n} className="text-lg font-bold text-foreground/60 tracking-wide">{n}</span>
            ))}
          </div>
        </div>
      </Section>

      {/* ── FEATURES ── */}
      <Section id="recursos" className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">Recursos</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground">Tudo que você precisa para cobrar melhor</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">Uma plataforma completa que substitui dezenas de ferramentas e coloca sua operação no piloto automático.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <motion.div
                key={f.title}
                whileHover={{ y: -4 }}
                className="p-6 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="h-11 w-11 rounded-lg gradient-orange flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-card-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── COMO FUNCIONA ── */}
      <Section id="como-funciona" className="py-20 sm:py-28 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">Como Funciona</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground">3 passos para transformar sua cobrança</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={s.num} className="relative text-center">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] border-t-2 border-dashed border-primary/25" />
                )}
                <div className="mx-auto h-24 w-24 rounded-full gradient-dark flex items-center justify-center mb-6 ring-4 ring-primary/20">
                  <s.icon className="h-10 w-10 text-primary" />
                </div>
                <span className="text-xs font-bold text-primary uppercase tracking-widest">Passo {s.num}</span>
                <h3 className="mt-2 text-xl font-bold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── RESULTADOS ── */}
      <Section className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">Resultados Comprovados</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground">Números que falam por si</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {metrics.map((m) => (
              <div key={m.label} className="p-8 rounded-xl gradient-dark text-center shadow-lg">
                <p className="text-4xl sm:text-5xl font-extrabold text-primary">
                  <AnimatedCounter target={m.value} suffix={m.suffix} prefix={m.prefix} />
                </p>
                <p className="mt-3 text-sm text-white/70">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── DEPOIMENTOS ── */}
      <Section className="py-20 sm:py-28 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">Depoimentos</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground">O que nossos clientes dizem</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="p-6 rounded-xl bg-card border border-border shadow-sm">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-primary text-primary" />)}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed italic">"{t.quote}"</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full gradient-orange flex items-center justify-center text-sm font-bold text-primary-foreground">
                    {t.name.split(" ").map((w) => w[0]).join("")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── PRICING ── */}
      <Section id="precos" className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">Planos</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground">Escolha o plano ideal</h2>
            <p className="mt-4 text-muted-foreground">Sem surpresas. Cancele quando quiser.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {plans.map((p) => (
              <motion.div
                key={p.name}
                whileHover={{ y: -4 }}
                className={`relative p-8 rounded-2xl border shadow-sm ${
                  p.highlight
                    ? "border-primary bg-card ring-2 ring-primary/30 shadow-lg"
                    : "border-border bg-card"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold gradient-orange text-primary-foreground">
                    Mais Popular
                  </span>
                )}
                <h3 className="text-lg font-bold text-card-foreground">{p.name}</h3>
                <div className="mt-4 flex items-end gap-1">
                  <span className="text-4xl font-extrabold text-foreground">{p.price}</span>
                  {p.period && <span className="text-sm text-muted-foreground mb-1">{p.period}</span>}
                </div>
                <ul className="mt-6 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/auth" className="block mt-8">
                  <Button className={`w-full font-semibold ${p.highlight ? "" : "variant-outline"}`} variant={p.highlight ? "default" : "outline"}>
                    {p.cta} <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── CTA FINAL ── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl gradient-dark p-10 sm:p-16 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_110%,hsl(30_100%_50%/0.12),transparent)]" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Pronto para transformar sua cobrança?</h2>
              <p className="mt-4 text-white/70 text-lg max-w-lg mx-auto">Junte-se a mais de 500 empresas que já aumentaram sua recuperação com o RIVO Connect.</p>
              <div className="mt-8">
                <Link to="/auth">
                  <Button size="lg" className="text-base px-10 py-6 font-bold shadow-lg shadow-primary/30">
                    Comece agora gratuitamente <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <img src={logoImg} alt="RIVO Connect" className="h-7 mb-4" />
              <p className="text-sm text-muted-foreground">Plataforma inteligente de cobrança que une automação, contact center e portal do devedor.</p>
            </div>
            <div>
              <h4 className="font-semibold text-card-foreground mb-3">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#recursos" className="hover:text-primary transition-colors">Recursos</a></li>
                <li><a href="#precos" className="hover:text-primary transition-colors">Preços</a></li>
                <li><a href="#como-funciona" className="hover:text-primary transition-colors">Como Funciona</a></li>
                <li><Link to="/api-docs/public" className="hover:text-primary transition-colors">API Docs</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-card-foreground mb-3">Empresa</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Sobre nós</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Carreiras</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-card-foreground mb-3">Contato</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> contato@rivoconnect.com.br</li>
                <li className="flex items-center gap-2"><Phone className="h-4 w-4" /> (11) 9 9999-9999</li>
                <li className="flex items-center gap-2"><MapPin className="h-4 w-4" /> São Paulo, SP</li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} RIVO Connect. Todos os direitos reservados.</p>
            <div className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              <span>Em conformidade com a LGPD</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
