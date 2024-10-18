import { PrinterConfig } from '@vx/libs/types/src';
import { join } from 'node:path';
import { z } from 'zod';
import { find } from '@vx/libs/basics/src';

export const PrinterConfigSchema: z.ZodSchema<PrinterConfig> = z.object({
  label: z.string(),
  vendorId: z.number().nonnegative(),
  productId: z.number().nonnegative(),
  baseDeviceUri: z.string(),
  ppd: z.string(),
  supportsIpp: z.boolean(),
});

const RELATIVE_PATH_TO_SUPPORTED_PRINTERS = '../../supported_printers';
export const SUPPORTED_PRINTER_CONFIGS: PrinterConfig[] = [
  {
    label: 'HP LaserJet Pro M404n',
    vendorId: 1008,
    productId: 49450,
    baseDeviceUri: 'usb://HP/LaserJet%20Pro%20M404-M405',
    ppd: 'generic-postscript-driver.ppd',
    supportsIpp: true,
  },
  {
    label: 'HP Color LaserJet Pro M454dn/dw',
    vendorId: 1008,
    productId: 50218,
    baseDeviceUri: 'usb://HP/Color%20LaserJet%20Pro%20M453-4',
    ppd: 'generic-postscript-driver.ppd',
    supportsIpp: true,
  },
  {
    label: 'HP Color LaserJet Pro M4001dn',
    vendorId: 1008,
    productId: 628,
    baseDeviceUri: 'usb://HP/LaserJet%20Pro%204001',
    ppd: 'generic-postscript-driver.ppd',
    supportsIpp: true,
  },
  {
    label: 'Brother PJ-822',
    vendorId: 1273,
    productId: 8418,
    baseDeviceUri: 'usb://Brother/PJ-822',
    ppd: 'brother_pj822_printer_en.ppd',
    supportsIpp: false,
  },
  {
    label: 'Brother PJ-823',
    vendorId: 1273,
    productId: 8419,
    baseDeviceUri: 'usb://Brother/PJ-823',
    ppd: 'brother_pj823_printer_en.ppd',
    supportsIpp: false,
  },
];

export function getPrinterConfig(uri: string): PrinterConfig | undefined {
  return SUPPORTED_PRINTER_CONFIGS.find((supportedPrinterConfig) =>
    uri.startsWith(supportedPrinterConfig.baseDeviceUri)
  );
}

export function getPpdPath(printerConfig: PrinterConfig): string {
  return join(
    __dirname,
    RELATIVE_PATH_TO_SUPPORTED_PRINTERS,
    printerConfig.ppd
  );
}

export const BROTHER_THERMAL_PRINTER_CONFIG = find(
  SUPPORTED_PRINTER_CONFIGS,
  (config) => config.label === 'Brother PJ-822'
);

export const HP_LASER_PRINTER_CONFIG = find(
  SUPPORTED_PRINTER_CONFIGS,
  (config) => config.label === 'HP Color LaserJet Pro M4001dn'
);
