import React from 'react';
import { createLove2DApp } from '@ilovereact/native';
import { CartridgeInspector } from '@ilovereact/core';
import { ThemeProvider, useThemeColors } from '@ilovereact/theme';
import { PortalHost } from '@ilovereact/core';

function InspectorApp() {
  const c = useThemeColors();
  return <CartridgeInspector colors={c} />;
}

const app = createLove2DApp();
app.render(
  <ThemeProvider>
    <PortalHost>
      <InspectorApp />
    </PortalHost>
  </ThemeProvider>
);
