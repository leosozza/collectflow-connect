import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle2, AlertCircle, Loader2, ScanFace } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SignatureFacialProps {
  onConfirm: (photos: string[]) => void;
  loading?: boolean;
  primaryColor?: string;
}

const INSTRUCTIONS = [
  { text: "Olhe para frente", icon: "👤", duration: 3000 },
  { text: "Vire levemente para a esquerda", icon: "👈", duration: 3000 },
  { text: "Sorria", icon: "😊", duration: 3000 },
];

const FaceOverlay = ({ primaryColor, instruction, countdown }: { primaryColor: string; instruction: typeof INSTRUCTIONS[0]; countdown: number }) => (
  <div className="absolute inset-0 pointer-events-none">
    {/* Face guide oval */}
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        className="w-[55%] h-[70%] rounded-full border-[3px] border-dashed"
        style={{ borderColor: primaryColor, boxShadow: `0 0 30px ${primaryColor}40, inset 0 0 30px ${primaryColor}10` }}
      />
    </div>

    {/* Corner brackets */}
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 400">
      <path d="M60,80 L60,50 Q60,40 70,40 L100,40" fill="none" stroke={primaryColor} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M240,80 L240,50 Q240,40 230,40 L200,40" fill="none" stroke={primaryColor} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M60,320 L60,350 Q60,360 70,360 L100,360" fill="none" stroke={primaryColor} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M240,320 L240,350 Q240,360 230,360 L200,360" fill="none" stroke={primaryColor} strokeWidth="2.5" strokeLinecap="round" />
    </svg>

    {/* Scanning line animation */}
    <div className="absolute left-[22%] right-[22%] animate-pulse" style={{ top: "30%", height: 2, background: `linear-gradient(90deg, transparent, ${primaryColor}, transparent)` }} />

    {/* Face landmark dots */}
    <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 300 400">
      {/* Eyes */}
      <circle cx="120" cy="170" r="3" fill={primaryColor} className="animate-pulse" />
      <circle cx="180" cy="170" r="3" fill={primaryColor} className="animate-pulse" />
      {/* Nose */}
      <circle cx="150" cy="210" r="2.5" fill={primaryColor} className="animate-pulse" />
      {/* Mouth corners */}
      <circle cx="125" cy="250" r="2" fill={primaryColor} className="animate-pulse" />
      <circle cx="175" cy="250" r="2" fill={primaryColor} className="animate-pulse" />
      {/* Face contour */}
      <circle cx="90" cy="200" r="2" fill={primaryColor} className="animate-pulse" />
      <circle cx="210" cy="200" r="2" fill={primaryColor} className="animate-pulse" />
      {/* Connecting lines */}
      <line x1="120" y1="170" x2="180" y2="170" stroke={primaryColor} strokeWidth="0.5" strokeDasharray="4 4" />
      <line x1="120" y1="170" x2="150" y2="210" stroke={primaryColor} strokeWidth="0.5" strokeDasharray="4 4" />
      <line x1="180" y1="170" x2="150" y2="210" stroke={primaryColor} strokeWidth="0.5" strokeDasharray="4 4" />
    </svg>

    {/* Top HUD - ID verified style */}
    <div className="absolute top-3 left-0 right-0 flex justify-center">
      <div className="bg-background/80 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-2 border border-border/50">
        <ScanFace className="w-4 h-4" style={{ color: primaryColor }} />
        <span className="text-xs font-medium text-foreground">Verificação facial</span>
      </div>
    </div>

    {/* Left side progress bars */}
    <div className="absolute left-3 top-1/2 -translate-y-1/2 space-y-1.5">
      {INSTRUCTIONS.map((inst, i) => {
        const instrIndex = INSTRUCTIONS.indexOf(instruction);
        const completed = i < instrIndex;
        const active = i === instrIndex;
        return (
          <div key={i} className="flex items-center gap-1.5">
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: completed ? 28 : active ? 20 : 12,
                backgroundColor: completed ? primaryColor : active ? `${primaryColor}90` : `${primaryColor}30`,
              }}
            />
          </div>
        );
      })}
    </div>

    {/* Bottom instruction panel */}
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/80 via-foreground/50 to-transparent pt-12 pb-4 px-4 text-center">
      <p className="text-3xl mb-1">{instruction.icon}</p>
      <p className="font-semibold text-background text-sm">{instruction.text}</p>
      <div className="flex items-center justify-center gap-2 mt-2">
        <div
          className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold"
          style={{ borderColor: primaryColor, color: primaryColor }}
        >
          {countdown}
        </div>
        <span className="text-background/70 text-xs">capturando...</span>
      </div>
    </div>
  </div>
);

