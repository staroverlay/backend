import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@ObjectType()
@Schema()
export class Template {
  @Field(() => ID)
  @Prop()
  _id: string;

  @Field()
  @Prop()
  name: string;

  @Field()
  @Prop()
  displayName: boolean;

  @Field()
  @Prop()
  description: string;

  @Field()
  @Prop()
  template: string;
}

export type TemplateDocument = Template & Document;
export const TemplateSchema = SchemaFactory.createForClass(Template);
