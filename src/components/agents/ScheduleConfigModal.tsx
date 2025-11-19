import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, Plus, Trash2, AlertCircle } from "lucide-react";
import { ScheduleConfig, Holiday, WEEK_DAYS, SLOT_DURATION_OPTIONS, DELIVERY_TIME_OPTIONS, DEFAULT_SCHEDULE_CONFIG } from "@/types/schedule";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ScheduleConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleConfig: ScheduleConfig;
  holidays: Holiday[];
  onSave: (config: ScheduleConfig, holidays: Holiday[]) => void;
  agentType?: "general" | "delivery" | "support";
}

export function ScheduleConfigModal({
  open,
  onOpenChange,
  scheduleConfig,
  holidays,
  onSave,
  agentType = "general",
}: ScheduleConfigModalProps) {
  const [localConfig, setLocalConfig] = useState<ScheduleConfig>(scheduleConfig);
  const [localHolidays, setLocalHolidays] = useState<Holiday[]>(holidays);

  // Keep local state in sync when the modal opens or when props change
  useEffect(() => {
    setLocalConfig(scheduleConfig);
  }, [scheduleConfig, open]);

  useEffect(() => {
    setLocalHolidays(holidays || []);
  }, [holidays, open]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayDescription, setNewHolidayDescription] = useState("");

  const handleDayToggle = (day: string) => {
    setLocalConfig({
      ...localConfig,
      [day]: !localConfig[day as keyof ScheduleConfig],
    });
  };

  const handleAddHoliday = () => {
    if (!newHolidayDate) return;

    const holiday: Holiday = {
      date: newHolidayDate,
      description: newHolidayDescription || "Feriado",
    };

    setLocalHolidays([...localHolidays, holiday]);
    setNewHolidayDate("");
    setNewHolidayDescription("");
  };

  const handleRemoveHoliday = (index: number) => {
    setLocalHolidays(localHolidays.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(localConfig, localHolidays);
    onOpenChange(false);
  };

  const formatPreview = () => {
    const enabledDays = WEEK_DAYS.filter(day => localConfig[day.key as keyof ScheduleConfig]);
    const daysText = enabledDays.map(d => d.label).join(", ");
    const slotText = SLOT_DURATION_OPTIONS.find(opt => opt.value === localConfig.slot_duration)?.label || `${localConfig.slot_duration} min`;

    return `${daysText || "Nenhum dia"}, ${localConfig.start_time}-${localConfig.end_time}, intervalos de ${slotText}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {agentType === "delivery"
              ? "Configuração de Horários de Funcionamento"
              : "Configuração de Horários de Agendamento"}
          </DialogTitle>
          <DialogDescription>
            {agentType === "delivery"
              ? "Configure os dias e horários que o restaurante aceita pedidos"
              : "Configure os dias, horários e feriados para este agente"}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="schedule" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="schedule">
              <Clock className="h-4 w-4 mr-2" />
              Dias e Horários
            </TabsTrigger>
            <TabsTrigger value="holidays">
              <Calendar className="h-4 w-4 mr-2" />
              {agentType === "delivery"
                ? `Dias Fechados (${localHolidays.length})`
                : `Feriados (${localHolidays.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-4 mt-4">
            {/* Days of the week */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Dias da Semana</Label>
              <div className="grid grid-cols-7 gap-2">
                {WEEK_DAYS.map((day) => (
                  <div
                    key={day.key}
                    className={`flex flex-col items-center justify-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      localConfig[day.key as keyof ScheduleConfig]
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                    onClick={() => handleDayToggle(day.key)}
                  >
                    <span className="text-xs font-medium">{day.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Time range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Horário de Início</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={localConfig.start_time}
                  onChange={(e) =>
                    setLocalConfig({ ...localConfig, start_time: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">Horário de Término</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={localConfig.end_time}
                  onChange={(e) =>
                    setLocalConfig({ ...localConfig, end_time: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Slot duration */}
            <div className="space-y-2">
              <Label htmlFor="slot_duration">
                {agentType === "delivery"
                  ? "Tempo de Espera Estimado"
                  : "Duração do Agendamento"}
              </Label>
              <Select
                value={localConfig.slot_duration.toString()}
                onValueChange={(value) =>
                  setLocalConfig({ ...localConfig, slot_duration: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(agentType === "delivery" ? DELIVERY_TIME_OPTIONS : SLOT_DURATION_OPTIONS).map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {agentType === "delivery"
                  ? "Tempo estimado de preparo e entrega"
                  : "Tempo padrão de cada agendamento"}
              </p>
            </div>

            {/* Allow partial hours - Oculto para delivery */}
            {agentType !== "delivery" && (
              <div className="flex items-center justify-between border rounded-lg p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="allow_partial_hours" className="text-base">
                    Permitir horários quebrados
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Ex: 9:30, 10:15, etc. (Se desabilitado: apenas 9:00, 10:00, 11:00)
                  </p>
                </div>
                <Switch
                  id="allow_partial_hours"
                  checked={localConfig.allow_partial_hours}
                  onCheckedChange={(checked) =>
                    setLocalConfig({ ...localConfig, allow_partial_hours: checked })
                  }
                />
              </div>
            )}

            {/* Preview */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Resumo:</strong> {formatPreview()}
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="holidays" className="space-y-4 mt-4">
            {/* Add holiday form */}
            <div className="border rounded-lg p-4 space-y-3">
              <Label className="text-base font-semibold">
                {agentType === "delivery"
                  ? "Adicionar Dia Fechado"
                  : "Adicionar Feriado/Bloqueio"}
              </Label>
              <div className="grid grid-cols-[1fr_2fr_auto] gap-2">
                <Input
                  type="date"
                  placeholder="Data"
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                />
                <Input
                  placeholder={agentType === "delivery"
                    ? "Descrição (ex: Natal, Manutenção, Férias)"
                    : "Descrição (ex: Natal, Férias)"}
                  value={newHolidayDescription}
                  onChange={(e) => setNewHolidayDescription(e.target.value)}
                />
                <Button
                  type="button"
                  onClick={handleAddHoliday}
                  disabled={!newHolidayDate}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Holidays list */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">
                {agentType === "delivery"
                  ? `Dias Fechados (${localHolidays.length})`
                  : `Datas Bloqueadas (${localHolidays.length})`}
              </Label>
              {localHolidays.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {agentType === "delivery"
                    ? "Nenhum dia fechado cadastrado"
                    : "Nenhum feriado cadastrado"}
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {localHolidays.map((holiday, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between border rounded-lg p-3"
                    >
                      <div>
                        <p className="font-medium">
                          {new Date(holiday.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {holiday.description}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveHoliday(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar Configuração</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
