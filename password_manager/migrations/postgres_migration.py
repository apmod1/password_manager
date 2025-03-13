
import os
import django
import psycopg2
from django.db import connections
from django.conf import settings

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'security_tools.settings')
django.setup()

def migrate_to_postgres():
    """
    Migrate data from SQLite to PostgreSQL
    """
    # Get PostgreSQL connection details from settings
    postgres_settings = settings.DATABASES['postgres']
    
    # Connect to PostgreSQL
    conn = psycopg2.connect(
        host=postgres_settings['HOST'],
        database=postgres_settings['NAME'],
        user=postgres_settings['USER'],
        password=postgres_settings['PASSWORD'],
        port=postgres_settings['PORT']
    )
    
    # Create cursor
    cur = conn.cursor()
    
    # Migrate CustomUser table
    print("Migrating CustomUser table...")
    with connections['default'].cursor() as sqlite_cursor:
        sqlite_cursor.execute("SELECT * FROM password_manager_customuser")
        rows = sqlite_cursor.fetchall()
        
        for row in rows:
            # Insert into PostgreSQL (adjust field names as needed)
            cur.execute("""
                INSERT INTO password_manager_customuser 
                (id, sha512hash, wrapped_key, hmac_wrapped_key, totp_secret_key, 
                alg_unwrap_key, email, auth_words_hash, hmac_words_hash, 
                is_active, is_staff, date_joined, password) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, row)
    
    # Migrate UserData table
    print("Migrating UserData table...")
    with connections['default'].cursor() as sqlite_cursor:
        sqlite_cursor.execute("SELECT * FROM password_manager_userdata")
        rows = sqlite_cursor.fetchall()
        
        for row in rows:
            # Insert into PostgreSQL (adjust field names as needed)
            cur.execute("""
                INSERT INTO password_manager_userdata 
                (item_id, encrypted_data, name, created_at, updated_at, user_id) 
                VALUES (%s, %s, %s, %s, %s, %s)
            """, row)
    
    # Commit changes and close connection
    conn.commit()
    cur.close()
    conn.close()
    
    print("Migration completed successfully!")

if __name__ == '__main__':
    migrate_to_postgres()
