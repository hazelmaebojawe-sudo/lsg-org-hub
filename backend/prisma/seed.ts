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
  ];

  for (const c of colleges) {
    await prisma.college.upsert({
      where: { code: c.code },
      update: { name: c.name },
      create: c,
    });
  }

  // one LSG organization per college (LSG dues belong to it)
  const allColleges = await prisma.college.findMany();
  for (const college of allColleges) {
    const existing = await prisma.organization.findFirst({
      where: { collegeId: college.id, type: "LSG" },
    });
    if (!existing) {
      await prisma.organization.create({
        data: {
          collegeId: college.id,
          name: `${college.code} Local Student Government`,
          type: "LSG",
        },
      });
    }
  }

  console.log("Colleges and LSG organizations seeded");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());