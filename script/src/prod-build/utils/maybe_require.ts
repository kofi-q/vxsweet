export interface PackageJson {
  name: string;
  dependencies: { [key: string]: string };
  devDependencies: { [key: string]: string };
  vx?: {
    env: { [key: string]: string };
    isBundled: boolean;
    services: string[];
  };
}

export function maybeRequire(id: string): PackageJson | undefined {
  try {
    return require(id);
  } catch (error) {
    if ((error as { code?: unknown }).code === 'MODULE_NOT_FOUND') {
      return undefined;
    } else {
      throw error;
    }
  }
}
