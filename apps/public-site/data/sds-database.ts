// SDS Database Loader
// Reads structured chemical safety data from sds-database.json
// Keeps the TypeScript interface in sds-types.ts

import type { SDSEntry } from './sds-types';
import data from './sds-database.json';

export const SDS_DATABASE: SDSEntry[] = data as SDSEntry[];
