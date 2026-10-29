import { useEffect, useRef, useState } from 'react';
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
const BUDGET_MIN = 20;
const BUDGET_MAX = 400;
const SILLAGE = ['skin-scent', 'intimate', 'moderate', 'room-filling', 'enormous'];
const LONGEVITY = ['fleeting', 'moderate', 'long', 'very-long'];
const SEASONS = ['spring', 'summer', 'fall', 'winter'];
const tint = (name: string) => (accordColors as Record<string, string>)[name] ?? '#9c5a3c';
const pretty = (s: string) => s.replace(/-/g, ' ');

type Msg =
  | { kind: 'user'; text: string; photo?: Photo | null; tags?: string[] }
  | { kind: 'ai'; text: string; question?: string | null }
  | { kind: 'touch'; id: number }
  | { kind: 'result'; result: Result };

export function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [budget, setBudget] = useState<number | undefined>(undefined);
  const [gender, setGender] = useState('any');
  const [avoid, setAvoid] = useState<string[]>([]);
  const [prefs, setPrefs] = useState('');
  const [lookText, setLookText] = useState('');
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [picked, setPicked] = useState<Entity[]>([]);
  const [off, setOff] = useState<string[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    api
      .status()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs.length, busy]);

  const last = msgs[msgs.length - 1];
  const started = msgs.length > 0;
  const stage = !started ? 'start' : last?.kind === 'result' ? 'result' : 'touch';
  const push = (...m: Msg[]) => setMsgs((x) => [...x, ...m]);
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

  const tags = () => [
    budget === undefined ? 'no budget limit' : `up to $${budget}`,
    gender === 'any' ? 'for anyone' : `for ${gender}`,
    ...avoid.map((a) => `nothing too ${a}`),
  ];
  const ask = (t: string, p: Photo | null, then?: () => void) =>
    run('Reading your look…', async () => {
      const s = await api.suggest(t, p ?? undefined);
      setSuggestion(s);
      push(
        { kind: 'ai', text: s.summary, question: s.followUp },
        { kind: 'touch', id: Date.now() },
      );
      then?.();
    });
  const recommend = (extraPrefs = prefs, deselected = off, entities = picked, look = lookText) =>
    run('Matching your vibe to the catalog…', async () => {
      const result = await api.recommend({
        look: suggestion ? `${look} (${suggestion.summary})` : look,
        preferences: extraPrefs,
        budgetMaxUsd: budget,
        gender,
        excludeAccords: avoid,
        entities,
        deselectedTagIds: deselected,
      });
      push({ kind: 'result', result });
    });

  const startWith = (t: string, p: Photo | null) => {
    setLookText(t);
    push({ kind: 'user', text: t, photo: p, tags: tags() });
    setText('');
    ask(t, p);
  };
  const send = () => {
    const t = text.trim();
    if (!t && !(stage === 'start' && photo)) return;
    if (stage === 'start') return startWith(t, photo);
    push({ kind: 'user', text: t });
    setText('');
    if (stage === 'touch') {
      run('Looking those up…', async () => {
        const r = await api.reply(t);
        const known = new Set(picked.map((p) => p.entityId));
        const fresh = r.entities.filter((e) => !known.has(e.entityId));
        const room = Math.max(0, 5 - picked.length);
        setPicked((p) => [...p, ...fresh.slice(0, room)]);
        const said = [
          fresh.length
            ? `Added ${fresh
                .slice(0, room)
                .map((e) => e.name)
                .join(', ')}.`
            : '',
          fresh.length > room ? 'You can pick up to 5, so I stopped there.' : '',
          r.unmatched.length ? `I couldn’t find ${r.unmatched.join(', ')} in Qloo.` : '',
        ]
          .filter(Boolean)
          .join(' ');
        if (r.detail) {
          const next = `${lookText}. ${r.detail}`;
          setLookText(next);
          const s2 = await api.suggest(next);
          setSuggestion(s2);
          push(
            {
              kind: 'ai',
              text: [said, s2.summary].filter(Boolean).join(' '),
              question: s2.followUp,
            },
            { kind: 'touch', id: Date.now() },
          );
        } else {
          push({
            kind: 'ai',
            text: said || 'I didn’t catch a name there. Try a person, brand, artist or film.',
          });
          push({ kind: 'touch', id: Date.now() });
        }
      });
    } else {
      const p = [prefs, t].filter(Boolean).join('; ');
      setPrefs(p);
      recommend(p);
    }
  };
  const usePreset = async (p: Preset) => {
    const sample = p.photo
      ? await fetch(`/samples/${p.photo}`)
          .then((r) => r.blob())
          .then((b) => toPhoto(new File([b], p.photo!, { type: b.type })))
          .catch(() => null)
      : null;
    setBudget(p.budget);
    setGender(p.gender);
    setAvoid(p.avoid);
    setPrefs(p.prefs);
    setPhoto(sample);
    setLookText(p.look);
    push({
      kind: 'user',
      text: p.look,
      photo: sample,
      tags: [
        p.budget === undefined ? 'no budget limit' : `up to $${p.budget}`,
        p.gender === 'any' ? 'for anyone' : `for ${p.gender}`,
        ...p.avoid.map((a) => `nothing too ${a}`),
      ],
    });
    ask(p.look, sample);
  };
  const attach = async (f?: File) => {
    if (f) setPhoto(await toPhoto(f).catch(() => null));
  };
  const toggle = (e: Entity) =>
    setPicked((p) =>
      p.some((x) => x.entityId === e.entityId)
        ? p.filter((x) => x.entityId !== e.entityId)
        : p.length >= 5
          ? p
          : [...p, e],
    );
  const findFragrances = () => {
    push({ kind: 'user', text: `I’ll go with ${picked.map((p) => p.name).join(', ')}.` });
    recommend();
  };
  const startOver = () => {
    setMsgs([]);
    setSuggestion(null);
    setPicked([]);
    setOff([]);
    setLookText('');
    setText('');
    setPhoto(null);
    setPrefs('');
    setError(null);
  };
  const canSend = !busy && (!!text.trim() || (stage === 'start' && !!photo)) && !!status?.gemini;
  const lastTouch = msgs.map((m) => m.kind).lastIndexOf('touch');
  const lastResult = msgs.map((m) => m.kind).lastIndexOf('result');

  const composer = (
    <div
      className="composer"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (stage === 'start') attach(e.dataTransfer.files[0]);
      }}
    >
      {stage === 'start' && photo && (
        <div className="attached">
          <img alt="Your outfit" src={`data:${photo.mimeType};base64,${photo.data}`} />
          <button type="button" aria-label="Remove photo" onClick={() => setPhoto(null)}>
            ×
          </button>
        </div>
      )}
      <textarea
        aria-label="Message"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (canSend) send();
          }
        }}
        onPaste={(e) => {
          const f = [...e.clipboardData.files].find((x) => x.type.startsWith('image/'));
          if (f && stage === 'start') {
            e.preventDefault();
            attach(f);
          }
        }}
        rows={stage === 'start' ? 3 : 1}
        maxLength={1000}
        placeholder={
          stage === 'start'
            ? 'What are you wearing and where are you headed? Add or drop a photo too.'
            : stage === 'touch'
              ? 'Answer, or add your own names: “also Tyler, the Creator and Succession”'
              : 'Tell me what to change: lighter, more woody, cheaper…'
        }
      />
      <div className="cbar">
        {stage === 'start' && (
          <>
            <label className="attach">
              📷 {photo ? 'Change photo' : 'Add photo'}
              <input
                type="file"
                accept="image/*"
                className="sr"
                onChange={(e) => attach(e.target.files?.[0])}
              />
            </label>
            <small>Photos go to Gemini only and are never stored.</small>
          </>
        )}
        <button type="button" className="send" aria-label="Send" disabled={!canSend} onClick={send}>
          ↑
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="hero">
        <div className="wrap">
          <h1>
            Vibe<span>Scent</span>
          </h1>
          <p>Start with the outfit. Find the scent that finishes it.</p>
          {started && (
            <button type="button" className="restart" onClick={startOver}>
              New look
            </button>
          )}
        </div>
      </div>
      <main className="wrap">
        {!started && (
          <>
            <section>
              <h2 className="eyebrow">Try a sample look</h2>
              <div className="presets" role="list">
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
                    {p.photo && <img className="pthumb" alt="" src={`/samples/${p.photo}`} />}
                    <b>{p.title}</b>
                    <span>{p.look}</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="plain">
              <div className="opts">
                <label className="slider">
                  <span>{budget === undefined ? 'No budget limit' : `Up to $${budget}`}</span>
                  <input
                    type="range"
                    aria-label="Budget"
                    min={BUDGET_MIN}
                    max={BUDGET_MAX + 10}
                    step={10}
                    value={budget ?? BUDGET_MAX + 10}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setBudget(v > BUDGET_MAX ? undefined : v);
                    }}
                  />
                </label>
                <label>
                  <select
                    aria-label="For"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="any">For anyone</option>
                    <option value="masculine">For masculine</option>
                    <option value="feminine">For feminine</option>
                    <option value="unisex">For unisex</option>
                  </select>
                </label>
              </div>
              {composer}
              <details className="more">
                <summary>More options</summary>
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
              </details>
            </section>
          </>
        )}

        {started && (
          <div className="thread">
            {msgs.map((m, i) => {
              if (m.kind === 'user')
                return (
                  <div key={i} className="bubble user">
                    {m.photo && (
                      <img
                        className="ph"
                        alt="Your outfit"
                        src={`data:${m.photo.mimeType};base64,${m.photo.data}`}
                      />
                    )}
                    <p>{m.text}</p>
                    {m.tags && (
                      <div className="tags">
                        {m.tags.map((t) => (
                          <span key={t} className="chip">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              if (m.kind === 'ai')
                return (
                  <div key={i} className="bubble ai">
                    <small className="who">
                      <span className="badge ai">Gemini</span> how I read it
                    </small>
                    <p>{m.text}</p>
                    {m.question && <p className="q">{m.question}</p>}
                  </div>
                );
              if (m.kind === 'touch')
                return i === lastTouch && suggestion ? (
                  <div key={i} className="bubble ai wide">
                    <small className="who">
                      <span className="badge">Qloo</span> cultural touchstones
                    </small>
                    <Touchstones
                      suggestion={suggestion}
                      picked={picked}
                      toggle={toggle}
                      live={stage === 'touch'}
                      busy={!!busy}
                      onFind={findFragrances}
                    />
                  </div>
                ) : null;
              return (
                <ResultMsg
                  key={i}
                  result={m.result}
                  live={i === lastResult && stage === 'result'}
                  off={off}
                  busy={!!busy}
                  onDrop={(next) => {
                    setOff(next);
                    recommend(prefs, next);
                  }}
                  onReact={(add) => {
                    const p = [prefs, add].filter(Boolean).join('; ');
                    setPrefs(p);
                    push({ kind: 'user', text: add });
                    recommend(p);
                  }}
                  onSwap={() => push({ kind: 'touch', id: Date.now() })}
                />
              );
            })}
            {busy && (
              <div className="bubble ai">
                <p className="busy" aria-live="polite">
                  <i />
                  {busy}
                </p>
              </div>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div ref={end} />
          </div>
        )}
        {!started && error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {!started && busy && (
          <p className="busy" aria-live="polite">
            <i />
            {busy}
          </p>
        )}
        {started && <div className="dock">{composer}</div>}
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

function Touchstones({
  suggestion,
  picked,
  toggle,
  live,
  busy,
  onFind,
}: {
  suggestion: Suggestion;
  picked: Entity[];
  toggle: (e: Entity) => void;
  live: boolean;
  busy: boolean;
  onFind: () => void;
}) {
  if (!live)
    return (
      <p>
        You picked <b>{picked.map((p) => p.name).join(', ') || 'nothing'}</b>.
      </p>
    );
  const inCarousel = Object.values(suggestion.carousels)
    .flat()
    .map((e) => e?.entityId);
  return (
    <>
      <div className="pickhead">
        <h2>Which of these feel like you?</h2>
        <span className={picked.length ? 'count ok' : 'count'}>
          {picked.length}/5 · {picked.length ? 'tap again to remove' : 'pick at least 1'}
        </span>
      </div>
      <div className="rows">
        {(Object.entries(suggestion.carousels) as [Kind, Entity[]][]).map(([kind, list]) => (
          <div key={kind} className="cat">
            <h3>{KIND_LABEL[kind] ?? kind}</h3>
            <div className="chips scroll">
              {list.map((e) => {
                const on = picked.some((x) => x.entityId === e.entityId);
                return (
                  <button
                    type="button"
                    key={e.entityId}
                    className={on ? 'tile on' : 'tile'}
                    onClick={() => toggle(e)}
                  >
                    <i>{on ? '✓' : '+'}</i>
                    {e.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div>
        {picked
          .filter((p) => !inCarousel.includes(p.entityId))
          .map((p) => (
            <span key={p.entityId} className="chip on">
              {p.name}
            </span>
          ))}
      </div>
      <div className="row actions">
        <button className="primary" disabled={busy || picked.length < 1} onClick={onFind}>
          {picked.length < 1 ? 'Pick at least one to continue' : 'Find my fragrances'}
        </button>
      </div>
    </>
  );
}

function ResultMsg({
  result,
  live,
  off,
  busy,
  onDrop,
  onReact,
  onSwap,
}: {
  result: Result;
  live: boolean;
  off: string[];
  busy: boolean;
  onDrop: (next: string[]) => void;
  onReact: (add: string) => void;
  onSwap: () => void;
}) {
  if (!live)
    return (
      <div className="bubble ai">
        <small className="who">Earlier shortlist</small>
        <p>{result.items.map((i) => `${i.name} (${i.house})`).join(' · ') || 'No matches.'}</p>
      </div>
    );
  return (
    <>
      <div className="bubble ai wide qloo">
        <small className="who">
          <span className="badge">Qloo</span> what the taste graph returned
        </small>
        <p className="muted">Entities you confirmed</p>
        <div>
          {result.qloo.entities.map((e) => (
            <span key={e.entityId} className="chip on">
              {KIND_LABEL[e.kind] ?? e.kind}: {e.name}
            </span>
          ))}
        </div>
        <p className="muted">Style cues Qloo associates with them. Tap one to drop it.</p>
        {Array.from(new Set([...result.qloo.tags, ...result.qloo.dropped].map((t) => t.group))).map(
          (group) => (
            <div key={group} className="taggroup">
              <small>{group}</small>
              {result.qloo.tags
                .filter((t) => t.group === group)
                .map((t) => (
                  <button
                    key={t.id}
                    className="chip on"
                    disabled={busy}
                    onClick={() => onDrop([...off, t.id])}
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
                    disabled={busy}
                    onClick={() => onDrop(off.filter((x) => x !== t.id))}
                  >
                    {t.name} (off)
                  </button>
                ))}
            </div>
          ),
        )}
      </div>
      <div className="bubble ai wide">
        <small className="who">
          <span className="badge ai">Gemini</span> how I turned that into a scent brief
        </small>
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
          {[...result.brief.vibes, ...result.brief.occasions, ...result.brief.seasons].map((x) => (
            <span key={x} className="chip">
              {x}
            </span>
          ))}
        </div>
      </div>
      <div className="bubble ai wide">
        <small className="who">Your shortlist</small>
        {!result.items.length && (
          <p>Nothing matched those limits. Try a bigger budget or removing a “nothing too…”.</p>
        )}
        {result.items.map((it) => (
          <Card key={it.id} it={it} />
        ))}
        <div className="row">
          {REACTIONS.map(([l, add]) => (
            <button key={l} disabled={busy} onClick={() => onReact(add)}>
              {l}
            </button>
          ))}
          <button disabled={busy} onClick={onSwap}>
            Swap touchstones
          </button>
        </div>
        <small className="muted">Or type below to refine in your own words.</small>
      </div>
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
