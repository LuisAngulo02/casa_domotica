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
    sync_physical_state,
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

    speed = payload.get("speed")  # Puede ser 0, 1, 2, 3 o None
    turn_on = bool(payload.get("is_on", not device.is_on))
    result = toggle_device_state(device, turn_on, speed=speed)

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
    from django.conf import settings
    from django.core.cache import cache
    
    is_night = False
    current_temp = 20.0
    source_info = "API Clima"
    
    if not settings.ARDUINO_SIMULATION_MODE:
        # Modo Real: Leer del cache poblado por la sincronización física del Arduino
        current_temp = cache.get("arduino_temperature")
        is_night = cache.get("arduino_is_night")
        
        if current_temp is None or is_night is None:
            # Forzar una lectura física inmediata para poblar el cache
            sync_physical_state()
            current_temp = cache.get("arduino_temperature", 22.0)
            is_night = cache.get("arduino_is_night", False)
            
        source_info = "Sensores Físicos Arduino"
    else:
        # Modo Simulación: Consultar API meteorológico
        try:
            # Guayaquil, Ecuador coordinates
            url = "https://api.open-meteo.com/v1/forecast?latitude=-2.1962&longitude=-79.8862&current_weather=true"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                current_temp = data.get("current_weather", {}).get("temperature", 20.0)
        except Exception:
            current_temp = 20.0 # Fallback seguro
            
        # Ecuador time is UTC-5
        ecuador_time = datetime.utcnow() - timedelta(hours=5)
        hour = ecuador_time.hour
        # Day is 6:00 to 17:59, Night is 18:00 to 5:59
        is_night = hour >= 18 or hour < 6
        

        
    # Update Fan based on temperature (>= 31°C -> ON, <= 26°C -> OFF) only if in Auto mode
    try:
        fan_mode = DeviceState.objects.get(key="modo_ventilador")
        is_auto = fan_mode.is_on
    except DeviceState.DoesNotExist:
        is_auto = False

    if is_auto:
        try:
            fan = DeviceState.objects.get(key="ventilador")
            
            turn_fan_on = fan.is_on
            if not fan.is_on and current_temp >= 31.0:
                turn_fan_on = True
            elif fan.is_on and current_temp <= 26.0:
                turn_fan_on = False
                
            nivel_deseado = 3 if turn_fan_on else 0
            current_speed = getattr(fan, "speed", 0) if fan.is_on else 0
            
            if fan.is_on != turn_fan_on or current_speed != nivel_deseado:
                toggle_device_state(fan, turn_fan_on, speed=nivel_deseado)
        except DeviceState.DoesNotExist:
            pass

    # Automatización de luces interiores basada en fotoresistencia (LDR / is_night) si está activo
    auto_theme_param = request.GET.get("auto_theme", "true").lower() == "true"
    if auto_theme_param:
        interior_lights = DeviceState.objects.filter(kind=DeviceState.LIGHT).exclude(key="luz_jardin")
        for light in interior_lights:
            if light.is_on != is_night:
                toggle_device_state(light, is_night)

    ecuador_time = datetime.utcnow() - timedelta(hours=5)
    return JsonResponse({
        "message": f"Clima sincronizado ({source_info}). Hora local: {ecuador_time.strftime('%H:%M')}, Temperatura: {current_temp}°C",
        "is_night": is_night,
        "temperature": current_temp
    })


@require_GET
def system_status(request):
    status = check_connection()
    return JsonResponse(status)

@require_GET
def sync_physical(request):
    ensure_default_devices()
    result = sync_physical_state()
    return JsonResponse(result)
