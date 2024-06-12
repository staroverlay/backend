import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { SettingsFieldGroup } from '../../shared/SettingsFieldGroup';
import SettingsScope from '../../shared/SettingsScope';

@ObjectType()
@Schema()
export class TemplateVersion {
  @Field(() => ID)
  _id: string;

  @Field()
  @Prop()
  templateId: string;

  @Field(() => [SettingsFieldGroup], { nullable: true })
  @Prop()
  fields?: SettingsFieldGroup[];

  @Field()
  @Prop({ default: '' })
  html: string;

  @Field(() => [String], { nullable: true })
  @Prop()
  scopes?: SettingsScope[];

  @Field()
  @Prop()
  version: string;
}

export type TemplateVersionDocument = TemplateVersion & Document;
export const TemplateVersionSchema =
  SchemaFactory.createForClass(TemplateVersion);
