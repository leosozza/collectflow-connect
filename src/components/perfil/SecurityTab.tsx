import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, Mail, Shield, ShieldCheck, ShieldOff, KeyRound, Eye, EyeOff } from "lucide-react";

const SecurityTab = () => {
  const { user } = useAuth();

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // 2FA
  const [mfaFactors, setMfaFactors] = useState<any[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<{ id: string; qr: string; secret: string; uri: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [loadingFactors, setLoadingFactors] = useState(true);

  // Reset password email
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    loadFactors();
  }, []);

  const loadFactors = async () => {
    setLoadingFactors(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setMfaFactors(data?.totp || []);
    } catch {
      // ignore
    } finally {
      setLoadingFactors(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar senha");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleEnroll2FA = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: user?.email || "Rivo Connect",
      });
      if (error) throw error;
      setEnrollData({
        id: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar 2FA");
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!enrollData || verifyCode.length !== 6) {
      toast.error("Digite o código de 6 dígitos");
      return;
    }
    setVerifying(true);
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: enrollData.id,
      });
      if (challengeErr) throw challengeErr;

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: enrollData.id,
        challengeId: challenge.id,
        code: verifyCode,
      });
      if (verifyErr) throw verifyErr;

      toast.success("Autenticação de dois fatores ativada!");
      setEnrollData(null);
      setVerifyCode("");
      await loadFactors();
    } catch (err: any) {
      toast.error(err.message || "Código inválido");
    } finally {
      setVerifying(false);
    }
  };

  const handleUnenroll2FA = async (factorId: string) => {
    setUnenrolling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast.success("2FA desativado com sucesso!");
      await loadFactors();
    } catch (err: any) {
      toast.error(err.message || "Erro ao desativar 2FA");
    } finally {
      setUnenrolling(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Email de redefinição enviado! Verifique sua caixa de entrada.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar email");
    } finally {
      setSendingReset(false);
    }
  };

  const activeFactors = mfaFactors.filter((f) => f.status === "verified");
  const has2FA = activeFactors.length > 0;

  return (
    <div className="space-y-6">
      {/* Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="w-5 h-5 text-primary" />
            Email de Login
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input value={user?.email || ""} disabled className="max-w-md" />
            <span className="text-xs text-muted-foreground">Somente leitura</span>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="w-5 h-5 text-primary" />
            Alterar Senha
          </CardTitle>
          <CardDescription>Defina uma nova senha para sua conta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md space-y-3">
            <div>
              <Label>Nova Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Confirmar Nova Senha</Label>
              <Input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
              />
            </div>
            <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword}>
              {changingPassword ? "Salvando..." : "Alterar Senha"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2FA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-primary" />
            Autenticação de Dois Fatores (2FA)
          </CardTitle>
          <CardDescription>
            Adicione uma camada extra de segurança usando um aplicativo autenticador (Google Authenticator, Authy, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingFactors ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : has2FA ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-700">2FA ativo</span>
              </div>
              {activeFactors.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">{f.friendly_name || "TOTP"}</p>
                    <p className="text-xs text-muted-foreground">Ativo desde a configuração</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleUnenroll2FA(f.id)}
                    disabled={unenrolling}
                  >
                    <ShieldOff className="w-4 h-4 mr-1" />
                    Desativar
                  </Button>
                </div>
              ))}
            </div>
          ) : enrollData ? (
            <div className="space-y-4 max-w-md">
              <p className="text-sm text-muted-foreground">
                Escaneie o QR code abaixo com seu aplicativo autenticador:
              </p>
              <div className="flex justify-center p-4 bg-white rounded-lg border border-border">
                <img src={enrollData.qr} alt="QR Code 2FA" className="w-48 h-48" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Chave manual (se não puder escanear):</Label>
                <code className="block mt-1 p-2 bg-muted rounded text-xs break-all font-mono">{enrollData.secret}</code>
              </div>
              <div>
                <Label>Código de verificação</Label>
                <Input
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="max-w-[200px] text-center text-lg tracking-widest font-mono"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleVerify2FA} disabled={verifying || verifyCode.length !== 6}>
                  {verifying ? "Verificando..." : "Verificar e Ativar"}
                </Button>
                <Button variant="outline" onClick={() => { setEnrollData(null); setVerifyCode(""); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={handleEnroll2FA} disabled={enrolling}>
              <ShieldCheck className="w-4 h-4 mr-1" />
              {enrolling ? "Configurando..." : "Ativar 2FA"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Reset Password by Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="w-5 h-5 text-primary" />
            Redefinir Senha por Email
          </CardTitle>
          <CardDescription>
            Receba um link de redefinição de senha no seu email cadastrado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleSendResetEmail} disabled={sendingReset}>
            {sendingReset ? "Enviando..." : "Enviar Email de Redefinição"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityTab;
