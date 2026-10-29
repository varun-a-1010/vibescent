import { useEffect, useState } from 'react';
import {
  api,
  toPhoto,
  type Entity,
  type Kind,
  type Photo,
  type Result,
  type Status,
  type Suggestion,
} from './api';

const KIND_LABEL: Record<string, string> = {
  person: 'Style icons',
  brand: 'Brands',
  artist: 'Music',
  movie: 'Movies',
  tv_show: 'TV',
  destination: 'Destinations',
};
const AVOID = ['sweet', 'smoky', 'floral', 'powdery', 'woody', 'citrus', 'musky'];
const REACTIONS: [string, string][] = [
  ['Too heavy', 'lighter, softer projection'],
  ['More woody', 'more woody'],
  ['Less sweet', 'less sweet'],
  ['Longer lasting', 'longer lasting'],
];
const BUDGETS: [string, number | undefined][] = [
  ['No limit', undefined],
  ['Under $50', 50],
  ['Under $120', 120],
  ['Under $250', 250],
];

export function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [budget, setBudget] = useState<number | undefined>(undefined);
  const [gender, setGender] = useState('any');
  const [avoid, setAvoid] = useState<string[]>([]);
  const [prefs, setPrefs] = useState('');
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [picked, setPicked] = useState<Entity[]>([]);
  const [off, setOff] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api
      .status()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };
  const look = () => [suggestion?.summary || text, answer].filter(Boolean).join(' — ');
  const recommend = (extraPrefs = prefs, deselected = off) =>
    run('Finding fragrances…', async () => {
      setResult(
        await api.recommend({
          look: look(),
          preferences: extraPrefs,
          budgetMaxUsd: budget,
          gender,
          excludeAccords: avoid,
          entities: picked,
          deselectedTagIds: deselected,
        }),
      );
    });
  const toggle = (e: Entity) =>
    setPicked((p) =>
      p.some((x) => x.entityId === e.entityId)
        ? p.filter((x) => x.entityId !== e.entityId)
        : p.length >= 5
          ? p
          : [...p, e],
    );
  const reset = () => {
    setSuggestion(null);
    setResult(null);
    setPicked([]);
    setOff([]);
    setAnswer('');
  };

  return (
    <main>
      <header>
        <h1>VibeScent</h1>
        <p>Tell us how you want to show up. We’ll find the fragrance that fits.</p>
        {status && (
          <small className="muted">
            Qloo {status.qloo ? '✓' : '✗'} · Gemini {status.gemini ? '✓' : '✗'} · Catalog:{' '}
            {status.catalog ?? 'not connected'}
            {status.catalog === 'dev-export' ? ' (local export)' : ''}
          </small>
        )}
      </header>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {busy && (
        <p className="muted" aria-live="polite">
          {busy}
        </p>
      )}

      {!suggestion && (
        <section className="card">
          <h2>1. Your look</h2>
          <label>
            What are you wearing and where are you headed?
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Boxy leather jacket, dark denim, rooftop bar on a cool night"
            />
          </label>
          <label>
            Or add an outfit photo (optional, not stored)
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                setPhoto(f ? await toPhoto(f).catch(() => null) : null);
              }}
            />
          </label>
          {photo && (
            <img
              className="thumb"
              alt="Your outfit"
              src={`data:${photo.mimeType};base64,${photo.data}`}
            />
          )}
          <div className="row">
            <label>
              Budget
              <select
                value={budget ?? ''}
                onChange={(e) => setBudget(e.target.value ? Number(e.target.value) : undefined)}
              >
                {BUDGETS.map(([l, v]) => (
                  <option key={l} value={v ?? ''}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              For
              <select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="any">Anyone</option>
                <option value="masculine">Masculine</option>
                <option value="feminine">Feminine</option>
                <option value="unisex">Unisex</option>
              </select>
            </label>
          </div>
          <fieldset>
            <legend>Nothing too…</legend>
            {AVOID.map((a) => (
              <button
                type="button"
                key={a}
                className={avoid.includes(a) ? 'chip on' : 'chip'}
                onClick={() =>
                  setAvoid((v) => (v.includes(a) ? v.filter((x) => x !== a) : [...v, a]))
                }
              >
                {a}
              </button>
            ))}
          </fieldset>
          <label>
            Anything else?{' '}
            <input
              value={prefs}
              onChange={(e) => setPrefs(e.target.value)}
              maxLength={500}
              placeholder="e.g. I hate anything that smells like candy"
            />
          </label>
          <button
            className="primary"
            disabled={!!busy || (!text.trim() && !photo) || !status?.gemini}
            onClick={() =>
              run('Reading your look…', async () => {
                setSuggestion(await api.suggest(text, photo ?? undefined));
                setPicked([]);
              })
            }
          >
            Continue
          </button>
        </section>
      )}

      {suggestion && !result && (
        <section className="card">
          <h2>2. Your cultural touchstones</h2>
          <p>
            <em>{suggestion.summary}</em>
          </p>
          {suggestion.followUp && (
            <label>
              {suggestion.followUp}
              <input value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={300} />
            </label>
          )}
          <p className="muted">
            Pick 1–5 that feel like you. They come from Qloo’s taste graph. ({picked.length}/5)
          </p>
          {(Object.entries(suggestion.carousels) as [Kind, Entity[]][]).map(([kind, list]) => (
            <div key={kind}>
              <h3>{KIND_LABEL[kind] ?? kind}</h3>
              <div className="carousel">
                {list.map((e) => (
                  <button
                    type="button"
                    key={e.entityId}
                    className={picked.some((x) => x.entityId === e.entityId) ? 'tile on' : 'tile'}
                    onClick={() => toggle(e)}
                  >
                    {e.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Custom onPick={toggle} />
          {picked
            .filter(
              (p) =>
                !Object.values(suggestion.carousels)
                  .flat()
                  .some((e) => e?.entityId === p.entityId),
            )
            .map((p) => (
              <span key={p.entityId} className="chip on">
                {p.name}
              </span>
            ))}
          <div className="row">
            <button onClick={reset}>Back</button>
            <button
              className="primary"
              disabled={!!busy || picked.length < 1}
              onClick={() => recommend()}
            >
              Find my fragrances
            </button>
          </div>
        </section>
      )}

      {result && (
        <>
          <section className="card qloo">
            <h2>
              <span className="badge">Qloo</span> What the taste graph returned
            </h2>
            <p className="muted">Entities you confirmed</p>
            <div>
              {result.qloo.entities.map((e) => (
                <span key={e.entityId} className="chip on">
                  {KIND_LABEL[e.kind] ?? e.kind}: {e.name}
                </span>
              ))}
            </div>
            <p className="muted">Style cues Qloo associates with them (tap to drop a cue)</p>
            <div>
              {result.qloo.tags.map((t) => (
                <button
                  key={t.id}
                  className="chip on"
                  onClick={() => {
                    const next = [...off, t.id];
                    setOff(next);
                    recommend(prefs, next);
                  }}
                >
                  {t.name} ✕
                </button>
              ))}
              {result.qloo.dropped.map((t) => (
                <button
                  key={t.id}
                  className="chip"
                  onClick={() => {
                    const next = off.filter((x) => x !== t.id);
                    setOff(next);
                    recommend(prefs, next);
                  }}
                >
                  {t.name} (off)
                </button>
              ))}
            </div>
          </section>
          <section className="card">
            <h2>
              <span className="badge ai">Gemini</span> How we read it
            </h2>
            <ul>
              {result.brief.because.map((b, i) => (
                <li key={i}>
                  <strong>{b.cue}</strong>: {b.effect}
                </li>
              ))}
            </ul>
            <p className="muted">
              Looking for:{' '}
              {[
                ...result.brief.wantAccords.map((a) => a.name),
                ...result.brief.families,
                ...result.brief.occasions,
                ...result.brief.seasons,
              ].join(', ') || '—'}
            </p>
          </section>
          <section>
            <h2>Your shortlist</h2>
            {!result.items.length && (
              <p>
                Nothing matched those limits. Try loosening the budget or removing a “nothing too…”.
              </p>
            )}
            {result.items.map((it) => (
              <article key={it.id} className="card item">
                <h3>
                  {it.name}{' '}
                  <small>
                    {it.house}
                    {it.concentration ? ` · ${it.concentration}` : ''}
                  </small>
                </h3>
                <p className="muted">
                  {it.price_usd ? `$${it.price_usd} retail` : 'Price not confirmed'} ·{' '}
                  {it.accords.join(', ')}
                </p>
                <p>{it.match_reasons.join(' · ')}</p>
                {it.has_wearing_profile ? (
                  <small className="muted">
                    Estimated: {it.sillage} projection, {it.longevity} lasting.
                  </small>
                ) : (
                  <small className="muted">
                    No wearing profile yet, so setting fit wasn’t scored.
                  </small>
                )}
              </article>
            ))}
            <div className="row">
              {REACTIONS.map(([l, add]) => (
                <button
                  key={l}
                  disabled={!!busy}
                  onClick={() => {
                    const p = [prefs, add].filter(Boolean).join('; ');
                    setPrefs(p);
                    recommend(p);
                  }}
                >
                  {l}
                </button>
              ))}
              <button onClick={() => setResult(null)}>Swap cultural vibe</button>
              <button
                onClick={() => {
                  reset();
                  setText('');
                  setPhoto(null);
                }}
              >
                Start over
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Custom({ onPick }: { onPick: (e: Entity) => void }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<Kind>('person');
  const [found, setFound] = useState<Entity[]>([]);
  const [msg, setMsg] = useState('');
  return (
    <div className="custom">
      <h3>Add your own</h3>
      <div className="row">
        <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          {Object.entries(KIND_LABEL).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a name"
          maxLength={100}
        />
        <button
          onClick={async () => {
            try {
              const r = await api.search(q, kind);
              setFound(r.results);
              setMsg(r.results.length ? '' : 'No match.');
            } catch (e) {
              setMsg(e instanceof Error ? e.message : 'Search failed.');
            }
          }}
        >
          Search
        </button>
      </div>
      {msg && <small className="muted">{msg}</small>}
      <div className="carousel">
        {found.map((e) => (
          <button
            key={e.entityId}
            className="tile"
            onClick={() => {
              onPick(e);
              setFound([]);
              setQ('');
            }}
          >
            {e.name}
          </button>
        ))}
      </div>
    </div>
  );
}
