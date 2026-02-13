import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";

interface AudioRecorderProps {
  onRecorded: (blob: Blob) => void;
  disabled?: boolean;
}

const AudioRecorder = ({ onRecorded, disabled }: AudioRecorderProps) => {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm;codecs=opus" });
        onRecorded(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      // Permission denied or not available
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-destructive">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-xs font-medium">{formatDuration(duration)}</span>
        </div>
        <Button size="icon" variant="destructive" className="h-8 w-8" onClick={stopRecording}>
          <Square className="w-3 h-3" />
        </Button>
      </div>
    );
  }

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
};

export default AudioRecorder;
