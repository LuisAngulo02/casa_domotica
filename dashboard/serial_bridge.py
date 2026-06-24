from django.conf import settings

from .constants import DEVICE_COMMANDS

SERIAL_TIMEOUT_SECONDS = 2


def command_for(device_key, turn_on):
    action = "on" if turn_on else "off"
    return DEVICE_COMMANDS[device_key][action]


import threading
import time

_arduino_serial = None
_serial_lock = threading.Lock()

def _get_serial_connection():
    global _arduino_serial
    if _arduino_serial is not None and _arduino_serial.is_open:
        return _arduino_serial

    import serial
    _arduino_serial = serial.Serial(
        settings.ARDUINO_SERIAL_PORT,
        settings.ARDUINO_BAUD_RATE,
        timeout=SERIAL_TIMEOUT_SECONDS,
    )
    # Esperar 2 segundos para que el Arduino inicie después del auto-reset
    time.sleep(2)
    return _arduino_serial

def send_command(command):
    if settings.ARDUINO_SIMULATION_MODE:
        return {
            "status": "simulado",
            "message": f"Comando preparado para Arduino: {command}",
        }

    try:
        import serial
    except ImportError:
        return {
            "status": "error",
            "message": "pyserial no esta instalado. Ejecuta: python -m pip install pyserial",
        }

    try:
        with _serial_lock:
            arduino = _get_serial_connection()
            arduino.write(f"{command}\n".encode("utf-8"))
            arduino.flush()
            response = arduino.readline().decode("utf-8", errors="ignore").strip()
            return {"status": "ok", "message": response or "Comando enviado correctamente"}
    except Exception as exc:
        global _arduino_serial
        if _arduino_serial:
            _arduino_serial.close()
            _arduino_serial = None
        return {"status": "error", "message": f"Error de comunicación: {exc}"}

def check_connection():
    if settings.ARDUINO_SIMULATION_MODE:
        return {"connected": True, "message": "Modo simulación activado"}

    try:
        import serial
    except ImportError:
        return {"connected": False, "message": "pyserial no está instalado"}

    try:
        with _serial_lock:
            arduino = _get_serial_connection()
            # Test connection status (if it didn't throw an error, it's open)
            return {"connected": True, "message": f"Conectado en {settings.ARDUINO_SERIAL_PORT}"}
    except Exception as exc:
        global _arduino_serial
        if _arduino_serial:
            _arduino_serial.close()
            _arduino_serial = None
        return {"connected": False, "message": "Arduino desconectado"}
