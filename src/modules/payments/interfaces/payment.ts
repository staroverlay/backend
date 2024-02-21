import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export default class Payment {
  @Field()
  url: string;
}
