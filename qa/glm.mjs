const DEFAULT_BASE_URL = 'https://api.z.ai/api/anthropic';
const DEFAULT_MODEL = 'glm-4.7';
const FIELDS = [
  'kind',
  'summary',
  'scenario',
  'environment',
  'viewport',
  'area',
  'reproSteps',
  'expected',
  'actual',
  'acceptanceCriteria',
  'risk',
  'confidence',
  'sensitiveAreas',
];

const SYSTEM_PROMPT = `You are a conservative web QA analyst. Return ONLY one valid JSON object with exactly these fields:
kind (bug or ux), summary, scenario, environment, viewport, area, reproSteps (string[]), expected, actual, acceptanceCriteria (string[]), risk (low|medium|high|critical), confidence (number 0..1), sensitiveAreas (string[]).
Use sensitiveAreas values only from auth, authorization, payment, personal-data, data-deletion, security, policy. Use [] when none apply.
Do not invent a defect. If evidence is insufficient, set confidence below 0.8. If any sensitive area is involved, include it even when risk is low.`;

function parseJson(text) {
  const trimmed = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const value = JSON.parse(trimmed);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('GLM response must be a JSON object');
  return value;
}

export function validateJudgment(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('GLM response must be a JSON object');
  const expectedKeys = [...FIELDS].sort();
  const keys = Object.keys(value).sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index]))
    throw new Error('GLM response has an invalid schema');
  if (
    !['bug', 'ux'].includes(value.kind) ||
    !['low', 'medium', 'high', 'critical'].includes(value.risk)
  )
    throw new Error('GLM response has an invalid kind or risk');
  for (const field of [
    'summary',
    'scenario',
    'environment',
    'viewport',
    'area',
    'expected',
    'actual',
  ]) {
    if (typeof value[field] !== 'string' || !value[field].trim())
      throw new Error(`GLM response field ${field} must be a non-empty string`);
  }
  for (const field of ['reproSteps', 'acceptanceCriteria', 'sensitiveAreas']) {
    if (!Array.isArray(value[field]) || value[field].some((item) => typeof item !== 'string'))
      throw new Error(`GLM response field ${field} must be a string array`);
  }
  if (typeof value.confidence !== 'number' || value.confidence < 0 || value.confidence > 1)
    throw new Error('GLM response confidence is invalid');
  return value;
}

export async function judgeWithGlm({
  observation,
  apiKey = process.env.GLM_API_KEY ?? process.env.ZAI_API_KEY,
  baseUrl = process.env.GLM_BASE_URL ?? DEFAULT_BASE_URL,
  model = process.env.GLM_MODEL ?? DEFAULT_MODEL,
  fetchImpl = fetch,
}) {
  if (!apiKey) throw new Error('GLM_API_KEY or ZAI_API_KEY is required');
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(observation) }],
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`GLM returned HTTP ${response.status}`);
  const payload = await response.json();
  const text = payload.content?.find((item) => item.type === 'text')?.text;
  if (typeof text !== 'string') throw new Error('GLM response did not contain text content');
  return validateJudgment(parseJson(text));
}
