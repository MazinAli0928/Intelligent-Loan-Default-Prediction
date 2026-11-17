export function MetricCard({
  label,
  value,
  change
}: {
  label: string;
  value: string;
  change: string;
}) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{change}</small>
    </article>
  );
}
