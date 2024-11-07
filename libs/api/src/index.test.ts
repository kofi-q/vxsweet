import { safeParse, unsafeParse } from '@vx/libs/types/basic';
import { ErrorsResponseSchema, OkResponseSchema } from './base';

test('OkResponse', () => {
  unsafeParse(OkResponseSchema, { status: 'ok' });
  safeParse(OkResponseSchema, {}).unsafeUnwrapErr();
});

test('ErrorsResponse', () => {
  unsafeParse(ErrorsResponseSchema, {
    status: 'error',
    errors: [],
  });
  safeParse(ErrorsResponseSchema, { status: 'ok' }).unsafeUnwrapErr();
});
