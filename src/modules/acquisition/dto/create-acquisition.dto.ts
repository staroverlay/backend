import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsMongoId, IsNotEmpty } from 'class-validator';

import { ProductType, ProductTypes } from '../models/acquisition';

@InputType()
export default class CreateAcquisitionDTO {
  @IsNotEmpty()
  @IsMongoId()
  @Field(() => String)
  productId: string;

  @IsEnum(ProductTypes)
  @Field(() => String)
  productType: ProductType;
}
