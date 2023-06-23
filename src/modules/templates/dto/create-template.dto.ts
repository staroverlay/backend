import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, MaxLength } from 'class-validator';

import TemplateVisibility, {
  TemplateVisibilityValues,
} from '../interfaces/TemplateVisibility';

@InputType()
export default class CreateTemplateDTO {
  @IsNotEmpty()
  @MaxLength(64)
  @Field(() => String)
  name: string;

  @IsNotEmpty()
  @IsEnum(TemplateVisibilityValues)
  @Field(() => String)
  visibility: TemplateVisibility;
}
