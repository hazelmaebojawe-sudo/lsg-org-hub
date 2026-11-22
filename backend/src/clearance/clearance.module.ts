import { Module } from '@nestjs/common';
import { ClearanceController } from './clearance.controller';
import { ClearanceService } from './clearance.service';

@Module({
  controllers: [ClearanceController],
  providers: [ClearanceService],
})
export class ClearanceModule {}