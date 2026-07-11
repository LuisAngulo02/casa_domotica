from django.db import transaction

from .constants import DEFAULT_DEVICES
from .models import DeviceState, EventLog
from .serial_bridge import command_for, send_command


def ensure_default_devices():
    for key, label, kind in DEFAULT_DEVICES:
        DeviceState.objects.get_or_create(
            key=key,
            defaults={"label": label, "kind": kind, "is_on": False},
        )


def serialize_device(device):
    return {
        "key": device.key,
        "label": device.label,
        "kind": device.kind,
        "is_on": device.is_on,
        "updated_at": device.updated_at.isoformat(),
    }


def serialize_event(event):
    return {
        "created_at": event.created_at.strftime("%H:%M:%S"),
        "device_key": event.device_key,
        "action": event.action,
        "command": event.command,
        "status": event.status,
        "message": event.message,
    }


def toggle_device_state(device, turn_on, speed=None):
    # Regla de seguridad: no se puede abrir la puerta si la cerradura está bloqueada (is_on == True)
    if device.key == "puerta" and turn_on:
        try:
            lock = DeviceState.objects.get(key="cerradura")
            if lock.is_on:
                return {
                    "device": device,
                    "command": "",
                    "status": EventLog.ERROR,
                    "message": "No se puede abrir la puerta: la cerradura está cerrada/bloqueada.",
                }
        except DeviceState.DoesNotExist:
            pass

    # Regla de seguridad: no se puede cambiar el estado de la cerradura si la puerta está abierta (is_on == True)
    if device.key == "cerradura":
        try:
            door = DeviceState.objects.get(key="puerta")
            if door.is_on:
                return {
                    "device": device,
                    "command": "",
                    "status": EventLog.ERROR,
                    "message": "No se puede cambiar el estado de la cerradura si la puerta está abierta.",
                }
        except DeviceState.DoesNotExist:
            pass

    if device.key == "ventilador":
        command = "FAN_ON" if turn_on else "FAN_OFF"
        speed = 3 if turn_on else 0
    else:
        command = command_for(device.key, turn_on)
        speed = None
        
    result = send_command(command)

    with transaction.atomic():
        if result["status"] != EventLog.ERROR:
            device.is_on = turn_on
            if device.key == "ventilador" and hasattr(device, "speed"):
                device.speed = speed
                try:
                    device.save(update_fields=["is_on", "speed", "updated_at"])
                except Exception:
                    # Resiliencia si el usuario no ha corrido las migraciones todavía
                    device.save(update_fields=["is_on", "updated_at"])
            else:
                device.save(update_fields=["is_on", "updated_at"])

        # Generar un mensaje amigable en lenguaje natural en español
        if device.kind == DeviceState.DOOR:
            action_name = "abierta" if turn_on else "cerrada"
            subject = device.label
        elif device.kind == DeviceState.LOCK:
            action_name = "bloqueada (seguro echado)" if turn_on else "desbloqueada (libre)"
            subject = device.label
        elif device.kind == DeviceState.LIGHT:
            action_name = "encendida" if turn_on else "apagada"
            if not device.label.lower().startswith("luz"):
                subject = f"Luz {device.label}"
            else:
                subject = device.label
        else: # ventilador, sensor, etc.
            action_name = "activado" if turn_on else "desactivado"
            if device.key == "ventilador":
                action_name = "encendido" if turn_on else "apagado"
            subject = device.label
                
        friendly_msg = f"{subject} {action_name}."
        if result["status"] == EventLog.ERROR:
            friendly_msg = f"Error: {result['message']}"

        EventLog.objects.create(
            device_key=device.key,
            action="encender" if turn_on else "apagar",
            command=command,
            status=result["status"],
            message=friendly_msg,
        )

        # Regla del Sensor PIR: activa únicamente la luz del jardín (exterior) al detectar presencia
        if device.key == "sensor_pir" and result["status"] != EventLog.ERROR:
            try:
                ext_light = DeviceState.objects.get(key="luz_jardin")
                if ext_light.is_on != turn_on:
                    light_command = command_for(ext_light.key, turn_on)
                    light_result = send_command(light_command)
                    if light_result["status"] != EventLog.ERROR:
                        ext_light.is_on = turn_on
                        ext_light.save(update_fields=["is_on", "updated_at"])
                        EventLog.objects.create(
                            device_key=ext_light.key,
                            action="encender" if turn_on else "apagar",
                            command=light_command,
                            status=light_result["status"],
                            message="Activado por presencia (PIR)" if turn_on else "Apagado por fin de presencia (PIR)",
                        )
            except DeviceState.DoesNotExist:
                pass

    return {
        "device": device,
        "command": command,
        "status": result["status"],
        "message": friendly_msg,
    }

