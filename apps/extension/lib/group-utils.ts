export function getDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
}

// Well-known domains → human-friendly short names
const DOMAIN_NAME_HINTS: Record<string, string> = {
  // Video / Media
  'youtube.com': 'YouTube', 'youtu.be': 'YouTube',
  'netflix.com': 'Netflix', 'twitch.tv': 'Twitch',
  'vimeo.com': 'Vimeo', 'hulu.com': 'Hulu',
  'disneyplus.com': 'Disney+', 'primevideo.com': 'Prime Video',
  'music.youtube.com': 'YT Music',

  // Social
  'twitter.com': 'Twitter', 'x.com': 'X',
  'facebook.com': 'Facebook', 'instagram.com': 'Instagram',
  'linkedin.com': 'LinkedIn', 'reddit.com': 'Reddit',
  'tiktok.com': 'TikTok', 'pinterest.com': 'Pinterest',
  'discord.com': 'Discord', 'slack.com': 'Slack',
  'whatsapp.com': 'WhatsApp', 'telegram.org': 'Telegram',
  'snapchat.com': 'Snapchat',

  // Google services (subdomains before base domain so exact match wins)
  'mail.google.com': 'Gmail',
  'docs.google.com': 'Google Docs',
  'drive.google.com': 'Google Drive',
  'sheets.google.com': 'Google Sheets',
  'slides.google.com': 'Google Slides',
  'calendar.google.com': 'Calendar',
  'meet.google.com': 'Google Meet',
  'maps.google.com': 'Google Maps',
  'photos.google.com': 'Photos',
  'news.google.com': 'Google News',
  'cloud.google.com': 'Google Cloud',
  'gemini.google.com': 'Gemini',
  'gmail.com': 'Gmail',
  'google.com': 'Google',

  // Microsoft
  'outlook.live.com': 'Outlook', 'outlook.com': 'Outlook',
  'teams.microsoft.com': 'Teams',
  'office.com': 'Office',
  'microsoft.com': 'Microsoft',
  'onedrive.live.com': 'OneDrive',

  // Apple
  'music.apple.com': 'Apple Music',
  'icloud.com': 'iCloud',
  'apple.com': 'Apple',

  // Dev / Tech
  'github.com': 'GitHub', 'gitlab.com': 'GitLab',
  'bitbucket.org': 'Bitbucket',
  'stackoverflow.com': 'Stack Overflow',
  'developer.mozilla.org': 'MDN',
  'npmjs.com': 'npm', 'pypi.org': 'PyPI',
  'news.ycombinator.com': 'Hacker News',
  'vercel.com': 'Vercel', 'netlify.com': 'Netlify',
  'heroku.com': 'Heroku',
  'codepen.io': 'CodePen', 'codesandbox.io': 'CodeSandbox',
  'replit.com': 'Replit',
  'jira.atlassian.com': 'Jira',
  'confluence.atlassian.com': 'Confluence',

  // AI
  'chat.openai.com': 'ChatGPT', 'openai.com': 'OpenAI',
  'claude.ai': 'Claude', 'anthropic.com': 'Anthropic',
  'bard.google.com': 'Gemini',
  'perplexity.ai': 'Perplexity',
  'huggingface.co': 'HuggingFace',

  // Productivity
  'notion.so': 'Notion', 'obsidian.md': 'Obsidian',
  'figma.com': 'Figma', 'airtable.com': 'Airtable',
  'trello.com': 'Trello', 'asana.com': 'Asana',
  'miro.com': 'Miro', 'linear.app': 'Linear',
  'monday.com': 'Monday', 'dropbox.com': 'Dropbox',

  // Shopping
  'amazon.com': 'Amazon', 'amazon.ca': 'Amazon',
  'amazon.co.uk': 'Amazon', 'amazon.de': 'Amazon',
  'ebay.com': 'eBay', 'etsy.com': 'Etsy',

  // Music
  'spotify.com': 'Spotify', 'soundcloud.com': 'SoundCloud',

  // News
  'nytimes.com': 'NY Times', 'theguardian.com': 'Guardian',
  'bbc.com': 'BBC', 'bbc.co.uk': 'BBC',
  'cnn.com': 'CNN', 'techcrunch.com': 'TechCrunch',
  'theverge.com': 'The Verge', 'wired.com': 'Wired',
};

/**
 * Returns a human-friendly group title for a domain.
 * Checks an exact lookup table first, then the base domain (strips one subdomain level),
 * then falls back to capitalising the first segment.
 */
export function getGroupTitle(domain: string): string {
  if (!domain) return '';
  // Exact match
  if (DOMAIN_NAME_HINTS[domain]) return DOMAIN_NAME_HINTS[domain];
  // Try base domain (e.g. docs.google.com → google.com)
  const parts = domain.split('.');
  if (parts.length > 2) {
    const baseDomain = parts.slice(-2).join('.');
    if (DOMAIN_NAME_HINTS[baseDomain]) return DOMAIN_NAME_HINTS[baseDomain];
  }
  // Fallback: capitalise first segment
  const first = parts[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : domain;
}
