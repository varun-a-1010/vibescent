---
type: Reference
title: Devpost copy
description: Submission text for the Qloo Agentic Hackathon.
timestamp: 2026-10-31
---

**Tagline:** You know exactly who you want to look like. You have no idea what they smell like.

## Inspiration

Most people can describe their style in alarming detail. They know what they like to wear. They know who they would like to look like, usually someone with better cheekbones. They can name the exact vibe they are going for: "quiet money," "off-duty architect," "man who owns a boat but will not bring it up unless you ask."

Now ask these same people what they want to smell like. They will look at you as though you asked them to name their favorite tax form. After a long silence, they will say: "...good?"

The fragrance industry has responded to this crisis by speaking exclusively in code. A person at a counter tells you a scent has "a heart of iris and an ambroxan dry-down," and you nod, the same way you nod at your mechanic. Then you spray eleven strips of cardboard, lose your sense of smell entirely, and go home with a candle.

We thought there had to be a better way, one that begins with what you actually know: your outfit, your plans, and who you are pretending to be tonight.

## What it does

Describe a look or drop in a photo. "Black bomber jacket, courtside at a Knicks game" will do. VibeScent reads it and proposes style icons, brands, music, movies and TV that belong in the same room. Qloo confirms that these are real things, and you pick up to five under the only question that matters: _Which of these feel like you?_

Qloo then works out what your picks have in common, in terms of style, mood, look and setting. You see those cues and can delete any that have misjudged you. Out come real fragrances, with their notes, price, and a plain reason each one is there. Too heavy? More woody? Just say so, in English, and it adjusts.

Your limits always win. If you say nothing sweet, no amount of Timothée Chalamet will overrule you.

At no point will anyone ask you to have an opinion about ambroxan.

## Why Qloo is essential

Ask a language model to pick a perfume for a leather jacket and it will recommend the same five bottles it recommends to everybody, in the confident tone of a man explaining wine. Qloo is what stands between a look and a guess. It turns "leather jacket at a rooftop bar" into real cultural entities, and those entities into taste tags that come from a graph, not from adjectives. Without it, we would just be a chatbot with a nice font.

## How we built it

Getting from "bomber jacket" to a bottle takes a five-leg relay across three systems, and any leg can drop the baton.

1. **Read.** Gemini handles text and vision, describes the look, and proposes about 30 cultural names across five categories. If the occasion is missing, it asks exactly one question, because nobody wants a fragrance interview.
2. **Resolve.** Every name goes through Qloo `/search`. Only real entities of the right type survive, so a hallucinated style icon quietly disappears before you ever meet it.
3. **Taste.** Your confirmed picks go to Qloo `/v2/insights`, which returns tags across four namespaces: personal style, emotional tone, aesthetics and ambience. Silhouette words are capped, or else every person alive turns out to be "A-line." Any cue you switch off stays off.
4. **Translate.** Gemini 4 Argon writes a scent brief, and this is the tricky part. It may only use vocabulary pulled live from the **Fragologist API**, so the schema is built at runtime and the model cannot invent an accord. Vertex rejects enormous enums, so large vocabularies are relaxed on the wire and then validated strictly on return. Every choice must name the cultural cue that caused it.
5. **Match.** The Fragologist API supplies the real, accurate fragrance data: notes, accords, seasons, occasions, projection, longevity and prices. It filters and scores the catalog and explains each match. Anything you excluded is stripped from the brief before the query, and hard filters go through exactly as you set them. Zero-score results are dropped instead of being dressed up as a recommendation.

**Reliability:** Argon leads. A failed call tries the same model on a second Vertex project, then walks a chain of Flash models, then backs off and walks it again. Catalog vocabulary is cached for an hour, repeat recommendations for 30 minutes, and `Retry-After` is honored, because we were raised properly.

**Stack:** TypeScript, Fastify and React, with server-side secrets and per-client rate limits.

## Challenges

A single look asks Qloo for about 30 names at once. Qloo, quite reasonably, interpreted this as an attack. Lookups were rate-limited and vanished in silence, so a look that deserved seven brands got two, and we briefly believed the world contained only Tom Ford and Yves Saint Laurent. Calls now share a pace and retry instead of disappearing.

We also removed destinations, after the app sincerely asked users whether Portugal felt like them.

## What's next

Layering suggestions, sample sets you can actually order, and a memory that learns from every "too heavy."

## Limits

Qloo shows cultural association, not what will suit you. No API has met your skin, so try a sample before you commit to the big bottle.
