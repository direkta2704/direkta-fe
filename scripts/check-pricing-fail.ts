require("dotenv").config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");

async function main() {
  const p = new PrismaClient();
  const run = await p.agentRun.findFirst({ where: { conversationId: "cmolfh1ih0013lsskz905yzpf" } });
  if (!run) { console.log("No run"); return; }

  const steps = await p.agentStep.findMany({
    where: { agentRunId: run.id, toolName: "pricing_recommend" },
    orderBy: { ordinal: "desc" },
    take: 3,
  });

  for (const s of steps) {
    console.log("--- Step", s.ordinal, "---");
    console.log("OK:", s.ok);
    console.log("Error:", s.error);
    console.log("Input:", JSON.stringify(s.input, null, 2).slice(0, 500));
    console.log("Output:", JSON.stringify(s.output, null, 2).slice(0, 500));
    console.log();
  }
  await p.$disconnect();
}
main();
