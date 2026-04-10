import type { PigObservationCategory } from '../types';

export const PIG_OBSERVATION_OPTIONS: { value: PigObservationCategory; label: string }[] = [
  { value: 'GENERAL_WELLBEING', label: 'General wellbeing / alert' },
  { value: 'APPETITE_FEED_INTAKE', label: 'Appetite / feed intake' },
  { value: 'BEHAVIOUR_ACTIVITY', label: 'Behaviour / activity level' },
  { value: 'RESPIRATORY_COUGHING', label: 'Respiratory / coughing' },
  { value: 'DIGESTIVE_DIARRHEA', label: 'Digestive / diarrhoea' },
  { value: 'SKIN_LESIONS', label: 'Skin / lesions' },
  { value: 'LAMENESS_MOBILITY', label: 'Lameness / mobility' },
  { value: 'EYES_NOSE_DISCHARGE', label: 'Eyes / nose discharge' },
  { value: 'OTHER', label: 'Other (describe in notes)' },
];

export function pigObservationLabel(category: PigObservationCategory): string {
  return PIG_OBSERVATION_OPTIONS.find((o) => o.value === category)?.label ?? category;
}
