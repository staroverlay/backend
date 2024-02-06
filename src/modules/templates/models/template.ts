import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

import SettingsScope from 'src/modules/shared/SettingsScope';
import ServiceType from 'src/modules/shared/SettingsService';

import TemplateVisibility from '../interfaces/TemplateVisibility';

@ObjectType()
class Author {
  @Field()
  id: string;
  @Field()
  username: string;
  @Field()
  avatar: string;
}

@ObjectType()
@Schema()
export class Template {
  @Field(() => ID)
  _id: string;

  @Prop()
  authorId: string;

  @Field(() => Author)
  author: Author;

  @Field()
  @Prop()
  name: string;

  @Field(() => String, { nullable: true })
  @Prop()
  description?: string;

  @Field(() => [String], { nullable: true })
  @Prop()
  scopes?: SettingsScope[];

  @Field(() => String)
  @Prop({ type: String })
  service: ServiceType;

  @Field()
  @Prop({ default: '' })
  html: string;

  @Field(() => String, { nullable: true })
  @Prop()
  fields?: string;

  @Field(() => String)
  @Prop()
  visibility: TemplateVisibility;

  @Field()
  @Prop({ default: 0 })
  version: number;
}

export type TemplateDocument = Template & Document;
export const TemplateSchema = SchemaFactory.createForClass(Template);

TemplateSchema.pre('save', function (next) {
  const fields = ['scopes', 'service', 'html', 'fields'];

  for (const field of fields) {
    if (this.isModified(field)) {
      this.version++;
      break;
    }
  }

  next();
});
