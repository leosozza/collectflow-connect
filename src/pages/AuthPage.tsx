import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Lock, User } from "lucide-react";
import rivoLogo from "@/assets/rivo_connect.png";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres").max(72),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(100),
});

const AuthPage = () => {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const [isLogin, setIsLogin] = useState(!inviteToken);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{ tenant_name: string; role: string } | null>(null);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (inviteToken) {
      supabase
        .from("invite_links")
        .select("role, tenant_id, tenants(name)")
        .eq("token", inviteToken)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setInviteInfo({
              tenant_name: (data as any).tenants?.name || "Empresa",
              role: data.role,
            });
          } else {
            toast.error("Convite inválido ou expirado");
          }
        });
    }
  }, [inviteToken]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const parsed = z.string().trim().email("E-mail inválido").parse(email);
      const { error } = await supabase.auth.resetPasswordForEmail(parsed, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(error.message || "Erro ao enviar link de recuperação");
      } else {
        toast.success("Link de recuperação enviado para seu e-mail!");
        setIsForgotPassword(false);
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      } else {
        toast.error("Erro inesperado");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isLogin) {
        const parsed = loginSchema.parse({ email, password });
        const { error } = await signIn(parsed.email, parsed.password);
        if (error) {
          if (error.message?.includes("Invalid login")) {
            toast.error("E-mail ou senha incorretos");
          } else if (error.message?.includes("Email not confirmed")) {
            toast.error("Confirme seu e-mail antes de fazer login");
          } else {
            toast.error(error.message || "Erro ao fazer login");
          }
        } else {
          toast.success("Login realizado!");
          navigate("/");
        }
      } else {
        const parsed = signupSchema.parse({ email, password, fullName });
        const { error, data: signUpData } = await signUp(parsed.email, parsed.password, parsed.fullName) as any;
        if (error) {
          if (error.message?.includes("already registered")) {
            toast.error("Este e-mail já está cadastrado");
          } else {
            toast.error(error.message || "Erro ao criar conta");
          }
        } else {
          // If invite token, accept invite
          if (inviteToken && signUpData?.user?.id) {
            try {
              await supabase.functions.invoke("accept-invite", {
                body: { token: inviteToken, user_id: signUpData.user.id },
              });
            } catch {
              // non-blocking
            }
          }
          toast.success("Conta criada! Verifique seu e-mail para confirmar.");
          setIsLogin(true);
        }
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      } else {
        toast.error("Erro inesperado");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-center mb-8">
          <img src={rivoLogo} alt="RIVO CONNECT" className="h-12 w-auto object-contain" />
        </div>

        <div className="bg-card rounded-2xl shadow-lg border border-border p-8">
          <h2 className="text-xl font-semibold text-card-foreground mb-1">
            {isForgotPassword ? "Recuperar Senha" : isLogin ? "Entrar" : "Criar Conta"}
          </h2>
          {inviteInfo && !isLogin && !isForgotPassword && (
            <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm text-foreground font-medium">
                Convite para <strong>{inviteInfo.tenant_name}</strong>
              </p>
              <p className="text-xs text-muted-foreground capitalize">Cargo: {inviteInfo.role}</p>
            </div>
          )}
          <p className="text-muted-foreground text-sm mb-6">
            {isForgotPassword
              ? "Digite seu e-mail para receber o link de recuperação"
              : isLogin
              ? "Acesse sua conta para continuar"
              : "Preencha os dados para criar sua conta"}
          </p>

          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-card-foreground">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="pl-10"
                    maxLength={255}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-card-foreground">Nome Completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Seu nome completo"
                      className="pl-10"
                      maxLength={100}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-card-foreground">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="pl-10"
                    maxLength={255}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-card-foreground">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                    maxLength={72}
                  />
                </div>
              </div>

              {isLogin && (
                <div className="text-right">
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => setIsForgotPassword(true)}
                  >
                    Esqueci minha senha
                  </button>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Carregando..." : isLogin ? "Entrar" : "Criar Conta"}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => { setIsLogin(!isLogin); setIsForgotPassword(false); }}
            >
              {isForgotPassword
                ? "Voltar ao login"
                : isLogin
                ? "Não tem conta? Criar agora"
                : "Já tem conta? Entrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
