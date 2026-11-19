/** Plain-English labels for audit-log entries (actions and entities are stored as codes). */

const PHRASES: Record<string, string> = {
  'CREATE Pig': 'added a pig',
  'UPDATE Pig': 'updated a pig',
  'DELETE Pig': 'deleted a pig',
  'IMPORT Pig': 'imported pigs from Excel',
  'CREATE Pen': 'added a pen',
  'UPDATE Pen': 'updated a pen',
  'DELETE Pen': 'deleted a pen',
  'CREATE WeightLog': 'logged a weight',
  'BULK_CREATE WeightLog': 'logged weights for a pen',
  'CREATE SaleRecord': 'recorded a sale',
  'BULK_CREATE SaleRecord': 'recorded sales',
  'CREATE FarrowingRecord': 'recorded a farrowing',
  'UPDATE FarrowingRecord': 'updated litter details',
  'CREATE Vaccination': 'recorded a vaccination',
  'UPDATE Vaccination': 'updated a vaccination',
  'DELETE Vaccination': 'removed a vaccination',
  'CREATE PigObservation': 'logged a health observation',
  'UPDATE Farm': 'updated farm settings',
  'DELETE Farm': 'deleted the farm',
  'INVITE FarmMember': 'invited a team member',
  'INVITE Invitation': 'invited a team member',
  'REVOKE Invitation': 'revoked an invitation',
  'JOIN FarmMember': 'joined the farm',
  'REMOVE FarmMember': 'removed a team member',
};

const ACTIONS: Record<string, string> = {
  CREATE: 'Added',
  BULK_CREATE: 'Added (bulk)',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  IMPORT: 'Imported',
  INVITE: 'Invited',
  REVOKE: 'Revoked',
  JOIN: 'Joined',
  REMOVE: 'Removed',
};

const ENTITIES: Record<string, string> = {
  PigObservation: 'Health observation',
  SaleRecord: 'Sale',
  FarrowingRecord: 'Farrowing',
  FarmMember: 'Team member',
};

const words = (code: string) => code.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** e.g. "logged weights for a pen" — for activity feeds ("Alice logged weights for a pen"). */
export function describeActivity(action: string, entity: string): string {
  return PHRASES[`${action} ${entity}`] ?? `${words(action)} ${words(entity)}`;
}

/** e.g. BULK_CREATE → "Added (bulk)". */
export function actionLabel(action: string): string {
  return ACTIONS[action] ?? capitalise(words(action));
}

/** e.g. WeightLog → "Weight log". */
export function entityLabel(entity: string): string {
  return ENTITIES[entity] ?? capitalise(words(entity));
}
