
import { NeuralLensAudit, GeneratedLecture } from '../types';
import { logger } from './logger';

const GATEWAY_URL = 'http://localhost:18792'; // Default OpenClaw Gateway HTTP
const RETINA_SKILL = 'neural-retina';

export async function checkOpenClawAvailability(): Promise<boolean> {
  try {
    // Simple health check or ping
    const res = await fetch(`${GATEWAY_URL}/health`, { method: 'GET' });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function requestRetinaAudit(lecture: GeneratedLecture, force: boolean): Promise<NeuralLensAudit | null> {
  const category = 'OPENCLAW_RETINA';
  
  try {
    const payload = {
        skill: RETINA_SKILL,
        action: 'audit',
        params: {
            documentText: lecture.sections.map(s => `${s.speaker}: ${s.text}`).join('\n'),
            topic: lecture.topic,
            force: force
        }
    };

    logger.info(`Dispatching audit to OpenClaw (Neural Retina)...`, { category, topic: lecture.topic });

    const startTime = performance.now();
    const response = await fetch(`${GATEWAY_URL}/v1/skills/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const latency = performance.now() - startTime;

    if (!response.ok) {
        throw new Error(`OpenClaw returned ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    
    // Log detailed telemetry for transparency
    logger.info(`OpenClaw API Transaction Complete`, {
        category: 'API_TELEMETRY',
        endpoint: `${GATEWAY_URL}/v1/skills/invoke`,
        latencyMs: Math.round(latency),
        model: result.model || 'openclaw-agent-v1',
        usage: {
            inputTokens: result.usage?.input_tokens || 0,
            outputTokens: result.usage?.output_tokens || 0,
            totalTokens: result.usage?.total_tokens || 0
        },
        cost: result.cost || 0,
        skill: RETINA_SKILL
    });
    
    // Map OpenClaw's generic response to NeuralLensAudit
    // Assuming the skill returns { structural_score, drift_risk, graph: {...}, ... }
    return {
        ...lecture.audit, // Keep existing metadata if any
        StructuralCoherenceScore: result.overall_score || 0,
        LogicalDriftRisk: result.drift_risk || 'Unknown',
        AdversarialRobustness: result.robustness || 'Unknown',
        machineFeedback: result.summary || 'Verified by Neural Retina',
        graph: result.graph || { nodes: [], links: [] },
        probes: result.probes || [],
        timestamp: Date.now(),
        reportUuid: result.audit_id || crypto.randomUUID(),
        model: 'neural-retina-v1'
    } as NeuralLensAudit;

  } catch (e: any) {
    logger.error(`OpenClaw Retina Audit Failed`, e, { category });
    return null;
  }
}
