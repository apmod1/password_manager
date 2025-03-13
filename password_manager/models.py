from django.db import models
import uuid
from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.auth.models import PermissionsMixin, UserManager
from django_otp.models import Device, ThrottlingMixin
import hashlib
import base64


class CustomUserManager(UserManager):
    def create_user(self, username=None, password=None, **extra_fields):
        if not username:
            raise ValueError("The username field must be set")
        if not password:
            raise ValueError("The password field must be set")

        user = self.model(sha512hash=self.normalize_username(username), **extra_fields)
        user.set_password(password)  # Use Django's password handling
        user.save(using=self._db)
        return user

    def normalize_username(self, username):
        norm_username = super().normalize_username(username)
        norm_username = hashlib.sha512(norm_username.encode()).digest()
        return norm_username

    def create_superuser(self, sha512hash, password, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(sha512hash, password, **extra_fields)


class CustomUser(AbstractBaseUser, PermissionsMixin):
    sha512hash = models.BinaryField(
        max_length=64, unique=True, primary_key=False, editable=True
    )
    wrapped_key = models.BinaryField(max_length=256)
    hmac_wrapped_key = models.BinaryField(max_length=256)
    id = models.UUIDField(
        primary_key=True, default=uuid.uuid4, editable=False, unique=True
    )
    alg_unwrap_key = models.CharField(
        choices=(("xchacha20", "XChaCha20-Poly1305"), ("aesgcm", "AES-GCM256")),
        default="aesgcm",
        max_length=32,
    )
    # Add email field (optional) for UUID recovery
    email = models.EmailField(blank=True, null=True)
    
    # Add fields for storing the authentication words and HMAC words
    # These are stored in hashed form for security
    auth_words_hash = models.BinaryField(max_length=64, blank=True, null=True)
    hmac_words_hash = models.BinaryField(max_length=64, blank=True, null=True)
    
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "sha512hash"
    REQUIRED_FIELDS = ["wrapped_key", "alg_unwrap_key", "hmac_wrapped_key"]

    objects = CustomUserManager()

    groups = models.ManyToManyField(
        "auth.Group",
        blank=True,
        related_name="custom_users_groups",
        verbose_name="groups",
        help_text="The groups this user belongs to."
        " A user will get all permissions granted to each of their groups.",
        related_query_name="custom_user",
    )
    user_permissions = models.ManyToManyField(
        "auth.Permission",
        blank=True,
        related_name="custom_users_permissions",
        verbose_name="user permissions",
        help_text="Specific permissions for this user.",
        related_query_name="custom_user",
    )

    def __str__(self):
        return str({
            "username": base64.b64encode(self.sha512hash).decode("utf-8"),
            "id": self.id
        })


# Using django-otp models directly instead of custom OTP device


class UserData(models.Model):
    """
    Model to store encrypted user data (password vault items)
    Each field is encrypted separately as per the specification
    """
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='vault_items')
    item_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Encrypted data JSON structure (Base64 encoded string containing IV + ciphertext)
    encrypted_data = models.TextField()
    
    # Metadata
    name = models.CharField(max_length=100)  # Optional plaintext identifier (could be encrypted too)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-updated_at']
        verbose_name = "User Data Item"
        verbose_name_plural = "User Data Items"
    
    def __str__(self):
        return f"Item {self.name} for user {self.user.id}"


class RememberedDevice(models.Model):
    """
    Model to store information about remembered devices
    """
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='remembered_devices')
    device_uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    
    # Store hashed identifier of the device
    device_identifier = models.BinaryField(max_length=64)
    
    # Encrypted authentication data for auto-login
    # (encrypted with a device-specific key)
    encrypted_auth_data = models.BinaryField(max_length=512)
    
    last_used = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('user', 'device_identifier')
