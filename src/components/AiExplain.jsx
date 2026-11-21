import { useEffect, useState } from 'react';
import { SparkIcon } from './Icons.jsx';

const VERDICT = {
  normal: { label: 'Normal', cls: 'v-ok' },
  worth_knowing: { label: 'Worth knowing', cls: 'v-warn' },
  concerning: { label: 'Concerning', cls: 'v-bad' },
};

// Only the facts Gemini needs, as plain data
function payload(details) {
  return {
    city: details.city,
    country: details.country,
    groups: details.groups.map((g) => ({
      name: g.name,
      category: g.category,
      domains: g.domains,
      network: g.network,
      apps: g.apps.map(([name]) => name),
      ports: g.ports,
      active: g.active,
    })),
  };
}

export function KeyForm({ onSaved }) {
  const [key, setKey] = useState('');
  const [err, setErr] = useState(null);
  async function save() {
    const r = await window.watchtower.ai.setKey(key);
    if (r.ok) onSaved();
    else setErr(r.error);
  }
  return (
    <div className="ai-key">
      <div>Add a free Gemini API key to get explanations. Get one at <b>aistudio.google.com</b> → Get API key.</div>
      <div className="ai-key-row">
        <input type="password" placeholder="Paste your Gemini API key" value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        <button onClick={save} disabled={!key.trim()}>Save</button>
      </div>
      {err && <div className="ai-err">{err}</div>}
      <div className="muted">Saved only on this PC.</div>
    </div>
  );
}

export default function AiExplain({ details }) {
  const [state, setState] = useState({ status: 'loading' });
  const [nonce, setNonce] = useState(0);
  // Re-ask only when what's at this place actually changes, not on every poll
  const sig = JSON.stringify([details.city, details.country, details.groups.map((g) => [g.name, g.domains.length, g.apps.length, g.category])]);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    window.watchtower.ai.explainPlace(payload(details)).then((r) => {
      if (!alive) return;
      if (r.ok) setState({ status: 'done', result: r.result });
      else setState({ status: r.code === 'NO_KEY' ? 'nokey' : r.code === 'AI_OFF' ? 'off' : 'error', error: r.error });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, nonce]);

  return (
    <div className="ai-box">
      <div className="ai-head">
        <SparkIcon width={14} height={14} /> Gemini explains
        {state.status === 'done' && <span className={`verdict ${VERDICT[state.result.verdict]?.cls || ''}`}>{VERDICT[state.result.verdict]?.label || state.result.verdict}</span>}
      </div>
      {state.status === 'loading' && (
        <div className="ai-loading">
          <span className="shimmer" style={{ width: '70%' }} />
          <span className="shimmer" style={{ width: '95%' }} />
          <span className="shimmer" style={{ width: '82%' }} />
        </div>
      )}
      {state.status === 'done' && (
        <>
          <div className="ai-headline">{state.result.headline}</div>
          <p className="ai-text">{state.result.explanation}</p>
          <div className="ai-advice">→ {state.result.advice}</div>
        </>
      )}
      {state.status === 'nokey' && <KeyForm onSaved={() => setNonce((n) => n + 1)} />}
      {state.status === 'off' && <div className="ai-text">AI explanations are turned off in Settings.</div>}
      {state.status === 'error' && (
        <div className="ai-err">
          Couldn't get an explanation: {state.error}{' '}
          <button className="link" onClick={() => setNonce((n) => n + 1)}>Try again</button>
        </div>
      )}
    </div>
  );
}
