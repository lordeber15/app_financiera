# Design

## Context

`CameraCapture` mantiene una máquina de estados por ref (`idle → settling → lockout`) que corre dentro de un `useEffect` condicionado a `permission === 'granted' && autoCapture && !paused`. El recuadro guía es un `div` superpuesto con clase fija `border-white/80`, sin ninguna variación. La confirmación del reconocimiento ocurre fuera del componente, en `CashCameraCounter` (`pending`), que le pasa `paused={pending !== null}`.

Dos consecuencias de esa estructura:

1. No existe ningún dato que pueda teñir el recuadro: el componente no sabe si el usuario confirmó.
2. Cuando `paused` pasa a `true`, el efecto se re-ejecuta y reinicia `stillnessRef` a `idle` y `prevFrameRef` a `null`. Al confirmar (`paused → false`), el billete sigue quieto, así que en ~700 ms vuelve a `settling → lockout` y se captura otra vez. Lo mismo ocurre tras "Descartar": en ~700 ms se reabre el panel con el mismo billete.

Ver proposal.md — Why.

## Goals / Non-Goals

**Goals:**

- Que el recuadro guía sea un indicador de estado: neutro en reposo, verde tras un conteo confirmado, neutro al retirar el objeto.
- Un solo evento de captura por objeto presentado, para confirmar o para descartar.
- Mantener intacto el flujo de calibración, que comparte el mismo componente.

**Non-Goals:**

- Cambiar umbrales de quietud (`MOVEMENT_THRESHOLD`, `SETTLE_DURATION_MS`, `LOCKOUT_RELEASE_DURATION_MS`) o la heurística de reconocimiento (`extractFeatures` / `classify` / niveles de confianza).
- Cambios de backend, API o contrato de eventos hacia n8n.
- Añadir infraestructura de tests al frontend.
- Estados visuales adicionales del recuadro (ámbar durante `settling`, rojo al descartar).

## Decisions

### D1: El estado "confirmado" vive en el padre y se le pasa por prop

`CashCameraCounter` ya es dueño de `pending`; añade un estado `confirmed` que se pone en `true` justo cuando `handleConfirm` suma la línea, y se limpia cuando `CameraCapture` avisa de la retirada. `CameraCapture` solo renderiza el color según una prop (`confirmed?: boolean`, por defecto `false`).

- *Alternativa descartada:* mover la confirmación dentro de `CameraCapture` (el padre le pasaría el resultado para que él mismo dibuje el panel). Acoplaría el componente genérico al dominio de denominaciones y rompería su uso en calibración.
- *Alternativa descartada:* que `CashCameraCounter` pinte un `div` propio sobre el video. Duplicaría el posicionamiento porcentual del recuadro y permitiría que se desincronice del recuadro real.

### D2: La máquina de estados gana un estado de "retención" que sobrevive a la pausa

Se separa "el bucle de medición de movimiento" de "puedo capturar":

```
  permiso concedido y componente montado
  (SIEMPRE corre, sea cual sea `autoCapture`)
                 |
                 v
  +----------------------------------------------+
  |  idle (blanco)                               |
  |    | quietud >= 700ms y autoCapture          |
  |    v                                          |
  |  settling (blanco)                            |
  |    | quietud sostenida          | movimiento  |
  |    v                            |            |
  |  hold (blanco o VERDE) ---------+            |
  |    | onCapture() una vez        |            |
  |    |                            |            |
  |    | padres: panel abierto      |            |
  |    | padre confirma --> confirmed=true (VERDE)
  |    | movimiento sostenido 400ms |            |
  +----+----------------------------------------+
       |
       +--> onCleared() y vuelta a idle (blanco)
```

`hold` reemplaza al `lockout` actual como estado post-captura y ahora **se mantiene** mientras `paused` sea verdadero (hoy se reinicia a `idle`, que es la raíz del bug). La salida es única: movimiento sostenido en el recuadro → `onCleared()` → `idle`.

- *Alternativa descartada:* mantener `paused` reiniciando a `idle` y, para el verde, usar un `setTimeout` de 1 s. No apagaría el verde "hasta retirar el billete" y tampoco arreglaría la doble captura.
- *Alternativa descartada:* exigir movimiento solo para el caso verde y dejar el descarte en `idle`. Mantendría el bucle "Descartar → recapturar en 700 ms".

### D3: El bucle de movimiento corre aunque `autoCapture` esté desactivado

Hoy el `useEffect` no arranca si `autoCapture` es falso. Si el verde depende de detectar la retirada, desactivar la casilla "Captura automática" dejaría el recuadro verde para siempre. El bucle pasa a depender solo de `permission === 'granted'` (el cómputo es un `drawImage` de 48x36 px cada 120 ms, despreciable); `autoCapture` solo decide si `settling` avanza a la captura. La captura manual sigue funcionando en ambos casos y entra en `hold` como cualquier otra.

### D4: La retirada limpia el pendiente en el padre

`CameraCapture` emite `onCleared()` al salir de `hold`. `CashCameraCounter` lo usa para poner `pending = null` y `confirmed = false`. Así el panel de sugerencia no queda huérfano si el usuario retira el billete sin responder, y la propiedad `paused` deja de ser necesaria: el estado de retención interno la reemplaza.

- *Alternativa descartada:* que el padre consulte la quietud por polling. Duplicaría la medición de difusión de frames y crearía dos fuentes de verdad.

### D5: Calibración queda sin cambios de API

`CashCalibration` llama a `CameraCapture` con `autoCapture={false}` y cierra el componente apenas llega `onCapture`, por lo que nunca entra en `hold` de forma visible y nunca recibe `confirmed`. No se le pasa `onCleared` (es opcional).

## Risks / Trade-offs

- **[Movimiento durante el panel de sugerencia descarta la sugerencia]** → La medición corre mientras `pending` está abierto; un movimiento sostenido en el recuadro emite `onCleared` y cierra el panel. Se mitiga solo: al volver a la quietud se captura y se reabre el panel. Coste aceptable frente a dejar el estado inconsistente.
- **[Verde pegado si nunca hay movimiento detectable]** → Con D3 el bucle corre siempre con permiso concedido; solo queda sin liberar si la escena es estática en los 48x36 px muestreados, caso que hoy ya dejaría el sistema en `lockout` permanente. Mitigación operativa: la transición a blanco también puede dispararse al desmontar/cerrar el modo Cámara.
- **[Retroalimentación solo por color]** → Daltónicos o en pantalla pequeña podrían no distinguir verde de blanco. Ver Open Questions.
- **[Dos consumidores del mismo componente]** → Cualquier cambio de props debe conservar la firma mínima (`autoCapture`, `onCapture`) para no romper calibración; verificar con `pnpm build` (TypeScript hará visible cualquier desajuste).
- **[Falsos positivos de quietud]** → Umbral de 8 de diferencia media entre frames puede declarar quietud con poca luz. No se toca en este cambio; queda fuera de alcance explícito.

## Migration Plan

Cambio puramente visual/estado en frontend, sin datos ni endpoints: despliegue normal con `pnpm build` + imagen Docker. Rollback = revertir el commit; no hay migración de esquema ni de almacenamiento.

## Open Questions

- Convenir un indicador no-color (marca de check o texto junto al recuadro, `aria-live`) para accesibilidad. Se puede añadir después sin tocar los requisitos de estado del recuadro ni la máquina de estados.
