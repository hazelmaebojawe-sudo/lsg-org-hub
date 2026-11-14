import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const colleges = [
    { code: "CCIS", name: "College of Computing and Information Sciences" },
    { code: "CEIT", name: "College of Engineering and Information Technology" },
    // add the rest of your colleges here
  ];

  for (const c of colleges) {
    await prisma.college.upsert({
      where: { code: c.code },
      update: { name: c.name },
      create: c,
    });
  }
  console.log("Colleges seeded");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());