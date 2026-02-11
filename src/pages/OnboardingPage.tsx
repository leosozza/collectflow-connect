import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { fetchPlans, createTenant, Plan } from "@/services/tenantService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Building2, CreditCard, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const OnboardingPage = () => {
  const { user } = useAuth();
  const { refetch } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPlans().then(setPlans).catch(console.error);
  }, []);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleNameChange = (value: string) => {
    setCompanyName(value);
    setCompanySlug(generateSlug(value));
  };

  const handleCreate = async () => {
    if (!user || !companyName || !companySlug || !selectedPlan) return;
    setLoading(true);
    try {
      await createTenant(companyName, companySlug, selectedPlan, user.id);
      await refetch();
      toast({ title: "Empresa criada com sucesso!", description: "Bem-vindo ao CollectFlow Connect." });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Erro ao criar empresa", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[
            { num: 1, label: "Empresa", icon: Building2 },
            { num: 2, label: "Plano", icon: CreditCard },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  step >= s.num ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s.num ? <Check className="w-5 h-5" /> : s.num}
              </div>
              <span className={`text-sm font-medium ${step >= s.num ? "text-foreground" : "text-muted-foreground"}`}>
                {s.label}
              </span>
              {s.num < 2 && <ArrowRight className="w-4 h-4 text-muted-foreground mx-2" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card className="max-w-lg mx-auto">
            <CardHeader>
              <CardTitle>Criar sua empresa</CardTitle>
              <CardDescription>Informe os dados da sua empresa de cobrança</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da empresa</Label>
                <Input
                  id="name"
                  placeholder="Ex: Empresa de Cobranças ABC"
                  value={companyName}
                  onChange={(e) => handleNameChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Identificador (slug)</Label>
                <Input
                  id="slug"
                  placeholder="empresa-abc"
                  value={companySlug}
                  onChange={(e) => setCompanySlug(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Usado para identificar sua empresa no sistema</p>
              </div>
              <Button
                className="w-full"
                onClick={() => setStep(2)}
                disabled={!companyName || !companySlug}
              >
                Continuar
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">Escolha seu plano</h2>
              <p className="text-muted-foreground mt-1">Selecione o plano ideal para sua operação</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((p) => {
                const limits = p.limits as Record<string, any>;
                const features = (limits.features as string[]) || [];
                const isSelected = selectedPlan === p.id;
                return (
                  <Card
                    key={p.id}
                    className={`cursor-pointer transition-all ${
                      isSelected ? "ring-2 ring-primary border-primary" : "hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedPlan(p.id)}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{p.name}</CardTitle>
                        {p.slug === "professional" && <Badge>Popular</Badge>}
                      </div>
                      <CardDescription>
                        <span className="text-2xl font-bold text-foreground">{formatCurrency(p.price_monthly)}</span>
                        <span className="text-muted-foreground">/mês</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-primary" />
                          Até {limits.max_users} usuários
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-primary" />
                          Até {limits.max_clients?.toLocaleString()} clientes
                        </li>
                        {features.map((f: string) => (
                          <li key={f} className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-primary" />
                            {f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button onClick={handleCreate} disabled={!selectedPlan || loading}>
                {loading ? "Criando..." : "Criar empresa"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingPage;
