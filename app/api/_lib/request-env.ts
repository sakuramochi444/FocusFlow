import { AsyncLocalStorage } from "node:async_hooks";

export type FocusFlowEnv = {
  DB?: D1Database;
};

const envStorage = new AsyncLocalStorage<FocusFlowEnv>();

export function runWithFocusFlowEnv<T>(env: FocusFlowEnv, callback: () => T): T {
  return envStorage.run(env, callback);
}

export function getFocusFlowEnv() {
  return envStorage.getStore() ?? null;
}
