const ACTIONS = new Set(['click', 'fill', 'press', 'wait', 'screenshot']);
import { sanitizeUrl } from '../scripts/qa-report.mjs';

export function validateScenario(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('scenario must be an object');
  if (typeof input.name !== 'string' || !input.name.trim())
    throw new Error('scenario.name is required');
  let targetUrl;
  try {
    targetUrl = sanitizeUrl(input.targetUrl);
  } catch {
    throw new Error('scenario.targetUrl must be an http(s) URL without credentials');
  }
  if (!Array.isArray(input.steps) || input.steps.length < 1 || input.steps.length > 30)
    throw new Error('scenario.steps must contain 1-30 steps');
  const viewport = input.viewport ?? { width: 1440, height: 900 };
  if (
    !Number.isInteger(viewport.width) ||
    !Number.isInteger(viewport.height) ||
    viewport.width < 320 ||
    viewport.height < 320
  ) {
    throw new Error('scenario.viewport must contain valid width and height');
  }
  const steps = input.steps.map((step, index) => {
    if (!step || typeof step !== 'object' || !ACTIONS.has(step.action))
      throw new Error(`step ${index + 1} has an unsupported action`);
    if (
      ['click', 'fill', 'press'].includes(step.action) &&
      (typeof step.selector !== 'string' || !step.selector.trim())
    ) {
      throw new Error(`step ${index + 1} requires selector`);
    }
    if (step.action === 'fill' && typeof step.value !== 'string')
      throw new Error(`step ${index + 1} requires value`);
    if (step.action === 'press' && typeof step.key !== 'string')
      throw new Error(`step ${index + 1} requires key`);
    if (step.action === 'wait' && (!Number.isInteger(step.ms) || step.ms < 0 || step.ms > 10000)) {
      throw new Error(`step ${index + 1} wait must be 0-10000ms`);
    }
    return {
      ...step,
      label: typeof step.label === 'string' ? step.label.slice(0, 120) : `${step.action} step`,
    };
  });
  return {
    name: input.name.slice(0, 120),
    targetUrl,
    viewport,
    steps,
    environment:
      typeof input.environment === 'string' && input.environment.trim()
        ? input.environment.slice(0, 80)
        : 'staging',
  };
}
