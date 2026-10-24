import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, Eye, EyeOff, WandSparkles } from 'lucide-react';
import { Button } from './button';
import { generarPassword, errorAutenticacionEs, requisitosPassword, passwordsCoinciden, type PasswordPolicy } from './password-utils';

/** Preserve the native field and its existing handlers/validation. */
export function PasswordInput({ input, policy }: { input: HTMLInputElement; policy?: PasswordPolicy }) {
  const [visible, setVisible] = React.useState(input.type === 'text');
  const [value, setValue] = React.useState(input.value);
  const [mismatch, setMismatch] = React.useState(false);
  const label = input.labels?.[0]?.textContent ?? input.parentElement?.querySelector('label')?.textContent ?? '';
  const temporal = /temporal|contraseña.*administrador/i.test(label);
  React.useEffect(() => {
    const scope = input.closest('form, [role="dialog"], [role="alertdialog"]') ?? input.parentElement?.parentElement;
    const update = () => {
      setValue(input.value);
      const confirmation = /confirm|repite/i.test(`${input.id} ${label} ${input.placeholder}`);
      const original = Array.from(scope?.querySelectorAll<HTMLInputElement>('input') ?? []).find(other => other !== input &&
        (other.type === 'password' || /password/i.test(other.id)) && !/actual|current|confirm/i.test(`${other.id} ${other.labels?.[0]?.textContent ?? other.parentElement?.querySelector('label')?.textContent ?? ''}`));
      const unequal = !!(confirmation && original && input.value && !passwordsCoinciden(original.value, input.value));
      setMismatch(unequal);
      input.setCustomValidity(unequal ? 'Las contraseñas no coinciden' : '');
    };
    scope?.addEventListener('input', update); update();
    return () => { scope?.removeEventListener('input', update); input.setCustomValidity(''); };
  }, [input, label]);
  const cambiar = () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) return;
    setter.call(input, generarPassword(policy));
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
    <ul className="space-y-1 text-xs text-muted-foreground">
      {policy ? requisitosPassword(value, policy).map(rule => <li key={rule.label} className={rule.met ? 'flex items-center gap-1 text-success' : 'flex items-center gap-1'}><Check className={rule.met ? 'h-3 w-3' : 'h-3 w-3 invisible'}/>{rule.label}</li>) : <li>Longitud y caracteres: sujetos a la política vigente de autenticación.</li>}
      <li>No debe aparecer en filtraciones conocidas.</li>
    </ul>
    {mismatch && <p role="alert" className="text-xs text-destructive">Las contraseñas no coinciden.</p>}
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
