export function renderThemeToggle(): string {
  return `
    <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch theme">
      <span class="theme-toggle-icon" aria-hidden="true">◐</span>
      <span class="theme-toggle-label" data-theme-toggle-label>Theme</span>
    </button>
  `;
}
