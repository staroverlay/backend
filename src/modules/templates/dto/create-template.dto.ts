import { Field, InputType } from '@nestjs/graphql';
import {
  ArrayMaxSize,
  IsEnum,
  IsJSON,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

import { ServiceTypeNames } from 'src/common/ServiceType';

@InputType()
export default class CreateTemplateDTO {
  @IsNotEmpty()
  @MaxLength(64)
  @Field(() => String)
  name: string;

  @MaxLength(512)
  @Field(() => String, { nullable: true })
  description?: string;

  @ArrayMaxSize(25)
  @Field(() => [String])
  scopes: string[];

  @IsEnum(ServiceTypeNames)
  @Field(() => String)
  service: string;

  @IsNotEmpty()
  @MaxLength(10000)
  @Field(() => String)
  html: string;

  @IsJSON()
  @MaxLength(10000)
  @Field(() => String, { nullable: true })
  settings?: string;
}
