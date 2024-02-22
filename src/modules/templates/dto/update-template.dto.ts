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
} from 'src/modules/shared/SettingsService';

import { SettingsFieldGroup } from '../../shared/SettingsFieldGroup';
import SettingsScope, { SettingsScopes } from '../../shared/SettingsScope';
import TemplateVisibility, {
  TemplateVisibilityValues,
} from '../interfaces/TemplateVisibility';

@InputType()
export default class UpdateTemplateDTO {
  @MaxLength(64)
  @Field(() => String, { nullable: true })
  name?: string;

  @MaxLength(256)
  @Field(() => String, { nullable: true })
  description?: string;

  @MaxLength(2048)
  @Field(() => String, { nullable: true })
  storeDescription?: string;

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

  @Field(() => [SettingsFieldGroup], { nullable: true })
  fields?: SettingsFieldGroup[];

  @IsEnum(TemplateVisibilityValues)
  @Field(() => String, { nullable: true })
  visibility?: TemplateVisibility;
}
