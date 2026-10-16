export type AutomationSettingsInput = {
  reportEmailCadence?: string | null;
  alertSmsPhone?: string | null;
  alertSmsFarrowing?: boolean | null;
  alertSmsLowStock?: boolean | null;
};

/**
 * True when a farm update would switch on an Enterprise-only automation (scheduled
 * report emails or SMS alerts). Sending these fields in their "off" state is allowed
 * on every plan — the settings form always includes them, so gating on mere presence
 * would block lower plans from saving any farm setting.
 */
export function turnsOnEnterpriseAutomation(input: AutomationSettingsInput): boolean {
  return (
    (input.reportEmailCadence != null && input.reportEmailCadence !== 'OFF') ||
    input.alertSmsFarrowing === true ||
    input.alertSmsLowStock === true ||
    (input.alertSmsPhone != null && String(input.alertSmsPhone).trim() !== '')
  );
}
