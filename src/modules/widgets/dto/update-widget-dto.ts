import { Field, InputType } from '@nestjs/graphql';
import { IsArray, IsBoolean, IsJSON, Length } from 'class-validator';

import SettingsScope from 'src/modules/shared/SettingsScope';

@InputType()
export default class UpdateWidgetDTO {
  @IsBoolean()
  @Field(() => Boolean, { nullable: true })
  autoUpdate?: boolean;

  @Length(1, 64)
  @Field(() => String, { nullable: true })
  displayName?: string;

  @IsBoolean()
  @Field(() => Boolean, { nullable: true })
  enabled?: boolean;

  @IsArray()
  @Field(() => [String], { nullable: true })
  scopes?: SettingsScope[];

  @Length(0, 10000)
  @IsJSON()
  @Field(() => String, { nullable: true })
  settings?: string;
}
