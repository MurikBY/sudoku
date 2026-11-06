type LabeledMetricProps = {
  label: string;
  value: string | number;
  layout: "stacked" | "inline";
};

export function LabeledMetric({ label, value, layout }: LabeledMetricProps) {
  if (layout === "stacked") {
    return (
      <div>
        <p className="text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-medium tabular-nums">{value}</p>
      </div>
    );
  }
  return (
    <span>
      <span className="text-muted-foreground">{label} </span>
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}