def sync_physical_state():
    from .constants import SYNC_ORDER
    from django.core.cache import cache
    result = send_command("SYNC")
    
    if result["status"] == "ok" and result["message"].startswith("SYNC:"):
        try:
            # Expected format: "SYNC:1,0,1,0,1,0,0,1,0,0,0,24.5"
            parts = result["message"].split(":")[1].split(",")
            changed_devices = []
            physical_changed = False
            
            with transaction.atomic():
                for idx, val in enumerate(parts):
                    if idx < len(SYNC_ORDER):
                        device_key = SYNC_ORDER[idx]
                        device = DeviceState.objects.get(key=device_key)
                        
                        if device.key == "modo_ventilador":
                            is_on = (val.strip() == "0") # 0 = Auto (is_on = True), 1 = Manual (is_on = False)
                            if device.is_on != is_on:
                                device.is_on = is_on
                                device.save(update_fields=["is_on", "updated_at"])
                                changed_devices.append(device)
                        elif device.key == "ventilador":
                            try:
                                speed_val = int(val.strip())
                            except ValueError:
                                speed_val = 0
                            is_on = (speed_val > 0)
                            
                            speed_changed = False
                            if hasattr(device, "speed") and device.speed != speed_val:
                                device.speed = speed_val
                                speed_changed = True
                            
                            if device.is_on != is_on or speed_changed:
                                device.is_on = is_on
                                if hasattr(device, "speed"):
                                    try:
                                        device.save(update_fields=["is_on", "speed", "updated_at"])
                                    except Exception:
                                        device.save(update_fields=["is_on", "updated_at"])
                                else:
                                    device.save(update_fields=["is_on", "updated_at"])
                                changed_devices.append(device)
                        elif device.key == "cerradura":
                            is_on = (val.strip() == "0") # 0 = locked (is_on = True), 1 = unlocked (is_on = False)
                            if device.is_on != is_on:
                                device.is_on = is_on
                                device.save(update_fields=["is_on", "updated_at"])
                                changed_devices.append(device)
                        else:
                            is_on = (val.strip() == "1")
                            if device.is_on != is_on:
                                device.is_on = is_on
                                device.save(update_fields=["is_on", "updated_at"])
                                changed_devices.append(device)
            
            # Sincronizar LDR (posición 11) y Temperatura (posición 12) si están presentes
            if len(parts) >= 13:
                try:
                    # ldrVal == 1 significa que HAY luz (ver Arduino: HIGH = luz).
                    # Por lo tanto es_de_noche (is_night) es lo contrario: ldrVal == 0.
                    is_night_val = (parts[11].strip() == "0")
                    temp_val = float(parts[12].strip())

                    previous_is_night = cache.get("arduino_is_night")
                    previous_temp = cache.get("arduino_temperature")

                    if previous_is_night is None or previous_is_night != is_night_val:
                        physical_changed = True

                    if previous_temp is None or round(float(previous_temp), 1) != round(temp_val, 1):
                        physical_changed = True
                    
                    # Almacenar en cache con expiración corta de 60 segundos
                    cache.set("arduino_temperature", temp_val, 60)
                    cache.set("arduino_is_night", is_night_val, 60)
                except (ValueError, IndexError):
                    pass
            
            return {"status": "ok", "message": "Sincronizado", "changed": len(changed_devices) > 0 or physical_changed}
        except Exception as e:
            return {"status": "error", "message": f"Error parseando SYNC: {e}", "changed": False}
            
    return {"status": result["status"], "message": result["message"], "changed": False}