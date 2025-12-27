interface LTVGaugeProps {
    ltv: number;
    marginCallLTV?: number;
    liquidationLTV?: number;
    showLabels?: boolean;
}

export default function LTVGauge({
    ltv,
    marginCallLTV = 75,
    liquidationLTV = 83,
    showLabels = true
}: LTVGaugeProps) {
    // Determine color based on LTV
    const getColorClass = () => {
        if (ltv >= liquidationLTV) return 'danger';
        if (ltv >= marginCallLTV) return 'warning';
        if (ltv >= 65) return 'caution';
        return 'safe';
    };

    // Cap visual width at 100%
    const fillWidth = Math.min(ltv, 100);

    return (
        <div className="ltv-container">
            {showLabels && (
                <div className="ltv-header">
                    <span className="ltv-label">LTV</span>
                    <span className={`ltv-value ${getColorClass()}`}>{ltv.toFixed(1)}%</span>
                </div>
            )}

            <div className="ltv-gauge">
                <div
                    className={`ltv-gauge-fill ${getColorClass()}`}
                    style={{ width: `${fillWidth}%` }}
                />

                {/* Threshold markers */}
                <div className="ltv-markers">
                    <div
                        className="ltv-marker"
                        style={{ left: '65%' }}
                        title="Initial LTV (65%)"
                    />
                    <div
                        className="ltv-marker margin-call"
                        style={{ left: `${marginCallLTV}%` }}
                        title={`Margin Call (${marginCallLTV}%)`}
                    />
                    <div
                        className="ltv-marker liquidation"
                        style={{ left: `${liquidationLTV}%` }}
                        title={`Liquidation (${liquidationLTV}%)`}
                    />
                </div>
            </div>

            {showLabels && (
                <div className="ltv-thresholds">
                    <span className="threshold safe">Safe</span>
                    <span className="threshold caution">Caution</span>
                    <span className="threshold warning">Warning</span>
                    <span className="threshold danger">Liquidation</span>
                </div>
            )}

            <style>{`
        .ltv-container {
          width: 100%;
        }

        .ltv-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-2);
        }

        .ltv-label {
          font-size: var(--font-size-sm);
          color: var(--color-text-tertiary);
        }

        .ltv-value {
          font-size: var(--font-size-lg);
          font-weight: 700;
        }

        .ltv-value.safe { color: var(--color-ltv-safe); }
        .ltv-value.caution { color: var(--color-ltv-caution); }
        .ltv-value.warning { color: var(--color-ltv-warning); }
        .ltv-value.danger { color: var(--color-ltv-danger); }

        .ltv-marker.margin-call {
          background: var(--color-ltv-warning);
        }

        .ltv-marker.liquidation {
          background: var(--color-ltv-danger);
        }

        .ltv-thresholds {
          display: flex;
          justify-content: space-between;
          margin-top: var(--space-2);
        }

        .threshold {
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
        }

        .threshold.safe { color: var(--color-ltv-safe); }
        .threshold.caution { color: var(--color-ltv-caution); }
        .threshold.warning { color: var(--color-ltv-warning); }
        .threshold.danger { color: var(--color-ltv-danger); }
      `}</style>
        </div>
    );
}
