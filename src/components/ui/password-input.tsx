import * as React from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, WandSparkles } from 'lucide-react';
import { Button } from './button';
import { generarPassword, errorAutenticacionEs } from './password-utils';

/** Preserve the native field and its existing handlers/validation. */
export function PasswordInput({ input }: { input: HTMLInputElement }) {
  const [visible, setVisible] = React.useState(input.type === 'text');
  const label = input.labels?.[0]?.textContent ?? input.parentElement?.querySelector('label')?.textContent ?? '';
  const temporal = /temporal|contraseña.*administrador/i.test(label);
  const minimo = input.minLength > 0 ? input.minLength : null;
  const cambiar = () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) return;
    setter.call(input, generarPassword());
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
  };
  return <div className="space-y-2 pt-1 text-foreground">
    <div className="flex items-center gap-2">
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible} disabled={input.disabled} onClick={() => { input.type = visible ? 'password' : 'text'; setVisible(!visible); }}>
        {visible ? <EyeOff/> : <Eye/>}
      </Button>
      {temporal && <Button type="button" size="sm" variant="outline" disabled={input.disabled || input.readOnly} onClick={cambiar}><WandSparkles/>Generar</Button>}
    </div>
    <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
      {minimo && <li>Al menos {minimo} caracteres.</li>}
      <li>Cumplir la longitud y los tipos de caracteres exigidos por la política vigente.</li>
      <li>No debe aparecer en filtraciones conocidas.</li>
    </ul>
  </div>;
}
/** Single adapter for all native/Input fields, including dialogs mounted later. */
export function PasswordFields() {
  const [campos, setCampos] = React.useState<{ input: HTMLInputElement; host: HTMLElement }[]>([]);
  React.useEffect(() => {
    const registrados = new Map<HTMLInputElement, HTMLElement>(); const ocultos = new Set<HTMLButtonElement>();
    const actualizar = () => {
      let cambio = false;
      for (const input of document.querySelectorAll<HTMLInputElement>('input')) {
        const label = input.labels?.[0]?.textContent ?? input.parentElement?.querySelector('label')?.textContent ?? '';
        if (input.type !== 'password' && !/password/i.test(input.id) && !(input.type === 'text' && /contraseña/i.test(label))) continue;
        if (registrados.has(input)) continue;
        const padre = input.parentElement; if (!padre) continue;
        const host = document.createElement('div'); host.dataset.passwordControls = 'true';
        for (const btn of padre.querySelectorAll<HTMLButtonElement>('button[aria-label]')) {
          if (/mostrar contraseña|ocultar contraseña/i.test(btn.getAttribute('aria-label') ?? '')) { btn.hidden = true; ocultos.add(btn); }
        }
        input.insertAdjacentElement('afterend', host); registrados.set(input, host); cambio = true;
      }
      for (const [input, host] of registrados) if (!input.isConnected) { host.remove(); registrados.delete(input); cambio = true; }
      if (cambio) setCampos(Array.from(registrados, ([input, host]) => ({ input, host })));
      for (const aviso of document.querySelectorAll('[data-sonner-toast], [role="status"], [role="alert"]')) {
        const walker = document.createTreeWalker(aviso, NodeFilter.SHOW_TEXT); let node = walker.nextNode();
        while (node) { const texto = node.textContent ?? ''; const es = errorAutenticacionEs(texto); if (es !== texto) node.textContent = es; node = walker.nextNode(); }
      }
    };
    actualizar(); const observer = new MutationObserver(actualizar);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => { observer.disconnect(); for (const host of registrados.values()) host.remove(); for (const btn of ocultos) btn.hidden = false; };
  }, []);
  return <>{campos.map(({ input, host }, i) => createPortal(<PasswordInput input={input}/>, host, String(i)))}</>;
}
