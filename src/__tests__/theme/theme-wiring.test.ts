import fs from 'fs';
import path from 'path';

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('shared Provvy theme wiring', () => {
  it('bootstraps the existing theme key before hydration', () => {
    const layout = read('app/layout.tsx');
    expect(layout).toContain('THEME_BOOTSTRAP_SCRIPT');
    expect(layout).toContain('beforeInteractive');
    expect(layout).toContain('provvy-theme');
    expect(layout).toContain('suppressHydrationWarning');
  });

  it('applies journey dark tokens when html.dark is set, matching the workspace', () => {
    const css = read('components/journey/lovable/lovable-journey.css');
    expect(css).toContain('html.dark .lovable-journey');
    expect(css).toContain('.lovable-journey.dark');
    expect(css).toContain('color-scheme: dark');
  });

  it('uses the shared theme hook on marketing and authenticated surfaces', () => {
    const landing = read('components/journey/lovable/journey-landing-page.tsx');
    const workspace = read('components/journey/lovable/workspace-layout.tsx');
    const assessment = read('components/journey/lovable/assessment-layout.tsx');

    expect(landing).toContain('useProvvyTheme');
    expect(landing).toContain('LandingAdvisor');
    expect(landing).not.toContain("localStorage.getItem('theme')");
    expect(workspace).toContain('useProvvyTheme');
    expect(workspace).not.toContain("localStorage.getItem('theme')");
    expect(assessment).toContain('useProvvyTheme');
    expect(assessment).not.toContain("localStorage.getItem('theme')");
  });
});
