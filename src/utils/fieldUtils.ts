import SettingsField from '../modules/shared/SettingsField';
import { SettingsFieldGroup } from '../modules/shared/SettingsFieldGroup';

export function getFieldPath(cat: SettingsFieldGroup, field: SettingsField) {
  const categoryId = cat && cat.id != '' ? cat.id : null;
  return categoryId ? `${categoryId}.${field.id}` : field.id;
}
