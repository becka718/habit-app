// Supabase Edge Function: AI coach, AI quest chooser and AI photo checker.
// The Groq key lives in Supabase secrets, never in the app. Photos are checked and thrown away, never stored.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const METRICS = ['habit_completions', 'habit_days', 'todos_done', 'mood_days'];
const CAP: Record<string, number> = { day: 12, week: 50, month: 200, recovery: 40, life: 1 };
const TEXT_MODEL = 'groq/compound-mini';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'; // change here if Groq renames its vision model
const LIMITS: Record<string, number> = { chat: 80, quest: 40, verify: 30 }; // per person per day
const clamp = (v: unknown, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(v) || lo)));

async function groq(key: string, model: string, messages: unknown[], max: number) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: max, temperature: model === VISION_MODEL ? 0 : 0.7, messages }),
  });
  if (!r.ok) throw new Error(`upstream ${r.status}`);
  const d = await r.json();
  return String(d.choices?.[0]?.message?.content ?? '').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const key = Deno.env.get('GROQ_API_KEY');
    if (!key) return json({ error: 'GROQ_API_KEY is not set' }, 500);
    const body = await req.json();
    // Only signed-in people may use the AI (the public key alone is not enough), with a daily limit each
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return json({ error: 'unauthorized' }, 401);
    const bucket = body.mode === 'verify' ? 'verify' : body.mode === 'quest' ? 'quest' : 'chat';
    const { data: allowed } = await sb.rpc('ai_hit', { p_user: user.id, p_bucket: bucket, p_limit: LIMITS[bucket] });
    if (allowed === false) return json({ error: 'rate_limited' }, 429);
    const name = String(body.name ?? '').replace(/[^\p{L}\p{N} '-]/gu, '').slice(0, 30);

    // ── Photo proof: does the picture show what the habit or quest asked for? ──
    if (body.mode === 'verify') {
      const image = String(body.image ?? '');
      if (!image.startsWith('data:image/jpeg;base64,') || image.length > 2_500_000) return json({ error: 'bad image' }, 400);
      const expect = String(body.expect ?? '').slice(0, 100);
      const prompt = `Someone must prove they did a task by sending a photo. The photo should show: "${expect}".
Be fair and friendly, but not gullible: reject blank, unrelated, or obviously fake photos (screenshots, pictures of a screen, internet images).
Reply with ONLY JSON, no markdown: {"ok": true or false, "reason": "one short friendly sentence"}`;
      const text = await groq(key, VISION_MODEL, [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image } }] }], 120);
      const m = text.match(/\{[\s\S]*\}/);
      let ok = false, reason = 'I could not tell. Try a clearer photo.';
      if (m) { try { const j = JSON.parse(m[0]); ok = j.ok === true; reason = String(j.reason ?? reason).slice(0, 160); } catch { /* keep defaults */ } }
      if (ok && body.questId) {
        // only this function can mark proof as approved, so the app cannot fake it
        await sb.from('quests').update({ proof_ok: true }).eq('id', String(body.questId)).eq('user_id', user.id).eq('status', 'active');
      }
      return json({ ok, reason });
    }

    // ── Quest chooser ──
    if (body.mode === 'quest') {
      const kind = ['day', 'week', 'month', 'life', 'recovery'].includes(body.kind) ? body.kind : 'day';
      const stats = JSON.stringify(body.stats ?? {}).slice(0, 1500);
      const prompt = `You design quests for ${name || 'a user'} in a personal habit app. Talk to them like a close friend: warm, direct, second person, never corporate. Reply with ONLY one JSON object, no markdown:
{"title": short string (max 60 chars), "description": one friendly sentence (max 140 chars), "metric": ${kind === 'life' ? '"photo"' : 'one of ' + METRICS.join(' | ')}, "target": integer, "difficulty": 1 or 2 or 3, "days": integer, "proof": string}
Metrics: habit_completions = habit check-ins done; habit_days = days with at least one habit done; todos_done = to-dos finished; mood_days = days a mood was logged.
Quest kind: "${kind}" (day = today only, week = this week, month = this month, life = a REAL-LIFE chore or good deed they prove with a photo, recovery = a HARD comeback challenge to restore a lost streak).
User stats: ${stats}
Rules: base targets on the user's recent baseline. difficulty 1 = about the baseline, 2 = a bit above, 3 = a real stretch (about 1.5x). Rewards are rare, so do not make everything hard. Max target: day 12, week 50, month 200.
For "life": metric "photo", target 1, and a concrete, personal, photographable task such as "Clean your room", "Wash the dishes", "Go for a walk" or "Read your Bible". difficulty 1 = tiny, 2 = a proper chore, 3 = a big effort. "proof" = a short phrase for what the photo must show (e.g. "your clean room").
For "recovery": difficulty 3, "days" between 4 and 9, metric habit_days with target equal to days, or habit_completions.
For other kinds set "days" to 1 and "proof" to "". If "avoid" is in the stats, do NOT repeat that quest.`;
      const text = await groq(key, TEXT_MODEL, [{ role: 'user', content: prompt }], 260);
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return json({ error: 'no json' }, 502);
      const q = JSON.parse(m[0]);
      const metric = kind === 'life' ? 'photo' : q.metric;
      if (kind !== 'life' && !METRICS.includes(metric)) return json({ error: 'bad metric' }, 502);
      return json({
        title: String(q.title ?? 'Quest').slice(0, 80),
        description: String(q.description ?? '').slice(0, 200),
        metric,
        target: kind === 'life' ? 1 : clamp(q.target, 1, CAP[kind]),
        difficulty: clamp(q.difficulty, 1, 3),
        days: kind === 'recovery' ? clamp(q.days, 3, 9) : 1,
        proof: kind === 'life' ? String(q.proof || 'a photo showing you finished it').slice(0, 100) : '',
      });
    }

    // ── Chat coach ──
    const { messages, context, today } = body;
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 12) return json({ error: 'bad request' }, 400);
    const clean = messages.map((m: { role: string; content: unknown }) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content ?? '').slice(0, 1000),
    }));
    const system = `You are a friendly Christian habit coach inside a habit tracking app${name ? `, talking with ${name}` : ''}. Be personal and warm, like a close friend. Encourage them and share a short Bible verse when it fits. Their current habits:\n\n${String(context ?? '').slice(0, 2000)}\n\nToday is ${String(today ?? '').slice(0, 10)}. Be concise. Keep replies under 30 words. When giving YouTube links, use exactly this markdown format: [Title](https://www.youtube.com/results?search_query=SEARCH_TERM)`;
    return json({ text: await groq(key, TEXT_MODEL, [{ role: 'system', content: system }, ...clean], 150) });
  } catch {
    return json({ error: 'server error' }, 500);
  }
});
