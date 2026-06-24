import json
import urllib.request
from datetime import datetime, timedelta

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
from .serial_bridge import check_connection


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


@require_POST
def update_temperature(request):
    ensure_default_devices()
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
        temperature = float(payload.get("temperature", 0))
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Temperatura invalida"}, status=400)

    try:
        fan = DeviceState.objects.get(key="ventilador")
    except DeviceState.DoesNotExist:
        return JsonResponse({"error": "Ventilador no encontrado"}, status=404)

    # Lógica: si temp >= 26, encender ventilador. Si < 26, apagar.
    turn_on = temperature >= 26
    if fan.is_on != turn_on:
        result = toggle_device_state(fan, turn_on)
        return JsonResponse({
            "message": f"Temperatura actual: {temperature}°C. Ventilador {'encendido' if turn_on else 'apagado'}.",
            "device": serialize_device(fan),
            "temperature": temperature
        })
    else:
        return JsonResponse({
            "message": f"Temperatura actual: {temperature}°C. Estado del ventilador sin cambios.",
            "device": serialize_device(fan),
            "temperature": temperature
        })


@require_GET
def sync_weather(request):
    ensure_default_devices()
    try:
        # Guayaquil, Ecuador coordinates
        url = "https://api.open-meteo.com/v1/forecast?latitude=-2.1962&longitude=-79.8862&current_weather=true"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            current_temp = data.get("current_weather", {}).get("temperature", 20.0)
    except Exception as e:
        return JsonResponse({"error": f"No se pudo obtener el clima: {e}"}, status=500)

    # Ecuador time is UTC-5
    ecuador_time = datetime.utcnow() - timedelta(hours=5)
    hour = ecuador_time.hour

    # Day is 6:00 to 17:59, Night is 18:00 to 5:59
    is_night = hour >= 18 or hour < 6
    
    # Update PIR Sensor based on day/night
    try:
        pir = DeviceState.objects.get(key="sensor_pir")
        if pir.is_on != is_night:
            toggle_device_state(pir, is_night)
    except DeviceState.DoesNotExist:
        pass
        
    # Update Fan based on temperature (>= 26°C -> ON)
    try:
        fan = DeviceState.objects.get(key="ventilador")
        turn_fan_on = current_temp >= 26
        if fan.is_on != turn_fan_on:
            toggle_device_state(fan, turn_fan_on)
    except DeviceState.DoesNotExist:
        pass

    return JsonResponse({
        "message": f"Clima sincronizado. Hora local: {ecuador_time.strftime('%H:%M')}, Temperatura: {current_temp}°C",
        "is_night": is_night,
        "temperature": current_temp
    })


@require_GET
def system_status(request):
    status = check_connection()
    return JsonResponse(status)
