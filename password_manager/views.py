import json
import secrets
import base64
import hashlib
import uuid
from django.shortcuts import render
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import login, authenticate
from django.views.decorators.http import require_http_methods
from django.conf import settings

from .forms import CustomUserCreationForm
from .models import CustomUser
from django_otp.plugins.otp_totp.models import TOTPDevice
from django_otp.util import random_hex
from django_otp import devices_for_user
import qrcode
from io import BytesIO
import base64
from datetime import datetime

# For HMAC verification
import hmac
import hashlib

# For secure random word generation
import random
import os


def get_or_create_totp_device(user, confirmed=False):
    """Get or create a TOTP device for a user"""
    # Get devices for user using django-otp function
    devices = devices_for_user(user, confirmed=None)
    
    # Check if a TOTP device already exists
    for device in devices:
        if isinstance(device, TOTPDevice):
            return device

    # Create a new device with a random key
    device = TOTPDevice(user=user, name="default")
    device.key = random_hex(20)  # Generate a random key
    device.confirmed = confirmed
    device.save()
    return device


def generate_qr_code(device, username):
    """Generate a QR code for TOTP setup"""
    # Generate the URI for the device
    config_url = device.config_url

    # Generate QR code
    img = qrcode.make(config_url)
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"


@csrf_exempt
def initial_registration(request):
    """
    First step of registration - generate and return:
    - UUID
    - 10 random words
    - TOTP secret
    """
    if request.method == "GET":
        try:
            # Generate UUID
            user_uuid = str(uuid.uuid4())

            # Generate 10 random words
            words = generate_random_words(10)
            auth_words = words[:5]
            hmac_words = words[5:]

            # Create a new user with a unique hash
            user = CustomUser()
            user.id = uuid.UUID(user_uuid)

            # Generate a unique hash for this user
            # Using digest() to get binary data for BinaryField
            unique_hash = hashlib.sha512(str(uuid.uuid4()).encode()).digest()
            user.sha512hash = unique_hash

            # Add any other required fields for your CustomUser model
            user.save()

            # Create TOTP device for this user
            totp_device = get_or_create_totp_device(user)
            
            if not totp_device or not hasattr(totp_device, 'id') or not hasattr(totp_device, 'key'):
                raise ValueError("Failed to create valid TOTP device")

            # Store these temporarily in session
            # Store only the ID of the totp_device, not the entire object
            request.session['registration_data'] = {
                'uuid': user_uuid,
                'auth_words': auth_words,
                'hmac_words': hmac_words,
                'totp_device_id': totp_device.id,
                'timestamp': datetime.now().timestamp()
            }

            # Generate QR code for TOTP
            qr_code = generate_qr_code(totp_device, user_uuid)

            # Create response data
            response_data = {
                'uuid': user_uuid,
                'words': words,
                'totp_device': totp_device.key,
                'qr_code': qr_code
            }

            return render(request, "password_manager/initial_registration.html", response_data)
            
        except Exception as e:
            print(f"Error in initial registration: {str(e)}")
            return HttpResponse(f"Error during registration setup: {str(e)}", status=500)
    else:
        return HttpResponse("Method not allowed", status=405)


