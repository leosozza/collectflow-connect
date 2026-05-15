import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Check, MessageCircle, Phone, Trophy, BarChart3,
  Globe, Brain, ShieldCheck, Zap, Users, LineChart,
  Sparkles, Plug, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImg from "@/assets/rivo_connect.png";

/* ============================================================
   RIVO CONNECT — Landing Page Editorial
   Inspirado em CobreAI: tipografia editorial, grid sutil,
   foco em assessorias de cobrança.
============================================================ */

// Tipografia: tudo em Inter, headings em peso black para impacto.
const serif = "font-sans font-black";
const grid = "bg-[linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)] bg-[size:48px_48px]";

/* ───────── Pattern de conexões (rede neural sutil) ───────── */
const ConnectionsBg = ({ className = "" }: { className?: string }) => {
  // Grid 7×5 de nós com linhas conectando vizinhos próximos.
  const cols = 7, rows = 5;
  const nodes = Array.from({ length: rows * cols }, (_, i) => ({
    x: ((i % cols) + 0.5) * (100 / cols),
    y: (Math.floor(i / cols) + 0.5) * (100 / rows),
  }));
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  nodes.forEach((a, i) => {
    nodes.slice(i + 1).forEach((b) => {
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 22) lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    });
  });
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
    >
      {lines.map((l, i) => (
        <line
          key={i}
          x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={0.08}
        />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={0.35} fill="rgba(255,127,0,0.35)" />
      ))}
    </svg>
  );
};

/* ───────── MacBook Frame ───────── */
const MacBookFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative mx-auto w-full max-w-5xl">
    {/* Tela */}
    <div className="relative rounded-t-2xl bg-neutral-900 p-3 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] ring-1 ring-black/20">
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1 rounded-full bg-neutral-800" />
      <div className="overflow-hidden rounded-lg bg-white aspect-[16/10]">
        {children}
      </div>
    </div>
    {/* Base trapezoidal */}
    <div className="relative">
      <div className="h-3 bg-gradient-to-b from-neutral-300 to-neutral-400" style={{ clipPath: "polygon(2% 0, 98% 0, 100% 100%, 0 100%)" }} />
      <div className="h-1.5 bg-neutral-500/80 mx-auto rounded-b-xl" style={{ width: "18%" }} />
    </div>
  </div>
);

