import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IntegrationType = 'twitch';

@ObjectType()
@Schema()
export class Integration {
  @Field()
  _id: string;

  @Prop()
  accessToken: string;

  @Prop()
  refreshToken: string;

  @Prop()
  ownerId: string;

  @Field(() => String)
  @Prop()
  avatar: string;

  @Field(() => String)
  @Prop()
  integrationId: string;

  @Field(() => String)
  @Prop()
  username: string;

  @Field(() => String)
  @Prop()
  type: IntegrationType;

  @Prop()
  expires: number;
}

export type IntegrationDocument = Integration & Document;
export const IntegrationSchema = SchemaFactory.createForClass(Integration);
