import { Field, InputType } from '@nestjs/graphql';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  Matches,
  MaxLength,
} from 'class-validator';

import { SettingsFieldGroup } from '../../shared/SettingsFieldGroup';
import SettingsScope, { SettingsScopes } from '../../shared/SettingsScope';

@InputType()
export default class PostTemplateVersionDTO {
  @Field(() => [SettingsFieldGroup], { nullable: true })
  fields: SettingsFieldGroup[];

  @MaxLength(10000)
  @Field(() => String, { nullable: true })
  html: string;

  @IsArray()
  @ArrayMaxSize(SettingsScopes.length)
  @ArrayUnique()
  @Field(() => [String], { nullable: true })
  scopes?: SettingsScope[];

  @Field(() => String)
  @Matches(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
  )
  version: string;
}
