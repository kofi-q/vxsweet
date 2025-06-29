import { buildApp } from './app';
import { type AppContext } from './context';
import { PORT } from '../globals/globals';

/**
 * Starts the server.
 */
export function start(context: AppContext): void {
  const app = buildApp(context);

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`VxDesign backend running at http://localhost:${PORT}/`);
  });
}
