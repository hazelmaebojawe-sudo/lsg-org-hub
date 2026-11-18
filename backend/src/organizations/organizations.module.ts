import { Module } from '@nestjs/common';
import { OfficersController } from './officers.controller';
import { OfficersService } from './officers.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  controllers: [OrganizationsController, OfficersController],
  providers: [OrganizationsService, OfficersService],
})
export class OrganizationsModule {}
