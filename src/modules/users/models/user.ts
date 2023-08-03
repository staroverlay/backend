import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import bcrypt from 'bcrypt';
import { Document } from 'mongoose';

import { randomString } from 'src/utils/random';

@ObjectType()
@Schema({
  timestamps: true,
})
export class User {
  @Field()
  _id: string;

  @Prop()
  emailVerificationCode?: string;

  @Field()
  @Prop({ default: false })
  isCreator: boolean;

  @Field({ nullable: true })
  @Prop()
  avatar?: string;

  @Field()
  @Prop({ unique: true, lowercase: true })
  email: string;

  @Field()
  @Prop()
  username: string;

  @Field()
  @Prop()
  password: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);

// Hook password and crypt.
UserSchema.pre<UserDocument>('save', async function (next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Hook email and generate verify code.
UserSchema.pre<UserDocument>('save', async function (next) {
  if (!this.isModified('email')) return next();

  this.emailVerificationCode = randomString(6);
  next();
});
