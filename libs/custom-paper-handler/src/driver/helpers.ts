import { type Optional } from '@vx/libs/basics/types';
import { type PaperHandlerDriverInterface } from './driver_interface';
import { PaperHandlerDriver, getPaperHandlerWebDevice } from './driver';
import { MaxPrintWidthDots } from './constants';

interface GetPaperHandlerDriverProps {
  maxPrintWidth: MaxPrintWidthDots;
}

export async function getPaperHandlerDriver(
  { maxPrintWidth }: GetPaperHandlerDriverProps = {
    maxPrintWidth: MaxPrintWidthDots.BMD_155,
  }
): Promise<Optional<PaperHandlerDriverInterface>> {
  const paperHandlerWebDevice = await getPaperHandlerWebDevice();
  if (!paperHandlerWebDevice) {
    return;
  }

  const paperHandlerDriver = new PaperHandlerDriver(
    paperHandlerWebDevice,
    maxPrintWidth
  );
  await paperHandlerDriver.connect();

  return paperHandlerDriver;
}
