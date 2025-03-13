from django.contrib import admin
from .models import CustomUser, UserData, RememberedDevice

@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('id', 'email', 'is_staff', 'date_joined')
    search_fields = ('id', 'email')
    readonly_fields = ('id', 'date_joined')
    
@admin.register(UserData)
class UserDataAdmin(admin.ModelAdmi
