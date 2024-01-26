import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, MaxLength } from 'class-validator';

import SettingsField from './SettingsField';

@InputType()
export class SettingsFieldGroup {
  @IsNotEmpty()
  @MaxLength(64)
  @Field(() => String)
  id: string;

  @MaxLength(64)
  @Field(() => String, { nullable: true })
  label?: string;

  @Field(() => [SettingsField])
  children: SettingsField[];
}
