export type LabArchetype =
  | "graph_pointer"
  | "circuit_prism"
  | "pipeline_sequence"
  | "equilibrium_slider"
  | "stack_inspector";

export const ALLOWED_ARCHETYPES: LabArchetype[] = [
  "graph_pointer",
  "circuit_prism",
  "pipeline_sequence",
  "equilibrium_slider",
  "stack_inspector",
];

export interface PyqLabConfig {
  id: string;
  originalQuery: string;
  labTitle: string;
  detectedSubjectCode: string;
  archetype: LabArchetype;
  missionObjective: string;
  nodesOrControls: string[];
  correctSequenceOrTarget: string;
  hintBeamTarget: string;
  ahaIntuition: string;
  source: "gemini" | "local";
}

export const SAMPLE_PYQ_CHIPS = [
  "PCC-CS301: Detect and remove a loop in a singly linked list (Floyd's Cycle)",
  "ESC-301: Simplify F(A,B,C) = Σm(1,3,5,7) using universal NAND/XOR gates",
  "PCC-CS302: Trace memory address flow during an indirect LOAD instruction cycle",
] as const;