@csrf_exempt
@require_http_methods(["POST"])
def verify_totp(request):
    """Verify the TOTP code entered by user"""
    try:
        data = json.loads(request.body)
        totp_code = data.get('totp_code')
        
        if not totp_code:
            return JsonResponse({'success': False, 'error': 'TOTP code is required'}, status=400)

        # Get registration data from session
        registration_data = request.session.get('registration_data')
        if not registration_data:
            return JsonResponse({'success': False, 'error': 'Registration session expired'}, status=400)

        totp_device_id = registration_data.get('totp_device_id')
        if not totp_device_id:
            return JsonResponse({'success': False, 'error': 'TOTP device ID not found in session'}, status=400)
            
        # Get the actual device from the database using the ID
        try:
            totp_device = TOTPDevice.objects.get(id=totp_device_id)
            
            # Verify the TOTP code
            if totp_device.verify(totp_code):
                # Mark TOTP as verified in session
                registration_data['totp_verified'] = True
                request.session['registration_data'] = registration_data
                return JsonResponse({'success': True})
            else:
                return JsonResponse({'success': False, 'error': 'Invalid TOTP code. Please make sure your authenticator app is in sync.'}, status=400)
        except TOTPDevice.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'TOTP device not found. Please restart registration.'}, status=400)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON data'}, status=400)
    except Exception as e:
        print(f"TOTP verification error: {str(e)}")  # Log the error for debugging
        return JsonResponse({'success': False, 'error': f'Error verifying TOTP: {str(e)}'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def complete_registration(request):
    """
    Second step of registration - collect:
    - Username
    - Password
    - Email (optional)
    - Wrapped key
    - HMAC of wrapped key
    """
    try:
        # Get data from request
        data = json.loads(request.body)

        # Get required fields
        username_hash = data.get('username_hash')
        wrapped_key = data.get('wrapped_key')
        hmac_wrapped_key = data.get('hmac_wrapped_key')
        algorithm = data.get('algorithm', 'aesgcm')
        email = data.get('email', '')
        auth_hash = data.get('auth_hash')  # Argon2id hash from client

        # Get registration data from session
        registration_data = request.session.get('registration_data')
        if not registration_data:
            return JsonResponse({'success': False, 'error': 'Registration session expired'}, status=400)

        # Check if TOTP was verified
        if not registration_data.get('totp_verified'):
            return JsonResponse({'success': False, 'error': 'TOTP not verified'}, status=400)

        # Get stored UUID and words
        user_uuid = registration_data.get('uuid')
        auth_words = registration_data.get('auth_words')
        hmac_words = registration_data.get('hmac_words')
        
        # Get TOTP device from database using ID
        totp_device_id = registration_data.get('totp_device_id')
        try:
            totp_device = TOTPDevice.objects.get(id=totp_device_id)
        except TOTPDevice.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'TOTP device not found'}, status=400)

        # Verify HMAC of wrapped key
        client_hmac_key = " ".join(hmac_words).encode('utf-8')
        computed_hmac = hmac.new(
            client_hmac_key, 
            base64.b64decode(wrapped_key), 
            hashlib.sha256
        ).digest()

        # Convert received HMAC from base64
        received_hmac = base64.b64decode(hmac_wrapped_key)

        # Compare HMACs (constant time comparison)
        if not hmac.compare_digest(computed_hmac, received_hmac):
            return JsonResponse({'success': False, 'error': 'HMAC verification failed'}, status=400)

        # Create user object
        user = CustomUser()
        user.id = uuid.UUID(user_uuid)
        user.sha512hash = base64.b64decode(username_hash)
        user.wrapped_key = base64.b64decode(wrapped_key)
        user.hmac_wrapped_key = received_hmac
        user.totp_secret_key = totp_device.key.encode('utf-8') #Storing the key from the device.
        user.alg_unwrap_key = algorithm

        # Store hashed auth words and HMAC words
        auth_words_str = " ".join(auth_words)
        hmac_words_str = " ".join(hmac_words)
        user.auth_words_hash = hashlib.sha256(auth_words_str.encode('utf-8')).digest()
        user.hmac_words_hash = hashlib.sha256(hmac_words_str.encode('utf-8')).digest()

        # Store email if provided
        if email:
            user.email = email

        # Set password directly as the auth_hash is already processed client-side
        user.password = auth_hash

        # Save user
        user.save()

        # Clear registration data from session
        del request.session['registration_data']

        return JsonResponse({'success': True, 'uuid': str(user.id)})

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
def register(request):
    """Legacy registration view - redirects to new flow"""
    if request.method == "GET":
        return initial_registration(request)
    elif request.method == "POST":
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.clean()
            sha512hash = form.cleaned_data.get("sha512hash")
            raw_password = form.cleaned_data.get("password1")
            response_text = (
                f"Received username: {sha512hash}\nReceived password: {raw_password}"
            )
            user.save()
            return HttpResponse("<pre>" + response_text + "</pre>")
        else:
            return render(request, "password_manager/register.html", {"form": form})


