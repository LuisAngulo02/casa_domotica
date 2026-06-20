from django.urls import path

from . import views


app_name = "dashboard"

urlpatterns = [
    path("", views.home, name="home"),
    path("api/devices/", views.device_list, name="device_list"),
    path("api/devices/<slug:device_key>/toggle/", views.toggle_device, name="toggle_device"),
    path("api/history/", views.history, name="history"),
]
