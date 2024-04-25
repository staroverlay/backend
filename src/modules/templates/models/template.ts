import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

import ServiceType from 'src/modules/shared/SettingsService';

import TemplateVisibility from '../interfaces/TemplateVisibility';

@ObjectType()
@Schema()
export class Template {
  @Field(() => ID)
  _id: string;

  @Field(() => String, { nullable: true })
  @Prop()
  creatorId: string;

  @Field(() => String, { nullable: true })
  @Prop()
  description?: string;

  @Field(() => String, { nullable: true })
  @Prop()
  lastVersion?: string;

  @Field(() => String, { nullable: true })
  @Prop()
  lastVersionId?: string;

  @Field()
  @Prop()
  name: string;

  @Field(() => Number, { nullable: true })
  @Prop()
  price?: number;

  @Field(() => String)
  @Prop({ type: String })
  service: ServiceType;

  @Field(() => String, { nullable: true })
  @Prop()
  storeDescription?: string;

  @Field(() => String, { nullable: true })
  @Prop()
  thumbnail?: string;

  @Field(() => String, { nullable: true })
  @Prop()
  thumbnailResourceId?: string;

  @Field(() => String)
  @Prop({ default: 'private' })
  visibility: TemplateVisibility;
}

export type TemplateDocument = Template & Document;
export const TemplateSchema = SchemaFactory.createForClass(Template);
