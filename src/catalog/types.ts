import type { EphemerisTarget, StarFix } from '../astronomy/types';

export type BodyKind = 'planet' | 'natural-satellite' | 'star';

export type FactUnit =
  | 'km'
  | 'kg'
  | 'million-km'
  | 'day'
  | 'hour'
  | 'celsius'
  | 'kelvin'
  | 'degree'
  | 'light-year'
  | 'magnitude';

export type FactDataType = 'measured' | 'mean' | 'range' | 'effective' | 'approximate';

export interface QuantityFact {
  kind: 'quantity';
  id: string;
  labelFa: string;
  value: number | { min: number; max: number };
  unit: FactUnit;
  dataType: FactDataType;
  sourceIds: string[];
  noteFa?: string;
}

export interface TextFact {
  kind: 'text';
  id: string;
  labelFa: string;
  valueFa: string;
  dataType: FactDataType;
  sourceIds: string[];
  noteFa?: string;
}

export type BodyFact = QuantityFact | TextFact;

export interface DataSource {
  id: string;
  titleFa: string;
  publisherFa: string;
  url: string;
  accessedOn: string;
  licenseFa?: string;
}

export interface CelestialBody {
  id: string;
  nameFa: string;
  nameEn: string;
  kind: BodyKind;
  descriptionFa: string;
  accentColor: string;
  skyVisible: boolean;
  ephemerisTarget?: EphemerisTarget;
  starFix?: StarFix;
  facts: BodyFact[];
  sourceIds: string[];
}

export interface AssetCredit {
  id: string;
  titleFa: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  modificationsFa: string;
}
