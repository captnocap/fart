// Gallery preview sweep — click every component, check for crashes.
//
// Navigates to the Component Gallery, then clicks each component thumbnail
// and checks the preview renders without errors.
//
// Run:
//   cd storybook && rjit build && rjit test tests/gallery-preview-sweep.test.ts --timeout=300

type RpcBridge = {
  rpc<T = any>(method: string, args?: any, timeoutMs?: number): Promise<T>;
};

const bridge = (globalThis as any).__rjitBridge as RpcBridge | undefined;

function requireBridge(): RpcBridge {
  if (!bridge) throw new Error('Missing __rjitBridge');
  return bridge;
}

async function setViewport(w: number, h: number): Promise<void> {
  await requireBridge().rpc('window:setSize', { width: w, height: h });
  await page.wait(3);
}

async function navigateToGallery(): Promise<boolean> {
  // __navigateToStory is exposed by StorybookPanel on globalThis
  const nav = (globalThis as any).__navigateToStory;
  if (typeof nav === 'function') {
    const ok = nav('gallery');
    if (ok) {
      await page.wait(10); // let React re-render + layout settle
      return true;
    }
  }
  // Fallback: try clicking in sidebar
  try {
    await page.find('Text', { children: 'Component Gallery' }).click();
    await page.wait(5);
    return true;
  } catch {
    return false;
  }
}

test('Gallery preview sweep — all components', async () => {
  const broken: string[] = [];
  const passed: string[] = [];
  const skipped: string[] = [];

  await setViewport(1440, 900);

  const navOk = await navigateToGallery();
  if (!navOk) {
    await page.screenshot('/tmp/gallery_sweep_nav_fail.png');
    throw new Error('Could not navigate to Component Gallery. See /tmp/gallery_sweep_nav_fail.png');
  }

  await page.screenshot('/tmp/gallery_sweep_start.png');

  // Get component list from globalThis (exposed by GalleryStory)
  const entries = (globalThis as any).__galleryEntries as Array<{ id: string; label: string }> | undefined;
  if (!entries || entries.length === 0) {
    throw new Error('No __galleryEntries found on globalThis. GalleryStory may not have rendered.');
  }

  for (const entry of entries) {
    try {
      // Click the thumbnail label by testId
      const thumb = await page.find('Text', { testId: `gallery-thumb-${entry.id}` }).all();
      if (thumb.length === 0) { skipped.push(entry.label); continue; }

      await thumb[0].click();
      await page.wait(5);

      // Check for error overlay — StoryErrorBoundary renders "Story Crashed"
      try {
        const crashNodes = await page.find('Text', { children: 'Story Crashed' }).all();
        if (crashNodes.length > 0) {
          broken.push(`${entry.label}: Story Crashed`);
          const safeName = entry.id.replace(/[^a-z0-9]/g, '_');
          await page.screenshot(`/tmp/gallery_fail_${safeName}.png`);
          continue;
        }
      } catch { /* no error — good */ }

      // Also check for ERROR text in the preview itself
      try {
        const errorNodes = await page.find('Text', { children: 'ERROR' }).all();
        if (errorNodes.length > 0) {
          const errText = await errorNodes[0].text();
          broken.push(`${entry.label}: ${errText.slice(0, 150)}`);
          const safeName = entry.id.replace(/[^a-z0-9]/g, '_');
          await page.screenshot(`/tmp/gallery_fail_${safeName}.png`);
          continue;
        }
      } catch { /* no error — good */ }

      passed.push(entry.label);
    } catch (e: any) {
      broken.push(`${entry.label}: ${(e?.message || String(e)).slice(0, 150)}`);
    }
  }

  // Summary
  const summary = [
    `Gallery Preview Sweep: ${passed.length} pass, ${broken.length} fail, ${skipped.length} skip`,
    '',
    ...broken.map(b => `  FAIL  ${b}`),
    ...skipped.map(s => `  SKIP  ${s}`),
  ].join('\n');

  console.log(summary);

  if (broken.length > 0) {
    throw new Error(summary);
  }
});
