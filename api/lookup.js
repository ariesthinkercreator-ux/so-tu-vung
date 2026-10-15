// Vercel serverless function: GET /api/lookup?q=word
// Looks up a word that is NOT in the app's database.
//  - With ANTHROPIC_API_KEY set: asks Claude (Haiku) for definition + Vietnamese meaning.
//  - Without it: falls back to the free English dictionary at dictionaryapi.dev (no Vietnamese).
// Answers are cached by Vercel's CDN for a day, so a word costs one call per day at most.

const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-5-5";
const PROMPT = q => `You are an English–Vietnamese learner's dictionary for Vietnamese students preparing for IELTS and TOEIC.
Look up this English word or phrase: ${JSON.stringify(q)}
Reply with only one JSON object and no other text.
If it is a real English word, phrase, idiom, phrasal verb or abbreviation (or an inflected or misspelled form of one), reply:
{"valid":true,"word":"dictionary headword in base form","ipa":"/British IPA/","lvl":"CEFR level A1-C2, or empty","vi":"nghĩa tiếng Việt chính, ngắn gọn","md":"main English definition in one sentence","p":[{"pos":"noun | verb | adjective | adverb | phrasal verb | idiom | ...","vi":["nghĩa tiếng Việt 1","nghĩa tiếng Việt 2"],"senses":[{"d":"clear learner's definition in English","ex":["natural example sentence"]}],"note":"ghi chú cách dùng bằng tiếng Việt (giới từ, collocation thường gặp), or empty"}],"syn":["common synonyms"],"ant":["common antonyms"],"fam":{"noun":[],"verb":[],"adjective":[],"adverb":[]}}
Most common meaning first. At most 3 parts of speech, 3 senses each, 2 examples per sense, 5 synonyms, 5 antonyms; use empty arrays when there are none.
If it is not English or not a real word, reply: {"valid":false,"suggest":["up to 5 real English words the user may have meant"]}`;

// best-effort per-IP limit (each serverless instance keeps its own counter)
const hits = new Map();
function limited(ip){
  const now = Date.now(), win = 60_000, max = Number(process.env.LOOKUPS_PER_MINUTE || 20);
  const arr = (hits.get(ip) || []).filter(t => now - t < win);
  arr.push(now); hits.set(ip, arr);
  return arr.length > max;
}

function firstJson(text){
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if(a < 0 || b <= a) return null;
  try{ return JSON.parse(text.slice(a, b + 1)); }catch(e){ return null; }
}

async function viaClaude(q){
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {"content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01"},
    body: JSON.stringify({model: MODEL, max_tokens: 1500,
                          messages: [{role: "user", content: PROMPT(q)}]})
  });
  if(!r.ok) throw new Error("claude " + r.status);
  const d = await r.json();
  const text = (d.content || []).filter(c => c.type === "text").map(c => c.text).join("");
  const x = firstJson(text);
  if(!x) throw new Error("bad json");
  x.via = "Claude";
  return x;
}

async function viaFreeDictionary(q){
  const r = await fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(q));
  if(r.status === 404) return {valid: false, suggest: []};
  if(!r.ok) throw new Error("dictionaryapi " + r.status);
  const d = await r.json();
  const first = d[0] || {};
  const p = [];
  for(const ent of d) for(const m of ent.meanings || []){
    let b = p.find(x => x.pos === m.partOfSpeech);
    if(!b){ b = {pos: m.partOfSpeech, vi: [], senses: [], note: ""}; p.push(b); }
    for(const def of (m.definitions || []).slice(0, 3))
      if(b.senses.length < 3) b.senses.push({d: def.definition, ex: def.example ? [def.example] : []});
  }
  const syn = [...new Set(d.flatMap(e => (e.meanings || []).flatMap(m => m.synonyms || [])))].slice(0, 5);
  const ant = [...new Set(d.flatMap(e => (e.meanings || []).flatMap(m => m.antonyms || [])))].slice(0, 5);
  const ipa = first.phonetic || ((first.phonetics || []).find(x => x.text) || {}).text || "";
  return {valid: true, word: first.word || q, ipa, lvl: "", vi: "", md: (p[0] && p[0].senses[0] || {}).d || "",
          p: p.slice(0, 3), syn, ant, fam: {}, via: "Free Dictionary API (chưa có nghĩa tiếng Việt)"};
}

export default async function handler(req, res){
  const q = String((req.query && req.query.q) || "").trim().toLowerCase().slice(0, 60);
  if(!q || !/^[a-z][a-z' .-]*$/.test(q)){ res.status(400).json({error: "bad query"}); return; }
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  if(limited(ip)){ res.status(429).json({error: "too many lookups"}); return; }
  try{
    const x = process.env.ANTHROPIC_API_KEY ? await viaClaude(q) : await viaFreeDictionary(q);
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    res.status(200).json(x);
  }catch(e){
    if(process.env.ANTHROPIC_API_KEY){
      try{ const x = await viaFreeDictionary(q); res.status(200).json(x); return; }catch(e2){}
    }
    res.status(502).json({error: "lookup failed"});
  }
}