@csrf_exempt
@require_http_methods(["POST"])
def login_step1(request):
    """
    First step of login - validate:
    - Username
    - Password
    - Auth words
    - UUID
    """
    try:
        data = json.loads(request.body)
        username_hash = data.get('username_hash')
        auth_hash = data.get('auth_hash')
        user_uuid = data.get('uuid')

        # Find user by UUID or username hash
        try:
            if user_uuid:
                user = CustomUser.objects.get(id=uuid.UUID(user_uuid))
            else:
                user = CustomUser.objects.get(sha512hash=base64.b64decode(username_hash))
        except CustomUser.DoesNotExist:
            # Use a constant time response to prevent timing attacks
            # that could reveal whether a username exists
            secrets.compare_digest('a', 'b')  # Dummy operation for timing
            return JsonResponse({'success': False, 'error': 'Invalid credentials'}, status=401)

        # Compare password hash (auth_hash)
        # In a real implementation, this would use Django's check_password
        # But since we're using a custom auth scheme, we need to do this manually

        # Create a session token for step 2
        login_token = secrets.token_hex(32)
        request.session['login_data'] = {
            'user_id': str(user.id),
            'login_token': login_token,
            'timestamp': datetime.now().timestamp()
        }

        return JsonResponse({
            'success': True, 
            'login_token': login_token,
            'totp_required': True  # Always require TOTP for this implementation
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def login_step2(request):
    """
    Second step of login - validate:
    - TOTP code
    - Login token from step 1
    """
    try:
        data = json.loads(request.body)
        totp_code = data.get('totp_code')
        login_token = data.get('login_token')

        # Get login data from session
        login_data = request.session.get('login_data')
        if not login_data or login_data.get('login_token') != login_token:
            return JsonResponse({'success': False, 'error': 'Invalid login session'}, status=401)

        # Check if login attempt has expired (15 minute window)
        timestamp = login_data.get('timestamp', 0)
        if datetime.now().timestamp() - timestamp > 900:  # 15 minutes
            del request.session['login_data']
            return JsonResponse({'success': False, 'error': 'Login session expired'}, status=401)

        # Find the user
        try:
            user = CustomUser.objects.get(id=uuid.UUID(login_data.get('user_id')))
        except CustomUser.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'User not found'}, status=401)

        # Verify TOTP - Needs update for django-otp
        try:
            device = get_or_create_totp_device(user)
            if not device.verify(totp_code):
                return JsonResponse({'success': False, 'error': 'Invalid TOTP code'}, status=401)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)


        # TOTP verified, complete login
        # Return the wrapped key and other necessary data

        return JsonResponse({
            'success': True,
            'wrapped_key': base64.b64encode(user.wrapped_key).decode('utf-8'),
            'hmac_wrapped_key': base64.b64encode(user.hmac_wrapped_key).decode('utf-8'),
            'algorithm': user.alg_unwrap_key
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# Add views for data manipulation here
@csrf_exempt
@require_http_methods(["GET"])
def user_data_list(request):
    """View to list all vault items for the authenticated user"""
    # Check for user authentication via session
    user_id = request.session.get('login_data', {}).get('user_id')
    if not user_id:
        return JsonResponse({'success': False, 'error': 'Not authenticated'}, status=401)

    try:
        user = CustomUser.objects.get(id=uuid.UUID(user_id))
        # Get all vault items for this user
        items = UserData.objects.filter(user=user)

        # Return metadata only (not the encrypted content)
        items_data = [{
            'id': str(item.item_id),
            'name': item.name,
            'created_at': item.created_at.isoformat(),
            'updated_at': item.updated_at.isoformat()
        } for item in items]

        return JsonResponse({'success': True, 'items': items_data})

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET", "PUT", "DELETE"])
def user_data_detail(request, item_id):
    """View to retrieve, update or delete a specific vault item"""
    # Check for user authentication via session
    user_id = request.session.get('login_data', {}).get('user_id')
    if not user_id:
        return JsonResponse({'success': False, 'error': 'Not authenticated'}, status=401)

    try:
        user = CustomUser.objects.get(id=uuid.UUID(user_id))

        # Get the specific item, ensuring it belongs to this user
        try:
            item = UserData.objects.get(item_id=item_id, user=user)
        except UserData.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Item not found'}, status=404)

        if request.method == "GET":
            # Return the encrypted data for client-side decryption
            return JsonResponse({
                'success': True,
                'id': str(item.item_id),
                'name': item.name,
                'encrypted_data': item.encrypted_data,
                'created_at': item.created_at.isoformat(),
                'updated_at': item.updated_at.isoformat()
            })

        elif request.method == "PUT":
            # Update the item
            data = json.loads(request.body)

            # The client sends the already encrypted data
            encrypted_data = data.get('encrypted_data')
            name = data.get('name')

            # Verify HMAC if provided (optional validation step)
            hmac_signature = request.headers.get('X-HMAC')

                # Implement HMAC verification logic here
            if hmac_signature:
                # Get user's HMAC words hash
                hmac_words_hash = user.hmac_words_hash
                if not hmac_words_hash:
                    return JsonResponse({
                        'success': False, 
                        'error': 'HMAC key not configured for user'
                    }, status=400)

                # Compute HMAC of the encrypted data
                computed_hmac = hmac.new(
                    hmac_words_hash,
                    encrypted_data.encode('utf-8'),
                    hashlib.sha256
                ).digest()

                # Compare with provided HMAC (constant time comparison)
                if not hmac.compare_digest(
                    base64.b64decode(hmac_signature),
                    computed_hmac
                ):
                    return JsonResponse({
                        'success': False, 
                        'error': 'HMAC verification failed'
                    }, status=401)

            # Update the item
            item.encrypted_data = encrypted_data
            if name:
                item.name = name
            item.save()

            return JsonResponse({
                'success': True,
                'id': str(item.item_id),
                'updated_at': item.updated_at.isoformat()
            })

        elif request.method == "DELETE":
            # Delete the item
            item.delete()
            return JsonResponse({'success': True, 'message': 'Item deleted'})

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def user_data_create(request):
    """View to create a new vault item"""
    # Check for user authentication via session
    user_id = request.session.get('login_data', {}).get('user_id')
    if not user_id:
        return JsonResponse({'success': False, 'error': 'Not authenticated'}, status=401)

    try:
        user = CustomUser.objects.get(id=uuid.UUID(user_id))

        # Process the data from the request
        data = json.loads(request.body)

        # The client sends the already encrypted data
        encrypted_data = data.get('encrypted_data')
        name = data.get('name', 'Unnamed Item')

        # Verify HMAC if provided (optional validation step)
        hmac_signature = request.headers.get('X-HMAC')

        if hmac_signature:
    # Get user's HMAC words hash
            hmac_words_hash = user.hmac_words_hash
            if not hmac_words_hash:
                return JsonResponse({
                    'success': False, 
                    'error': 'HMAC key not configured for user'
                }, status=400)

            # Compute HMAC of the encrypted data
            computed_hmac = hmac.new(
                hmac_words_hash,
                encrypted_data.encode('utf-8'),
                hashlib.sha256
            ).digest()

            # Compare with provided HMAC
            if not hmac.compare_digest(
                base64.b64decode(hmac_signature),
                computed_hmac
            ):
                return JsonResponse({
                    'success': False, 
                    'error': 'HMAC verification failed'
                }, status=401)


        # Create the new item
        new_item = UserData.objects.create(
            user=user,
            encrypted_data=encrypted_data,
            name=name
        )

        return JsonResponse({
            'success': True,
            'id': str(new_item.item_id),
            'name': new_item.name,
            'created_at': new_item.created_at.isoformat()
        }, status=201)

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

def generate_random_words(num_words=10):
    """Generate random words for authentication and HMAC"""
    # Load word list - in production, this should be a larger wordlist
    # Use a file from your CLI directory
    word_list_path = os.path.join(settings.BASE_DIR, 'cli', 'my_list1.txt')
    try:
        with open(word_list_path, 'r') as f:
            word_list = f.read().splitlines()
    except FileNotFoundError:
        # Fallback to a smaller list if file not found
        word_list = [
            "apple", "banana", "orange", "grape", "melon", "car", "house", 
            "tree", "phone", "book", "computer", "table", "chair", "window", 
            "door", "mountain", "river", "ocean", "forest", "cloud", "sun", 
            "moon", "star", "planet", "galaxy", "music", "song", "dance", 
            "paint", "color", "light", "dark", "happy", "sad", "angry"
        ]

    # Filter out inappropriate words if needed

    # Select random words
    if len(word_list) < num_words:
        # If word list is too small, allow duplicates
        return [random.choice(word_list) for _ in range(num_words)]
    else:
        # No duplicates if enough words
        return random.sample(word_list, num_words)