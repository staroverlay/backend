import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

import SettingsScope from 'src/modules/shared/SettingsScope';
import ServiceType from 'src/modules/shared/SettingsService';

import { TemplateVersion } from '../../templates/models/template-version';

@ObjectType()
@Schema()
export class Widget {
  @Field(() => ID)
  _id: string;

  @Field()
  @Prop()
  autoUpdate: boolean;

  @Field()
  @Prop()
  displayName: string;

  @Field()
  @Prop()
  enabled: boolean;

  @Field(() => String)
  @Prop({ type: String })
  service: ServiceType;

  @Field(() => [String])
  @Prop()
  scopes: SettingsScope[];

  @Field()
  @Prop()
  settings?: string;

  @Field()
  @Prop()
  templateId: string;

  @Field(() => TemplateVersion)
  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: TemplateVersion.name }],
  })
  templateVersion: TemplateVersion;

  @Field()
  @Prop()
  token: string;

  @Field()
  @Prop()
  userId: string;
}

export type WidgetDocument = Widget & Document;
export const WidgetSchema = SchemaFactory.createForClass(Widget);

WidgetSchema.pre('save', function (next) {
  if (!this.token.startsWith(this._id)) {
    this.token = `${this._id}${this.token}`;
  }

  next();
});
