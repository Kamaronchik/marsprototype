const MODEL = () => process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const TIMEOUT_MS = 20 * 1000;

// Asks the model. maxOutputTokens limits the length of the answer. system = rules and facts, history = [{ role: 'user' | 'model', text }], text = the new question.
// Returns the answer text; throws when the service is not reachable or answers with an error.
const askGemini = async ({ system, history = [], text, maxOutputTokens = 600 }) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set in .env');

  const contents = [...history, { role: 'user', text }].map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens, temperature: 0.4 },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Gemini error ${response.status}: ${json?.error?.message ?? 'no details'}`);

  const answer = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
  if (!answer) throw new Error('Gemini returned an empty answer');
  return answer;
};

module.exports = { askGemini };
