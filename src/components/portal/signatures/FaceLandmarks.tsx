import { useState, useEffect, useRef, useCallback, RefObject } from "react";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

interface FaceLandmarksProps {
  primaryColor: string;
  videoRef: RefObject<HTMLVideoElement>;
}

interface LandmarkPoint {
  id: string;
  cx: number;
  cy: number;
  r: number;
  label: string;
}

const LANDMARK_INDICES = {
  eye_l: 159,
  eye_r: 386,
  nose: 1,
  mouth_l: 61,
  mouth_c: 13,
  mouth_r: 291,
  jaw_l: 234,
  jaw_r: 454,
};

const LANDMARK_META: Record<string, { r: number; label: string }> = {
  eye_l: { r: 6, label: "Olho E." },
  eye_r: { r: 6, label: "Olho D." },
  nose: { r: 5, label: "Nariz" },
  mouth_l: { r: 3.5, label: "" },
  mouth_c: { r: 4, label: "Boca" },
  mouth_r: { r: 3.5, label: "" },
  jaw_l: { r: 3, label: "" },
  jaw_r: { r: 3, label: "" },
};

const CONNECTIONS: [string, string][] = [
  ["eye_l", "eye_r"],
  ["eye_l", "nose"],
  ["eye_r", "nose"],
  ["nose", "mouth_c"],
  ["mouth_l", "mouth_c"],
  ["mouth_c", "mouth_r"],
  ["eye_l", "jaw_l"],
  ["eye_r", "jaw_r"],
  ["jaw_l", "nose"],
  ["jaw_r", "nose"],
  ["jaw_l", "mouth_l"],
  ["jaw_r", "mouth_r"],
];

const SVG_W = 300;
const SVG_H = 400;

const FaceLandmarks = ({ primaryColor, videoRef }: FaceLandmarksProps) => {
  const [points, setPoints] = useState<LandmarkPoint[]>([]);
  const [status, setStatus] = useState<"loading" | "detecting" | "detected" | "no_face">("loading");
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Initialize MediaPipe FaceLandmarker
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const resolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        if (cancelled) return;

        const faceLandmarker = await FaceLandmarker.createFromOptions(resolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });

        if (cancelled) {
          faceLandmarker.close();
          return;
        }

        landmarkerRef.current = faceLandmarker;
        setStatus("detecting");
      } catch (err) {
        console.error("FaceLandmarker init error:", err);
        if (!cancelled) setStatus("no_face");
      }
    };

    init();

    return () => {
      cancelled = true;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, []);

  // Detection loop
  const detect = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !landmarker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detect);
      return;
    }

    const now = performance.now();
    // Throttle to ~30fps
    if (now - lastTimeRef.current < 33) {
      rafRef.current = requestAnimationFrame(detect);
      return;
    }
    lastTimeRef.current = now;

    try {
      const results = landmarker.detectForVideo(video, now);

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        const newPoints: LandmarkPoint[] = [];

        for (const [id, index] of Object.entries(LANDMARK_INDICES)) {
          if (landmarks[index]) {
            const lm = landmarks[index];
            // Mirror horizontally (camera is mirrored with scaleX(-1))
            const cx = (1 - lm.x) * SVG_W;
            const cy = lm.y * SVG_H;
            const meta = LANDMARK_META[id];
            newPoints.push({ id, cx, cy, r: meta.r, label: meta.label });
          }
        }

        setPoints(newPoints);
        setStatus("detected");
      } else {
        setPoints([]);
        setStatus("no_face");
      }
    } catch {
      // Silently continue on detection errors
    }

    rafRef.current = requestAnimationFrame(detect);
  }, [videoRef]);

  useEffect(() => {
    if (status === "loading") return;

    rafRef.current = requestAnimationFrame(detect);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [status, detect]);

  const getPoint = (id: string) => points.find((p) => p.id === id);

  const hasPoints = points.length > 0;

  return (
    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ pointerEvents: "none" }}>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glowStrong">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Connection lines */}
      {hasPoints &&
        CONNECTIONS.map(([fromId, toId], i) => {
          const from = getPoint(fromId);
          const to = getPoint(toId);
          if (!from || !to) return null;
          return (
            <line
              key={i}
              x1={from.cx}
              y1={from.cy}
              x2={to.cx}
              y2={to.cy}
              stroke={primaryColor}
              strokeWidth="1.2"
              strokeDasharray="6 3"
              opacity={0.6}
            >
              <animate
                attributeName="stroke-dashoffset"
                from="18"
                to="0"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </line>
          );
        })}

      {/* Landmark points */}
      {points.map((lm) => (
        <g key={lm.id}>
          {/* Outer glow ring */}
          <circle
            cx={lm.cx}
            cy={lm.cy}
            r={lm.r + 4}
            fill="none"
            stroke={primaryColor}
            strokeWidth="1"
            opacity={0.4}
            filter="url(#glow)"
          >
            <animate attributeName="r" values={`${lm.r + 2};${lm.r + 6};${lm.r + 2}`} dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0.15;0.4" dur="2s" repeatCount="indefinite" />
          </circle>

          {/* Main point */}
          <circle
            cx={lm.cx}
            cy={lm.cy}
            r={lm.r}
            fill={primaryColor}
            opacity={0.9}
            filter="url(#glowStrong)"
          >
            <animate attributeName="opacity" values="0.9;0.6;0.9" dur="1.5s" repeatCount="indefinite" />
          </circle>

          {/* Inner dot */}
          <circle cx={lm.cx} cy={lm.cy} r={1.5} fill="white" opacity={0.9} />

          {/* Label */}
          {lm.label && (
            <text
              x={lm.cx + 10}
              y={lm.cy - 5}
              fill="white"
              fontSize="9"
              fontWeight="600"
              opacity={0.9}
              style={{ textShadow: `0 0 6px ${primaryColor}` }}
            >
              {lm.label}
            </text>
          )}
        </g>
      ))}

      {/* Detection status badge */}
      <foreignObject x="75" y="355" width="150" height="30">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            backgroundColor: status === "detected" ? `${primaryColor}30` : "rgba(0,0,0,0.5)",
            borderRadius: 20,
            padding: "3px 10px",
            border: `1px solid ${status === "detected" ? primaryColor : "rgba(255,255,255,0.2)"}`,
            transition: "all 0.5s ease",
          }}
        >
          {status === "detected" ? (
            <CheckCircle2 style={{ width: 12, height: 12, color: primaryColor }} />
          ) : status === "no_face" ? (
            <AlertCircle style={{ width: 12, height: 12, color: "#ef4444" }} />
          ) : (
            <Loader2 style={{ width: 12, height: 12, color: primaryColor, animation: "spin 1s linear infinite" }} />
          )}
          <span style={{ fontSize: 10, fontWeight: 600, color: "white" }}>
            {status === "detected"
              ? "Rosto detectado"
              : status === "no_face"
              ? "Posicione seu rosto"
              : "Carregando modelo..."}
          </span>
        </div>
      </foreignObject>
    </svg>
  );
};

export default FaceLandmarks;
