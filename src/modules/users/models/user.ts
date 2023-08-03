import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
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
  isEmailVerified: boolean;

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
  this.isEmailVerified = false;
  next();
});

// Hook verify code and isEmailVerified value.
UserSchema.pre<UserDocument>('save', async function (next) {
  if (this.emailVerificationCode == null && !this.isEmailVerified) {
    this.isEmailVerified = true;
  }

  next();
});
