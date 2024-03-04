import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, MaxLength } from 'class-validator';

import SettingsService, {
  SettingsServiceNames,
} from '../../shared/SettingsService';

@InputType()
export default class CreateTemplateDTO {
  @IsNotEmpty()
  @MaxLength(64)
  @Field(() => String)
  name: string;

  @IsEnum(SettingsServiceNames)
  @Field(() => String)
  service: SettingsService;
}
