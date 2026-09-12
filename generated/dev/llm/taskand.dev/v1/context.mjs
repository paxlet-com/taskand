// Kontekst zdolności dla promptów LLM — budowany dynamicznie z proc-catalog.json
import { loadCatalog } from '../../../../_lib/catalog.mjs';

// Procesy infrastruktury, których LLM nie powinien wybierać jako akcji dla usera
const INTERNAL = /\/(dev\/(chat|llm|act|evolve|composite|execute|codegen)|developer\/spawn|planner|validator|orchestrator)\//;

export function capabilities({ organism } = {}) {
  const procs = (loadCatalog().processes || []).filter(p => p.status === 'active' && !INTERNAL.test(p.uri));
  if (!organism) return procs;
  const own = `proc://taskand.dev/${organism}/`;
  return [...procs.filter(p => p.uri.startsWith(own)), ...procs.filter(p => !p.uri.startsWith(own))];
}

export function capabilityContext(opts) {
  return capabilities(opts).map(p => `- ${p.uri} — ${p.desc || p.kind}`).join('\n');
}
