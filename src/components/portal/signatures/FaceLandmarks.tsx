import { useState, useEffect } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

interface FaceLandmarksProps {
  primaryColor: string;
}

const LANDMARKS = [
  { id: "eye_l", cx: 120, cy: 170, r: 6, label: "Olho E.", lx: 85, ly: 165 },
  { id: "eye_r", cx: 180, cy: 170, r: 6, label: "Olho D.", lx: 195, ly: 165 },
  { id: "nose", cx: 150, cy: 215, r: 5, label: "Nariz", lx: 160, ly: 220 },
  { id: "mouth_l", cx: 125, cy: 255, r: 3.5, label: "", lx: 0, ly: 0 },
  { id: "mouth_c", cx: 150, cy: 260, r: 4, label: "Boca", lx: 160, ly: 268 },
  { id: "mouth_r", cx: 175, cy: 255, r: 3.5, label: "", lx: 0, ly: 0 },
  { id: "jaw_l", cx: 90, cy: 200, r: 3, label: "", lx: 0, ly: 0 },
  { id: "jaw_r", cx: 210, cy: 200, r: 3, label: "", lx: 0, ly: 0 },
];

const CONNECTIONS = [
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

const FaceLandmarks = ({ primaryColor }: FaceLandmarksProps) => {
  const [detectedCount, setDetectedCount] = useState(0);
  const allDetected = detectedCount >= LANDMARKS.length;

  useEffect(() => {
    if (detectedCount >= LANDMARKS.length) return;
    const timer = setTimeout(() => {
      setDetectedCount((c) => c + 1);
    }, 350);
    return () => clearTimeout(timer);
  }, [detectedCount]);

  const getPoint = (id: string) => LANDMARKS.find((l) => l.id === id)!;

  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 400" style={{ pointerEvents: "none" }}>
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
      {CONNECTIONS.map(([fromId, toId], i) => {
        const from = getPoint(fromId);
        const to = getPoint(toId);
        const fromIdx = LANDMARKS.findIndex((l) => l.id === fromId);
        const toIdx = LANDMARKS.findIndex((l) => l.id === toId);
        const visible = detectedCount > fromIdx && detectedCount > toIdx;
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
            opacity={visible ? 0.6 : 0}
            style={{ transition: "opacity 0.5s ease" }}
          >
            {visible && (
              <animate
                attributeName="stroke-dashoffset"
                from="18"
                to="0"
                dur="1.5s"
                repeatCount="indefinite"
              />
            )}
          </line>
        );
      })}

      {/* Landmark points */}
      {LANDMARKS.map((lm, i) => {
        const visible = detectedCount > i;
        return (
          <g key={lm.id} style={{ transition: "opacity 0.4s ease, transform 0.4s ease" }} opacity={visible ? 1 : 0}>
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
                x={lm.lx}
                y={lm.ly}
                fill="white"
                fontSize="9"
                fontWeight="600"
                opacity={visible ? 0.9 : 0}
                style={{ transition: "opacity 0.5s ease 0.2s", textShadow: `0 0 6px ${primaryColor}` }}
              >
                {lm.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Detection status badge */}
      <foreignObject x="75" y="355" width="150" height="30">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            backgroundColor: allDetected ? `${primaryColor}30` : "rgba(0,0,0,0.5)",
            borderRadius: 20,
            padding: "3px 10px",
            border: `1px solid ${allDetected ? primaryColor : "rgba(255,255,255,0.2)"}`,
            transition: "all 0.5s ease",
          }}
        >
          {allDetected ? (
            <CheckCircle2 style={{ width: 12, height: 12, color: primaryColor }} />
          ) : (
            <Loader2 style={{ width: 12, height: 12, color: primaryColor, animation: "spin 1s linear infinite" }} />
          )}
          <span style={{ fontSize: 10, fontWeight: 600, color: "white" }}>
            {allDetected ? "Rosto detectado" : `Detectando... ${detectedCount}/${LANDMARKS.length}`}
          </span>
        </div>
      </foreignObject>
    </svg>
  );
};

export default FaceLandmarks;
