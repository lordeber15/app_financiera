# Tasks

## 1. Estado de retención en CameraCapture

- [x] 1.1 Reemplazar el reinicio a `idle` de la condición `paused` por un estado de retención que sobreviva a la re-ejecución del efecto, de modo que tras una captura no se vuelva a capturar hasta detectar movimiento sostenido (verifica: leyendo el flujo del efecto, `stillnessRef` permanece en el estado de retención mientras `paused`/`pending` sea verdadero, y solo sale con movimiento sostenido de 400 ms)
- [x] 1.2 Separar el bucle de medición de movimiento de la habilitación de captura: el `useEffect` arranca solo con `permission === 'granted'` (sin exigir `autoCapture`) y `autoCapture` decide únicamente si `settling` avanza a la captura (verifica: con la casilla "Captura automática" desactivada el bucle sigue corriendo y el botón manual no produce capturas repetidas)
- [x] 1.3 Emitir un callback `onCleared?: () => void` al salir del estado de retención por movimiento sostenido (verifica: `pnpm build` compila y el callback solo se invoca en esa transición)

## 2. Recuadro verde al confirmar

- [x] 2.1 Añadir la prop `confirmed?: boolean` (por defecto `false`) a `CameraCapture` y pintar el recuadro guía con borde verde cuando sea verdadero y color neutro cuando sea falso, conservando el posicionamiento porcentual actual (verifica: `pnpm build` y que la clase del recuadro cambie solo según esa prop)
- [x] 2.2 En `CashCameraCounter`, añadir el estado `confirmed`, ponerlo en `true` en `handleConfirm` cuando se suma la línea, y limpiarlo junto con `pending` en el nuevo manejador de `onCleared` (verifica: al confirmar el recuadro pasa a verde y al retirar el billete vuelve a blanco cerrando también el panel si quedara abierto)
- [x] 2.3 Dejar de pasar `paused={pending !== null}` a `CameraCapture` y eliminar esa prop si ya no tiene consumidores, comprobando que el panel de sugerencia sigue abriéndose una sola vez por billete (verifica: `pnpm build` sin errores de tipo y comportamiento manual: una captura = un panel)

## 3. Verificación y regresión

- [x] 3.1 Ejecutar `pnpm lint` y `pnpm build` en `frontend/` sin errores (verifica: ambos comandos terminan en código 0)
- [ ] 3.2 Probar en dispositivo con cámara: presentar billete → sugerencia con recuadro en color neutro → confirmar → recuadro verde → retirar billete → recuadro en color neutro y listo para el siguiente billete (verifica: ningún paso vuelve a ofrecer contar el mismo billete)
- [ ] 3.3 Probar el descarte: sugerencia abierta → pulsar "Descartar" → sin nueva captura hasta retirar el objeto, y recuadro sin verde (verifica: observación manual, el panel no se reabre mientras el billete siga quieto)
- [ ] 3.4 Probar la pestaña Calibración: tomar foto de una denominación, guardarla y reabrirla para otra foto; verificar que sigue guardando muestras y que el recuadro nunca se pone verde (verifica: la muestra aparece en el listado `n/5 fotos` y no hay regresión en `GET /cash-calibration/samples`)
