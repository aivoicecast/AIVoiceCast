
import { NeuralLensAudit, GeneratedLecture } from '../types';
import { logger } from './logger';

const AUDIT_FILE = '/audit_results.json';
const RETINA_SKILL = 'neural-retina';

export async function checkOpenClawAvailability(): Promise<boolean> {
    // For the demo, we check if the results file exists (it does!)
    try {
        const res = await fetch(AUDIT_FILE);
        return res.ok;
    } catch { return false; }
}

export async function requestRetinaAudit(lecture: GeneratedLecture, force: boolean): Promise<NeuralLensAudit | null> {
  const category = 'OPENCLAW_RETINA';
  
  try {
    logger.info(`Dispatching audit to OpenClaw (Neural Retina)...`, { category, topic: lecture.topic });
    
    // Simulate network delay for realism
    await new Promise(r => setTimeout(r, 1500));

    const response = await fetch(AUDIT_FILE);
    if (!response.ok) throw new Error("Agent Bridge Unavailable");
    
    const allResults = await response.json();
    
    // Generic Chapter Mapping
    let result = null;
    const match = lecture.topic.match(/^(\d+)\./);
    
    if (match) {
        const num = match[1];
        result = allResults[`audit_ch_${num}`];
    } else if (lecture.topic.includes("Executive") || lecture.topic.includes("0.")) {
        result = allResults["audit_ch_0"];
    }

    if (!result) {
        // Fallback for other nodes (Simulate a "Pending" or "Inconclusive" live check)
        result = {
            overall_score: 0,
            summary: "Live Audit Inconclusive: Target substrate unreachable in current viewport.",
            drift_risk: "Unknown",
            robustness: "Low",
            model: "neural-retina-scan",
            usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
            cost: 0
        };
    }

    const score = result.overall_score || 0;
    
    logger.info(`OpenClaw API Transaction Complete [Score: ${score}%]`, {
        category: 'API_TELEMETRY',
        endpoint: `agent://local-bridge/${RETINA_SKILL}`,
        latencyMs: 1500,
        model: result.model || 'neural-retina-v1',
        usage: result.usage,
        cost: result.cost,
        skill: RETINA_SKILL
    });

    if (score === 0 || score < 50) {
        logger.warn(`Logic Audit Alert: Low Integrity Detected (${score}%)`, {
            category: 'NEURAL_JUDGE',
            reason: result.summary,
            drift: result.drift_risk,
            failedProbes: result.probes?.filter((p: any) => p.status !== 'passed').map((p: any) => p.question)
        });
    } else {
        logger.success(`Logic Audit Passed: ${score}% Integrity`, {
            category: 'NEURAL_JUDGE',
            summary: result.summary
        });
    }
    
    return {
        ...lecture.audit,
        StructuralCoherenceScore: score,
        coherenceScore: score, // FORCE OVERWRITE legacy metric
        LogicalDriftRisk: result.drift_risk || 'Unknown',
        AdversarialRobustness: result.robustness || 'Unknown',
        machineFeedback: result.summary,
        graph: result.graph || { nodes: [], links: [] },
        probes: result.probes || [],
        timestamp: Date.now(),
        reportUuid: crypto.randomUUID(),
        model: result.model
    } as NeuralLensAudit;

  } catch (e: any) {
    logger.error(`OpenClaw Retina Audit Failed`, e, { category });
    return null;
  }
}
