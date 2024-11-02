import { isCardlessVoterAuth } from '@vx/libs/utils/src';

import * as api from '../api/api';

export function useIsVoterAuth(): boolean {
  const authStatusQuery = api.getAuthStatus.useQuery();
  return authStatusQuery.isSuccess && isCardlessVoterAuth(authStatusQuery.data);
}
