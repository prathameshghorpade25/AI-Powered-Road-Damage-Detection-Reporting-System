export type WardFilterContext = {
  wardFilter: string;
  setWardFilter: (w: string) => void;
  /** Populated from GET /authority/meta */
  wardOptions: string[];
  zoneOptions: string[];
};
