import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, MaxLength } from 'class-validator';

import SettingsFieldType from './SettingsFieldType';

@InputType('FieldStringSettingsInput')
@ObjectType()
export class FieldStringSettings {
  @Field(() => Number, { nullable: true })
  minLength?: number;

  @Field(() => Number, { nullable: true })
  maxLength?: number;

  @Field(() => String, { nullable: true })
  validate?: 'email' | 'number' | 'non-spaces';

  @Field(() => String, { nullable: true })
  default?: string;
}

@InputType('FieldNumberSettingsInput')
@ObjectType()
export class FieldNumberSettings {
  @Field(() => Number, { nullable: true })
  min?: number;

  @Field(() => Number, { nullable: true })
  max?: number;

  @Field(() => Number, { nullable: true })
  rangeSteps?: number;

  @Field(() => String, { nullable: true })
  display?: 'input' | 'range';

  @Field(() => String, { nullable: true })
  type?: 'float' | 'integer';

  @Field(() => Number, { nullable: true })
  default?: number;
}

@InputType('FieldBooleanSettingsInput')
@ObjectType()
export class FieldBooleanSettings {
  @Field(() => String, { nullable: true })
  display?: 'checkbox' | 'slider';

  @Field(() => Boolean, { nullable: true })
  default?: boolean;
}

@InputType('FieldMapSettingsInput')
@ObjectType()
export class FieldMapSettings {
  @Field(() => Number, { nullable: true })
  minItems?: number;

  @Field(() => Number, { nullable: true })
  maxItems?: number;

  @Field(() => String)
  key: SettingsFieldType;

  @Field(() => String)
  value: SettingsFieldType;

  @Field(() => String, { nullable: true })
  display?: 'list' | 'table';
}

@InputType('FieldArraySettingsInput')
@ObjectType()
export class FieldArraySettings {
  @Field(() => Number, { nullable: true })
  minItems?: number;

  @Field(() => Number, { nullable: true })
  maxItems?: number;

  @Field(() => String, { nullable: true })
  display?: 'list' | 'table';

  @Field(() => String)
  type: SettingsFieldType;
}

@InputType('FieldEnumSettingsItemInput')
@ObjectType()
export class FieldEnumSettingsItem {
  @Field(() => String)
  value: string;

  @Field(() => String)
  label?: string;
}

@InputType('FieldEnumSettingsInput')
@ObjectType()
export class FieldEnumSettings {
  @Field(() => [FieldEnumSettingsItem])
  options: FieldEnumSettingsItem[];

  @Field(() => String, { nullable: true })
  display?: 'select' | 'radio';

  @Field(() => String, { nullable: true })
  default?: string;
}

@InputType('SettingsFieldInput')
@ObjectType()
export default class SettingsField {
  @IsNotEmpty()
  @MaxLength(64)
  @Field(() => String)
  id: string;

  @MaxLength(64)
  @Field(() => String, { nullable: true })
  label?: string;

  @MaxLength(512)
  @Field(() => String, { nullable: true })
  description?: string;

  @IsNotEmpty()
  @Field(() => String)
  type: SettingsFieldType;

  @Field(() => Boolean, { nullable: true })
  required?: boolean;

  @Field(() => FieldStringSettings, { nullable: true })
  string?: FieldStringSettings;

  @Field(() => FieldNumberSettings, { nullable: true })
  number?: FieldNumberSettings;

  @Field(() => FieldBooleanSettings, { nullable: true })
  boolean?: FieldBooleanSettings;

  @Field(() => FieldMapSettings, { nullable: true })
  map?: FieldMapSettings;

  @Field(() => FieldArraySettings, { nullable: true })
  array?: FieldArraySettings;

  @Field(() => FieldEnumSettings, { nullable: true })
  enum?: FieldEnumSettings;
}
