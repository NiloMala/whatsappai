// Domínio principal da aplicação SaaS
export const APP_DOMAIN = 'ia.auroratech.tech';

// Domínio para os mini sites públicos
export const PUBLIC_DOMAIN = 'teatende.online';

// Função para gerar URL pública do mini site
export const getMiniSiteUrl = (slug: string): string => {
  return `https://${slug}.${PUBLIC_DOMAIN}`;
};

// Função para verificar se está acessando via subdomínio do teatende.online
export const isPublicMiniSite = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname.endsWith(`.${PUBLIC_DOMAIN}`) && hostname !== PUBLIC_DOMAIN;
};

// Função para extrair o slug do subdomínio
export const getSlugFromHostname = (): string | null => {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname;

  if (hostname.endsWith(`.${PUBLIC_DOMAIN}`)) {
    const slug = hostname.replace(`.${PUBLIC_DOMAIN}`, '');
    return slug;
  }

  return null;
};
