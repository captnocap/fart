/**
 * Settings bridge — sends service registry to Lua and syncs keys.
 *
 * useSettingsRegistry() sends the service definitions to the Lua settings
 * overlay so it knows what fields to display. Call it once at app startup.
 *
 * @example
 * import { useSettingsRegistry, builtinServices } from '@ilovereact/apis';
 *
 * function App() {
 *   useSettingsRegistry(); // uses builtinServices by default
 *   return <MyApp />;
 * }
 *
 * // Or with custom services:
 * useSettingsRegistry([...builtinServices, myCustomService]);
 */

import { useEffect, useRef } from 'react';
import { builtinServices, type ServiceDefinition } from './registry';

type Bridge = {
  send(type: string, payload?: any): void;
  flush(): void;
};

/**
 * Try to get the bridge from the global context.
 * Works without requiring @ilovereact/core as a hard dependency.
 */
function getBridge(): Bridge | null {
  return (globalThis as any).__bridge || null;
}

let registrySent = false;

/**
 * Send service registry to the Lua settings overlay.
 * Idempotent — only sends once per app lifecycle.
 *
 * @param services - Service definitions to register. Defaults to all built-in services.
 */
export function useSettingsRegistry(
  services: ServiceDefinition[] = builtinServices,
): void {
  const servicesRef = useRef(services);
  servicesRef.current = services;

  useEffect(() => {
    if (registrySent) return;

    const bridge = getBridge();
    if (!bridge) return;

    bridge.send('settings:registry', { services: servicesRef.current });
    bridge.flush();
    registrySent = true;
  }, []);
}

/**
 * Reset the registry sent flag. Useful for HMR.
 */
export function resetSettingsRegistry(): void {
  registrySent = false;
}
