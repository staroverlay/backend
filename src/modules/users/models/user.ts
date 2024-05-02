import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Document } from 'mongoose';

@ObjectType()
@Schema({
  timestamps: true,
})
export class User {
  @Field()
  _id: string;

  @Field()
  @Prop({ unique: true, lowercase: true })
  email: string;

  @Prop()
  emailVerificationCode?: string;

  @Field()
  @Prop({ default: false })
  isEmailVerified: boolean;

  @Field()
  @Prop({ default: false })
  isCreator: boolean;

  @Prop()
  password: string;

  @Prop()
  @Field(() => String, { nullable: true })
  profileId?: string;

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
