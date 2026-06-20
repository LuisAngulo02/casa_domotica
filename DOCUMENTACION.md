# Documentacion del Proyecto

## Objetivo

La aplicacion permite controlar una maqueta de casa domotica desde una pagina web local. El usuario interactua con un plano de la vivienda y cada clic envia una orden al backend Django. El backend registra el evento y prepara el comando que se envia al Arduino por puerto serial usando pyserial.

## Componentes principales

- Frontend: HTML, CSS y JavaScript en `templates/` y `static/`.
- Backend: Django en `domotica_project/` y `dashboard/`.
- Base de datos: SQLite para guardar estados e historial.
- Comunicacion con Arduino: modulo `dashboard/serial_bridge.py`.
- Hardware: Arduino UNO conectado por USB al computador.

## Flujo de funcionamiento

1. El usuario abre `http://127.0.0.1:8000/`.
2. Django carga el dashboard y crea los dispositivos iniciales si todavia no existen.
3. El navegador pide los estados actuales a `/api/devices/`.
4. El usuario hace clic en una zona del plano o en un control manual.
5. JavaScript envia una solicitud a `/api/devices/<dispositivo>/toggle/`.
6. Django valida la solicitud y busca el dispositivo en la base de datos.
7. El servicio de control decide si debe encender o apagar el dispositivo.
8. El puente serial genera el comando correspondiente, por ejemplo `L3_ON`.
9. Si el modo simulacion esta activo, solo registra el comando. Si esta desactivado, lo envia al Arduino por USB.
10. Django guarda el evento en el historial y responde al navegador.
11. JavaScript actualiza el plano, el panel lateral y el historial.

## Estructura del codigo

- `dashboard/models.py`: define los modelos `DeviceState` y `EventLog`.
- `dashboard/constants.py`: contiene los dispositivos iniciales y comandos seriales.
- `dashboard/services.py`: concentra la logica de negocio del dashboard.
- `dashboard/serial_bridge.py`: maneja la comunicacion con Arduino o el modo simulacion.
- `dashboard/views.py`: expone las paginas y endpoints JSON.
- `dashboard/urls.py`: declara las rutas del dashboard.
- `templates/dashboard/home.html`: estructura visual principal.
- `static/dashboard/styles.css`: estilos del dashboard y plano.
- `static/dashboard/app.js`: interactividad del navegador.
- `domotica_project/settings.py`: configuracion general del proyecto.

## Dispositivos configurados

| Dispositivo | Tipo | Comandos |
| --- | --- | --- |
| Habitacion 1 | Luz | `L1_ON`, `L1_OFF` |
| Habitacion 2 | Luz | `L2_ON`, `L2_OFF` |
| Sala | Luz | `L3_ON`, `L3_OFF` |
| Cocina | Luz | `L4_ON`, `L4_OFF` |
| Jardin | Luz exterior | `EXT_ON`, `EXT_OFF` |
| Puerta principal | Servo | `DOOR_OPEN`, `DOOR_CLOSE` |
| Cerradura | Rele/solenoide | `LOCK_ON`, `LOCK_OFF` |

## Buenas practicas aplicadas

- Separacion de responsabilidades: las vistas no contienen toda la logica.
- Constantes centralizadas: dispositivos y comandos estan en un solo archivo.
- Validacion de entrada: el endpoint revisa que `is_on` sea verdadero o falso.
- Persistencia: los estados y eventos se guardan en base de datos.
- Transacciones: el cambio de estado y el registro del evento se manejan juntos.
- Configuracion por variables de entorno: puerto serial, baud rate, modo simulacion y opciones de Django se pueden cambiar sin tocar codigo.
- Modo simulacion: permite probar la web sin depender del Arduino conectado.
- Historial de eventos: facilita demostrar que la app envia comandos y registra acciones.

## Variables de configuracion

La aplicacion tiene valores por defecto, pero se pueden cambiar con variables de entorno:

| Variable | Uso | Valor por defecto |
| --- | --- | --- |
| `DJANGO_DEBUG` | Activa modo desarrollo | `true` |
| `DJANGO_ALLOWED_HOSTS` | Hosts permitidos | `127.0.0.1,localhost` |
| `ARDUINO_SERIAL_PORT` | Puerto USB del Arduino | `COM3` |
| `ARDUINO_BAUD_RATE` | Velocidad serial | `9600` |
| `ARDUINO_SIMULATION_MODE` | Simula o envia al Arduino | `true` |

## Como probar sin Arduino

Con `ARDUINO_SIMULATION_MODE=true`, cada clic genera un evento simulado. Esto sirve para presentar el funcionamiento web aunque el hardware aun no este listo.

## Como activar Arduino real

1. Conecta el Arduino por USB.
2. Identifica el puerto, por ejemplo `COM3` o `COM4`.
3. Configura `ARDUINO_SERIAL_PORT` con ese puerto.
4. Configura `ARDUINO_SIMULATION_MODE=false`.
5. Asegurate de que el codigo C++ del Arduino lea comandos terminados en salto de linea.

## Recomendacion para el codigo Arduino

El Arduino debe leer el puerto serial y comparar comandos como `L1_ON`, `L1_OFF` o `DOOR_OPEN`. Cada comando debe activar o desactivar el pin correspondiente. Tambien conviene responder por serial con un texto corto, por ejemplo `OK`, para que Django pueda mostrar una confirmacion.
