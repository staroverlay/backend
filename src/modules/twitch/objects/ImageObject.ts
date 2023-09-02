import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ImageObject {
  @Field(() => String)
  url_1x: string;

  @Field(() => String)
  url_2x: string;

  @Field(() => String)
  url_4x: string;
}
