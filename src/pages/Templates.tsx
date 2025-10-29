import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, Copy, Pencil, Trash2, Star } from "lucide-react";

const Templates = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "comercial",
    prompt: "",
  });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<any | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .or(`user_id.eq.${user.id},is_system.eq.true`)
      .order("is_system", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar templates",
        variant: "destructive",
      });
      return;
    }

    setTemplates(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingTemplate) {
      const { error } = await supabase
        .from("templates")
        .update(formData)
        .eq("id", editingTemplate.id);

      if (error) {
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Template atualizado!",
        description: "As alterações foram salvas.",
      });
    } else {
      const { error } = await supabase
        .from("templates")
        .insert({ ...formData, user_id: user.id });

      if (error) {
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Template criado!",
        description: "Seu template está pronto para uso.",
      });
    }

    setIsDialogOpen(false);
    resetForm();
    fetchTemplates();
  };

  const handleDuplicate = async (template: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("templates").insert({
      name: `${template.name} (Cópia)`,
      category: template.category,
      prompt: template.prompt,
      user_id: user.id,
    });

    if (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Template duplicado!",
      description: "Você pode editar a cópia agora.",
    });
    fetchTemplates();
  };

  // Open delete confirmation modal (replaces native confirm)
  const handleDelete = (template: any) => {
    setTemplateToDelete(template);
    setDeleteModalOpen(true);
  };

  // Called when user confirms deletion in modal
  const confirmDeleteTemplate = async () => {
    const id = templateToDelete?.id;
    setDeleteModalOpen(false);
    setTemplateToDelete(null);
    if (!id) return;

    const { error } = await supabase.from("templates").delete().eq("id", id);

    if (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Template excluído",
      description: "O template foi removido.",
    });
    fetchTemplates();
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category: "comercial",
      prompt: "",
    });
    setEditingTemplate(null);
  };

  const openEditDialog = (template: any) => {
    if (template.is_system) {
      handleDuplicate(template);
      return;
    }
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      category: template.category,
      prompt: template.prompt,
    });
    setIsDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Templates de Atendimento</h1>
            <p className="text-muted-foreground">
              Use templates prontos ou crie os seus próprios
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-primary/90">
                <Plus className="mr-2 h-4 w-4" />
                Novo Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? "Editar Template" : "Criar Novo Template"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Template</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    placeholder="Ex: Atendimento de Suporte"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comercial">Comercial</SelectItem>
                      <SelectItem value="suporte">Suporte</SelectItem>
                      <SelectItem value="agendamento">Agendamento</SelectItem>
                      <SelectItem value="informativo">Informativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prompt">Prompt do Atendente</Label>
                  <Textarea
                    id="prompt"
                    value={formData.prompt}
                    onChange={(e) =>
                      setFormData({ ...formData, prompt: e.target.value })
                    }
                    required
                    rows={8}
                    placeholder="Descreva como o agente deve se comportar, que tipo de informações fornecer, etc..."
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingTemplate ? "Salvar Alterações" : "Criar Template"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
            {/* Delete confirmation modal for templates */}
            <Dialog open={deleteModalOpen} onOpenChange={(open) => { if (!open) setTemplateToDelete(null); setDeleteModalOpen(open); }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmar exclusão</DialogTitle>
                </DialogHeader>
                <div className="mt-2">
                  <p>Tem certeza que deseja excluir o template <strong>{templateToDelete?.name}</strong>? Esta ação não pode ser desfeita.</p>
                </div>
                <DialogFooter>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => { setDeleteModalOpen(false); setTemplateToDelete(null); }}>Cancelar</Button>
                    <Button variant="destructive" onClick={() => void confirmDeleteTemplate()}>Excluir template</Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
        </div>

        <div className="grid gap-6">
          {templates.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Nenhum template encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Crie seu primeiro template de atendimento
              </p>
            </Card>
          ) : (
            templates.map((template) => (
              <Card key={template.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4 flex-1">
                    <FileText className="h-10 w-10 text-primary" />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold">{template.name}</h3>
                        {template.is_system && (
                          <Badge variant="secondary" className="gap-1">
                            <Star className="h-3 w-3" />
                            Sistema
                          </Badge>
                        )}
                        <Badge variant="outline">{template.category}</Badge>
                      </div>
                      <p className="text-muted-foreground text-sm mb-3">
                        {template.prompt.substring(0, 150)}...
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDuplicate(template)}
                      title="Duplicar template"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    {!template.is_system && (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openEditDialog(template)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDelete(template)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Templates;