import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
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

const SignatureFacial = ({ onConfirm, loading, primaryColor = "#F97316" }: SignatureFacialProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [step, setStep] = useState<"idle" | "capturing" | "done" | "error">("idle");
  const [currentInstruction, setCurrentInstruction] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [countdown, setCountdown] = useState(3);
  const [errorMsg, setErrorMsg] = useState("");

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 480, height: 360 },
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
    canvas.height = video.videoHeight || 360;
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
          // Capture photo
          const photo = captureFrame();
          setPhotos((prevPhotos) => {
            const newPhotos = [...prevPhotos, photo];
            if (newPhotos.length >= INSTRUCTIONS.length) {
              setStep("done");
              // Stop camera
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
        <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
          <Camera className="w-10 h-10" style={{ color: primaryColor }} />
        </div>
        <div>
          <p className="font-medium text-foreground">Reconhecimento Facial</p>
          <p className="text-sm text-muted-foreground mt-1">
            Vamos capturar 3 fotos seguindo instruções simples para validar sua identidade.
          </p>
        </div>
        <Button onClick={startCamera} style={{ backgroundColor: primaryColor }}>
          <Camera className="w-4 h-4 mr-2" /> Iniciar Captura
        </Button>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-2" />
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
    <div className="space-y-4">
      <div className="relative rounded-xl overflow-hidden border-2" style={{ borderColor: primaryColor }}>
        <video ref={videoRef} autoPlay playsInline muted className="w-full" />
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-3 text-center">
          <p className="text-2xl mb-1">{INSTRUCTIONS[currentInstruction]?.icon}</p>
          <p className="font-medium">{INSTRUCTIONS[currentInstruction]?.text}</p>
          <p className="text-xs opacity-80">Capturando em {countdown}s...</p>
        </div>
      </div>
      <Progress value={((currentInstruction) / INSTRUCTIONS.length) * 100} className="h-2" />
      <p className="text-xs text-center text-muted-foreground">
        Foto {currentInstruction + 1} de {INSTRUCTIONS.length}
      </p>
    </div>
  );
};

export default SignatureFacial;
