import { type PageInterpretationType } from '@vx/libs/types/src';
import { DiagnosticError } from './diagnostic_error';

export class UnknownInterpretationDiagnosticError extends DiagnosticError {
  constructor(interpretationType: PageInterpretationType) {
    super(`Unexpected test ballot interpretation: ${interpretationType}`);
  }
}
