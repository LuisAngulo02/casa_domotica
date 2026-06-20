from django.contrib import admin

from .models import DeviceState, EventLog


@admin.register(DeviceState)
class DeviceStateAdmin(admin.ModelAdmin):
    list_display = ("key", "label", "kind", "is_on", "updated_at")
    list_filter = ("kind", "is_on")
    search_fields = ("key", "label")


@admin.register(EventLog)
class EventLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "device_key", "action", "status", "message")
    list_filter = ("status", "action")
    search_fields = ("device_key", "message")
