import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // 1. Obtener la sesión almacenada en 'finanzas_ia_auth'
  const raw = localStorage.getItem('finanzas_ia_auth');

  if (!raw) {
    return next(req);
  }

  try {
    // 2. Parsear el JSON para extraer el token real
    const session = JSON.parse(raw) as { token?: string } | null;

    if (!session?.token) {
      return next(req);
    }

    // 3. Clonar la petición e inyectar únicamente el JWT string
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${session.token}`
      }
    });

    return next(authReq);
  } catch (error) {
    console.error('Error al parsear la sesión en el interceptor:', error);
    return next(req);
  }
};