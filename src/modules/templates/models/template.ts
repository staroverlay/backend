import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

import SettingsScope from 'src/modules/shared/SettingsScope';
import ServiceType from 'src/modules/shared/SettingsService';

import TemplateVisibility from '../interfaces/TemplateVisibility';

@ObjectType()
@Schema()
export class Template {
  @Field(() => ID)
  _id: string;

  @Field()
  @Prop()
  author: string;

  @Field()
  @Prop()
  name: string;

  @Field(() => String, { nullable: true })
  @Prop()
  description?: string;

  @Field(() => [String], { nullable: true })
  @Prop()
  scopes?: SettingsScope[];

  @Field(() => String, { nullable: true })
  @Prop({ type: String })
  service?: ServiceType;

  @Field()
  @Prop({ default: '' })
  html: string;

  @Field(() => String, { nullable: true })
  @Prop()
  fields?: string;

  @Field(() => String)
  @Prop()
  visibility: TemplateVisibility;
}

export type TemplateDocument = Template & Document;
export const TemplateSchema = SchemaFactory.createForClass(Template);
