import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import type { TransformedSource, Transformer } from '@jest/transform';

export interface Config {
  useJestCache?: boolean;
}

const cacheKeySuffix = Date.now();

/**
 * Simple jest "transformer" that just loads the corresponding pre-transpiled
 * JS source.
 *
 * This only exists so we can feed jest the original source files, so all the
 * test output references point to `.ts[x]` filenames, instead of the
 * `.js` ones.
 */
const transformer: Transformer<Config> = {
  getCacheKey(_sourceText: string, sourcePath: string): string {
    return `${sourcePath}-${cacheKeySuffix}`;
  },

  getCacheKeyAsync(_sourceText: string, sourcePath: string): Promise<string> {
    return Promise.resolve(`${sourcePath}-${cacheKeySuffix}`);
  },

  process(_sourceText: string, sourcePath: string): TransformedSource {
    return {
      code: fsSync.readFileSync(sourcePath.replace(/\.tsx?$/, '.js'), 'utf-8'),
    };
  },

  async processAsync(
    _sourceText: string,
    sourcePath: string
  ): Promise<TransformedSource> {
    return {
      code: await fs.readFile(sourcePath.replace(/\.tsx?$/, '.js'), 'utf-8'),
    };
  },
};

export default transformer;
