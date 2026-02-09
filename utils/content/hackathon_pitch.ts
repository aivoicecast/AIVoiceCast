import { SpotlightChannelData } from '../spotlightContent';

export const HACKATHON_PITCH_CONTENT: Record<string, SpotlightChannelData> = {
  'hackathon-pitch': {
    curriculum: [
      {
        id: 'pitch-ch1',
        title: 'The 180-Second Refraction',
        subTopics: [
          { id: 'pitch-1-1', title: 'Neural Lens: Verification over Generation' }
        ]
      }
    ],
    lectures: {
      "Neural Lens: Verification over Generation": {
        topic: "Neural Lens: Verification over Generation",
        professorName: "Chief Architect",
        studentName: "Hackathon Judge",
        sections: [
          {
            speaker: "Teacher",
            text: "Good afternoon. Most AI apps are 'Agreeable Assistants'—they prioritize comfort over truth. We built Neural Prism to be a **Reasoning Instrument.** We've collapsed 24 specialized tools—from Finance Labs to Builder IDEs—into a single refractive substrate."
          },
          {
            speaker: "Student",
            text: "What makes this different from a standard chatbot wrapper?"
          },
          {
            speaker: "Teacher",
            text: "The **Neural Lens.** While Gemini 3 is the most fluent model ever built, it suffers from 'Silent Drift.' It can add a feature while breaking a core logic invariant. The Lens turns Gemini into a formal verifier of its own understanding. It extracts a logic mesh, launches adversarial probes, and computes a **Structural Coherence Score.** [METRIC: COHERENCE_98]"
          },
          {
            speaker: "Student",
            text: "And the efficiency? How do you scale this many apps?"
          },
          {
            speaker: "Teacher",
            text: "The **18x Efficiency Proof.** We route interaction to Flash and audit via Pro. We bypass physical infrastructure in our Code Studio using heuristic simulation, achieving a 10x energy saving. We sharded the binary wall with our BCP Protocol. We aren't just prompting; we are orchestrating thermodynamics. [METRIC: ROBUST_HIGH]"
          },
          {
            speaker: "Teacher",
            text: "Neural Prism is the bridge to the 10:1 Resident/Hub ratio. A future where intelligence is a zero-marginal-cost utility. Refraction complete. Thank you."
          }
        ],
        audit: {
          graph: {
            nodes: [
              { id: '1', label: 'Neural Lens', type: 'component' },
              { id: '2', label: 'Gemini 3 Pro/Flash', type: 'component' },
              { id: '3', label: '18x Efficiency', type: 'metric' },
              { id: '4', label: 'Sovereignty', type: 'concept' }
            ],
            links: [
              { source: '2', target: '1', label: 'Powers' },
              { source: '1', target: '4', label: 'Ensures' },
              { source: '3', target: '2', label: 'Optimizes' }
            ]
          },
          probes: [
            { 
              question: "How is 'Silent Drift' detected?", 
              answer: "The Shadow Agent cross-references current logic against the extracted dependency graph to find contradictions.",
              status: 'passed'
            }
          ],
          coherenceScore: 98,
          // Added missing required properties for NeuralLensAudit
          StructuralCoherenceScore: 98,
          LogicalDriftRisk: 'Low',
          AdversarialRobustness: 'High',
          driftRisk: 'Low',
          robustness: 'High',
          timestamp: Date.now()
        }
      }
    }
  }
};