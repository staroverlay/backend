import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Date, Document } from 'mongoose';

import { IntegrationType } from 'src/modules/integration/models/integration';

@ObjectType()
@Schema()
export class Session {
  @Field(() => ID)
  _id: string;

  @Prop({ required: true })
  address: string;

  @Field()
  @Prop({ required: true })
  device: string;

  @Prop({ required: true })
  token: string;

  @Prop({ required: true })
  userId: string;

  @Field()
  @Prop({ required: true })
  location: string;

  @Field(() => Number)
  @Prop({
    type: Date,
    default: Date.now(),
    expires: process.env['JWT_EXPIRATION'],
  })
  date: Date;

  @Field(() => String, { nullable: true })
  @Prop()
  method?: IntegrationType;
}

export type SessionDocument = Session & Document;
export const SessionSchema = SchemaFactory.createForClass(Session);
