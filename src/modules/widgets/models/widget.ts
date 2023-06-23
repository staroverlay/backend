import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

import SettingsScope from 'src/modules/shared/SettingsScope';

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
  template: string;

  @Field()
  @Prop({ default: '' })
  html: string;

  @Field(() => [String], { nullable: true })
  @Prop()
  scopes?: SettingsScope[];

  @Field()
  @Prop()
  settings?: string;
}

export type WidgetDocument = Widget & Document;
export const WidgetSchema = SchemaFactory.createForClass(Widget);

WidgetSchema.pre('save', function (next) {
  if (!this.token.startsWith(this._id)) {
    this.token = `${this._id}${this.token}`;
  }

  next();
});
