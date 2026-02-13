import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, CheckCircle2, PenTool } from "lucide-react";

interface SignatureDrawProps {
  onConfirm: (imageData: string) => void;
  loading?: boolean;
  primaryColor?: string;
  fullscreen?: boolean;
}

const SignatureDraw = ({ onConfirm, loading, primaryColor = "#F97316", fullscreen = false }: SignatureDrawProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    initCanvas();
    setHasDrawn(false);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onConfirm(dataUrl);
  };

  if (fullscreen) {
    return (
      <div ref={containerRef} className="absolute inset-0 flex flex-col bg-background">
        {/* Header bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <PenTool className="w-4 h-4" style={{ color: primaryColor }} />
            <span className="font-medium text-foreground">Assinatura Digital</span>
          </div>
          <Button variant="ghost" size="sm" onClick={clearCanvas}>
            <Eraser className="w-4 h-4 mr-1" /> Limpar
          </Button>
        </div>

        {/* Canvas area - fills remaining space */}
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-2 rounded-xl border-2 border-dashed overflow-hidden bg-white" style={{ borderColor: `${primaryColor}40` }}>
            <canvas
              ref={canvasRef}
              width={800}
              height={400}
              className="w-full h-full cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          {!hasDrawn && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-muted-foreground/40 text-sm">Desenhe sua assinatura aqui</p>
            </div>
          )}
        </div>

        {/* Confirm button */}
        <div className="px-3 py-2 border-t shrink-0">
          <Button
            className="w-full"
            style={{ backgroundColor: primaryColor }}
            disabled={!hasDrawn || loading}
            onClick={handleConfirm}
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            {loading ? "Registrando..." : "Confirmar Assinatura"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <PenTool className="w-4 h-4" style={{ color: primaryColor }} />
        <span>Desenhe sua assinatura no campo abaixo usando o dedo ou caneta</span>
      </div>

      <div className="rounded-xl border-2 border-dashed overflow-hidden bg-white" style={{ borderColor: `${primaryColor}40` }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full cursor-crosshair touch-none"
          style={{ height: "180px" }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={clearCanvas} className="flex-1">
          <Eraser className="w-4 h-4 mr-2" /> Limpar
        </Button>
        <Button
          className="flex-1"
          style={{ backgroundColor: primaryColor }}
          disabled={!hasDrawn || loading}
          onClick={handleConfirm}
        >
          <CheckCircle2 className="w-5 h-5 mr-2" />
          {loading ? "Registrando..." : "Confirmar Assinatura"}
        </Button>
      </div>
    </div>
  );
};

export default SignatureDraw;
