import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@ObjectType()
@Schema()
export class Widget {
  @Field(() => ID)
  @Prop()
  _id: string;

  @Field()
  @Prop()
  displayName: string;

  @Field()
  @Prop()
  owner: string;

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
  @Prop()
  settings: {
    a: string;
  };
}

export type WidgetDocument = Widget & Document;
export const WidgetSchema = SchemaFactory.createForClass(Widget);
