require("dotenv").config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");

async function main() {
  const p = new PrismaClient();
  const c = await p.conversation.findFirst({
    where: { agentKind: "EXPOSE", status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
    include: { turns: { orderBy: { createdAt: "asc" } } },
  });

  if (!c) { console.log("No active conversation"); await p.$disconnect(); return; }

  console.log("Conv:", c.id, "| Turns:", c.turns.length);
  console.log();

  for (const t of c.turns) {
    const hasOutput = t.toolOutput && JSON.stringify(t.toolOutput) !== "null";
    const hasPatch = hasOutput && JSON.stringify(t.toolOutput).includes("memoryPatch");
    console.log(
      `[${t.role}]`,
      t.toolName || "",
      hasPatch ? "HAS_PATCH" : "",
      (t.content || "").slice(0, 80).replace(/\n/g, " ")
    );
  }

  const memExtracts = c.turns.filter((t: any) => t.toolName === "memory_extract");
  console.log("\nmemory_extract turns:", memExtracts.length);

  await p.$disconnect();
}
main();
