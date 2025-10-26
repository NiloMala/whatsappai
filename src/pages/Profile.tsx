import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    id: "",
    email: "",
    company_name: "",
    phone: "",
    updated_at: '' as string | null,
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/auth');
          return;
        }

        const { data, error } = await (supabase as any)
          .from('profiles')
          .select('id, email, company_name, phone, updated_at')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setProfile({
          id: data.id,
          email: data.email || user.email || '',
          company_name: data.company_name || '',
          phone: data.phone || '',
          updated_at: data.updated_at || null,
        });
      } catch (err: any) {
        console.error('Error loading profile', err);
        toast({ title: 'Erro', description: err.message || 'Não foi possível carregar o perfil', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate, toast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Validate phone format (BR: (00) 00000-0000 or 00000000000) - simple check
      const phone = (profile.phone || '').trim();
      const phoneRegex = /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/;
      if (phone && !phoneRegex.test(phone)) {
        toast({ title: 'Telefone inválido', description: 'Digite um telefone no formato (00) 90000-0000 ou 00900000000', variant: 'destructive' });
        setSaving(false);
        return;
      }

      const updates: any = {
        company_name: profile.company_name,
        phone: phone,
      };

      const { error } = await (supabase as any)
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) throw error;

  toast({ title: 'Salvo', description: 'Perfil atualizado com sucesso.' });
      // Após salvar, voltar para o dashboard
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Error saving profile', err);
      toast({ title: 'Erro', description: err.message || 'Não foi possível salvar o perfil', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8">Carregando perfil...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Meu Perfil</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" value={profile.email} readOnly />
          </div>

          <div>
            <Label htmlFor="company">Empresa</Label>
            <Input id="company" value={profile.company_name} onChange={(e) => setProfile({ ...profile, company_name: (e.target as HTMLInputElement).value })} />
          </div>

          <div>
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: (e.target as HTMLInputElement).value })} />
          </div>

          {profile.updated_at && (
            <div>
              <Label htmlFor="updated">Última atualização</Label>
              <Input id="updated" value={new Date(profile.updated_at).toLocaleString('pt-BR')} readOnly />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => navigate('/dashboard')}>Voltar ao Dashboard</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default Profile;
