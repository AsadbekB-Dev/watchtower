import { useEffect, useRef, useState } from 'react';
import { SparkIcon, TowerLogo } from '../components/Icons.jsx';
import { buildContext } from '../lib/context.js';

const SUGGESTIONS = [
  'What did my PC do last night?',
  'Which apps used my microphone this month?',
  'Am I being tracked right now?',
  "What's the most concerning thing you see?",
  'Which background programs touch my sensors?',
  'Where in the world is my data going?',
];

// Light formatting: paragraphs and "- " lists, no HTML from the model
function Answer({ text }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const rows = b.split('\n').filter(Boolean);
        if (rows.every((r) => /^\s*[-*•]\s+/.test(r))) {
          return (
            <ul key={i}>
              {rows.map((r, j) => (
                <li key={j}>{r.replace(/^\s*[-*•]\s+/, '').replace(/\*\*/g, '')}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{b.replace(/\*\*/g, '')}</p>;
      })}
    </>
  );
}

export default function Ask({ sensors, net, goSettings }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const end = useRef(null);

  useEffect(() => {
    window.watchtower.ai.status().then(setStatus);
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function ask(q) {
    const question = (q ?? input).trim();
    if (!question || busy) return;
    setInput('');
    const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setBusy(true);
    const r = await window.watchtower.ai.ask(question, buildContext(sensors, net), history);
    setBusy(false);
    setMessages((m) => [...m, r.ok ? { role: 'model', text: r.text } : { role: 'model', text: r.error, error: true, code: r.code }]);
  }

  const blocked = status && (!status.hasKey || !status.enabled);

  return (
    <div className="view ask-view">
      <header className="ask-head">
        <div className="eyebrow">Ask Watchtower</div>
        <h1 className="title">Ask anything about what your PC is doing.</h1>
        <p className="sub">Answers come from Gemini, using only what Watchtower has seen on this PC: sensor history and live connections.</p>
      </header>

      {blocked && (
        <div className="banner">
          {!status.enabled ? 'AI is turned off.' : 'Add a Gemini API key to start asking.'}{' '}
          <button className="link" onClick={goSettings}>Open Settings</button>
        </div>
      )}

      <div className="chat">
        {messages.length === 0 && (
          <div className="chat-empty">
            <TowerLogo width={44} height={44} />
            <div className="suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} disabled={busy || blocked}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}${m.error ? ' err' : ''}`}>
            {m.role === 'model' && <span className="msg-avatar"><SparkIcon width={14} height={14} /></span>}
            <div className="bubble">
              {m.role === 'model' && !m.error ? <Answer text={m.text} /> : m.text}
              {m.code === 'NO_KEY' && <button className="link" onClick={goSettings}> Open Settings</button>}
            </div>
          </div>
        ))}
        {busy && (
          <div className="msg model">
            <span className="msg-avatar"><SparkIcon width={14} height={14} /></span>
            <div className="bubble typing"><i /><i /><i /></div>
          </div>
        )}
        <div ref={end} />
      </div>

      <div className="composer">
        <input
          value={input}
          placeholder={blocked ? 'Add a Gemini key in Settings first' : 'e.g. Did anything use my camera while I was asleep?'}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          disabled={busy || blocked}
        />
        <button onClick={() => ask()} disabled={busy || blocked || !input.trim()}>Ask</button>
      </div>
    </div>
  );
}
