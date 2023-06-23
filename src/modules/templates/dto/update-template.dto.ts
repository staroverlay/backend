import { Field, InputType } from '@nestjs/graphql';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  MaxLength,
} from 'class-validator';

import SettingsService, {
  SettingsServiceNames,
} from 'src/modules/templates/interfaces/SettingsService';

import SettingsField from '../interfaces/SettingsField';
import SettingsScope, { SettingsScopes } from '../interfaces/SettingsScope';
import TemplateVisibility, {
  TemplateVisibilityValues,
} from '../interfaces/TemplateVisibility';

@InputType()
export default class UpdateTemplateDTO {
  @MaxLength(64)
  @Field(() => String, { nullable: true })
  name?: string;

  @MaxLength(512)
  @Field(() => String, { nullable: true })
  description?: string;

  @IsArray()
  @ArrayMaxSize(SettingsScopes.length)
  @ArrayUnique()
  @Field(() => [String], { nullable: true })
  scopes?: SettingsScope[];

  @IsEnum(SettingsServiceNames)
  @Field(() => String, { nullable: true })
  service?: SettingsService;

  @MaxLength(10000)
  @Field(() => String, { nullable: true })
  html?: string;

  @Field(() => [SettingsField], { nullable: true })
  fields?: SettingsField[];

  @IsEnum(TemplateVisibilityValues)
  @Field(() => String, { nullable: true })
  visibility?: TemplateVisibility;
}
