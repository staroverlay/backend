import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsNumber, Max, MaxLength, Min } from 'class-validator';

import SettingsService, {
  SettingsServiceNames,
} from 'src/modules/shared/SettingsService';

import TemplateVisibility, {
  TemplateVisibilityValues,
} from '../interfaces/TemplateVisibility';

@InputType()
export default class UpdateTemplateDTO {
  @MaxLength(256)
  @Field(() => String, { nullable: true })
  description?: string;

  @MaxLength(64)
  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => Number, { nullable: true })
  @Min(0)
  @Max(99999)
  @IsNumber({
    allowInfinity: false,
    allowNaN: false,
    maxDecimalPlaces: 2,
  })
  price?: number;

  @IsEnum(SettingsServiceNames)
  @Field(() => String, { nullable: true })
  service?: SettingsService;

  @MaxLength(2048)
  @Field(() => String, { nullable: true })
  storeDescription?: string;

  @MaxLength(256)
  @Field(() => String, { nullable: true })
  thumbnail?: string;

  @IsEnum(TemplateVisibilityValues)
  @Field(() => String, { nullable: true })
  visibility?: TemplateVisibility;
}
