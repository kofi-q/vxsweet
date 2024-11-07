import { createInterface } from 'node:readline';
import { extractErrorMessage } from '@vx/libs/basics/errors';
import { throwIllegalValue } from '@vx/libs/basics/assert';

import { CommonAccessCard } from '../../src/cac/common_access_card';
import { type CommonAccessCardDetails } from '../../src/cac/common_access_card_api';
import {
  type CardDetails,
  type PinProtectedCard,
  type StatefulCard,
} from '../../src/card';
import { JavaCard } from '../../src/java_card';
import { waitForReadyCardStatus } from './utils';

const usageMessage = 'Usage: check-pin [--cac|--vxsuite (default)]';

interface CheckPinInput {
  cardType: 'cac' | 'vxsuite';
}

function parseCommandLineArgs(args: readonly string[]): CheckPinInput {
  if (args.length > 1 || ![undefined, '--cac', '--vxsuite'].includes(args[0])) {
    console.error(usageMessage);
    process.exit(1);
  }
  return { cardType: args[0] === '--cac' ? 'cac' : 'vxsuite' };
}

async function checkPin({ cardType }: CheckPinInput): Promise<void> {
  const pin = await new Promise<string>((resolve) => {
    createInterface(process.stdin, process.stdout).question(
      'Enter PIN: ',
      resolve
    );
  });

  let card: PinProtectedCard &
    StatefulCard<CardDetails | CommonAccessCardDetails>;
  switch (cardType) {
    case 'cac': {
      card = new CommonAccessCard();
      break;
    }
    case 'vxsuite': {
      (process.env.NODE_ENV as string) = 'development';
      (process.env.VX_MACHINE_TYPE as string) = 'admin';
      card = new JavaCard();
      break;
    }
    default: {
      throwIllegalValue(cardType);
    }
  }

  await waitForReadyCardStatus(card);
  const checkPinResponse = await card.checkPin(pin);
  console.log(checkPinResponse);
}

/**
 * A script for checking a Java Card PIN
 */
export async function main(args: readonly string[]): Promise<void> {
  try {
    await checkPin(parseCommandLineArgs(args));
    process.exit(0); // Smart card scripts require an explicit exit or else they hang
  } catch (error) {
    console.error(`❌ ${extractErrorMessage(error)}`);
    process.exit(1);
  }
}
