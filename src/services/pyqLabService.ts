import {
  ALLOWED_ARCHETYPES,
  LabArchetype,
  PyqLabConfig,
  SAMPLE_PYQ_CHIPS,
} from "../types/pyqLab";
import { isClientRateLimited, markClientRateLimited } from "./aiService";

// Prebuilt Local Fallbacks for the 3 Canonical Sample PYQs
const FALLBACK_FLOYD: Omit<PyqLabConfig, "id" | "originalQuery" | "source"> = {
  labTitle: "Floyd's Cycle Detection Protocol",
  detectedSubjectCode: "PCC-CS301",
  archetype: "graph_pointer",
  missionObjective:
    "Identify the cycle in a singly linked list using slow and fast pointers, then remove the loop correctly.",
  nodesOrControls: [
    "Initialize slow pointer",
    "Initialize fast pointer",
    "Advance slow by one node",
    "Advance fast by two nodes",
    "Detect pointer collision",
    "Break the cycle",
  ],
  correctSequenceOrTarget:
    "Detect the meeting point using Floyd's algorithm, identify the cycle entry, and update the predecessor pointer to NULL to remove the loop.",
  hintBeamTarget: "Compare the slow and fast pointer positions after each traversal.",
  ahaIntuition:
    "The fast pointer moves twice as quickly as the slow pointer, making a collision inside a cycle detectable.",
};

const FALLBACK_BOOLEAN: Omit<PyqLabConfig, "id" | "originalQuery" | "source"> = {
  labTitle: "NAND Logic Prism",
  detectedSubjectCode: "ESC-301",
  archetype: "circuit_prism",
  missionObjective:
    "Simplify the given three-variable Boolean function and construct a valid gate-level realization.",
  nodesOrControls: [
    "Select minterm 1",
    "Select minterm 3",
    "Select minterm 5",
    "Select minterm 7",
    "Configure logic gates",
    "Verify the output",
  ],
  correctSequenceOrTarget:
    "For the stated minterms, F(A,B,C) = C. Verify all eight input combinations and construct a valid NAND-based realization.",
  hintBeamTarget: "Observe which variable remains constant across all selected minterms.",
  ahaIntuition:
    "All four selected minterms have C equal to 1, so the simplified function is independent of A and B.",
};

const FALLBACK_INDIRECT_LOAD: Omit<PyqLabConfig, "id" | "originalQuery" | "source"> = {
  labTitle: "Indirect LOAD Memory Trace",
  detectedSubjectCode: "PCC-CS302",
  archetype: "pipeline_sequence",
  missionObjective:
    "Trace the effective address and memory data movement during an indirect LOAD instruction.",
  nodesOrControls: [
    "Fetch the instruction",
    "Decode the indirect addressing mode",
    "Read the address field",
    "Fetch the effective address",
    "Access the operand from memory",
    "Load the operand into the destination register",
  ],
  correctSequenceOrTarget:
    "Fetch and decode the instruction, retrieve the effective address through the indirect memory reference, fetch the operand, and load it into the destination register.",
  hintBeamTarget:
    "Distinguish the address stored in the instruction from the effective address stored in memory.",
  ahaIntuition:
    "Indirect addressing requires an additional memory reference because the instruction initially points to the location containing the effective address.",
};

