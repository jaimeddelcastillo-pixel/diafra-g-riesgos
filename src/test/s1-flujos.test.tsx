import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { CambioTemporal } from '@/components/CambioTemporal';
import { AutoridadCalidadCard } from '@/components/AutoridadCalidadCard';
import { designarSuplencia, facultadesSuplencia, errorSuplencia } from '@/lib/suplencias';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn(), refresh: vi.fn(), temporal: true }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'qa' }, orgId: null, org: null, roles: ['admin'], loading: false, requiereCambioTemporal: mocks.temporal, hasRole: () => true, isSuperAdmin: () => false, refreshOrg: mocks.refresh, signOut: vi.fn() }) }));
vi.mock('@/hooks/useAuditorExpedientes', () => ({ useAuditorExpedientes: () => ({ data: [], isLoading: false }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.temporal = true; });
const wrapper = (children: React.ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>);
describe('S-1 flujos utilizados por las pantallas', () => {
  it('el guard impide entrar a la plataforma con contraseña temporal', async () => {
    wrapper(<ProtectedRoute><div>Contenido privado QA</div></ProtectedRoute>);
    expect(await screen.findByRole('heading', { name: 'Cambia tu contraseña temporal' })).toBeInTheDocument();
    expect(screen.queryByText('Contenido privado QA')).not.toBeInTheDocument();
  });
  it('cambiar temporal llama al servidor y solo habilita acceso tras confirmación', async () => {
    mocks.invoke.mockResolvedValue({ data: { success: true } }); wrapper(<CambioTemporal/>);
    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'QA-old' } });
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'QA-new' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'QA-new' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nueva contraseña' }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(mocks.invoke).toHaveBeenCalledWith('cambiar-password-temporal', { body: { current_password: 'QA-old', password: 'QA-new' } });
  });
  it('el botón de autoridad no guarda sin motivo', () => {
    wrapper(<AutoridadCalidadCard/>);
    expect(screen.getByRole('button', { name: 'Guardar autoridad de calidad' })).toBeDisabled();
  });
  it('la designación de pantalla usa la RPC real y errores de restricción no muestran SQL', async () => {
    mocks.rpc.mockResolvedValue({ data: 'suplencia' });
    await expect(designarSuplencia({ rol: 'aseguramiento_calidad', titular: 'qa-ac', suplente: 'qa-op', inicio: '2026-10-24T12:00:00Z', fin: '2026-10-25T12:00:00Z', categoria: 'vacaciones', motivo: 'QA suplencia' })).resolves.toBe('suplencia');
    expect(mocks.rpc.mock.calls[0][0]).toBe('designar_suplencia');
    expect(facultadesSuplencia('aseguramiento_calidad')).toEqual(['autorizar','anular','validar_kpi']);
    mocks.rpc.mockResolvedValue({ error: { code: '23514', message: 'new row violates check constraint org_suplencias_facultades_check' } });
    try { await designarSuplencia({ rol: 'aseguramiento_calidad', titular: 'qa-ac', suplente: 'qa-op', inicio: '2026-10-24T12:00:00Z', fin: '2026-10-25T12:00:00Z', categoria: 'vacaciones', motivo: 'QA' }); throw new Error('Debió fallar'); } catch(e) {
      expect(errorSuplencia(e)).toBe('No se pudo guardar la suplencia. Revisa el rol, las facultades y las fechas.');
    }
  });
});