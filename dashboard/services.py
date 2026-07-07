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


def toggle_device_state(device, turn_on):
    command = command_for(device.key, turn_on)
    result = send_command(command)

    with transaction.atomic():
        if result["status"] != EventLog.ERROR:
            device.is_on = turn_on
            device.save(update_fields=["is_on", "updated_at"])

        EventLog.objects.create(
            device_key=device.key,
            action="encender" if turn_on else "apagar",
            command=command,
            status=result["status"],
            message=result["message"],
        )

        if device.key == "sensor_pir" and result["status"] != EventLog.ERROR:
            lights = DeviceState.objects.filter(kind=DeviceState.LIGHT)
            for light in lights:
                if light.is_on != turn_on:
                    light_command = command_for(light.key, turn_on)
                    light_result = send_command(light_command)
                    if light_result["status"] != EventLog.ERROR:
                        light.is_on = turn_on
                        light.save(update_fields=["is_on", "updated_at"])
                        EventLog.objects.create(
                            device_key=light.key,
                            action="encender" if turn_on else "apagar",
                            command=light_command,
                            status=light_result["status"],
                            message="Simulado por PIR" if result["status"] == EventLog.SIMULATED else "Activado por PIR",
                        )

    return {
        "device": device,
        "command": command,
        "status": result["status"],
        "message": result["message"],
    }

def sync_physical_state():
    from .constants import SYNC_ORDER
    result = send_command("SYNC")
    
    if result["status"] == "ok" and result["message"].startswith("SYNC:"):
        try:
            # Expected format: "SYNC:1,0,1,0,1,0,0,1,0"
            values = result["message"].split(":")[1].split(",")
            changed_devices = []
            
            with transaction.atomic():
                for idx, val in enumerate(values):
                    if idx < len(SYNC_ORDER):
                        device_key = SYNC_ORDER[idx]
                        is_on = (val.strip() == "1")
                        
                        device = DeviceState.objects.get(key=device_key)
                        if device.is_on != is_on:
                            device.is_on = is_on
                            device.save(update_fields=["is_on", "updated_at"])
                            changed_devices.append(device)
            
            return {"status": "ok", "message": "Sincronizado", "changed": len(changed_devices) > 0}
        except Exception as e:
            return {"status": "error", "message": f"Error parseando SYNC: {e}", "changed": False}
            
    return {"status": result["status"], "message": result["message"], "changed": False}
