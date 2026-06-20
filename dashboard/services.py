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

    return {
        "device": device,
        "command": command,
        "status": result["status"],
        "message": result["message"],
    }
