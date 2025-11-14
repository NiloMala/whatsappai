import { MenuItem } from '@/contexts/MenuContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';

interface MenuItemCardProps {
  item: MenuItem;
  onEdit?: (item: MenuItem) => void;
  onDelete?: (id: string) => void;
  isPublic?: boolean;
  onWhatsAppClick?: () => void;
}

export const MenuItemCard = ({ item, onEdit, onDelete, isPublic = false, onWhatsAppClick }: MenuItemCardProps) => {
  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-lg">
      {item.imageUrl && (
        <div className="aspect-video w-full overflow-hidden bg-muted">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
          />
        </div>
      )}
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl">{item.title}</CardTitle>
            <CardDescription className="mt-1">{item.category}</CardDescription>
          </div>
          <div className="text-lg font-bold text-primary">
            R$ {item.price.toFixed(2)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{item.description}</p>
        {item.duration && (
          <p className="text-xs text-muted-foreground">
            ⏱️ Duração: {item.duration} minutos
          </p>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        {isPublic ? (
          <Button onClick={onWhatsAppClick} className="w-full" size="lg">
            Pedir via WhatsApp
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={() => onEdit?.(item)} className="flex-1">
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
            <Button variant="destructive" size="sm" onClick={() => onDelete?.(item.id)} className="flex-1">
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
};
