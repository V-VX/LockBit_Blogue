export interface SiteLink {
  readonly href: string;
  readonly label: string;
}

export const siteNavRows: readonly (readonly SiteLink[])[] = [
  [
    { href: '#', label: 'ENCRYPTING THE PLANET' },
    { href: '#', label: 'HOW TO BUY BITCOIN' },
    { href: '#', label: 'CONTACT US' },
  ],
  [
    { href: '#', label: 'PRESS ABOUT US' },
    { href: '#', label: 'AFFILIATE RULES' },
    { href: '#', label: 'MIRRORS' },
  ],
];
