import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Image } from 'twitch-api-ts';

import { ImageObject } from './ImageObject';

@ObjectType()
export class CustomRewardObject {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  broadcaster_id: string;

  @Field(() => String)
  broadcaster_login: string;

  @Field(() => String)
  broadcaster_name: string;

  @Field(() => String)
  title: string;

  @Field(() => String)
  prompt: string;

  @Field(() => Number)
  cost: number;

  @Field(() => String)
  background_color: string;

  @Field(() => ImageObject, { nullable: true })
  image?: Image;

  @Field(() => ImageObject, { nullable: true })
  default_image: Image;
}
