require("dotenv").config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");
async function main() {
  const p = new PrismaClient();
  const props = await p.property.findMany({
    include: {
      media: { select: { kind: true, fileName: true } },
      listings: { select: { id: true, status: true }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
  for (const pr of props) {
    const photos = pr.media.filter((m: any) => m.kind === "PHOTO").length;
    const fp = pr.media.filter((m: any) => m.kind === "FLOORPLAN").length;
    console.log(pr.id.slice(0, 12), pr.street, pr.houseNumber, "|", photos, "photos", fp, "floorplans |", pr.listings[0]?.status || "no listing", pr.listings[0]?.id?.slice(0, 12) || "");
  }
  await p.$disconnect();
}
main();
