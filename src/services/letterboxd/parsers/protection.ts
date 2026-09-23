/** Normal public pages also contain CAPTCHA login widgets and passive CDN scripts. */
export function isProtectionPage(html: string): boolean {
  return (
    /<title[^>]*>\s*(?:Just a moment|Attention Required)/i.test(html) ||
    /id=["']challenge-form["']/i.test(html)
  );
}
