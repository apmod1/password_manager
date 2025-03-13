from django.contrib.auth.forms import UserCreationForm
from password_manager.models import CustomUser

# import hashlib
# import base64
# import os


class CustomUserCreationForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = CustomUser
        fields = ("sha512hash", "password1")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["sha512hash"].label = "Username"

    def clean(self):
        cleaned_data = super().clean()
        try:
            username = cleaned_data["sha512hash"]
            cleaned_data["sha512hash"] = bytes.fromhex(username)
        except ValueError as e:
            print(f"{e}")
        return cleaned_data
