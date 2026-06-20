# Casa Domotica Inteligente

Aplicacion web para controlar una maqueta de casa domotica con Arduino UNO, Django y pyserial.

La explicacion completa de arquitectura y funcionamiento esta en `DOCUMENTACION.md`.

## Que incluye

- Dashboard con plano interactivo de la casa.
- Zonas clicables para luces internas, luz exterior, puerta y cerradura.
- API Django para alternar dispositivos.
- Historial de comandos enviados.
- Capa serial preparada para Arduino por USB.
- Modo simulacion para trabajar sin el hardware conectado.

## Como ejecutarlo

1. Instala Python 3.
2. Instala dependencias:

```powershell
python -m pip install -r requirements.txt
```

3. Crea la base de datos:

```powershell
python manage.py migrate
```

4. Inicia el servidor:

```powershell
python manage.py runserver
```

5. Abre:

```text
http://127.0.0.1:8000/
```

## Conexion con Arduino

Mientras no tengas el Arduino conectado, deja `ARDUINO_SIMULATION_MODE = True` en `domotica_project/settings.py`.

Cuando lo conectes:

1. Cambia el puerto si hace falta con `ARDUINO_SERIAL_PORT`, por ejemplo `COM4`.
2. Cambia `ARDUINO_SIMULATION_MODE` a `False`.
3. Asegurate de que el Arduino lea comandos terminados en salto de linea.

Comandos que envia la app:

- `L1_ON`, `L1_OFF`
- `L2_ON`, `L2_OFF`
- `L3_ON`, `L3_OFF`
- `L4_ON`, `L4_OFF`
- `EXT_ON`, `EXT_OFF`
- `DOOR_OPEN`, `DOOR_CLOSE`
- `LOCK_ON`, `LOCK_OFF`