/* ───────── Mockup Dashboard (placeholder estilizado) ───────── */
const DashboardMockup = () => (
  <div className="w-full h-full bg-[#FAFAF7] flex flex-col text-[10px]">
    {/* Top bar */}
    <div className="flex items-center gap-2 px-3 py-2 border-b border-black/10 bg-white">
      <div className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-red-400" />
        <span className="w-2 h-2 rounded-full bg-yellow-400" />
        <span className="w-2 h-2 rounded-full bg-green-400" />
      </div>
      <div className="ml-3 text-[9px] font-semibold text-neutral-700">RIVO CONNECT · Dashboard</div>
      <div className="ml-auto flex gap-2 text-neutral-400">
        <span>Hoje</span><span>Mês</span><span className="text-primary font-semibold">Ano</span>
      </div>
    </div>
    <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      <div className="w-28 bg-[#0F1117] text-white/80 px-2 py-3 space-y-1 text-[8px]">
        {["Dashboard", "Carteira", "Atendimento", "Acordos", "WhatsApp", "Discador", "Analytics", "Gamificação"].map((m, i) => (
          <div key={m} className={`px-2 py-1.5 rounded ${i === 0 ? "bg-primary text-white" : ""}`}>{m}</div>
        ))}
      </div>
      {/* Conteúdo */}
      <div className="flex-1 p-3 space-y-2 overflow-hidden">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { l: "Recebido", v: "R$ 487 K", c: "text-emerald-600" },
            { l: "Acordos", v: "1.284", c: "text-primary" },
            { l: "Carteira", v: "R$ 4,2 Mi", c: "text-neutral-700" },
            { l: "Conversão", v: "32%", c: "text-blue-600" },
          ].map((k) => (
            <div key={k.l} className="bg-white border border-black/5 rounded-md px-2 py-1.5">
              <div className="text-[7px] uppercase tracking-wider text-neutral-400">{k.l}</div>
              <div className={`text-[11px] font-bold ${k.c}`}>{k.v}</div>
            </div>
          ))}
        </div>
        {/* Gráfico */}
        <div className="bg-white border border-black/5 rounded-md p-2">
          <div className="text-[8px] font-semibold text-neutral-600 mb-1.5">Recuperação · 12 meses</div>
          <div className="flex items-end gap-1 h-14">
            {[35, 48, 42, 60, 55, 72, 68, 80, 75, 88, 92, 100].map((h, i) => (
              <div key={i} className="flex-1 bg-gradient-to-t from-primary to-primary/50 rounded-t" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        {/* Tabela */}
        <div className="bg-white border border-black/5 rounded-md p-2 flex-1">
          <div className="text-[8px] font-semibold text-neutral-600 mb-1">Top operadores</div>
          {["Carla M. · 42 acordos", "Pedro R. · 38 acordos", "Joana S. · 31 acordos"].map((r, i) => (
            <div key={r} className="flex items-center justify-between py-1 border-t border-black/5 first:border-0 text-[8px]">
              <span className="text-neutral-700">{r}</span>
              <span className="text-primary font-semibold">+{(15 - i * 3)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const ProductShowcase = () => (
  <section className={`relative bg-gradient-to-b from-[#FAFAF7] to-[#F0EDE5] ${grid}`}>
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="text-[11px] tracking-[0.18em] uppercase text-primary mb-3">A plataforma</div>
        <h2 className={`${serif} text-4xl lg:text-5xl tracking-tight text-neutral-950`}>
          Tudo o que você precisa em <span className="text-primary">uma única tela</span>.
        </h2>
        <p className="mt-4 text-neutral-600">Carteira, atendimento, acordos, WhatsApp, discador e analytics — sem trocar de aba, sem trocar de senha.</p>
      </div>
      <MacBookFrame>
        <DashboardMockup />
      </MacBookFrame>
    </div>
  </section>
);

/* ───────── Top Nav ───────── */
const Nav = () => (
  <header className="sticky top-0 z-50 backdrop-blur-md bg-[#FAFAF7]/80 border-b border-black/5">
    <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2">
        <img src={logoImg} alt="RIVO CONNECT" className="h-8 w-auto" />
      </Link>
      <nav className="hidden md:flex items-center gap-8 text-sm text-neutral-700">
        <a href="#recursos" className="hover:text-neutral-950 transition">Recursos</a>
        <a href="#para-quem" className="hover:text-neutral-950 transition">Para quem</a>
        <a href="#portal" className="hover:text-neutral-950 transition">Portal do credor</a>
        <a href="#planos" className="hover:text-neutral-950 transition">Planos</a>
      </nav>
      <div className="flex items-center gap-2">
        <Link to="/auth" className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-neutral-800 hover:text-neutral-950 px-3 py-2">
          Entrar
        </Link>
        <Link to="/auth">
          <Button className="rounded-full bg-primary hover:bg-primary/90 text-white px-5 h-10 text-sm font-semibold">
            Teste grátis 14 dias
          </Button>
        </Link>
      </div>
    </div>
  </header>
);

/* ───────── WhatsApp Mockup animado ───────── */
const WhatsAppMockup = () => {
  const messages = [
    { side: "in", text: "Olha, sinceramente não tenho como pagar isso agora. Tô desempregado.", time: "14:20" },
    { side: "out", text: "Entendo, João. Bora montar algo que caiba no seu bolso? Quanto você consegue pagar por mês sem apertar?", time: "14:21", emphasis: true },
    { side: "in", text: "No máximo uns R$ 150.", time: "14:22" },
    { side: "out", text: "Fechado. Posso te dar:\n✅ 30% de desconto sobre o saldo\n✅ 10× de R$ 152,30\nPrimeira só daqui 15 dias. Topa?", time: "14:22" },
    { side: "in", text: "Topo!", time: "14:23" },
    { side: "out", text: "Acordo registrado ✅ Boleto da 1ª parcela já no seu WhatsApp.", time: "14:23", card: true },
  ];

  const [visible, setVisible] = useState(1);
  useEffect(() => {
    if (visible >= messages.length) {
      const r = setTimeout(() => setVisible(1), 4000);
      return () => clearTimeout(r);
    }
    const t = setTimeout(() => setVisible(v => v + 1), 1400);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <div className="relative">
      {/* Tag flutuante */}
      <div className="absolute -top-3 left-6 z-10 bg-neutral-950 text-white text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        IA · contornando objeção · JOÃO M.
      </div>

      {/* Marcas de canto laranja */}
      <div className="absolute -inset-3 pointer-events-none">
        {[
          "top-0 left-0 border-t-2 border-l-2",
          "top-0 right-0 border-t-2 border-r-2",
          "bottom-0 left-0 border-b-2 border-l-2",
          "bottom-0 right-0 border-b-2 border-r-2",
        ].map((c, i) => (
          <span key={i} className={`absolute w-5 h-5 border-primary ${c}`} />
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)] overflow-hidden border border-black/5">
        {/* Header chat */}
        <div className="bg-[#0b1220] text-white px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-xs font-semibold">RC</div>
          <div className="flex-1">
            <div className="text-sm font-medium">RIVO · Recuperação</div>
            <div className="text-[11px] text-white/60 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> online · digitando
            </div>
          </div>
          <div className="text-[11px] text-white/50">14:23</div>
        </div>

        {/* Messages */}
        <div className="bg-[#ECE5DD] px-4 py-5 space-y-2.5 min-h-[420px]">
          <div className="text-center">
            <span className="text-[10px] tracking-[0.18em] uppercase bg-white/70 text-neutral-600 px-2.5 py-1 rounded">hoje</span>
          </div>
          <AnimatePresence mode="popLayout">
            {messages.slice(0, visible).map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3 }}
                className={`flex ${m.side === "out" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug whitespace-pre-line shadow-sm ${
                  m.side === "out"
                    ? "bg-[#DCF8C6] text-neutral-900 rounded-br-sm"
                    : "bg-white text-neutral-900 rounded-bl-sm"
                }`}>
                  {m.text}
                  {m.card && (
                    <div className="mt-2 bg-white/80 border border-emerald-700/10 rounded-lg p-2 font-mono text-[10px] text-neutral-700 space-y-0.5">
                      <div className="flex justify-between"><span className="text-neutral-500">ACORDO</span><span className="font-semibold">#4821</span></div>
                      <div className="flex justify-between"><span className="text-neutral-500">TOTAL</span><span>R$ 1.523,00</span></div>
                      <div className="flex justify-between"><span className="text-neutral-500">PARCELAS</span><span>10× R$ 152,30</span></div>
                    </div>
                  )}
                  <div className="text-right text-[9px] text-neutral-500 mt-1">{m.time}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Spec footer */}
        <div className="px-4 py-3 border-t border-black/5 bg-white flex items-center justify-between text-[10px] tracking-wider uppercase">
          <div>
            <div className="text-neutral-400">SPEC</div>
            <div className="font-mono text-neutral-700">acordo · 10× · objeção tratada</div>
          </div>
          <div className="text-right">
            <div className="text-neutral-400">SCORE</div>
            <div className="font-mono text-primary font-semibold">0.78 · auto-fechado</div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ───────── Hero (escuro · estilo antigo) ───────── */
const Hero = () => (
  <section className="relative bg-[#0F1117] text-white overflow-hidden">
    {/* Pattern de conexões */}
    <ConnectionsBg />
    {/* Glow laranja radial */}
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          "radial-gradient(60% 50% at 25% 35%, rgba(255,127,0,0.18), transparent 70%), radial-gradient(50% 40% at 85% 70%, rgba(255,127,0,0.12), transparent 70%)",
      }}
    />
    {/* Grid sutil branco */}
    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

    <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 ring-1 ring-primary/30 text-[11px] tracking-[0.18em] uppercase text-primary font-semibold mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Plataforma para assessorias de cobrança
        </div>

        <h1 className="font-sans font-black text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight">
          Sua assessoria recupera{" "}
          <span className="text-primary">mais</span> cobrando do{" "}
          <span className="text-primary">jeito certo</span>.
        </h1>

        <p className="mt-7 text-lg text-white/70 max-w-xl leading-relaxed">
          WhatsApp oficial e não oficial, discador, score de IA e portal do credor —
          tudo em <strong className="font-semibold text-white">uma única plataforma</strong>,
          feita para quem vive de cobrança.
        </p>

        {/* CTAs */}
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link to="/auth">
            <Button
              className="rounded-full bg-primary hover:bg-primary/90 text-white px-7 h-12 text-sm font-semibold shadow-[0_0_40px_rgba(255,127,0,0.45)]"
            >
              Teste grátis 14 dias <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
          <a href="#hero-chat">
            <Button
              variant="outline"
              className="rounded-full border-white/20 bg-transparent text-white hover:bg-white/10 px-6 h-12 text-sm font-medium"
            >
              Ver demonstração
            </Button>
          </a>
        </div>

        {/* Trust badges */}
        <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/60">
          {[
            { i: ShieldCheck, t: "Sem cartão de crédito" },
            { i: Zap, t: "Setup em 24h" },
            { i: ShieldCheck, t: "LGPD compliant" },
            { i: Plug, t: "Funciona com seu CRM" },
          ].map((s) => (
            <span key={s.t} className="inline-flex items-center gap-1.5">
              <s.i className="w-3.5 h-3.5 text-primary" /> {s.t}
            </span>
          ))}
        </div>

        {/* KPIs */}
        <div className="mt-10 grid grid-cols-3 gap-6 max-w-xl border-t border-white/10 pt-6">
          {[
            { label: "RECUPERAÇÃO", value: "+30%", sub: "vs. operação manual" },
            { label: "PRODUTIVIDADE", value: "3×", sub: "mais contatos / operador" },
            { label: "CREDORES", value: "Multi", sub: "em uma só plataforma" },
          ].map((k) => (
            <div key={k.label}>
              <div className="text-[10px] tracking-[0.18em] uppercase text-white/50">{k.label}</div>
              <div className="font-sans font-black text-3xl text-white mt-1 leading-none">
                {k.value.startsWith("+") || k.value.startsWith("3") ? (
                  <span className="text-primary">{k.value}</span>
                ) : (
                  k.value
                )}
              </div>
              <div className="text-[11px] text-white/50 mt-1.5">{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div id="hero-chat" className="lg:pl-6">
        <WhatsAppMockup />
      </div>
    </div>
  </section>
);

/* ───────── Faixa "feito para" ───────── */
const TargetBar = () => (
  <section className="border-y border-black/10 bg-white">
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 flex flex-wrap items-center justify-between gap-y-3 gap-x-8">
      <div className="text-[11px] tracking-[0.18em] uppercase text-neutral-500">
        Feito para assessorias <span className="text-primary">·</span> recuperadores <span className="text-primary">·</span> escritórios de cobrança
      </div>
      <div className="flex items-center gap-6 text-sm text-neutral-700">
        <span className="inline-flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> LGPD</span>
        <span className="inline-flex items-center gap-2"><Plug className="w-4 h-4 text-neutral-700" /> Multi-credor</span>
        <span className="inline-flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Onboarding rápido</span>
      </div>
    </div>
  </section>
);

/* ───────── Big numbers ───────── */
const BigNumbers = () => (
  <section className="bg-[#FAFAF7]">
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <div className="max-w-3xl">
        <h2 className={`${serif} text-5xl lg:text-6xl text-neutral-950 leading-[1] tracking-tight`}>
          Por que <em className="italic text-primary">automatizar</em>.
        </h2>
        <p className="mt-4 text-neutral-600 text-lg">O que sua operação ganha ao adotar a RIVO CONNECT.</p>
      </div>

      <div className="mt-14 grid md:grid-cols-3 gap-px bg-black/10 border border-black/10 rounded-2xl overflow-hidden">
        {[
          { big: "+30%", label: "Mais Recuperação", desc: "Score de IA prioriza quem tem mais chance de pagar agora — operador foca no que converte." },
          { big: "−15h", label: "Por Semana / Operador", desc: "Disparos automatizados, reconciliação e agendas — menos tarefa manual." },
          { big: "24/7", label: "Atendimento", desc: "IA responde fora do horário comercial e qualifica antes do operador entrar." },
        ].map((c) => (
          <div key={c.label} className="bg-white p-8 lg:p-10">
            <div className={`${serif} text-6xl lg:text-7xl text-neutral-950 leading-none`}>
              <span className="text-primary">{c.big}</span>
            </div>
            <div className="mt-4 text-sm font-medium uppercase tracking-wider text-neutral-700">{c.label}</div>
            <div className="mt-2 text-sm text-neutral-600 leading-relaxed">{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ───────── Recursos ───────── */
const features = [
  { icon: Brain, title: "Score de Propensão IA", desc: "Cada CPF recebe uma nota de 0 a 100. O operador trabalha primeiro quem tem real chance de pagar." },
  { icon: BarChart3, title: "Dashboard Operacional", desc: "Carteira, baixas, comissão e produtividade em uma única visão executiva." },
  { icon: MessageCircle, title: "WhatsApp Oficial + Não Oficial", desc: "Gupshup, Evolution e Wuzapi integrados. Você escolhe o provedor por carteira ou credor." },
  { icon: Phone, title: "Discador Integrado", desc: "3CPlus nativo, click-to-call, gravações anexadas automaticamente à timeline do devedor." },
  { icon: Trophy, title: "Gamificação", desc: "Ranking, metas e RIVO Coins para engajar operadores e premiar performance real." },
  { icon: Globe, title: "Portal do Credor White-label", desc: "Seu credor acompanha recuperação em tempo real — com a marca da sua assessoria." },
  { icon: LineChart, title: "Analytics de Decisão", desc: "Funil, qualidade, performance por operador, credor e canal. Decisão baseada em dado." },
  { icon: Plug, title: "API REST + Workflows", desc: "Integre seu CRM, automatize disparos D-5/D0/D+30 e construa fluxos visuais." },
];

const Features = () => (
  <section id="recursos" className="bg-white">
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <div className="grid lg:grid-cols-3 gap-10 mb-12">
        <div className="lg:col-span-2">
          <div className="text-[11px] tracking-[0.18em] uppercase text-primary mb-3">Recursos</div>
          <h2 className={`${serif} text-5xl lg:text-6xl leading-[1] tracking-tight text-neutral-950`}>
            Tudo que sua operação<br />precisa, em <em className="italic text-primary">uma só tela</em>.
          </h2>
        </div>
        <p className="lg:pt-12 text-neutral-600 leading-relaxed">
          Pare de pagar 5 ferramentas separadas. WhatsApp, discador, score, portal, analytics e gamificação — todos sob o mesmo teto, conversando entre si.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-black/10 border border-black/10 rounded-2xl overflow-hidden">
        {features.map((f) => (
          <div key={f.title} className="bg-white p-7 hover:bg-neutral-50/70 transition group">
            <div className="w-10 h-10 rounded-lg bg-primary/10 ring-1 ring-primary/30 flex items-center justify-center mb-5 group-hover:bg-primary group-hover:text-white transition">
              <f.icon className="w-5 h-5 text-primary group-hover:text-white" strokeWidth={2} />
            </div>
            <h3 className="text-base font-semibold text-neutral-950 mb-2">{f.title}</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ───────── Como funciona ───────── */
const HowItWorks = () => {
  const steps = [
    { n: "01", t: "Importa carteira", d: "Upload CSV/XLSX ou via API. Múltiplos credores, múltiplas carteiras." },
    { n: "02", t: "IA prioriza", d: "Score de propensão classifica cada devedor. Operador atende quem paga." },
    { n: "03", t: "Operador negocia", d: "WhatsApp + discador + scripts de IA na mesma tela. Tudo registrado." },
    { n: "04", t: "Devedor paga", d: "Boleto, Pix ou portal de auto-negociação. Reconciliação automática." },
  ];
  return (
    <section className="bg-[#0b1220] text-white">
      <div className={`max-w-7xl mx-auto px-6 lg:px-10 py-20 relative ${grid} bg-[size:48px_48px]`}>
        <div className="text-[11px] tracking-[0.18em] uppercase text-primary mb-3">Como funciona</div>
        <h2 className={`${serif} text-5xl lg:text-6xl leading-[1] tracking-tight max-w-3xl`}>
          Da importação ao <em className="italic text-primary">acordo pago</em>,<br />em quatro passos.
        </h2>
        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              <div className={`${serif} text-7xl text-primary/40 leading-none`}>{s.n}</div>
              <div className="mt-4 text-lg font-semibold">{s.t}</div>
              <div className="mt-2 text-sm text-white/60 leading-relaxed">{s.d}</div>
              {i < steps.length - 1 && (
                <ArrowRight className="hidden lg:block absolute -right-3 top-8 w-5 h-5 text-primary/40" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ───────── Para quem ───────── */
const Personas = () => (
  <section id="para-quem" className="bg-white">
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <div className="text-[11px] tracking-[0.18em] uppercase text-primary mb-3">Para quem é</div>
      <h2 className={`${serif} text-5xl lg:text-6xl leading-[1] tracking-tight text-neutral-950 max-w-3xl`}>
        Cada papel da assessoria,<br /><em className="italic text-primary">com a ferramenta certa</em>.
      </h2>

      <div className="mt-14 grid md:grid-cols-3 gap-6">
        {[
          {
            role: "Dono / Diretor",
            icon: Sparkles,
            bullets: ["Visão executiva multi-credor", "Comissão e margem em tempo real", "Portal para vender mais carteiras"],
          },
          {
            role: "Supervisor",
            icon: Users,
            bullets: ["Ranking e gamificação dos times", "Qualidade de atendimento por operador", "Distribuição inteligente de carteira"],
          },
          {
            role: "Operador",
            icon: Trophy,
            bullets: ["Atendimento omnichannel em uma tela", "Score mostra quem ligar primeiro", "Comissão visível e gamificada"],
          },
        ].map((p) => (
          <div key={p.role} className="border border-black/10 rounded-2xl p-7 hover:border-primary/40 transition">
            <div className="flex items-center justify-between mb-6">
              <div className="text-sm font-medium text-neutral-500 uppercase tracking-wider">{p.role}</div>
              <p.icon className="w-5 h-5 text-primary" />
            </div>
            <ul className="space-y-3">
              {p.bullets.map(b => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-neutral-800">
                  <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ───────── Portal do credor ───────── */
const CredorPortal = () => (
  <section id="portal" className={`bg-[#FAFAF7] ${grid}`}>
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <div className="text-[11px] tracking-[0.18em] uppercase text-primary mb-3">Portal do credor</div>
        <h2 className={`${serif} text-5xl lg:text-6xl leading-[1] tracking-tight text-neutral-950`}>
          Seu credor acompanha em<br /><em className="italic text-primary">tempo real</em> — sem te ligar.
        </h2>
        <p className="mt-6 text-lg text-neutral-700 max-w-xl leading-relaxed">
          Portal white-label com a marca da sua assessoria. O credor vê carteira, baixas, acordos e prestação de contas — você ganha autoridade e fecha mais contratos.
        </p>
        <ul className="mt-8 space-y-3">
          {[
            "Marca, cor e domínio da sua assessoria",
            "Acesso por credor — multi-tenant seguro",
            "Devedor também negocia sozinho pelo portal",
            "Prestação de contas exportável (PDF/XLSX)",
          ].map(t => (
            <li key={t} className="flex items-center gap-3 text-neutral-800">
              <Check className="w-4 h-4 text-primary shrink-0" /> {t}
            </li>
          ))}
        </ul>
      </div>

      {/* Mockup mini-dashboard */}
      <div className="relative">
        <div className="bg-white rounded-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.2)] border border-black/5 overflow-hidden">
          <div className="bg-neutral-950 text-white px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-primary flex items-center justify-center text-[10px] font-bold">CR</div>
              <div className="text-sm font-medium">Portal · Banco Exemplo</div>
            </div>
            <div className="text-[10px] text-white/50 uppercase tracking-wider">tempo real</div>
          </div>
          <div className="p-5 grid grid-cols-2 gap-3">
            {[
              { l: "Recuperado mês", v: "R$ 487.230", d: "+18% vs mês anterior", c: "text-emerald-600" },
              { l: "Carteira ativa", v: "R$ 4,2 Mi", d: "12.840 contratos", c: "text-neutral-600" },
              { l: "Acordos vigentes", v: "1.284", d: "92% em dia", c: "text-primary" },
              { l: "Quitados", v: "342", d: "este mês", c: "text-emerald-600" },
            ].map(k => (
              <div key={k.l} className="border border-black/5 rounded-lg p-3 bg-neutral-50/40">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">{k.l}</div>
                <div className="text-xl font-semibold text-neutral-950 mt-1">{k.v}</div>
                <div className={`text-[11px] mt-0.5 ${k.c}`}>{k.d}</div>
              </div>
            ))}
          </div>
          <div className="px-5 pb-5">
            <div className="flex items-end gap-1.5 h-20">
              {[40, 55, 48, 70, 62, 85, 78, 92, 88, 95, 100, 90].map((h, i) => (
                <div key={i} className="flex-1 bg-primary/80 rounded-t" style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[9px] text-neutral-400 uppercase tracking-wider">
              <span>jan</span><span>dez</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

/* ───────── Planos ───────── */
const plans = [
  { name: "Starter", price: "R$ 497", per: "/mês", desc: "Para assessorias começando a digitalizar.", features: ["Até 3 operadores", "1 credor", "WhatsApp não oficial", "Score de IA básico", "Suporte por chat"], cta: "Começar grátis" },
  { name: "Growth", price: "R$ 1.497", per: "/mês", desc: "Para assessorias que querem escalar.", features: ["Até 15 operadores", "Multi-credor", "WhatsApp oficial + não oficial", "Discador 3CPlus", "Portal do credor", "Gamificação", "Analytics completo"], cta: "Agendar demo", featured: true },
  { name: "Enterprise", price: "Sob consulta", per: "", desc: "Operação multi-filial e alto volume.", features: ["Operadores ilimitados", "API REST + workflows", "SLA dedicado", "Onboarding assistido", "Customizações"], cta: "Falar com vendas" },
];

const Pricing = () => (
  <section id="planos" className="bg-white">
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <div className="text-center max-w-2xl mx-auto">
        <div className="text-[11px] tracking-[0.18em] uppercase text-primary mb-3">Planos</div>
        <h2 className={`${serif} text-5xl lg:text-6xl leading-[1] tracking-tight text-neutral-950`}>
          Escolha o plano <em className="italic text-primary">ideal</em>.
        </h2>
        <p className="mt-5 text-neutral-600 text-lg">Comece com 14 dias grátis. Sem cartão de crédito. Cancele quando quiser.</p>
      </div>

      <div className="mt-14 grid md:grid-cols-3 gap-6">
        {plans.map((p) => (
          <div key={p.name} className={`relative rounded-2xl p-8 border transition ${p.featured ? "bg-neutral-950 text-white border-neutral-950 shadow-2xl scale-[1.02]" : "bg-white border-black/10 hover:border-primary/40"}`}>
            {p.featured && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] tracking-[0.18em] uppercase px-3 py-1 rounded-full">Recomendado</span>
            )}
            <div className={`text-sm font-medium uppercase tracking-wider ${p.featured ? "text-primary" : "text-neutral-500"}`}>{p.name}</div>
            <div className={`mt-4 ${serif} text-5xl ${p.featured ? "text-white" : "text-neutral-950"}`}>
              {p.price}<span className={`text-sm font-sans ${p.featured ? "text-white/60" : "text-neutral-500"}`}>{p.per}</span>
            </div>
            <p className={`mt-2 text-sm ${p.featured ? "text-white/70" : "text-neutral-600"}`}>{p.desc}</p>
            <ul className="mt-6 space-y-2.5">
              {p.features.map(f => (
                <li key={f} className={`flex items-start gap-2.5 text-sm ${p.featured ? "text-white/90" : "text-neutral-800"}`}>
                  <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link to="/auth" className="block mt-8">
              <Button className={`w-full rounded-full h-11 text-sm font-medium ${p.featured ? "bg-primary hover:bg-primary/90 text-white" : "bg-neutral-950 hover:bg-neutral-800 text-white"}`}>
                {p.cta} <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ───────── FAQ ───────── */
const faqs = [
  { q: "Quanto tempo leva para colocar minha assessoria no ar?", a: "Em média 1 dia útil: importação da carteira, configuração do WhatsApp e treinamento do time. Onboarding assistido nos planos Growth e Enterprise." },
  { q: "Posso usar meus números atuais de WhatsApp?", a: "Sim. Suportamos WhatsApp oficial (Gupshup) e não oficial (Evolution, Wuzapi). Você escolhe o provedor por carteira ou credor." },
  { q: "Funciona com mais de um credor?", a: "Sim, é multi-credor por padrão. Cada credor tem visibilidade isolada via portal white-label, e operadores são atribuídos por carteira." },
  { q: "Vocês integram com discador?", a: "Sim, integração nativa com 3CPlus. Click-to-call, gravação anexada à timeline do devedor e métricas de produtividade telefônica." },
  { q: "Como funciona o score de IA?", a: "O score combina histórico de pagamento, comportamento na conversa, valor da dívida e tempo de inadimplência. Atualiza a cada interação." },
];

const FAQ = () => {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="bg-[#FAFAF7]">
      <div className="max-w-4xl mx-auto px-6 lg:px-10 py-20">
        <div className="text-[11px] tracking-[0.18em] uppercase text-primary mb-3">Perguntas frequentes</div>
        <h2 className={`${serif} text-5xl lg:text-6xl leading-[1] tracking-tight text-neutral-950`}>
          Ainda em <em className="italic text-primary">dúvida</em>?
        </h2>

        <div className="mt-12 divide-y divide-black/10 border-y border-black/10">
          {faqs.map((f, i) => (
            <button key={i} onClick={() => setOpen(open === i ? null : i)} className="w-full text-left py-5 flex items-start justify-between gap-6 group">
              <div className="flex-1">
                <div className="text-base font-medium text-neutral-950">{f.q}</div>
                <AnimatePresence>
                  {open === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="text-sm text-neutral-600 mt-3 leading-relaxed">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <ChevronDown className={`w-5 h-5 text-neutral-500 transition-transform mt-1 ${open === i ? "rotate-180" : ""}`} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ───────── CTA Final ───────── */
const FinalCTA = () => (
  <section className="bg-neutral-950 text-white relative overflow-hidden">
    <div className={`absolute inset-0 ${grid} opacity-[0.07]`} />
    <div className="relative max-w-5xl mx-auto px-6 lg:px-10 py-24 text-center">
      <h2 className={`${serif} text-5xl lg:text-7xl leading-[1] tracking-tight`}>
        Sua próxima carteira recuperada<br />começa <em className="italic text-primary">agora</em>.
      </h2>
      <p className="mt-6 text-lg text-white/70 max-w-2xl mx-auto">
        Agende uma demo de 30 minutos. Mostramos a plataforma com dados parecidos aos seus e você decide se faz sentido.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link to="/auth">
          <Button className="rounded-full bg-primary hover:bg-primary/90 text-white px-7 h-12 text-sm font-semibold shadow-[0_0_40px_rgba(255,127,0,0.4)]">
            Teste grátis 14 dias <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </Link>
        <a href="#recursos">
          <Button variant="outline" className="rounded-full border-white/20 bg-transparent text-white hover:bg-white/10 px-7 h-12 text-sm font-medium">
            Ver recursos
          </Button>
        </a>
      </div>
    </div>
  </section>
);

/* ───────── Footer ───────── */
const Footer = () => (
  <footer className="bg-[#0b1220] text-white/70 border-t border-white/10">
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 grid md:grid-cols-4 gap-8">
      <div className="md:col-span-2">
        <img src={logoImg} alt="RIVO CONNECT" className="h-10 w-auto mb-4 brightness-0 invert" />
        <p className="text-sm max-w-sm leading-relaxed">
          Plataforma operacional de IA para assessorias de cobrança. Multi-credor, omnichannel e segura.
        </p>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-white/50 mb-3">Produto</div>
        <ul className="space-y-2 text-sm">
          <li><a href="#recursos" className="hover:text-white">Recursos</a></li>
          <li><a href="#portal" className="hover:text-white">Portal do credor</a></li>
          <li><a href="#planos" className="hover:text-white">Planos</a></li>
          <li><Link to="/api-docs" className="hover:text-white">API REST</Link></li>
        </ul>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-white/50 mb-3">Empresa</div>
        <ul className="space-y-2 text-sm">
          <li><Link to="/auth" className="hover:text-white">Entrar</Link></li>
          <li><a href="mailto:contato@rivoconnect.com" className="hover:text-white">Fale conosco</a></li>
        </ul>
      </div>
    </div>
    <div className="border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5 flex flex-wrap justify-between gap-2 text-xs text-white/50">
        <div>© {new Date().getFullYear()} RIVO CONNECT. Todos os direitos reservados.</div>
        <div>LGPD compliant · Multi-tenant seguro</div>
      </div>
    </div>
  </footer>
);

/* ───────── Page ───────── */
const LandingPage = () => {
  return (
    <div className="min-h-screen bg-[#FAFAF7] text-neutral-900 antialiased">
      <Nav />
      <main>
        <Hero />
        <TargetBar />
        <BigNumbers />
        <Features />
        <HowItWorks />
        <Personas />
        <CredorPortal />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
