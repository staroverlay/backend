import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

import ServiceType from 'src/modules/templates/interfaces/SettingsService';

import SettingsScope from '../interfaces/SettingsScope';

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

  @Field(() => [String])
  @Prop()
  scopes: SettingsScope[];

  @Field(() => String)
  @Prop({ type: String })
  service: ServiceType;

  @Field()
  @Prop()
  html: string;

  @Field(() => String, { nullable: true })
  @Prop()
  fields?: string;
}

export type TemplateDocument = Template & Document;
export const TemplateSchema = SchemaFactory.createForClass(Template);
