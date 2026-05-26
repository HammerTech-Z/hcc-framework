import { useState, useEffect } from "react";

interface ChartColors {
  primary: string;
  success: string;
  error: string;
  muted: string;
  secondary: string;
  background: string;
}

function readColors(): ChartColors {
  const style = getComputedStyle(document.documentElement);
  return {
    primary: style.getPropertyValue("--accent").trim(),
    success: style.getPropertyValue("--success").trim(),
    error: style.getPropertyValue("--error").trim(),
    muted: style.getPropertyValue("--text-muted").trim(),
    secondary: style.getPropertyValue("--text-secondary").trim(),
    background: style.getPropertyValue("--bg-tertiary").trim(),
  };
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(readColors);

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readColors()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}
