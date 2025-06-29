import { extractErrorMessage } from '@vx/libs/basics/errors';

import {
  constructMachineCertSubject,
  type MachineType,
} from '../../cards/certs';
import { createCertSigningRequest } from '../../cryptography/cryptography';
import { getRequiredEnvVar } from '../../src/env_vars';

interface ScriptEnv {
  machineType: MachineType;
  jurisdiction?: string;
}

function readScriptEnvVars(): ScriptEnv {
  const machineType = getRequiredEnvVar('VX_MACHINE_TYPE');
  const jurisdiction =
    machineType === 'admin'
      ? getRequiredEnvVar('VX_MACHINE_JURISDICTION')
      : undefined;
  return { machineType, jurisdiction };
}

async function createProductionMachineCertSigningRequest({
  machineType,
  jurisdiction,
}: ScriptEnv): Promise<void> {
  const certSigningRequest = await createCertSigningRequest({
    certKey: { source: 'tpm' },
    certSubject: constructMachineCertSubject(machineType, jurisdiction),
  });
  process.stdout.write(certSigningRequest);
}

/**
 * A script for creating a production machine cert signing request, using the machine's TPM key
 */
export async function main(): Promise<void> {
  try {
    const scriptEnv = readScriptEnvVars();
    await createProductionMachineCertSigningRequest(scriptEnv);
  } catch (error) {
    console.error(`❌ ${extractErrorMessage(error)}`);
    process.exit(1);
  }
}
