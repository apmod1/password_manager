from django.urls import path
from . import views
from django.shortcuts import render

def login_page(request):
    return render(request, 'password_manager/login.html')

app_name = "password_manager"
urlpatterns = [
    # Legacy registration endpoint
    path("create_user/", views.register, name="register"),
    
    # Two-step registration process
    path("initial-registration/", views.initial_registration, name="initial_registration"),
    path("verify-totp/", views.verify_totp, name="verify_totp"),
    path("complete-registration/", views.complete_registration, name="complete_registration"),
    
    # Two-step login process
    path("login/", login_page, name="login"),
    path("login-step1/", views.login_step1, name="login_step1"),
    path("login-step2/", views.login_step2, name="login_step2"),
    
    # Password vault operations
    path("vault/items/", views.user_data_list, name="user_data_list"),
    path("vault/items/create/", views.user_data_create, name="user_data_create"),
    path("vault/items/<uuid:item_id>/", views.user_data_detail, name="user_data_detail"),
]
