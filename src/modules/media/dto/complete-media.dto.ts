import { Field, InputType } from '@nestjs/graphql';
import { IsMongoId, IsNotEmpty } from 'class-validator';

@InputType()
export class MediaPart {
  @Field(() => String)
  etag: string;
  @Field(() => Number)
  partNumber: number;
}

@InputType()
export default class CompleteMediaDTO {
  @IsNotEmpty()
  @IsMongoId()
  @Field(() => String)
  id: string;

  @IsNotEmpty()
  @Field(() => [MediaPart])
  parts: MediaPart[];

  @Field(() => [MediaPart])
  thumbnailParts: MediaPart[];
}
