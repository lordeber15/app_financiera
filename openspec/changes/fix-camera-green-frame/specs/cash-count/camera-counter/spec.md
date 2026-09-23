# Spec Delta

## Purpose

Define el ciclo de vida de la captura de cámara al contar efectivo —cuántas veces se captura un mismo billete presentado y cuándo se libera la captura— y los estados visuales del recuadro guía que hacen visible ese ciclo al usuario.

## ADDED Requirements

### Requirement: El recuadro guía refleja el estado del conteo

El recuadro guía superpuesto al video SHALL estar en color neutro (blanco) por defecto, SHALL pasar a verde cuando el usuario confirma una denominación del reconocimiento pendiente y el billete queda sumado al conteo, SHALL mantenerse verde mientras el objeto siga quieto dentro del recuadro, y SHALL volver a color neutro cuando el objeto se retira del recuadro.

No SHALL haber verde sin un conteo confirmado: mientras el panel de sugerencia está abierto y el usuario aún no confirma, el recuadro permanece neutro.

#### Scenario: Confirmar el conteo enciende el verde

- **WHEN** el usuario toca una denominación en el panel de sugerencia y el billete se suma al conteo
- **THEN** el recuadro guía pasa a verde

#### Scenario: El verde se mantiene con el billete quieto

- **WHEN** el conteo ya fue confirmado y el billete sigue quieto dentro del recuadro
- **THEN** el recuadro guía sigue en verde y no se ofrece volver a contar el mismo billete

#### Scenario: Retirar el billete apaga el verde

- **WHEN** el billete confirmado se retira del recuadro (movimiento sostenido dentro de él)
- **THEN** el recuadro guía vuelve al color neutro y la cámara queda lista para el siguiente billete

#### Scenario: Reconocimiento sin confirmar mantiene el color neutro

- **WHEN** la cámara captura un billete y muestra el panel de sugerencia con la denominación reconocida
- **THEN** el recuadro guía permanece en color neutro hasta que el usuario confirme

#### Scenario: Descartar no enciende el verde

- **WHEN** el usuario pulsa "Descartar (no era ningún billete/moneda)"
- **THEN** el recuadro guía permanece en color neutro y el conteo no se modifica

### Requirement: Una sola captura por billete presentado

Tras una captura —automática o manual, confirmada o descartada— el sistema SHALL bloquear nuevas capturas hasta que se retire el objeto del recuadro guía, ya sea mediante la captura automática al detectar quietud o mediante el botón de captura manual. Tras detectar la retirada, SHALL quedar rearmado para capturar el siguiente billete.

#### Scenario: Confirmar no provoca una segunda captura

- **WHEN** el usuario confirma un billete y este sigue quieto en el recuadro sin retirarlo
- **THEN** no se dispara una nueva captura automática ni se vuelve a abrir el panel de sugerencia para ese mismo billete

#### Scenario: Descartar no entra en bucle de recaptura

- **WHEN** el usuario descarta una sugerencia con el objeto todavía quieto en el recuadro
- **THEN** no se vuelve a capturar automáticamente hasta que el objeto se retire

#### Scenario: La captura manual queda bajo el mismo bloqueo

- **WHEN** el usuario pulsa el botón de captura manual con la captura automática activada o desactivada
- **THEN** la captura se realiza una sola vez y no se repite hasta retirar el objeto

#### Scenario: Retirar y volver a presentar un billete rearma la captura

- **WHEN** el usuario retira el objeto del recuadro y después presenta otro billete que queda quieto
- **THEN** se dispara una nueva captura automática y se evalúa el reconocimiento

### Requirement: El flujo de calibración no cambia

La pestaña de calibración que reutiliza el mismo componente de cámara con captura automática desactivada SHALL seguir permitiendo tomar una foto de referencia por apertura de cámara, sin verse afectada por el bloqueo de recaptura ni por el estado verde.

#### Scenario: Tomar foto de calibración sigue guardando la muestra

- **WHEN** el usuario abre la cámara de una denominación en Calibración y pulsa capturar
- **THEN** se extraen las características, se guarda la muestra de calibración y se cierra esa cámara

#### Scenario: Reabrir la cámara para otra foto de la misma denominación

- **WHEN** el usuario vuelve a pulsar "Tomar foto" para la misma denominación después de cerrarla
- **THEN** la cámara se abre en su estado inicial (recuadro neutro, sin capturas previas) y permite capturar
