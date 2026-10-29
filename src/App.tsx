import { useEffect, useState } from 'react';
import {
  api,
  toPhoto,
  type Entity,
  type Item,
  type Kind,
  type Photo,
  type Result,
  type Status,
  type Suggestion,
} from './api';
import { PRESETS, type Preset } from './presets';
import accordColors from './accordColors.json';

const KIND_LABEL: Record<string, string> = {
  person: 'Style icons',
  brand: 'Brands',
  artist: 'Music',
  movie: 'Movies',
  tv_show: 'TV',
  destination: 'Destinations',
};
const AVOID = ['sweet', 'smoky', 'floral', 'powdery', 'woody', 'citrus', 'musk'];
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
const SILLAGE = ['skin-scent', 'intimate', 'moderate', 'room-filling', 'enormous'];
const LONGEVITY = ['fleeting', 'moderate', 'long', 'very-long'];
const SEASONS = ['spring', 'summer', 'fall', 'winter'];
const tint = (name: string) => (accordColors as Record<string, string>)[name] ?? '#9c5a3c';
const pretty = (s: string) => s.replace(/-/g, ' ');

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
  const suggest = (t = text, p: Photo | null = photo) =>
    run('Reading your look…', async () => {
      setSuggestion(await api.suggest(t, p ?? undefined));
      setPicked([]);
    });
  const recommend = (extraPrefs = prefs, deselected = off) =>
    run('Matching your vibe to the catalog…', async () => {
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
  const usePreset = (p: Preset) => {
    setText(p.look);
    setBudget(p.budget);
    setGender(p.gender);
    setAvoid(p.avoid);
    setPrefs(p.prefs);
    setPhoto(null);
    suggest(p.look, null);
  };
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
  const step = result ? 3 : suggestion ? 2 : 1;

  return (
    <>
      <div className="hero">
        <div className="wrap">
          <h1>
            Vibe<span>Scent</span>
          </h1>
          <p>
            Tell us how you want to show up. We read the culture around it, then find the fragrance
            that fits.
          </p>
          <ol className="steps" aria-label="Progress">
            {['Your look', 'Touchstones', 'Shortlist'].map((l, i) => (
              <li key={l} className={step === i + 1 ? 'now' : step > i + 1 ? 'done' : ''}>
                {l}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <main className="wrap">
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {busy && (
          <p className="busy" aria-live="polite">
            <i />
            {busy}
          </p>
        )}

        {step === 1 && (
          <>
            <section>
              <h2 className="eyebrow">Try a look</h2>
              <div className="presets">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    className="preset"
                    disabled={!!busy || !status?.gemini}
                    style={{
                      background: `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]})`,
                    }}
                    onClick={() => usePreset(p)}
                  >
                    <b>{p.title}</b>
                    <span>{p.look}</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="card">
              <h2 className="eyebrow">Or describe your own</h2>
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
                Outfit photo (optional, sent to Gemini only, never stored)
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
                onClick={() => suggest()}
              >
                Continue
              </button>
            </section>
          </>
        )}

        {step === 2 && suggestion && (
          <section className="card">
            <h2 className="eyebrow">Your cultural touchstones</h2>
            <p className="summary">{suggestion.summary}</p>
            {suggestion.followUp && (
              <label>
                {suggestion.followUp}
                <input value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={300} />
              </label>
            )}
            <p className="muted">
              Pick 1–5 that feel like you. These come from Qloo’s taste graph.{' '}
              <b>{picked.length}/5</b>
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
            <div>
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
            </div>
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

        {step === 3 && result && (
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
              <p className="muted">Style cues Qloo associates with them. Tap one to drop it.</p>
              {Array.from(
                new Set([...result.qloo.tags, ...result.qloo.dropped].map((t) => t.group)),
              ).map((group) => (
                <div key={group} className="taggroup">
                  <small>{group}</small>
                  {result.qloo.tags
                    .filter((t) => t.group === group)
                    .map((t) => (
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
                  {result.qloo.dropped
                    .filter((t) => t.group === group)
                    .map((t) => (
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
              ))}
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
              <div className="brief">
                {result.brief.wantAccords.map((a) => (
                  <span key={a.name} className="dot" style={{ background: tint(a.name) }}>
                    {pretty(a.name)}
                  </span>
                ))}
                {[...result.brief.vibes, ...result.brief.occasions, ...result.brief.seasons].map(
                  (x) => (
                    <span key={x} className="chip">
                      {x}
                    </span>
                  ),
                )}
              </div>
            </section>
            <section>
              <h2 className="eyebrow">Your shortlist</h2>
              {!result.items.length && (
                <p>
                  Nothing matched those limits. Try a bigger budget or removing a “nothing too…”.
                </p>
              )}
              {result.items.map((it) => (
                <Card key={it.id} it={it} />
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
        <footer className="muted">
          Qloo supplies cultural associations only. Fragrance data and wearing estimates come from
          Fragologist and are estimates, not measurements.
          {status && (
            <>
              {' '}
              · Qloo {status.qloo ? '✓' : '✗'} · Gemini {status.gemini ? '✓' : '✗'} · Catalog{' '}
              {status.catalog ?? '✗'}
            </>
          )}
        </footer>
      </main>
    </>
  );
}

function Meter({ label, value, scale }: { label: string; value?: string | null; scale: string[] }) {
  const at = value ? scale.indexOf(value) : -1;
  return (
    <div className="meter">
      <small>{label}</small>
      <div className="segs">
        {scale.map((s, i) => (
          <i key={s} className={i <= at ? 'fill' : ''} />
        ))}
      </div>
      <small>{value ? pretty(value) : 'unknown'}</small>
    </div>
  );
}

function Card({ it }: { it: Item }) {
  const lead = it.top_accords[0]?.name ?? '';
  const notes = it.notes
    ? [...it.notes.top.slice(0, 3), ...it.notes.heart.slice(0, 2), ...it.notes.base.slice(0, 3)]
    : [];
  return (
    <article className="card item" style={{ borderLeftColor: tint(lead) }}>
      <header>
        <div>
          <h3>{it.name}</h3>
          <small>
            {it.house}
            {it.concentration ? ` · ${it.concentration}` : ''}
            {it.year ? ` · ${it.year}` : ''}
          </small>
        </div>
        <div className="price">
          {it.price ? `$${Math.round(it.price.amount)}` : '—'}
          {it.price?.size_ml ? <small>{it.price.size_ml} ml</small> : null}
        </div>
      </header>
      <div className="bars">
        {it.top_accords.map((a) => (
          <div key={a.name} className="bar">
            <span>{pretty(a.name)}</span>
            <i>
              <b style={{ width: `${Math.round(a.weight * 100)}%`, background: tint(a.name) }} />
            </i>
          </div>
        ))}
      </div>
      {notes.length > 0 && <p className="notes">{notes.map(pretty).join(' · ')}</p>}
      {it.vibes && it.vibes.length > 0 && (
        <div>
          {it.vibes.map((v) => (
            <span key={v} className="chip">
              {v}
            </span>
          ))}
        </div>
      )}
      {it.has_wearing_profile ? (
        <div className="profile">
          <Meter label="Projection" value={it.sillage} scale={SILLAGE} />
          <Meter label="Lasts" value={it.longevity} scale={LONGEVITY} />
          <div className="seasons">
            {SEASONS.map((s) => (
              <span key={s} className={`s${it.seasons?.[s] ?? 0}`}>
                {s}
              </span>
            ))}
          </div>
          <small className="muted">
            Estimated wearing profile{it.occasions?.length ? ` · ${it.occasions.join(', ')}` : ''}
          </small>
        </div>
      ) : (
        <small className="muted">No wearing profile yet, so setting fit wasn’t scored.</small>
      )}
      <p className="why">
        <b>Why:</b>{' '}
        {it.match_reasons
          .filter((r) => r.contribution > 0)
          .map((r) => `${r.field} (${r.values.map(pretty).join(', ')})`)
          .join(' · ') || 'within your limits'}
      </p>
      {it.public_dossier_url && (
        <a href={it.public_dossier_url} target="_blank" rel="noreferrer">
          Read the dossier ↗
        </a>
      )}
    </article>
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
