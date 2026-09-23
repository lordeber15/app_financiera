# Proposal

## Why

El contador con cámara no da ninguna señal visual de éxito: el recuadro guía es siempre blanco (`border-white/80`), así que el usuario no sabe si el billete fue reconocido, confirmado o ya contado. Además, al confirmar un conteo el componente vuelve el detector de quietud a `idle` con el billete todavía en cuadro, por lo que la captura automática se dispara otra vez ~700 ms después y ofrece contar el mismo billete dos veces.

## What Changes

- El recuadro guía de la cámara pasa a **verde** cuando el usuario confirma una denominación y el billete queda sumado al conteo.
- El verde se mantiene mientras el billete siga dentro del recuadro y vuelve a blanco cuando el usuario lo retira (movimiento sostenido).
- El ciclo de captura pasa a ser **un billete presentado = una sola captura**: después de capturar (confirmar o descartar), no se vuelve a capturar hasta que se retire el objeto del recuadro. Esto elimina la doble captura del mismo billete y el bucle de "Descartar → recapturar en 700 ms".
- El reconocimiento sin confirmar (panel de sugerencia) mantiene el recuadro en blanco: no hay verde sin conteo confirmado.

No hay cambios de backend, de API ni del contrato de eventos: toda la lógica vive en los componentes de cámara del frontend.

## Capabilities

### New Capabilities

- `cash-count/camera-counter`: Ciclo de vida de captura de la cámara al contar efectivo (quietud → captura → confirmación/descarte → retira del objeto) y los estados visuales del recuadro guía que lo acompañan.

### Modified Capabilities

<!-- ninguna: openspec/specs/ está vacío -->

## Impact

- `frontend/src/components/CameraCapture.tsx` — máquina de estados de quietud y color del recuadro guía.
- `frontend/src/components/CashCameraCounter.tsx` — propaga la confirmación y limpia el estado pendiente al retirar el billete.
- `frontend/src/components/CashCalibration.tsx` — usuario compartido de `CameraCapture`; no debe cambiar su comportamiento de "una foto por apertura de cámara".
- Sin cambios en `backend/`, en los endpoints `/cash-calibration` ni en el contrato de payloads de n8n.
- Sin infraestructura de tests en el frontend (no hay runner de tests): verificación por `pnpm lint`, `pnpm build` y prueba manual en dispositivo con cámara.
