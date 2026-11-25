import { PyqLabConfig } from "./pyqLab";

export type GameId =
  | "pointer-3d"
  | "fetch-cycle"
  | "laser-prism"
  | "bridge-kings"
  | "break-even"
  | "stack-surgeon";

export type AppView =
  | { screen: "hub" }
  | { screen: "exam-season" }
  | { screen: "placement-season"; tab?: "aptitude" | "interview" | "project-forge" | "dsa-session" }
  | { screen: "game"; gameId: GameId }
  | { screen: "custom-lab"; config: PyqLabConfig };

export interface SubjectMeta {
  id: GameId;
  code: string;
  subjectName: string;
  gameTitle: string;
  shortTag: string;
  credits: number;
  description: string;
  accent: string;
  totalLevels: number;
}

export const SEMESTER_3_SUBJECTS: SubjectMeta[] = [
  {
    id: "pointer-3d",
    code: "PCC-CS301",
    subjectName: "Data Structures & Algorithms",
    gameTitle: "Unknot the Pointer 3D",
    shortTag: "Linked Lists & Cycles",
    credits: 4,
    description:
      "Rewire live 3D heap memory nodes, break Floyd pointer cycles, insert nodes safely, and reverse linked lists.",
    accent: "#00F5D4",
    totalLevels: 3,
  },
  {
    id: "fetch-cycle",
    code: "PCC-CS302",
    subjectName: "Computer Organization & Architecture",
    gameTitle: "Ghost in the Fetch Cycle",
    shortTag: "CPU Pipeline & Hazards",
    credits: 4,
    description:
      "Orchestrate Fetch, Decode, and Execute stages inside a 3D superscalar processor chamber and resolve RAW data hazards.",
    accent: "#38BDF8",
    totalLevels: 3,
  },
  {
    id: "laser-prism",
    code: "ESC-301",
    subjectName: "Analog & Digital Electronics",
    gameTitle: "Laser Prism Logic",
    shortTag: "Boolean Optics & Gates",
    credits: 4,
    description:
      "Rotate 3D dielectric mirrors and configure crystal AND, OR, NOT, NAND, and XOR prisms to route live laser beams.",
    accent: "#8B5CF6",
    totalLevels: 3,
  },
  {
    id: "bridge-kings",
    code: "BSC-301",
    subjectName: "Mathematics-III",
    gameTitle: "Bridge of Kings",
    shortTag: "ODEs, Laplace & Eigenvalues",
    credits: 3.5,
    description:
      "Stabilize oscillating 3D harmonic bridges across floating islands by solving Laplace transforms, ODEs, and eigenvalues.",
    accent: "#F59E0B",
    totalLevels: 3,
  },
  {
    id: "break-even",
    code: "HSMC-301",
    subjectName: "Economics for Engineers",
    gameTitle: "Break-Even Horizon",
    shortTag: "Cost Curves & Margin",
    credits: 3,
    description:
      "Command a 3D cyber-factory floor, tune price, fixed/variable costs, and output volume to hit break-even and profit targets.",
    accent: "#10B981",
    totalLevels: 3,
  },
  {
    id: "stack-surgeon",
    code: "PCC-CS393",
    subjectName: "Python / IT Workshop Lab",
    gameTitle: "Stack-Frame Surgeon 3D",
    shortTag: "Call Stack & Debugging",
    credits: 2,
    description:
      "Inspect 3D Python call-stack towers, trace local variable frames, halt infinite recursion, and patch scope bugs.",
    accent: "#EC4899",
    totalLevels: 3,
  },
];

export interface SavedProjectBlueprint {
  id: string;
  title: string;
  domain: string;
  difficulty: string;
  problemStatement: string;
  proposedSolution: string;
  coreFeatures: string[];
  techStack: string[];
  roadmap: string[];
  extensions: string[];
  createdAt: string;
  source: "gemini" | "local";
}

export interface NexusProgress {
  xp: number;
  streak: number;
  lastActiveDate: string;
  completedLevels: Record<GameId, number[]>;
  bestScores: Record<GameId, number>;
  aptitudeBestScore: number;
  aptitudeAttempts: number;
  interviewShieldsCleared: number[];
  savedProjects: SavedProjectBlueprint[];
  activityLog: { id: string; text: string; xpDelta?: number; timestamp: string }[];
}
