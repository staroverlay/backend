import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import ServiceType from 'src/common/ServiceType';

@ObjectType()
@Schema()
export class Template {
  @Field(() => ID)
  @Prop()
  _id: string;

  @Field()
  @Prop()
  author: string;

  @Field()
  @Prop()
  name: string;

  @Field()
  @Prop()
  description: string;

  @Field()
  @Prop()
  scopes: string[];

  @Field(() => String)
  @Prop({ type: String })
  service: ServiceType;

  @Field()
  @Prop()
  html: string;

  @Field()
  @Prop()
  settings: string;
}

export type TemplateDocument = Template & Document;
export const TemplateSchema = SchemaFactory.createForClass(Template);
