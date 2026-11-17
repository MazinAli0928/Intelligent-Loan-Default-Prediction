"use client";

interface Driver {
  label: string;
  contribution: number;
  direction: string;
  value?: string;
}

export function DriverChart({ drivers = [] }: { drivers?: Driver[] }) {
  if (!drivers || drivers.length === 0) {
    return <div className="muted" style={{ padding: "12px 0" }}>No feature contributions available for this record.</div>;
  }

  return (
    <div>
      {drivers.map((driver) => {
        const isRisk = driver.direction === "risk" || driver.direction === "positive_risk" || driver.contribution > 0;
        const widthPct = Math.min(Math.abs(driver.contribution) * 100, 100);
        return (
          <div className="driver" key={driver.label} style={{ fontSize: 13, marginBottom: 8 }}>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {driver.label} {driver.value ? `(${driver.value})` : ""}
            </span>
            <div className={`bar ${isRisk ? "risk" : "protective"}`} style={{ height: 8, background: "#eef2f7", borderRadius: 4, overflow: "hidden" }}>
              <span style={{ 
                display: "block",
                height: "100%",
                background: isRisk ? "var(--risk-critical)" : "var(--risk-low)",
                width: `${widthPct}%` 
              }} />
            </div>
            <strong>
              {driver.contribution > 0 ? "+" : ""}
              {driver.contribution.toFixed(3)}
            </strong>
          </div>
        );
      })}
    </div>
  );
}
