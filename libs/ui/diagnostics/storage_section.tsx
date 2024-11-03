import { type DiskSpaceSummary } from '@vx/libs/backend/src';
import { format } from '@vx/libs/utils/src';
import { H2, P } from '../primitives/typography';
import { SuccessIcon, WarningIcon } from './icons';

export const FREE_DISK_SPACE_RATIO_WARN_THRESHOLD = 0.05;

function roundToGigabytes(kilobytes: number): number {
  return Math.round(kilobytes / 100_000) / 10;
}

export interface StorageSectionProps {
  diskSpaceSummary: DiskSpaceSummary;
}

export function StorageSection({
  diskSpaceSummary,
}: StorageSectionProps): JSX.Element {
  const storageAvailableRatio =
    diskSpaceSummary.available / diskSpaceSummary.total;

  return (
    <section>
      <H2>Storage</H2>
      <P>
        {storageAvailableRatio < FREE_DISK_SPACE_RATIO_WARN_THRESHOLD ? (
          <WarningIcon />
        ) : (
          <SuccessIcon />
        )}{' '}
        Free Disk Space: {format.percent(storageAvailableRatio)} (
        {roundToGigabytes(diskSpaceSummary.available)} GB /{' '}
        {roundToGigabytes(diskSpaceSummary.total)} GB)
      </P>
    </section>
  );
}
