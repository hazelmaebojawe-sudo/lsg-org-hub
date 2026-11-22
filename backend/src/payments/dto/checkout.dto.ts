import { IsUUID } from 'class-validator';

export class CheckoutDto {
  @IsUUID('all', { message: 'Choose a fee to pay' })
  feeItemId!: string;
}