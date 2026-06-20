from django.conf import settings

from .constants import DEVICE_COMMANDS

SERIAL_TIMEOUT_SECONDS = 2


def command_for(device_key, turn_on):
    action = "on" if turn_on else "off"
    return DEVICE_COMMANDS[device_key][action]


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
        with serial.Serial(
            settings.ARDUINO_SERIAL_PORT,
            settings.ARDUINO_BAUD_RATE,
            timeout=SERIAL_TIMEOUT_SECONDS,
        ) as arduino:
            arduino.write(f"{command}\n".encode("utf-8"))
            response = arduino.readline().decode("utf-8", errors="ignore").strip()
    except serial.SerialException as exc:
        return {"status": "error", "message": f"No se pudo abrir el puerto serial: {exc}"}

    return {"status": "ok", "message": response or "Comando enviado correctamente"}
