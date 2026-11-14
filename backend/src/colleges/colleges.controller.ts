import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('colleges')
export class CollegesController {
  constructor(private readonly prisma: PrismaService) {}

  // Feeds the college dropdown on the onboarding page
  @Get()
  @UseGuards(JwtAuthGuard)
  list() {
    return this.prisma.college.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    });
  }
}
