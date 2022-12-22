import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@ObjectType()
@Schema()
export class User {
  @Field()
  @Prop()
  id: string;

  @Field()
  @Prop()
  username: string;

  @Field()
  @Prop()
  avatar: string;

  @Prop()
  accessToken: string;

  @Prop()
  refreshToken: string;
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);
