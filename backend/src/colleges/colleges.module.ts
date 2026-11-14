import { Module } from '@nestjs/common';
import { CollegesController } from './colleges.controller';

@Module({ controllers: [CollegesController] })
export class CollegesModule {}
