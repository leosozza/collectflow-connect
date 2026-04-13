import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Pause, Play, Trash2, Send } from "lucide-react";

type RecorderState = "idle" | "recording" | "paused" | "preview";

interface AudioRecorderProps {
  onRecorded: (blob: Blob) => void;
  disabled?: boolean;
}

const AudioRecorder = ({ onRecorded, disabled }: AudioRecorderProps) => {
  const [state, setState] = useState<RecorderState>("idle");
  const [duration, setDuration] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cleanup = () => {
    clearTimer();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    blobRef.current = null;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setDuration(0);
    setState("idle");
  };

  useEffect(() => {
    return () => {
      clearTimer();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const startRecording = async () => {
    try {
      console.log("[AudioRecorder] Iniciando gravação...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const formats = [
        "audio/ogg;codecs=opus",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/aac"
      ];

      const mimeType = formats.find(f => MediaRecorder.isTypeSupported(f)) || "audio/webm";
      console.log("[AudioRecorder] Formato selecionado:", mimeType);

      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType,
        audioBitsPerSecond: 128000 
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        blobRef.current = blob;
        console.log("[AudioRecorder] Gravação finalizada. Tamanho:", blob.size, "MIME:", blob.type);
        
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setState("preview");
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setState("recording");
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err: any) {
      console.error("[AudioRecorder] Erro ao acessar microfone:", err);
    }
  };

  const pauseRecording = () => {
    mediaRecorderRef.current?.pause();
    clearTimer();
    setState("paused");
  };

  const resumeRecording = () => {
    mediaRecorderRef.current?.resume();
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    setState("recording");
  };

  const stopToPreview = () => {
    clearTimer();
    mediaRecorderRef.current?.stop();
    // onstop handler will transition to "preview"
  };

  const discard = () => {
    mediaRecorderRef.current?.stop();
    cleanup();
  };

  const sendAudio = () => {
    if (blobRef.current) {
      onRecorded(blobRef.current);
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    setDuration(0);
    setState("idle");
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // IDLE
  if (state === "idle") {
    return (
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0"
        onClick={startRecording}
        disabled={disabled}
        title="Gravar áudio"
      >
        <Mic className="w-4 h-4" />
      </Button>
    );
  }

  // RECORDING
  if (state === "recording") {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1.5 text-destructive">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-xs font-medium tabular-nums">{formatDuration(duration)}</span>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={pauseRecording} title="Pausar">
          <Pause className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={discard} title="Descartar">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  // PAUSED
  if (state === "paused") {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-muted-foreground" />
          <span className="text-xs font-medium tabular-nums">{formatDuration(duration)}</span>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={resumeRecording} title="Retomar">
          <Mic className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="default" className="h-7 w-7 bg-primary" onClick={stopToPreview} title="Ouvir">
          <Play className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={discard} title="Descartar">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  // PREVIEW
  return (
    <div className="flex items-center gap-1.5">
      <audio src={previewUrl!} controls className="h-8 max-w-[180px]" />
      <Button size="icon" variant="default" className="h-7 w-7 bg-[#25d366] hover:bg-[#1da851]" onClick={sendAudio} title="Enviar">
        <Send className="w-3.5 h-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={discard} title="Descartar">
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
};

export default AudioRecorder;
