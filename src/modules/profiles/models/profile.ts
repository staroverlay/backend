import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type ProfileRole =
  | 'artist'
  | 'creator'
  | 'early-adopter'
  | 'staff'
  | 'translator';

@ObjectType()
@Schema()
export class Profile {
  @Field(() => ID)
  _id: string;

  @Field({ nullable: true })
  @Prop()
  avatar?: string;

  @Field(() => String)
  @Prop()
  displayName: string;

  @Field(() => String)
  @Prop({ default: ['early-adopter'] })
  roles: ProfileRole[];

  @Prop()
  userId: string;
}

export type ProfileDocument = Profile & Document;
export const ProfileSchema = SchemaFactory.createForClass(Profile);
