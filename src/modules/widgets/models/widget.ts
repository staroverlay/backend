import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

import SettingsScope from 'src/modules/shared/SettingsScope';
import ServiceType from 'src/modules/shared/SettingsService';

@ObjectType()
@Schema()
export class Widget {
  @Field(() => ID)
  _id: string;

  @Field()
  @Prop()
  displayName: string;

  @Field()
  @Prop()
  userId: string;

  @Field()
  @Prop()
  enabled: boolean;

  @Field()
  @Prop()
  token: string;

  @Field()
  @Prop()
  templateId: string;

  @Field()
  @Prop()
  templateRaw: string;

  @Field(() => String)
  @Prop({ type: String })
  service: ServiceType;

  @Field()
  @Prop()
  settings?: string;

  @Field(() => [String])
  @Prop()
  scopes: SettingsScope[];
}

export type WidgetDocument = Widget & Document;
export const WidgetSchema = SchemaFactory.createForClass(Widget);

WidgetSchema.pre('save', function (next) {
  if (!this.token.startsWith(this._id)) {
    this.token = `${this._id}${this.token}`;
  }

  next();
});
