export async function createSamplePyqImageFile(): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context unavailable");
  }

  // Crisp exam paper background
  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle exam border
  ctx.strokeStyle = "#CBD5E1";
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // University Header
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText("MAULANA ABUL KALAM AZAD UNIVERSITY OF TECHNOLOGY, WB", 48, 66);

  ctx.fillStyle = "#334155";
  ctx.font = "600 16px monospace";
  ctx.fillText("B.TECH IT · SEMESTER III · PAPER CODE: PCC-CS301 (DATA STRUCTURES)", 48, 96);

  ctx.strokeStyle = "#94A3B8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(48, 114);
  ctx.lineTo(canvas.width - 48, 114);
  ctx.stroke();

  // Exam Question Text
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 21px sans-serif";
  ctx.fillText("Q.3 (b) [8 Marks]:", 48, 154);

  ctx.font = "500 19px sans-serif";
  ctx.fillStyle = "#1E293B";
  ctx.fillText(
    "Explain Floyd's Tortoise and Hare Cycle Detection algorithm on a singly",
    48,
    188
  );
  ctx.fillText(
    "linked list. Given nodes 10 -> 20 -> 30 -> 40 pointing back to node 20,",
    48,
    218
  );
  ctx.fillText(
    "trace slow and fast pointers to detect and safely break the pointer loop.",
    48,
    248
  );

  // Clean Linked List + Cycle Diagram
  const nodeValues = ["10", "20", "30", "40"];
  const startX = 110;
  const nodeY = 340;
  const gapX = 210;

  nodeValues.forEach((val, idx) => {
    const x = startX + idx * gapX;
    ctx.fillStyle = idx === 1 ? "#E0F2FE" : "#FFFFFF";
    ctx.strokeStyle = idx === 1 ? "#0284C7" : "#0F172A";
    ctx.lineWidth = 2.5;
    ctx.fillRect(x, nodeY, 96, 54);
    ctx.strokeRect(x, nodeY, 96, 54);

    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 22px monospace";
    ctx.fillText(val, x + 34, nodeY + 35);

    if (idx < nodeValues.length - 1) {
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 96, nodeY + 27);
      ctx.lineTo(x + gapX - 8, nodeY + 27);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + gapX - 18, nodeY + 20);
      ctx.lineTo(x + gapX - 6, nodeY + 27);
      ctx.lineTo(x + gapX - 18, nodeY + 34);
      ctx.stroke();
    }
  });

  // Cycle back-edge from node 40 back to node 20
  const node40Right = startX + 3 * gapX + 48;
  const node20Center = startX + 1 * gapX + 48;
  ctx.strokeStyle = "#DC2626";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(node40Right, nodeY + 54);
  ctx.lineTo(node40Right, nodeY + 115);
  ctx.lineTo(node20Center, nodeY + 115);
  ctx.lineTo(node20Center, nodeY + 58);
  ctx.stroke();

  // Arrowhead pointing up to 20
  ctx.beginPath();
  ctx.moveTo(node20Center - 7, nodeY + 70);
  ctx.lineTo(node20Center, nodeY + 56);
  ctx.lineTo(node20Center + 7, nodeY + 70);
  ctx.stroke();

  ctx.fillStyle = "#DC2626";
  ctx.font = "bold 16px monospace";
  ctx.fillText("CYCLE EDGE: 40 -> 20 (Break Loop)", node20Center + 95, nodeY + 106);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );
  if (!blob) {
    throw new Error("Could not generate sample PYQ PNG");
  }

  return new File([blob], "makaut-pyq-pcc-cs301-sample.png", { type: "image/png" });
}
