// Barrel export for quote-builder module
export { default as StepSelectClient } from './StepSelectClient';
export { default as StepBuildingScope } from './StepBuildingScope';
export { default as StepLocations } from './StepLocations';
export { default as StepServicesAndPricing } from './StepServicesAndPricing';
export { default as StepTermsAndSubmit } from './StepTermsAndSubmit';
export { quoteLogger } from './logger';
export { computeTotals, formatCurrency, stripUndefined, FrequencyDisplay, getOrdinalSuffix } from './helpers';
export type { QuoteBuilderProps, Location, QuoteTotals } from './types';
export { STEPS, DAY_LABELS, SERVICE_COLORS } from './types';
