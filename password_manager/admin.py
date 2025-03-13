
from django.contrib import admin
from .models import CustomUser, UserData, RememberedDevice

@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('id', 'email', 'is_staff', 'date_joined')
    search_fields = ('id', 'email')
    readonly_fields = ('id', 'date_joined')
    
@admin.register(UserData)
class UserDataAdmin(admin.ModelAdmin):
    list_display = ('user', 'id')
    search_fields = ('user__email', 'id')
    readonly_fields = ('id',)

@admin.register(RememberedDevice)
class RememberedDeviceAdmin(admin.ModelAdmin):
    list_display = ('user', 'id', 'created_at')
    search_fields = ('user__email', 'id')
    readonly_fields = ('id', 'created_at')
