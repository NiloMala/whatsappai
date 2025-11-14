import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isPublicMiniSite, getSlugFromHostname } from '@/config/constants';

/**
 * Componente que redireciona baseado no domínio acessado
 * - Se for ia.auroratech.tech → não faz nada (usa rotas normais)
 * - Se for *.teatende.online → redireciona para /public/:slug
 */
export const DomainRouter = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Verifica se está acessando via subdomínio do teatende.online
    if (isPublicMiniSite()) {
      const slug = getSlugFromHostname();

      if (slug && !location.pathname.startsWith('/public/')) {
        // Redireciona para a página pública do mini site (compatibilidade com links antigos)
        navigate(`/public/${slug}`, { replace: true });
      }
    }
  }, [location, navigate]);

  return <>{children}</>;
};