function buildKeywordFallback(query: string): Omit<PyqLabConfig, "id" | "originalQuery" | "source"> {
  const q = query.toLowerCase();

  // Exact sample matches first
  if (
    query.trim() === SAMPLE_PYQ_CHIPS[0] ||
    (q.includes("floyd") && q.includes("cycle")) ||
    (q.includes("linked list") && q.includes("loop"))
  ) {
    return FALLBACK_FLOYD;
  }

  if (
    query.trim() === SAMPLE_PYQ_CHIPS[1] ||
    (q.includes("f(a,b,c)") && q.includes("1,3,5,7")) ||
    q.includes("nand") ||
    q.includes("k-map") ||
    q.includes("kmap") ||
    q.includes("boolean") ||
    q.includes("esc-301") ||
    q.includes("logic gate")
  ) {
    if (q.includes("1,3,5,7") || query.trim() === SAMPLE_PYQ_CHIPS[1]) {
      return FALLBACK_BOOLEAN;
    }
    return {
      labTitle: "Boolean Gate Realization Prism",
      detectedSubjectCode: "ESC-301",
      archetype: "circuit_prism",
      missionObjective:
        "Simplify the Boolean expression and align the optical NAND/logic gate prism to verify the truth table.",
      nodesOrControls: [
        "Align input laser emitters",
        "Group adjacent K-Map minterms",
        "Eliminate redundant literals",
        "Select universal NAND gate configuration",
        "Verify truth-table output",
      ],
      correctSequenceOrTarget:
        "Simplify adjacent minterms via K-Map grouping and implement the minimized SOP expression using universal NAND gates.",
      hintBeamTarget:
        "Look for variables that appear in both complemented and uncomplemented forms across grouped minterms.",
      ahaIntuition:
        "NAND gates are functionally complete, letting any minimized Boolean expression be realized using two-level NAND-NAND logic.",
    };
  }

  if (
    query.trim() === SAMPLE_PYQ_CHIPS[2] ||
    q.includes("indirect load") ||
    q.includes("pcc-cs302") ||
    q.includes("pipeline") ||
    q.includes("fetch") ||
    q.includes("hazard") ||
    q.includes("addressing mode") ||
    q.includes("cache")
  ) {
    if (q.includes("indirect") || query.trim() === SAMPLE_PYQ_CHIPS[2]) {
      return FALLBACK_INDIRECT_LOAD;
    }
    return {
      labTitle: "CPU Micro-Op Pipeline Trace",
      detectedSubjectCode: "PCC-CS302",
      archetype: "pipeline_sequence",
      missionObjective:
        "Sequence the processor micro-operations across Fetch, Decode, Memory, and Execute chambers without stalling.",
      nodesOrControls: [
        "Fetch instruction from PC",
        "Decode opcode and operands",
        "Check register dependencies",
        "Execute ALU or address calculation",
        "Write back result to register file",
      ],
      correctSequenceOrTarget:
        "Fetch from PC, Decode control signals, resolve dependencies, Execute in ALU, and Write Back cleanly.",
      hintBeamTarget: "Ensure instruction fetch and decode strictly precede ALU execution.",
      ahaIntuition:
        "Pipelining overlaps instruction stages across clock cycles while preserving sequential data dependencies.",
    };
  }

  if (
    q.includes("python") ||
    q.includes("pcc-cs393") ||
    q.includes("recursion") ||
    q.includes("stack frame") ||
    q.includes("decorator") ||
    q.includes("closure") ||
    q.includes("ast")
  ) {
    return {
      labTitle: "CPython Call-Stack Trace Lab",
      detectedSubjectCode: "PCC-CS393",
      archetype: "stack_inspector",
      missionObjective:
        "Inspect active Python stack frames, trace local bindings, and resolve the execution scope defect.",
      nodesOrControls: [
        "Push outer call frame",
        "Inspect local variable bindings",
        "Verify base termination condition",
        "Unwind return value across frames",
        "Pop completed frame cleanly",
      ],
      correctSequenceOrTarget:
        "Trace frame allocation in LIFO order, verify the base condition, and unwind return values back to the caller.",
      hintBeamTarget: "Inspect the top frame's local variables before unwinding to the caller.",
      ahaIntuition:
        "Each Python function invocation isolates its local namespace inside a dedicated stack frame popped on return.",
    };
  }

  if (
    q.includes("laplace") ||
    q.includes("eigen") ||
    q.includes("differential") ||
    q.includes("ode") ||
    q.includes("fourier") ||
    q.includes("bsc-301") ||
    q.includes("integral")
  ) {
    return {
      labTitle: "Harmonic Differential Equilibrium",
      detectedSubjectCode: "BSC-301",
      archetype: "equilibrium_slider",
      missionObjective:
        "Calibrate the mathematical parameter slider to stabilize the oscillating system and reach analytical equilibrium.",
      nodesOrControls: [
        "Identify governing equation",
        "Transform or factor auxiliary roots",
        "Adjust damping / pole slider",
        "Verify steady-state equilibrium",
      ],
      correctSequenceOrTarget:
        "Match the analytical root or Laplace pole parameter to bring system oscillation error to zero.",
      hintBeamTarget: "Check the sign and magnitude of the characteristic roots or s-domain pole.",
      ahaIntuition:
        "The characteristic roots or Laplace poles directly govern whether a system decays smoothly or diverges.",
    };
  }

  if (
    q.includes("break-even") ||
    q.includes("breakeven") ||
    q.includes("cost") ||
    q.includes("npv") ||
    q.includes("marginal") ||
    q.includes("hsmc-301") ||
    q.includes("profit") ||
    q.includes("revenue")
  ) {
    return {
      labTitle: "Cost-Volume Equilibrium Lab",
      detectedSubjectCode: "HSMC-301",
      archetype: "equilibrium_slider",
      missionObjective:
        "Adjust production volume and pricing sliders to balance Total Revenue against Total Cost at equilibrium.",
      nodesOrControls: [
        "Inspect fixed cost baseline",
        "Calculate unit contribution margin",
        "Adjust production volume slider",
        "Verify break-even or target profit",
      ],
      correctSequenceOrTarget:
        "Set production quantity Q = Fixed Cost / (Price - Variable Cost) so Total Revenue equals Total Cost.",
      hintBeamTarget: "Divide Fixed Cost by unit contribution margin (Selling Price minus Variable Cost).",
      ahaIntuition:
        "Each unit sold above variable cost contributes toward fixed overhead until the break-even threshold is crossed.",
    };
  }

  // Default DSA graph_pointer fallback
  return {
    labTitle: "DSA Pointer & Structure Lab",
    detectedSubjectCode: "PCC-CS301",
    archetype: "graph_pointer",
    missionObjective:
      "Analyze the data structure transitions and sequence the pointer/node operations in valid order.",
    nodesOrControls: [
      "Inspect head / root reference",
      "Traverse connected memory nodes",
      "Validate invariant condition",
      "Commit O(1) pointer update",
      "Verify termination at NULL",
    ],
    correctSequenceOrTarget:
      "Traverse the structure safely, update references in order without dropping links, and verify termination.",
    hintBeamTarget: "Save the next reference before mutating any active node pointer.",
    ahaIntuition:
      "Preserving forward references before mutating links guarantees O(1) structural updates without memory leaks.",
  };
}

