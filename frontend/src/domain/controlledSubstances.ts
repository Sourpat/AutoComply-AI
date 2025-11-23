// src/domain/controlledSubstances.ts

export interface ControlledSubstanceItem {
  id: string;
  name: string;
  ndc?: string | null;
  strength?: string | null;
  dosage_form?: string | null;
  dea_schedule?: string | null;
  unit?: string | null;
  schedule?: string | null;
  dea_code?: string | null;
}
