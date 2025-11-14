import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Key } from 'lucide-react';

interface CredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceNames: string[];
  onSaved: () => void;
}

const SERVICE_LABELS: Record<string, string> = {
  openai: 'OpenAI API Key',
  groq: 'Groq API Key',
  claude: 'Claude API Key',
  ollama: 'Ollama Base URL',
  evolution: 'Evolution API Key',
  redis: 'Redis Connection String',
  supabase: 'Supabase API Key'
};

export function CredentialsDialog({ open, onOpenChange, serviceNames, onSaved }: CredentialsDialogProps) {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      serviceNames.forEach(name => {
        initial[name] = '';
      });
      setCredentials(initial);
    }
  }, [open, serviceNames]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      for (const [serviceName, apiKey] of Object.entries(credentials)) {
        if (!apiKey.trim()) continue;

        const { error } = await supabase
          .from('user_credentials')
          .upsert({
            user_id: user.id,
            service_name: serviceName,
            api_key: apiKey.trim()
          }, {
            onConflict: 'user_id,service_name'
          });

        if (error) throw error;
      }

      toast({
        title: 'Credenciais salvas',
        description: 'Suas credenciais foram armazenadas com segurança.'
      });

      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving credentials:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Configurar Credenciais
          </DialogTitle>
          <DialogDescription>
            Configure as credenciais necessárias para criar este agente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {serviceNames.map(serviceName => (
            <div key={serviceName} className="space-y-2">
              <Label htmlFor={serviceName}>
                {SERVICE_LABELS[serviceName] || serviceName}
              </Label>
              <Input
                id={serviceName}
                type="password"
                placeholder={`Cole sua ${SERVICE_LABELS[serviceName] || 'chave'}...`}
                value={credentials[serviceName] || ''}
                onChange={(e) => setCredentials(prev => ({
                  ...prev,
                  [serviceName]: e.target.value
                }))}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
