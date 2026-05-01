require("dotenv").config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");
async function main() {
  const p = new PrismaClient();
  const r = await p.listing.updateMany({
    where: { property: { OR: [{ id: "cmomo0wj002fyj0ks4elb4lq0" }, { parentId: "cmomo0wj002fyj0ks4elb4lq0" }] } },
    data: { status: "ACTIVE" },
  });
  console.log("Reset", r.count, "listings to ACTIVE");
  await p.$disconnect();
}
main();
