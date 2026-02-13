import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Percent, CreditCard, Handshake, Shield, CheckCircle2 } from "lucide-react";
import { formatCPF } from "@/lib/formatters";
import { motion } from "framer-motion";

interface PortalHeroProps {
  tenantName?: string;
  primaryColor?: string;
  settings?: Record<string, unknown>;
  onSearch: (cpf: string) => void;
  loading?: boolean;
}

const PortalHero = ({ tenantName, primaryColor, settings, onSearch, loading }: PortalHeroProps) => {
  const [cpf, setCpf] = useState("");

  const heroTitle = (settings?.portal_hero_title as string) || "";
  const heroSubtitle = (settings?.portal_hero_subtitle as string) || "Consulte suas pendências e encontre as melhores condições de pagamento.";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cpf.replace(/\D/g, "");
    if (clean.length === 11) onSearch(clean);
  };

  const color = primaryColor || "#F97316";

  const benefits = [
    { icon: Percent, title: "Descontos exclusivos", desc: "Até 90% de desconto para pagamento à vista" },
    { icon: CreditCard, title: "Parcelamento facilitado", desc: "Divida em até 12x no cartão ou PIX" },
    { icon: Handshake, title: "Negocie online", desc: "Faça sua proposta 100% digital, sem sair de casa" },
  ];

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
  };

  return (
    <div className="space-y-16 py-8 md:py-12">
      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          {/* Left - Text & CPF */}
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"
              style={{ backgroundColor: `${color}15`, color }}
            >
              <Shield className="w-4 h-4" />
              Negocie online com segurança
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight text-foreground">
              {heroTitle || (
                <>
                  Negocie suas dívidas{" "}
                  <span style={{ color }}>com até 90% de desconto</span>
                </>
              )}
            </h1>

            <p className="text-lg text-muted-foreground max-w-lg">
              {heroSubtitle}
            </p>

            {/* CPF Card */}
            <Card className="shadow-lg border-0 bg-card max-w-md">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-foreground mb-3">
                  Digite seu CPF para consultar:
                </p>
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Input
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                    maxLength={14}
                    className="h-12 text-base bg-background"
                  />
                  <Button
                    type="submit"
                    disabled={loading || cpf.replace(/\D/g, "").length !== 11}
                    size="lg"
                    className="h-12 px-6 font-semibold text-white shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    <Search className="w-4 h-4 mr-2" />
                    {loading ? "..." : "Consultar"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" style={{ color }} /> Rápido
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" style={{ color }} /> Seguro
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" style={{ color }} /> 100% Online
              </span>
            </div>
          </motion.div>

          {/* Right - Decorative */}
          <motion.div
            className="hidden md:flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative w-80 h-80">
              {/* Large circle */}
              <div
                className="absolute inset-0 rounded-full opacity-10"
                style={{ backgroundColor: color }}
              />
              {/* Medium circle */}
              <div
                className="absolute top-8 left-8 right-8 bottom-8 rounded-full opacity-15"
                style={{ backgroundColor: color }}
              />
              {/* Icon center */}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-2xl flex items-center justify-center text-white shadow-xl"
                style={{ backgroundColor: color }}
              >
                <Handshake className="w-12 h-12" />
              </div>
              {/* Floating badges */}
              <div className="absolute top-6 right-4 bg-card shadow-lg rounded-xl px-4 py-2 text-sm font-semibold text-foreground border">
                💰 Até 90% off
              </div>
              <div className="absolute bottom-10 left-0 bg-card shadow-lg rounded-xl px-4 py-2 text-sm font-semibold text-foreground border">
                ✅ Sem burocracia
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-6">
          {benefits.map((b, i) => (
            <motion.div
              key={i}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
            >
              <Card className="text-center border-0 shadow-sm hover:shadow-md transition-shadow bg-card">
                <CardContent className="pt-8 pb-6 space-y-4">
                  <div
                    className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
                    style={{ backgroundColor: `${color}15`, color }}
                  >
                    <b.icon className="w-7 h-7" />
                  </div>
                  <h3 className="font-semibold text-lg text-foreground">{b.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default PortalHero;
