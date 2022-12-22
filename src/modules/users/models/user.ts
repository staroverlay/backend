import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

type UserRole = 'admin' | 'user';

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

  @Field()
  @Prop({ default: 'user' })
  role: UserRole;

  @Prop()
  accessToken: string;

  @Prop()
  refreshToken: string;
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);
