import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function ScoreRing({
  score,
  size = 140,
  label = "Health",
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 75
      ? "oklch(0.72 0.18 155)"
      : score >= 50
        ? "oklch(0.78 0.16 75)"
        : "oklch(0.65 0.24 25)";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="oklch(0.24 0.02 262)"
          strokeWidth={10}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={10}
          fill="none"
          strokeDasharray={circumference}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{
            filter: `drop-shadow(0 0 8px ${color})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className={cn(
            "text-3xl font-bold tracking-tight",
            score >= 75
              ? "text-success"
              : score >= 50
                ? "text-warning"
                : "text-destructive",
          )}
        >
          {score}
        </motion.span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
          {label}
        </span>
      </div>
    </div>
  );
}
