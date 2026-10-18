import type { ModelCard } from '../api/types';

/** Versions section (DESIGN.md section 9.12), derived from the card when the API sends no such section. */
function Versions({ card }: { card: ModelCard }) {
  const rows: [string, string][] = [
    ['Model', card.model ? `${card.model.model_id} ${card.model.model_version}` : 'No model'],
    ['Preprocessing', card.preprocessing?.version ?? '—'],
    ['Card updated', card.updated_at ?? '—'],
  ];
  return (
    <section>
      <h3>Versions</h3>
      <dl className="facts">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Ledger rendering of /model-card: sections, numbered limitation footnotes, versions. */
export function ModelCardView({ card }: { card: ModelCard }) {
  const hasVersions = card.sections.some((s) => s.section_id === 'versions');
  return (
    <div>
      {card.status === 'draft' ? (
        <p>
          <span className="stamp">Draft</span>
        </p>
      ) : null}
      {card.sections.map((s) => (
        <section key={s.section_id}>
          <h3>{s.title}</h3>
          {s.body.split(/\n{2,}/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </section>
      ))}
      <section>
        <h3>Limitations</h3>
        <ol className="footnotes">
          {card.limitations.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
      </section>
      {hasVersions ? null : <Versions card={card} />}
    </div>
  );
}