export function validatePyqLabConfig(
  raw: unknown,
  originalQuery: string,
  source: "gemini" | "local"
): PyqLabConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const labTitle = typeof obj.labTitle === "string" ? obj.labTitle.trim() : "";
  const detectedSubjectCode =
    typeof obj.detectedSubjectCode === "string" ? obj.detectedSubjectCode.trim() : "";
  const archetype = obj.archetype as LabArchetype;
  const missionObjective =
    typeof obj.missionObjective === "string" ? obj.missionObjective.trim() : "";
  const nodesOrControls = Array.isArray(obj.nodesOrControls)
    ? obj.nodesOrControls
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
        .slice(0, 6)
    : [];
  const correctSequenceOrTarget =
    typeof obj.correctSequenceOrTarget === "string" ? obj.correctSequenceOrTarget.trim() : "";
  const hintBeamTarget =
    typeof obj.hintBeamTarget === "string" ? obj.hintBeamTarget.trim() : "";
  const ahaIntuition = typeof obj.ahaIntuition === "string" ? obj.ahaIntuition.trim() : "";

  if (
    !labTitle ||
    !detectedSubjectCode ||
    !ALLOWED_ARCHETYPES.includes(archetype) ||
    !missionObjective ||
    nodesOrControls.length < 4 ||
    !correctSequenceOrTarget ||
    !hintBeamTarget ||
    !ahaIntuition
  ) {
    return null;
  }

  return {
    id: `custom-${Date.now()}`,
    originalQuery,
    labTitle,
    detectedSubjectCode,
    archetype,
    missionObjective,
    nodesOrControls,
    correctSequenceOrTarget,
    hintBeamTarget,
    ahaIntuition,
    source,
  };
}

export async function generatePyqLab(query: string): Promise<PyqLabConfig> {
  const trimmed = query.trim();

  if (isClientRateLimited()) {
    const fb = buildKeywordFallback(trimmed);
    return {
      ...fb,
      id: `custom-${Date.now()}`,
      originalQuery: trimmed,
      source: "local",
    };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch("/api/ai/pyq-lab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: trimmed }),
      signal: controller.signal,
    });
    if (res.status === 429) {
      try {
        const errData = await res.clone().json();
        markClientRateLimited(errData?.retryAfterSeconds ?? 15);
      } catch {
        markClientRateLimited(15);
      }
      throw new Error("HTTP 429");
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const validated = validatePyqLabConfig(data, trimmed, "gemini");
    if (validated) {
      return validated;
    }
    throw new Error("Schema validation failed");
  } catch {
    const fb = buildKeywordFallback(trimmed);
    return {
      ...fb,
      id: `custom-${Date.now()}`,
      originalQuery: trimmed,
      source: "local",
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}
