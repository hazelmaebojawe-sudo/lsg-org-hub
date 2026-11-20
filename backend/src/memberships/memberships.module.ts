import { Module } from '@nestjs/common';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';
import { OrgMembershipsController } from './org-memberships.controller';

@Module({
  controllers: [MembershipsController, OrgMembershipsController],
  providers: [MembershipsService],
})
export class MembershipsModule {}