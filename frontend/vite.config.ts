import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // El modo 'mobile' (npm run dev:mobile) sirve por HTTPS con un certificado
  // autofirmado: getUserMedia (cámara) exige un contexto seguro y solo
  // localhost queda exento, así que probar desde el celular en la red local
  // requiere TLS aunque sea autofirmado.
  plugins: [react(), ...(mode === 'mobile' ? [basicSsl()] : [])],
  server: {
    // true (en vez de una IP fija) expone en todas las interfaces de red y
    // evita tener que actualizar esto cada vez que cambie la IP por DHCP.
    host: true,
    proxy: {
      // El frontend llama a /api/*; en dev lo reenviamos al backend FastAPI
      // (mismo origen para el navegador, así la cookie de sesión funciona sin
      // configurar CORS con credenciales entre puertos distintos).
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
}))
