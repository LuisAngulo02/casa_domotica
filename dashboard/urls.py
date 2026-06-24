from django.urls import path

from . import views


app_name = "dashboard"

urlpatterns = [
    path("", views.home, name="home"),
    path("api/devices/", views.device_list, name="device_list"),
    path("api/devices/<slug:device_key>/toggle/", views.toggle_device, name="toggle_device"),
    path("api/history/", views.history, name="history"),
    path("api/temperature/", views.update_temperature, name="update_temperature"),
    path("api/sync-weather/", views.sync_weather, name="sync_weather"),
    path("api/system/status/", views.system_status, name="system_status"),
]
