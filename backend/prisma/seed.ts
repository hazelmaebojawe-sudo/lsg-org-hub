import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const colleges = [
  { code: "CCIS", name: "College of Computing and Information Sciences" },
  { code: "CEGS", name: "College of Engineering and Geosciences" },
  { code: "CHASS", name: "College of Humanities and Social Sciences" },
  { code: "CAA", name: "College of Agriculture and Agri-Industries" },
  { code: "CFES", name: "College of Forestry and Environmental Science" },
  { code: "CMNS", name: "College of Mathematics and Natural Sciences" },
  { code: "CED", name: "College of Education" },
  { code: "COM", name: "College of Medicine" },
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