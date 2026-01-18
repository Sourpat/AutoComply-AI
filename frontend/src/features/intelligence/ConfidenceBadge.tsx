import React from "react";

interface ConfidenceBadgeProps {
  score: number;
  band: 'high' | 'medium' | 'low';
  explanationFactors?: Array<{ factor: string; impact: string; weight?: number }>;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const bandConfig = {
  high: {
    bgClass: 'bg-emerald-900/40 border-emerald-700/70',
    textClass: 'text-emerald-200',
    dotClass: 'bg-emerald-400',
    label: 'High Confidence',
  },
  medium: {
    bgClass: 'bg-amber-900/40 border-amber-700/70',
    textClass: 'text-amber-200',
    dotClass: 'bg-amber-400',
    label: 'Medium Confidence',
  },
  low: {
    bgClass: 'bg-red-900/40 border-red-700/70',
    textClass: 'text-red-200',
    dotClass: 'bg-red-400',
    label: 'Low Confidence',
  },
};

/**
 * ConfidenceBadge Component
 * 
 * Displays decision confidence as a color-coded badge with optional tooltip
 * showing explanation factors.
 */
export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  score,
  band,
  explanationFactors = [],
  showTooltip = true,
  size = 'md',
}) => {
  const config = bandConfig[band];
  const [isHovered, setIsHovered] = React.useState(false);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <div className="relative inline-block">
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border ${config.bgClass} ${config.textClass} ${sizeClasses[size]} font-medium transition-all duration-200 ${showTooltip && explanationFactors.length > 0 ? 'cursor-help' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={showTooltip ? `${config.label}: ${score.toFixed(1)}%` : undefined}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
        <span>{config.label}</span>
        <span className="font-mono opacity-80">{score.toFixed(0)}%</span>
      </div>

      {/* Tooltip with explanation factors */}
      {showTooltip && explanationFactors.length > 0 && isHovered && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between border-b border-zinc-700/50 pb-2">
            <h4 className="text-xs font-semibold text-zinc-200">Confidence Factors</h4>
            <span className="text-xs text-zinc-400">{explanationFactors.length} factors</span>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {explanationFactors.slice(0, 10).map((factor, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 rounded border border-zinc-800/50 bg-zinc-950/50 p-2"
              >
                <div className="flex-1">
                  <div className="text-xs font-medium text-zinc-300">{factor.factor}</div>
                  <div className="mt-0.5 text-[10px] text-zinc-500">{factor.impact}</div>
                </div>
                {factor.weight !== undefined && (
                  <div className="text-[10px] font-mono text-zinc-400">
                    {factor.weight > 0 ? '+' : ''}{factor.weight}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
