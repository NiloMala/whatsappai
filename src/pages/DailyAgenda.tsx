import { useParams } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { eventService } from "@/services/eventService";
import { Event } from "@/types/events";

const DailyAgenda = () => {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [viewingEvent, setViewingEvent] = useState<Event | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    date: '',
  });
  

  // Parse date from URL parameter as local date at noon to avoid timezone issues
  // Memoize so the Date object identity stays stable between renders and
  // doesn't retrigger the effect repeatedly.
  const selectedDate = useMemo(() => {
    return date ? new Date(`${date}T12:00:00`) : new Date();
  }, [date]);

  // Carregar eventos quando o componente monta ou a data muda
  useEffect(() => {
    loadEvents();
  }, [selectedDate]);

  // Subscribe to realtime changes on the events table for this user so the
  // agenda updates automatically when an event is created/updated/deleted
  // elsewhere (e.g. from the Calendar page). We recreate the subscription
  // when the selectedDate changes to keep behavior scoped, and we cleanup
  // on unmount.
  useEffect(() => {
    let channel: any = null;
    let mounted = true;

    const setupSubscription = async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) return;

        const userId = user.user.id;

        // Create a channel filtered by user_id so only relevant events are
        // forwarded. On any change, reload events for the selected date.
        // Using the new supabase-js v2 realtime API.
        channel = supabase
          .channel(`public:events:user_id=${userId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'events', filter: `user_id=eq.${userId}` },
            (payload: any) => {
              // guard: only reload if component still mounted
              if (!mounted) return;
              console.log('Realtime event received for events table:', payload?.event);
              loadEvents();
            }
          )
          .subscribe();
      } catch (error) {
        console.error('Erro ao configurar realtime subscription:', error);
      }
    };

    setupSubscription();

    return () => {
      mounted = false;
      if (channel) {
        try {
          // unsubscribe/leave channel
          supabase.removeChannel(channel);
        } catch (err) {
          // fallback for older clients
          try { channel.unsubscribe(); } catch (_) {}
        }
      }
    };
  }, [selectedDate]);

  const loadEvents = async () => {
    try {
      console.log('loadEvents: start for date', selectedDate.toISOString());
      setLoading(true);
      const { data: user } = await supabase.auth.getUser();
      console.log('loadEvents: auth.getUser result', user);

      if (user.user) {
        const data = await eventService.getEventsForDate(user.user.id, selectedDate);
        console.log('loadEvents: events returned count', data?.length ?? 0);
        setEvents(data || []);
      } else {
        console.log('loadEvents: no authenticated user');
        setEvents([]);
      }
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      setEvents([]);
    } finally {
      console.log('loadEvents: finished, setting loading false');
      setLoading(false);
    }
  };

  // Usar eventos diretamente do serviço (já filtrados pela data correta)
  const eventsForSelectedDate = events
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.startTime || !newEvent.endTime) return;

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const [startHour, startMinute] = newEvent.startTime.split(':').map(Number);
      const [endHour, endMinute] = newEvent.endTime.split(':').map(Number);

      // Use the date chosen in the modal if provided, otherwise fall back to selectedDate
      const dateStr = newEvent.date || selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const [y, m, d] = dateStr.split('-').map(Number);

      // Criar datas em UTC para evitar problemas de timezone
        // Build Date in the user's local timezone so the entered time is preserved
        const startTime = new Date(y, m - 1, d, startHour, startMinute, 0, 0);
        const endTime = new Date(y, m - 1, d, endHour, endMinute, 0, 0);

      await eventService.createEvent({
        user_id: user.user.id,
        title: newEvent.title,
        description: newEvent.description || undefined,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
      });

  setNewEvent({ title: '', description: '', startTime: '', endTime: '', date: '' });
      setIsModalOpen(false);
      loadEvents(); // Recarregar eventos
    } catch (error) {
      console.error('Erro ao criar evento:', error);
    }
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    // Use toLocaleTimeString to get the local time (HH:mm) for the inputs
    const startTime = new Date(event.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(event.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setNewEvent({
      title: event.title,
      description: event.description || '',
      startTime,
      endTime,
      date: new Date(event.start_time).toISOString().split('T')[0],
    });
    setIsModalOpen(true);
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent || !newEvent.title || !newEvent.startTime || !newEvent.endTime) return;

    try {
      const [startHour, startMinute] = newEvent.startTime.split(':').map(Number);
      const [endHour, endMinute] = newEvent.endTime.split(':').map(Number);

      // Use the date chosen in the modal if provided, otherwise fall back to selectedDate
      const dateStr = newEvent.date || selectedDate.toISOString().split('T')[0];
      const [y, m, d] = dateStr.split('-').map(Number);

      // Criar datas em UTC para evitar problemas de timezone
        // Build Date in the user's local timezone so the entered time is preserved
        const startTime = new Date(y, m - 1, d, startHour, startMinute, 0, 0);
        const endTime = new Date(y, m - 1, d, endHour, endMinute, 0, 0);

      await eventService.updateEvent(editingEvent.id, {
        title: newEvent.title,
        description: newEvent.description || undefined,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
      });

  setNewEvent({ title: '', description: '', startTime: '', endTime: '', date: '' });
      setEditingEvent(null);
      setIsModalOpen(false);
      loadEvents(); // Recarregar eventos
    } catch (error) {
      console.error('Erro ao atualizar evento:', error);
    }
  };

  const handleDeleteEvent = (eventId: string) => {
    setEventToDelete(eventId);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete) return;

    try {
      await eventService.deleteEvent(eventToDelete);
      setEventToDelete(null);
      setIsDeleteModalOpen(false);
      loadEvents(); // Recarregar eventos
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
    }
  };

  const handleViewEvent = (event: Event) => {
    setViewingEvent(event);
    setIsViewModalOpen(true);
  };

  const testDatabaseConnection = async () => {
    console.log('=== TESTE DE CONEXÃO COM BANCO ===');

    try {
      // Testar conexão básica
      const { data: connectionTest, error: connectionError } = await supabase
        .from('events')
        .select('count')
        .limit(1);

      console.log('Teste de conexão:', connectionTest);
      console.log('Erro de conexão:', connectionError);

      // Verificar se tabela existe
      const { data: tableCheck, error: tableError } = await supabase
        .rpc('get_events_in_range', {
          user_id: 'test',
          start_date: '2025-01-01T00:00:00Z',
          end_date: '2025-12-31T23:59:59Z'
        });

      console.log('Teste de função RPC:', tableCheck);
      console.log('Erro de função RPC:', tableError);

    } catch (error) {
      console.error('Erro geral no teste de conexão:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header Section */}
  <div className="bg-card border rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Button
                variant="outline"
                size="default"
                onClick={() => navigate('/dashboard/calendar')}
                className="px-4 py-2"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Voltar ao Calendário
              </Button>
              <Button
                variant="outline"
                size="default"
                className="px-4 py-2 invisible">
              </Button>
              <div>
                <h1 className="text-2xl font-bold mb-1">
                  {selectedDate.toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                  })}
                </h1>
                <p className="text-muted-foreground">
                  {eventsForSelectedDate.length} compromisso{eventsForSelectedDate.length !== 1 ? 's' : ''} agendado{eventsForSelectedDate.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Dialog open={isModalOpen} onOpenChange={(open) => {
                      if (!open) {
                        setIsModalOpen(false);
                        setEditingEvent(null);
                        setNewEvent({ title: '', description: '', startTime: '', endTime: '', date: '' });
                      } else {
                        // when opening modal for create, default date to selectedDate
                        setIsModalOpen(true);
                        if (!editingEvent) {
                          setNewEvent((prev) => ({ ...prev, date: selectedDate.toISOString().split('T')[0] }));
                        }
                      }
                    }}>
              <DialogTrigger asChild>
                <Button size="default" className="px-6 py-2">
                  <Plus className="h-5 w-5 mr-2" />
                  Novo Evento
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingEvent ? 'Editar Evento' : 'Criar Novo Evento'}</DialogTitle>
                  <DialogDescription>
                    {editingEvent ? 'Edite os detalhes do evento selecionado.' : 'Preencha os detalhes para criar um novo evento na sua agenda.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="date">Data</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="title">Título do Evento</Label>
                    <Input
                      id="title"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                      placeholder="Digite o título do evento"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Descrição (opcional)</Label>
                    <Textarea
                      id="description"
                      value={newEvent.description}
                      onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                      placeholder="Digite uma descrição para o evento"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startTime">Horário de Início</Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={newEvent.startTime}
                        onChange={(e) => setNewEvent({...newEvent, startTime: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="endTime">Horário de Fim</Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={newEvent.endTime}
                        onChange={(e) => setNewEvent({...newEvent, endTime: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => {
                      setIsModalOpen(false);
                      setEditingEvent(null);
                      setNewEvent({ title: '', description: '', startTime: '', endTime: '', date: '' });
                    }}>
                      Cancelar
                    </Button>
                    <Button onClick={editingEvent ? handleUpdateEvent : handleAddEvent}>
                      {editingEvent ? 'Atualizar Evento' : 'Criar Evento'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Events Section */}
        <div className="space-y-6">
        
          {loading ? (
            <Card className="p-12 text-center border-dashed border-2">
              <div className="text-center">
                <div className="text-4xl mb-4">⏳</div>
                <h3 className="text-xl font-bold mb-3">Carregando eventos...</h3>
                <p className="text-muted-foreground">Aguarde enquanto buscamos seus compromissos.</p>
              </div>
            </Card>
          ) : eventsForSelectedDate.length > 0 ? (
            <div className="grid gap-4">
              {eventsForSelectedDate.map((event, index) => (
                <Card key={event.id} className="p-6 border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold mb-3 text-foreground">{event.title}</h3>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🕐</span>
                          <span className="font-medium text-foreground">
                            {new Date(event.start_time).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })} - {new Date(event.end_time).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">📅</span>
                          <span className="font-medium text-foreground">
                            {new Date(event.start_time).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 ml-4">
                      <Button variant="outline" size="default" className="px-4 py-2" onClick={() => handleViewEvent(event)}>
                        👁️ Visualizar
                      </Button>
                      <Button variant="outline" size="default" className="px-4 py-2" onClick={() => handleEditEvent(event)}>
                        ✏️ Editar
                      </Button>
                      <Button variant="outline" size="default" className="px-4 py-2 text-red-600 hover:text-red-700" onClick={() => handleDeleteEvent(event.id)}>
                        🗑️ Excluir
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center border-dashed border-2">
              <div className="text-center">
                <div className="text-6xl mb-6">📅</div>
                <h3 className="text-xl font-bold mb-3">Nenhum compromisso agendado</h3>
                <p className="text-muted-foreground mb-6 text-lg">Este dia está livre! Que tal adicionar um novo compromisso?</p>
            <Dialog open={isModalOpen} onOpenChange={(open) => {
              if (!open) {
                setIsModalOpen(false);
                setEditingEvent(null);
                setNewEvent({ title: '', description: '', startTime: '', endTime: '', date: '' });
              } else {
                setIsModalOpen(true);
              }
            }}>
              <DialogTrigger asChild>
                <Button size="lg" className="px-8 py-3">
                  <Plus className="h-5 w-5 mr-2" />
                  Criar Primeiro Evento
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingEvent ? 'Editar Evento' : 'Criar Novo Evento'}</DialogTitle>
                  <DialogDescription>
                    {editingEvent ? 'Edite os detalhes do evento selecionado.' : 'Preencha os detalhes para criar um novo evento na sua agenda.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Título do Evento</Label>
                    <Input
                      id="title"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                      placeholder="Digite o título do evento"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Descrição (opcional)</Label>
                    <Textarea
                      id="description"
                      value={newEvent.description}
                      onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                      placeholder="Digite uma descrição para o evento"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startTime">Horário de Início</Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={newEvent.startTime}
                        onChange={(e) => setNewEvent({...newEvent, startTime: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="endTime">Horário de Fim</Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={newEvent.endTime}
                        onChange={(e) => setNewEvent({...newEvent, endTime: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => {
                      setIsModalOpen(false);
                      setEditingEvent(null);
                      setNewEvent({ title: '', description: '', startTime: '', endTime: '', date: '' });
                    }}>
                      Cancelar
                    </Button>
                    <Button onClick={editingEvent ? handleUpdateEvent : handleAddEvent}>
                      {editingEvent ? 'Atualizar Evento' : 'Criar Evento'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* View Event Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Evento</DialogTitle>
            <DialogDescription>
              Visualize todas as informações do evento selecionado.
            </DialogDescription>
          </DialogHeader>
          {viewingEvent && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Título</Label>
                <p className="text-lg font-semibold">{viewingEvent.title}</p>
              </div>
              {viewingEvent.description && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Descrição</Label>
                  <p className="text-sm">{viewingEvent.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Horário de Início</Label>
                  <p className="font-medium">
                    {new Date(viewingEvent.start_time).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Horário de Fim</Label>
                  <p className="font-medium">
                    {new Date(viewingEvent.end_time).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Data</Label>
                <p className="font-medium">
                  {new Date(viewingEvent.start_time).toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
                  Fechar
                </Button>
                <Button onClick={() => {
                  handleEditEvent(viewingEvent);
                  setIsViewModalOpen(false);
                }}>
                  Editar Evento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. O evento será removido permanentemente da sua agenda.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <p className="text-lg font-medium mb-2">Tem certeza que deseja excluir este evento?</p>
              <p className="text-muted-foreground text-sm">
                Esta ação não pode ser desfeita. O evento será removido permanentemente da sua agenda.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setEventToDelete(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteEvent}
                className="bg-red-600 hover:bg-red-700"
              >
                Excluir Evento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default DailyAgenda;