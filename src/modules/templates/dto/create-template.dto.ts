import { Field, InputType } from '@nestjs/graphql';
import {
  ArrayContains,
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

import SettingsService, {
  SettingsServiceNames,
} from 'src/modules/templates/interfaces/SettingsService';

import SettingsField from '../interfaces/SettingsField';
import SettingsScope, { SettingsScopes } from '../interfaces/SettingsScope';

@InputType()
export default class CreateTemplateDTO {
  @IsNotEmpty()
  @MaxLength(64)
  @Field(() => String)
  name: string;

  @MaxLength(512)
  @Field(() => String, { nullable: true })
  description?: string;

  @IsArray()
  @ArrayMaxSize(25)
  @ArrayUnique()
  @ArrayContains(SettingsScopes, { each: true })
  @Field(() => [String])
  scopes: SettingsScope[];

  @IsNotEmpty()
  @IsEnum(SettingsServiceNames)
  @Field(() => String)
  service: SettingsService;

  @IsNotEmpty()
  @MaxLength(10000)
  @Field(() => String)
  html: string;

  @Field(() => [SettingsField], { nullable: true })
  fields?: SettingsField[];
}