const SignatureFacial = ({ onConfirm, loading, primaryColor = "#F97316" }: SignatureFacialProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [step, setStep] = useState<"idle" | "capturing" | "done" | "error">("idle");
  const [currentInstruction, setCurrentInstruction] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [countdown, setCountdown] = useState(3);
  const [errorMsg, setErrorMsg] = useState("");
  const [flashActive, setFlashActive] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 480, height: 640 },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStep("capturing");
      setCurrentInstruction(0);
      setPhotos([]);
    } catch {
      setStep("error");
      setErrorMsg("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    }
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video) return "";
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.8);
  }, []);

  useEffect(() => {
    if (step !== "capturing") return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Flash effect
          setFlashActive(true);
          setTimeout(() => setFlashActive(false), 200);

          const photo = captureFrame();
          setPhotos((prevPhotos) => {
            const newPhotos = [...prevPhotos, photo];
            if (newPhotos.length >= INSTRUCTIONS.length) {
              setStep("done");
              stream?.getTracks().forEach((t) => t.stop());
              clearInterval(timer);
            } else {
              setCurrentInstruction((ci) => ci + 1);
            }
            return newPhotos;
          });
          return 3;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step, captureFrame, stream]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  if (step === "error") {
    return (
      <div className="text-center space-y-4 p-6">
        <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
        <p className="text-sm text-muted-foreground">{errorMsg}</p>
        <Button variant="outline" onClick={() => { setStep("idle"); setErrorMsg(""); }}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (step === "idle") {
    return (
      <div className="text-center space-y-4 p-6">
        <div className="relative w-24 h-24 mx-auto">
          <div className="absolute inset-0 rounded-full border-2 border-dashed animate-spin" style={{ borderColor: `${primaryColor}40`, animationDuration: "8s" }} />
          <div className="absolute inset-2 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
            <ScanFace className="w-10 h-10" style={{ color: primaryColor }} />
          </div>
        </div>
        <div>
          <p className="font-medium text-foreground">Reconhecimento Facial</p>
          <p className="text-sm text-muted-foreground mt-1">
            Posicione seu rosto no guia oval e siga as 3 instruções para validar sua identidade.
          </p>
        </div>
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          {INSTRUCTIONS.map((inst, i) => (
            <div key={i} className="flex items-center gap-1">
              <span>{inst.icon}</span>
              <span>{inst.text}</span>
            </div>
          ))}
        </div>
        <Button onClick={startCamera} style={{ backgroundColor: primaryColor }} className="text-primary-foreground">
          <Camera className="w-4 h-4 mr-2" /> Iniciar Captura
        </Button>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto text-primary mb-2" />
          <p className="font-medium text-foreground">Fotos capturadas com sucesso!</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, i) => (
            <div key={i} className="rounded-lg overflow-hidden border">
              <img src={photo} alt={`Captura ${i + 1}`} className="w-full h-auto" />
              <p className="text-xs text-center py-1 text-muted-foreground">{INSTRUCTIONS[i].text}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => { setStep("idle"); setPhotos([]); }}>
            Refazer
          </Button>
          <Button
            className="flex-1"
            style={{ backgroundColor: primaryColor }}
            disabled={loading}
            onClick={() => onConfirm(photos)}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            {loading ? "Registrando..." : "Confirmar"}
          </Button>
        </div>
      </div>
    );
  }

  // Capturing state
  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden bg-foreground/90" style={{ aspectRatio: "3/4" }}>
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

        {/* Flash effect */}
        {flashActive && <div className="absolute inset-0 bg-background/90 z-20 transition-opacity" />}

        {/* Face overlay with guide */}
        <FaceOverlay
          primaryColor={primaryColor}
          instruction={INSTRUCTIONS[currentInstruction]}
          countdown={countdown}
        />
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progresso de verificação</span>
          <span className="font-medium">{currentInstruction + 1}/{INSTRUCTIONS.length}</span>
        </div>
        <Progress value={((currentInstruction) / INSTRUCTIONS.length) * 100} className="h-1.5" />
        <div className="flex justify-between">
          {INSTRUCTIONS.map((inst, i) => (
            <div key={i} className="flex items-center gap-1 text-xs">
              {i < currentInstruction ? (
                <CheckCircle2 className="w-3 h-3 text-primary" />
              ) : i === currentInstruction ? (
                <Loader2 className="w-3 h-3 animate-spin" style={{ color: primaryColor }} />
              ) : (
                <div className="w-3 h-3 rounded-full border border-muted-foreground/30" />
              )}
              <span className={i <= currentInstruction ? "text-foreground" : "text-muted-foreground/50"}>{inst.icon}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SignatureFacial;
