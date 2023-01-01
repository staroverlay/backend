import { Field, InputType } from '@nestjs/graphql';
import { IsMongoId, IsNotEmpty } from 'class-validator';

@InputType()
export default class UploadMediaDTO {
  @IsNotEmpty()
  @IsMongoId()
  @Field(() => String)
  id: string;

  @IsNotEmpty()
  @Field(() => String)
  writeToken: string;
}
