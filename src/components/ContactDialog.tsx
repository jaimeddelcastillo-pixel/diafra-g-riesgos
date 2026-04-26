import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ContactDialogProps {
  trigger: React.ReactNode;
}

interface FormState {
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  mensaje: string;
}

const EMPTY: FormState = {
  nombre: "",
  empresa: "",
  email: "",
  telefono: "",
  mensaje: "",
};

export function ContactDialog({ trigger }: ContactDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const update = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const validate = (): string | null => {
    if (!form.nombre.trim()) return "El nombre es obligatorio";
    if (form.nombre.length > 120) return "Nombre demasiado largo";
    if (!form.empresa.trim()) return "La empresa es obligatoria";
    if (form.empresa.length > 120) return "Empresa demasiado larga";
    if (!form.email.trim()) return "El correo es obligatorio";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Correo inválido";
    if (form.email.length > 200) return "Correo demasiado largo";
    if (form.telefono.length > 40) return "Teléfono demasiado largo";
    if (!form.mensaje.trim()) return "El mensaje es obligatorio";
    if (form.mensaje.length > 4000) return "Mensaje demasiado largo (máx 4000)";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast({ title: "Revisa el formulario", description: err, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("contact-message", {
        body: {
          nombre: form.nombre.trim(),
          empresa: form.empresa.trim(),
          email: form.email.trim(),
          telefono: form.telefono.trim(),
          mensaje: form.mensaje.trim(),
        },
      });
      if (error) throw error;
      toast({
        title: "Mensaje enviado",
        description: "Tu mensaje fue enviado. Te contactaremos en menos de 24 horas.",
      });
      setForm(EMPTY);
      setOpen(false);
    } catch (err) {
      toast({
        title: "No se pudo enviar",
        description: (err as Error).message || "Inténtalo nuevamente más tarde.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" /> Contáctanos
          </DialogTitle>
          <DialogDescription>
            Cuéntanos cómo podemos ayudarte. Te responderemos en menos de 24 horas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="contact-nombre">Nombre completo *</Label>
            <Input id="contact-nombre" value={form.nombre} onChange={update("nombre")} maxLength={120} required disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-empresa">Empresa *</Label>
            <Input id="contact-empresa" value={form.empresa} onChange={update("empresa")} maxLength={120} required disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-email">Correo electrónico *</Label>
            <Input id="contact-email" type="email" value={form.email} onChange={update("email")} maxLength={200} required disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-telefono">Teléfono <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Input id="contact-telefono" type="tel" value={form.telefono} onChange={update("telefono")} maxLength={40} disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-mensaje">Mensaje *</Label>
            <Textarea id="contact-mensaje" value={form.mensaje} onChange={update("mensaje")} maxLength={4000} required disabled={loading} rows={4} />
          </div>

          <DialogFooter className="pt-2">
            <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...
                </>
              ) : (
                "Enviar mensaje"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}