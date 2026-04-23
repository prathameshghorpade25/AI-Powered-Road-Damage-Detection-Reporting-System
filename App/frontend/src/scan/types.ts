export type DetectionCondition = 'minor' | 'moderate' | 'serious';

export type Detection = {
  label: string;
  condition: DetectionCondition;
  confidence: number;
  box: number[];
};
