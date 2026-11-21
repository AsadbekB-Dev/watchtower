import { useEffect, useRef, useState } from 'react';
import { SparkIcon } from './Icons.jsx';
import { buildContext } from '../lib/context.js';

const MOOD = {
  calm: { label: 'All calm', cls: 'v-ok' },
  heads_up: { label: 'Heads up', cls: 'v-warn' },
  alert: { label: 'Needs a look', cls: 'v-bad' },
};

// Gemini's summary of what this PC has been doing, at the top of Who's Watching
export default function Briefing({ sensors, net }) {
  const [state, setState] = useState({ status: 'idle' });
  const started = useRef(false);

  async function run(force) {
    setState({ status: 'loading' });
    const r = await window.watchtower.ai.briefing(buildContext(sensors, net), force);
    if (r.ok) setState({ status: 'done', result: r.result, at: Date.now() });
    else setState({ status: r.code === 'NO_KEY' ? 'nokey' : r.code === 'AI_OFF' ? 'off' : 'error', error: r.error });
  }

  // Wait until the first scans are in so the briefing has real data to work with
  useEffect(() => {
    if (started.current || !sensors?.sessions || !net?.flows) return;
    started.current = true;
    run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensors, net]);

  if (state.status === 'off') return null;

  return (
    <section className="briefing">
      <div className="br-head">
        <span className="br-title"><SparkIcon width={14} height={14} /> Today's briefing</span>
        {state.status === 'done' && <span className={`verdict ${MOOD[state.result.mood]?.cls || ''}`}>{MOOD[state.result.mood]?.label}</span>}
        <span className="br-by">by Gemini</span>
        {(state.status === 'done' || state.status === 'error') && (
          <button className="link" onClick={() => run(true)}>Refresh</button>
        )}
      </div>

      {(state.status === 'idle' || state.status === 'loading') && (
        <div className="ai-loading">
          <span className="shimmer" style={{ width: '45%' }} />
          <span className="shimmer" style={{ width: '90%' }} />
          <span className="shimmer" style={{ width: '80%' }} />
        </div>
      )}
      {state.status === 'done' && (
        <div className="br-body">
          <div className="br-headline">{state.result.headline}</div>
          <ul>
            {state.result.points.slice(0, 3).map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          <div className="br-focus">→ {state.result.focus}</div>
        </div>
      )}
      {state.status === 'nokey' && <div className="ai-text">Add a Gemini API key in Settings to get a daily briefing.</div>}
      {state.status === 'error' && <div className="ai-err">Couldn't write the briefing: {state.error}</div>}
    </section>
  );
}
