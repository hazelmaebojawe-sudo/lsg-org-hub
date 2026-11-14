import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { Profile } from 'passport-google-oauth20';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Create the user on first sign-in, or link an existing record. New users start as STUDENT. */
  async findOrCreateFromGoogle(profile: Profile) {
    const email = profile.emails?.[0]?.value?.toLowerCase();
    if (!email) {
      throw new UnauthorizedException('Your Google account has no email');
    }

    // Optional: restrict sign-in to the school's email domain (leave unset while testing)
    const domain = process.env.ALLOWED_EMAIL_DOMAIN;
    if (domain && !email.endsWith(`@${domain.toLowerCase()}`)) {
      throw new ForbiddenException(`Please sign in with your @${domain} account`);
    }

    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.id },
    });

    if (!user) {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      user = existing
        ? await this.prisma.user.update({
            where: { id: existing.id },
            data: { googleId: profile.id },
          })
        : await this.prisma.user.create({
            data: {
              googleId: profile.id,
              email,
              fullName: profile.displayName || email,
              role: Role.STUDENT,
            },
          });
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account has been deactivated');
    }
    return user;
  }

  signToken(user: { id: string; role: Role }) {
    return this.jwt.sign({ sub: user.id, role: user.role });
  }
}
