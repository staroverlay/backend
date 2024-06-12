import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type ProductType = 'template';
export const ProductTypes: ProductType[] = ['template'];

@ObjectType()
@Schema({ timestamps: true })
export class Acquisition {
  @Field(() => ID)
  _id: string;

  @Field()
  @Prop()
  isGift: boolean;

  @Field(() => String, { nullable: true })
  @Prop()
  gifterProfileId?: string;

  @Field()
  @Prop()
  profileId: string;

  @Field()
  @Prop()
  productId: string;

  @Field()
  @Prop()
  productType: ProductType;
}

export type AcquisitionDocument = Acquisition & Document;
export const AcquisitionSchema = SchemaFactory.createForClass(Acquisition);
