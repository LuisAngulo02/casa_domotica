import json

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .models import DeviceState, EventLog
from .services import (
    ensure_default_devices,
    serialize_device,
    serialize_event,
    toggle_device_state,
)


@ensure_csrf_cookie
def home(request):
    ensure_default_devices()
    return render(request, "dashboard/home.html")


@require_GET
def device_list(request):
    ensure_default_devices()
    devices = DeviceState.objects.all()
    return JsonResponse({"devices": [serialize_device(device) for device in devices]})


@require_GET
def history(request):
    events = EventLog.objects.all()[:12]
    return JsonResponse({"events": [serialize_event(event) for event in events]})


@require_POST
def toggle_device(request, device_key):
    ensure_default_devices()
    try:
        device = DeviceState.objects.get(key=device_key)
    except DeviceState.DoesNotExist:
        return JsonResponse({"error": "Dispositivo no encontrado"}, status=404)

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Solicitud invalida"}, status=400)

    if "is_on" in payload and not isinstance(payload["is_on"], bool):
        return JsonResponse({"error": "El campo is_on debe ser verdadero o falso"}, status=400)

    turn_on = bool(payload.get("is_on", not device.is_on))
    result = toggle_device_state(device, turn_on)

    status_code = 200 if result["status"] != EventLog.ERROR else 503
    return JsonResponse(
        {
            "device": serialize_device(result["device"]),
            "command": result["command"],
            "status": result["status"],
            "message": result["message"],
        },
        status=status_code,
    )
