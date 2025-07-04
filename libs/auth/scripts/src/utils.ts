import { Buffer } from 'node:buffer';
import { sleep } from '@vx/libs/basics/async';
import { throwIllegalValue } from '@vx/libs/basics/assert';
import {
  type SystemAdministratorUser,
  type VendorUser,
} from '@vx/libs/types/elections';
import { generatePin, hyphenatePin } from '@vx/libs/utils/src';

import { ResponseApduError } from '../../apdu/apdu';
import { type CardStatusReady, type StatefulCard } from '../../cards/card';
import { openssl } from '../../cryptography/cryptography';
import { JavaCard } from '../../cards/java_card';

/**
 * Generates an ECC private key and returns the private key contents in a buffer. The key is not
 * stored in a TPM.
 */
export async function generatePrivateKey(): Promise<Buffer> {
  return await openssl(['ecparam', '-genkey', '-name', 'prime256v1', '-noout']);
}

/**
 * Waits for a card to have a ready status
 */
export async function waitForReadyCardStatus<T>(
  card: StatefulCard<T>,
  waitTimeSeconds = 3
): Promise<CardStatusReady<T>> {
  let cardStatus = await card.getCardStatus();
  let remainingWaitTimeSeconds = waitTimeSeconds;
  while (cardStatus.status !== 'ready' && remainingWaitTimeSeconds > 0) {
    await sleep(1000);
    cardStatus = await card.getCardStatus();
    remainingWaitTimeSeconds -= 1;
  }
  if (cardStatus.status !== 'ready') {
    throw new Error(`Card status not "ready" after ${waitTimeSeconds} seconds`);
  }
  return cardStatus;
}

/**
 * Programs a vendor or system administrator Java Card
 */
export async function programJavaCard({
  card,
  isProduction,
  user,
}: {
  card: JavaCard;
  isProduction: boolean;
  user: VendorUser | SystemAdministratorUser;
}): Promise<void> {
  const initialJavaCardConfigurationScriptReminder = `
${
  isProduction
    ? 'Have you run this card through the configure-java-card script yet?'
    : 'Have you run this card through the configure-dev-java-card script yet?'
}
If not, that's likely the cause of this error.
Run that and then retry.
`;

  await waitForReadyCardStatus(card);

  const pin = isProduction ? generatePin() : '000000';
  try {
    switch (user.role) {
      case 'vendor': {
        await card.program({ user, pin });
        break;
      }
      case 'system_administrator': {
        await card.program({ user, pin });
        break;
      }
      default: {
        throwIllegalValue(user, 'role');
      }
    }
  } catch (error) {
    if (error instanceof ResponseApduError) {
      throw new Error(
        `${error.message}\n${initialJavaCardConfigurationScriptReminder}`
      );
    }
    throw error;
  }
  console.log(`✅ Done! Card PIN is ${hyphenatePin(pin)}.`);
}
