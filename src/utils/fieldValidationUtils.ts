import { BadRequestException } from '@nestjs/common';

import SettingsField, {
  FieldArraySettings,
  FieldBooleanSettings,
  FieldEnumSettings,
  FieldMapSettings,
  FieldNumberSettings,
  FieldStringSettings,
} from 'src/modules/shared/SettingsField';
import SettingsFieldType from 'src/modules/shared/SettingsFieldType';

type JsonType = { [key: string]: any };

function validateNumber(
  id: string,
  value: number,
  rules?: FieldNumberSettings,
) {
  if (isNaN(value)) {
    throw new BadRequestException(`Field ${id} must be a number`);
  }

  const { min, max } = rules;

  if (min && value < min) {
    throw new BadRequestException(`Field ${id} must be greater than ${min}`);
  }

  if (max && value > max) {
    throw new BadRequestException(`Field ${id} must be less than ${max}`);
  }
}

function validateBoolean(
  id: string,
  value: boolean,
  rules?: FieldBooleanSettings,
) {
  if (rules && value !== true && value !== false) {
    throw new BadRequestException(`Field ${id} must be a boolean`);
  }
}

function validateString(
  id: string,
  value: string,
  rules?: FieldStringSettings,
) {
  if (rules && rules.maxLength && value.length > rules.maxLength) {
    throw new BadRequestException(
      `Field ${id} must be less than ${rules.maxLength} characters`,
    );
  }

  if (rules && rules.minLength && value.length < rules.minLength) {
    throw new BadRequestException(
      `Field ${id} must be greater than ${rules.minLength} characters`,
    );
  }
}

function validateEnum(id: string, value: string, rules?: FieldEnumSettings) {
  for (const option of rules.options) {
    if (value === option.value) {
      return;
    }
  }

  throw new BadRequestException(
    `Field ${id} must be one of ${rules.options.join(', ')}`,
  );
}

function validateField(id: string, value: any, type: SettingsFieldType) {
  if (type === 'number') {
    validateNumber(id, value, null);
  } else if (type === 'boolean') {
    validateBoolean(id, value, null);
  } else if (type === 'string') {
    validateString(id, value, null);
  } else if (type === 'enum') {
    validateEnum(id, value, null);
  } else if (type === 'map') {
    validateMap(id, value, null);
  } else if (type === 'array') {
    validateArray(id, value, null);
  }
}

function validateMap(id: string, value: JsonType, rules?: FieldMapSettings) {
  if (typeof value !== 'object') {
    throw new BadRequestException(`Field ${id} must be an object`);
  }

  if (rules && rules.maxItems && Object.keys(value).length > rules.maxItems) {
    throw new BadRequestException(
      `Field ${id} must have less than ${rules.maxItems} properties`,
    );
  }

  if (rules && rules.minItems && Object.keys(value).length < rules.minItems) {
    throw new BadRequestException(
      `Field ${id} must have greater than ${rules.minItems} properties`,
    );
  }

  for (const key of Object.keys(value)) {
    if (rules && rules.key) {
      validateField(id, key, rules.key);
    }

    if (rules && rules.value) {
      validateField(id, value[key], rules.value);
    }
  }
}

function validateArray(id: string, value: any[], rules?: FieldArraySettings) {
  if (!Array.isArray(value)) {
    throw new BadRequestException(`Field ${id} must be an array`);
  }

  if (rules && rules.maxItems && value.length > rules.maxItems) {
    throw new BadRequestException(
      `Field ${id} must have less than ${rules.maxItems} items`,
    );
  }

  if (rules && rules.minItems && value.length < rules.minItems) {
    throw new BadRequestException(
      `Field ${id} must have greater than ${rules.minItems} items`,
    );
  }

  if (rules && rules.type) {
    for (const item of value) {
      validateField(id, item, rules.type);
    }
  }
}

export function validateJSONSettings(
  fields: SettingsField[],
  settings: JsonType,
): JsonType {
  const sanitized: JsonType = {};

  for (const field of fields) {
    const { id, type, required } = field;
    const value = settings[id];

    if (required && !Object.keys(settings).includes(id)) {
      throw new BadRequestException(`Field ${id} is required`);
    }

    // Validate number type.
    if (type === 'number') {
      validateNumber(id, value, field.number);
    } else if (type === 'boolean') {
      validateBoolean(id, value, field.boolean);
    } else if (type === 'string') {
      validateString(id, value, field.string);
    } else if (type === 'array') {
      validateArray(id, value, field.array);
    } else if (type === 'enum') {
      validateEnum(id, value, field.enum);
    } else if (type === 'map') {
      validateMap(id, value, field.map);
    } else {
      throw new BadRequestException(`Field ${id} has an invalid type`);
    }

    sanitized[id] = value;
  }

  return sanitized;
}
