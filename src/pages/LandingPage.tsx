import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import {
  Zap, MessageSquare, Globe, Trophy, BarChart3, Plug,
  Upload, Settings, TrendingUp, Check, ArrowRight, Shield,
  Star, ChevronRight, Phone, Mail, MapPin,
  CreditCard, Clock, Cable
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImg from "@/assets/rivo_connect.png";

/* ───────── animated bars background ───────── */
const AnimatedBars = ({ count = 12, className = "" }: { count?: number; className?: string }) => (
  <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
    {Array.from({ length: count }).map((_, i) => {
      const left = `${(i / count) * 100 + Math.random() * 4}%`;
      const maxH = 30 + Math.random() * 50;
      const duration = 4 + Math.random() * 6;
      const delay = Math.random() * 3;
      const width = 6 + Math.random() * 10;
      return (
        <motion.div
          key={`bar-${i}`}
          className="absolute bottom-0 rounded-t bg-primary/[0.06]"
          style={{ left, width }}
          animate={{ height: [0, `${maxH}%`, `${maxH * 0.4}%`, `${maxH * 0.8}%`, 0] }}
          transition={{ duration, repeat: Infinity, delay, ease: "easeInOut" }}
        />
      );
    })}
  </div>
);

/* ───────── section wrapper with parallax ───────── */
const Section = ({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [30, -30]);

  return (
    <motion.section
      ref={ref}
      id={id}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
      className={`px-4 sm:px-6 lg:px-8 relative ${className}`}
    >
      <motion.div style={{ y }} className="relative z-10">
        {children}
      </motion.div>
    </motion.section>
  );
};

/* ───────── stagger container ───────── */
const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

/* ───────── data ───────── */
const features = [
  { icon: Zap, title: "Automação Inteligente", desc: "Réguas de cobrança automáticas com IA que priorizam os devedores com maior propensão a pagar." },
  { icon: MessageSquare, title: "Contact Center Omnichannel", desc: "WhatsApp, telefonia e SMS integrados em uma única plataforma com filas inteligentes." },
  { icon: Globe, title: "Portal do Devedor", desc: "Portal personalizado por credor onde o devedor consulta dívidas e faz acordos 24/7." },
  { icon: Trophy, title: "Gamificação de Equipe", desc: "Rankings, conquistas e campanhas que motivam sua equipe a bater metas diariamente." },
  { icon: BarChart3, title: "Analytics e Dashboard", desc: "Painéis analíticos com métricas de recuperação, aging, performance de operadores e muito mais." },
  { icon: Plug, title: "Integrações Prontas", desc: "3CPlus, Gupshup, CobCloud, Serasa, Protesto e APIs abertas para seu ERP." },
];

const steps = [
  { num: "01", title: "Importe sua carteira", desc: "Envie planilhas ou conecte via API. Seus dados são processados em segundos.", icon: Upload },
  { num: "02", title: "Automatize réguas", desc: "Configure regras de cobrança por canal, credor e aging. A IA faz o resto.", icon: Settings },
  { num: "03", title: "Acompanhe resultados", desc: "Veja acordos fechados, valores recuperados e ranking da equipe em tempo real.", icon: TrendingUp },
];

const objections = [
  { icon: CreditCard, text: "Sem cartão de crédito" },
  { icon: Clock, text: "Setup em 24h" },
  { icon: Cable, text: "Funciona com seu ERP" },
];

const testimonials = [
  { name: "Carlos Mendes", role: "Diretor de Cobrança — FinCred", quote: "O RIVO Connect triplicou nossa taxa de recuperação em apenas 3 meses. A automação das réguas mudou completamente nosso jogo." },
  { name: "Ana Paula Silva", role: "Gerente Operacional — RecuperaBR", quote: "A gamificação transformou o ambiente da equipe. Os operadores estão mais engajados e as metas são batidas com consistência." },
  { name: "Roberto Alves", role: "CEO — CobTech Solutions", quote: "A integração com 3CPlus e o portal do devedor nos permitiram operar 24h sem aumentar a equipe. ROI impressionante." },
];

const plans = [
  {
    name: "Essencial", price: "R$ 499,99", period: "/mês",
    features: ["Até 2.000 devedores", "5 operadores", "Régua de cobrança", "Portal do devedor", "Relatórios essenciais", "Suporte por e-mail"],
    cta: "Contratar", highlight: false,
  },
  {
    name: "Pro", price: "R$ 999,99", period: "/mês",
    features: ["Até 20.000 devedores", "Operadores ilimitados", "Automação avançada", "WhatsApp + Telefonia", "Gamificação completa", "Integrações premium", "Suporte prioritário"],
    cta: "Contratar", highlight: true,
  },
  {
    name: "Enterprise", price: "Sob medida", period: "",
    features: ["Devedores ilimitados", "Operadores ilimitados", "IA preditiva", "API dedicada", "SLA personalizado", "Gerente de conta", "Treinamento presencial"],
    cta: "Falar com Vendas", highlight: false,
  },
];

/* ───────── floating shapes ───────── */
const FloatingShapes = ({ opacity = 0.07 }: { opacity?: number }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[
      { size: 120, x: "10%", y: "20%", duration: 18, delay: 0 },
      { size: 80, x: "85%", y: "15%", duration: 22, delay: 2 },
      { size: 60, x: "70%", y: "70%", duration: 20, delay: 4 },
      { size: 100, x: "20%", y: "75%", duration: 25, delay: 1 },
      { size: 50, x: "50%", y: "40%", duration: 16, delay: 3 },
    ].map((s, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full border"
        style={{ width: s.size, height: s.size, left: s.x, top: s.y, borderColor: `hsl(var(--primary) / ${opacity})` }}
        animate={{
          y: [0, -20, 0, 15, 0],
          x: [0, 10, 0, -10, 0],
          rotate: [0, 90, 180, 270, 360],
        }}
        transition={{ duration: s.duration, repeat: Infinity, delay: s.delay, ease: "linear" }}
      />
    ))}
    {[
      { w: 150, x: "30%", y: "30%", duration: 24, delay: 1 },
      { w: 100, x: "75%", y: "50%", duration: 20, delay: 3 },
      { w: 80, x: "15%", y: "55%", duration: 28, delay: 0 },
    ].map((s, i) => (
      <motion.div
        key={`diamond-${i}`}
        className="absolute rotate-45"
        style={{ width: s.w, height: s.w, left: s.x, top: s.y, border: `1px solid hsl(var(--primary) / ${opacity * 0.7})` }}
        animate={{ y: [0, 15, 0, -15, 0], opacity: [opacity * 0.5, opacity, opacity * 0.5] }}
        transition={{ duration: s.duration, repeat: Infinity, delay: s.delay, ease: "easeInOut" }}
      />
    ))}
  </div>
);

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
            {[
              { href: "#recursos", label: "Recursos" },
              { href: "#como-funciona", label: "Como Funciona" },
              { href: "#precos", label: "Preços" },
            ].map((link) => (
              <motion.a
                key={link.href}
                href={link.href}
                className="hover:text-primary transition-colors"
                whileHover={{ scale: 1.08 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                {link.label}
              </motion.a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" className="text-secondary-foreground hidden sm:inline-flex">Entrar</Button>
            </Link>
            <Link to="/auth">
              <Button className="font-semibold">Teste Grátis 14 Dias</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-24 sm:pt-44 sm:pb-32 overflow-hidden">
        <div className="absolute inset-0 gradient-dark opacity-95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(30_100%_50%/0.18),transparent)]" />
        <FloatingShapes />
        <AnimatedBars count={16} className="opacity-50" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <span className="inline-block mb-6 px-5 py-2 rounded-full text-xs font-semibold tracking-wide uppercase bg-primary/15 text-primary border border-primary/25">
              Plataforma líder em cobrança B2B
            </span>

            <motion.h1
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-white leading-[1.1] tracking-tight"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              Sua Empresa Perde Dinheiro<br className="hidden sm:block" />
              <span className="text-primary">Cobrando do Jeito Errado</span>
            </motion.h1>

            <p className="mt-6 text-lg sm:text-xl lg:text-2xl text-white/70 max-w-3xl mx-auto leading-relaxed">
              Empresas que usam RIVO recuperam até <span className="text-white font-semibold">45% mais recebíveis em 90 dias</span> — sem aumentar equipe e sem integração complexa.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://wa.me/5511999999999?text=Quero%20falar%20com%20um%20especialista%20RIVO"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" className="text-base px-8 py-6 font-bold shadow-lg shadow-primary/25">
                  Fale com um Especialista <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
              <Link to="/auth">
                <button className="inline-flex items-center justify-center text-base px-8 py-3 font-semibold rounded-md border border-white/30 text-white bg-white/5 hover:bg-white/15 transition-colors duration-200">
                  Teste Grátis 14 Dias
                </button>
              </Link>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-6 text-white/50 text-sm"
            >
              {objections.map((o) => (
                <motion.div
                  key={o.text}
                  className="flex items-center gap-2"
                  whileHover={{ scale: 1.08, color: "hsl(var(--primary))" }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <o.icon className="h-4 w-4 text-primary/70" />
                  <span>{o.text}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <Section id="recursos" className="py-20 sm:py-28">
        <FloatingShapes opacity={0.03} />
        <AnimatedBars count={8} className="opacity-30" />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">Recursos</span>
            <motion.h2
              className="mt-2 text-3xl sm:text-4xl font-bold text-foreground"
              whileHover={{ scale: 1.03 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              Tudo que você precisa para cobrar melhor
            </motion.h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">Uma plataforma completa que substitui dezenas de ferramentas e coloca sua operação no piloto automático.</p>
          </div>
          <motion.div
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={staggerItem}
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="p-6 rounded-xl border border-border bg-card shadow-sm hover:shadow-lg transition-shadow cursor-default"
              >
                <div className="h-11 w-11 rounded-lg gradient-orange flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <motion.h3
                  className="text-lg font-semibold text-card-foreground"
                  whileHover={{ scale: 1.04 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  {f.title}
                </motion.h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>

      {/* ── COMO FUNCIONA ── */}
      <Section id="como-funciona" className="py-20 sm:py-28 bg-muted/30">
        <AnimatedBars count={6} className="opacity-20" />
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">Como Funciona</span>
            <motion.h2
              className="mt-2 text-3xl sm:text-4xl font-bold text-foreground"
              whileHover={{ scale: 1.03 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              3 passos para transformar sua cobrança
            </motion.h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                className="relative text-center"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
              >
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] border-t-2 border-dashed border-primary/25" />
                )}
                <motion.div
                  className="mx-auto h-24 w-24 rounded-full gradient-dark flex items-center justify-center mb-6 ring-4 ring-primary/20"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <s.icon className="h-10 w-10 text-primary" />
                </motion.div>
                <span className="text-xs font-bold text-primary uppercase tracking-widest">Passo {s.num}</span>
                <motion.h3
                  className="mt-2 text-xl font-bold text-foreground"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  {s.title}
                </motion.h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── DEPOIMENTOS ── */}
      <Section className="py-20 sm:py-28 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">Depoimentos</span>
            <motion.h2
              className="mt-2 text-3xl sm:text-4xl font-bold text-foreground"
              whileHover={{ scale: 1.03 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              O que nossos clientes dizem
            </motion.h2>
          </div>
          <motion.div
            className="grid md:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
          >
            {testimonials.map((t) => (
              <motion.div
                key={t.name}
                variants={staggerItem}
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="p-6 rounded-xl bg-card border border-border shadow-sm hover:shadow-lg transition-shadow"
              >
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
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>

      {/* ── PRICING ── */}
      <Section id="precos" className="py-20 sm:py-28">
        <FloatingShapes opacity={0.03} />
        <AnimatedBars count={10} className="opacity-20" />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">Planos</span>
            <motion.h2
              className="mt-2 text-3xl sm:text-4xl font-bold text-foreground"
              whileHover={{ scale: 1.03 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              Escolha o plano ideal
            </motion.h2>
            <p className="mt-4 text-muted-foreground">Sem surpresas. Cancele quando quiser.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {plans.map((p, idx) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.12 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className={`relative p-8 rounded-2xl border shadow-sm hover:shadow-xl transition-shadow ${
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
                  <Button className={`w-full font-semibold`} variant={p.highlight ? "default" : "outline"}>
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
          <motion.div
            className="rounded-3xl gradient-dark p-10 sm:p-16 text-center shadow-2xl relative overflow-hidden"
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_110%,hsl(30_100%_50%/0.12),transparent)]" />
            <AnimatedBars count={8} className="opacity-40" />
            <div className="relative z-10">
              <motion.h2
                className="text-3xl sm:text-4xl font-extrabold text-white"
                whileHover={{ scale: 1.03 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                Pronto para transformar sua cobrança?
              </motion.h2>
              <p className="mt-4 text-white/70 text-lg max-w-lg mx-auto">Junte-se a mais de 500 empresas que já aumentaram sua recuperação com o RIVO Connect.</p>
              <div className="mt-8">
                <Link to="/auth">
                  <Button size="lg" className="text-base px-10 py-6 font-bold shadow-lg shadow-primary/30">
                    Contratar agora <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
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
