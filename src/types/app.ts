// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface Anmerkungen {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    screenshot?: string;
    beschreibung?: string;
    prioritaet?: LookupValue;
    status?: LookupValue;
  };
}

export const APP_IDS = {
  ANMERKUNGEN: '6a0db38dcfc96d613a9f88ac',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'anmerkungen': {
    prioritaet: [{ key: "mittel", label: "Mittel" }, { key: "hoch", label: "Hoch" }, { key: "kritisch", label: "Kritisch" }, { key: "niedrig", label: "Niedrig" }],
    status: [{ key: "offen", label: "Offen" }, { key: "in_bearbeitung", label: "In Bearbeitung" }, { key: "geloest", label: "Gelöst" }, { key: "geschlossen", label: "Geschlossen" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'anmerkungen': {
    'screenshot': 'file',
    'beschreibung': 'string/textarea',
    'prioritaet': 'lookup/radio',
    'status': 'lookup/select',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateAnmerkungen = StripLookup<Anmerkungen['fields']>;