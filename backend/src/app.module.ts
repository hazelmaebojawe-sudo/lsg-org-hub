import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AnnouncementsModule } from './announcements/announcements.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CaptchaModule } from './captcha/captcha.module';
import { ClearanceModule } from './clearance/clearance.module';
import { CollegesModule } from './colleges/colleges.module';
import { FeesModule } from './fees/fees.module';
import { MailModule } from './mail/mail.module';
import { MembershipsModule } from './memberships/memberships.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]), // 60 requests/minute per IP
    CacheModule.register({ isGlobal: true, ttl: 5 * 60 * 1000 }), // default expiry: 5 min
    PrismaModule,
    StorageModule,
    MailModule,
    AuthModule,
    CaptchaModule,
    CollegesModule,
    OrganizationsModule,
    AnnouncementsModule,
    MembershipsModule,
    FeesModule,
    PaymentsModule,
    ClearanceModule,
    ProfileModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}