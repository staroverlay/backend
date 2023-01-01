import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, Max, MaxLength, Min } from 'class-validator';

@InputType()
export default class CreateMediaDTO {
  @IsNotEmpty()
  @MaxLength(64)
  @Field(() => String)
  displayName: string;

  @IsNotEmpty()
  @Min(1) // Min: 1 Byte
  @Max(10 * 1024 * 1024 * 1024) // Max: 10MB
  @Field(() => String)
  size: number;
}
