import type { MetricsSnapshot } from '../api/types';
import { FactsBlock } from './ledger/FactsBlock';
import { InferenceBlock } from './ledger/InferenceBlock';
import { MacroAucLine } from './ledger/MacroAucLine';
import { MetricsTable } from './ledger/MetricsTable';

/** Ledger rendering of /metrics (DESIGN.md section 9.11). Prints no number when unavailable. */
export function MetricsLedger({ snapshot }: { snapshot: MetricsSnapshot }) {
  if (snapshot.status === 'unavailable') {
    return (
      <div>
        <p>
          <span className="stamp">Metrics unavailable</span>
        </p>
        <p className="reason">{snapshot.reason}</p>
      </div>
    );
  }
  return (
    <div>
      <FactsBlock snapshot={snapshot} />
      <MetricsTable rows={snapshot.per_finding ?? []} />
      {snapshot.macro_roc_auc ? <MacroAucLine macro={snapshot.macro_roc_auc} /> : null}
      <InferenceBlock inference={snapshot.inference} />
    </div>
  );
}
